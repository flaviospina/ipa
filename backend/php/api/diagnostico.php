<?php
/**
 * API pública de recebimento do diagnóstico IPA — Fase 3.
 *
 * Substitui gradualmente o Apps Script: o questionário envia para cá E para
 * a planilha durante a transição. Espelha as mesmas defesas do backend
 * antigo (honeypot, schema, permutação 0..11 por quadro, rate limit) e
 * acrescenta o que a planilha não tinha:
 *
 *  - vínculo com a EMPRESA cadastrada (via ?empresa=slug no link do
 *    questionário, com fallback para o texto digitado);
 *  - scores recalculados NO SERVIDOR a partir da tabela `palavras`
 *    (o estilo é dado, não posição) — o cliente não dita o resultado;
 *  - idempotência por uuid: reenvio da fila local não duplica nada;
 *  - relatório ligado à avaliação por chave estrangeira.
 *
 * Endpoints:
 *   GET  ?action=empresa&slug=x  → nome da empresa (prefixo do formulário)
 *   POST {action:'relatorio'}    → anexa o HTML do relatório à avaliação
 *   POST (padrão)                → grava o diagnóstico completo
 */
declare(strict_types=1);

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/Audit.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

const VERSAO_API = 1;
const LIMIAR_FLEXIBILIDADE = 15;   // mesmo valor de ACP.CRITERIOS.LIMIAR no engine.js

function responder(bool $ok, string $code, array $extra = []): never
{
    echo json_encode(['ok' => $ok, 'code' => $code] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

function limpar(mixed $v, int $max = 200): string
{
    return mb_substr(trim((string)$v), 0, $max);
}

function slugificar(string $t): string
{
    $a = @iconv('UTF-8', 'ASCII//TRANSLIT', $t);
    if ($a === false) {
        $a = $t;
    }
    return trim(strtolower((string)preg_replace('/[^a-zA-Z0-9]+/', '-', $a)), '-');
}

/* ============================================================ despacho */
try {
    $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($metodo === 'GET') {
        if (($_GET['action'] ?? '') === 'empresa') {
            $slug = limpar($_GET['slug'] ?? '', 60);
            $emp  = $slug === '' ? null
                : Db::um("SELECT nome FROM empresas WHERE slug = ? AND status = 'ativa'", [$slug]);
            if ($emp) {
                responder(true, 'empresa', ['nome' => $emp['nome']]);
            }
            responder(false, 'empresa_nao_encontrada');
        }
        // abrir a URL no navegador confirma qual versão está no ar
        responder(false, 'method_not_allowed', ['v' => VERSAO_API]);
    }

    if ($metodo !== 'POST') {
        responder(false, 'method_not_allowed', ['v' => VERSAO_API]);
    }

    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) {
        responder(false, 'json_invalido');
    }
    if (!empty($data['website'])) {              // honeypot: bots preenchem
        responder(false, 'rejected');
    }
    if ((int)($data['schema'] ?? 0) !== 2) {
        responder(false, 'bad_schema');
    }

    if (($data['action'] ?? '') === 'relatorio') {
        receberRelatorio($data);
    }
    receberDiagnostico($data);
} catch (Throwable $e) {
    error_log('[vipedia api] ' . $e->getMessage());
    responder(false, 'error');
}

/* ==================================================== diagnóstico (auto) */
function receberDiagnostico(array $data): never
{
    $nome    = limpar($data['nome'] ?? '');
    $org     = limpar($data['organizacao'] ?? '');
    $funcao  = limpar($data['funcao'] ?? '');
    $uuid    = limpar($data['id'] ?? '', 36);
    $consent = limpar($data['consentimento'] ?? '', 40);

    if ($nome === '' || $funcao === '') {
        responder(false, 'missing_fields');
    }
    if ($consent === '') {
        responder(false, 'missing_consent');
    }
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9\-]{7,35}$/', $uuid)) {
        responder(false, 'bad_id');
    }

    // idempotência: a fila local reenvia após falha de rede; se a primeira
    // tentativa gravou e a resposta se perdeu, o reenvio responde sucesso
    if (Db::valor('SELECT id FROM avaliacoes WHERE uuid = ?', [$uuid])) {
        responder(true, 'saved', ['dup' => true]);
    }

    // rate limit por origem (hash do IP — minimização LGPD)
    $sal    = (string)Db::opcao('app.sal_ip', 'vipedia');
    $ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . $sal);
    $limite = (int)Db::opcao('api.max_por_minuto', 10);
    $recentes = (int)Db::valor(
        'SELECT COUNT(*) FROM avaliacoes WHERE ip_hash = ? AND iniciada_em > DATE_SUB(NOW(), INTERVAL 1 MINUTE)',
        [$ipHash]
    );
    if ($recentes >= $limite) {
        responder(false, 'rate_limited');
    }

    // empresa: primeiro o slug vindo do link; depois o texto digitado
    $empresa = null;
    $slug = limpar($data['empresa'] ?? '', 60);
    if ($slug !== '') {
        $empresa = Db::um("SELECT id, nome FROM empresas WHERE slug = ? AND status = 'ativa'", [$slug]);
    }
    if (!$empresa && $org !== '') {
        $empresa = Db::um(
            "SELECT id, nome FROM empresas WHERE status = 'ativa' AND (slug = ? OR LOWER(nome) = LOWER(?))",
            [slugificar($org), $org]
        );
    }
    if (!$empresa) {
        // não é retryável: reenviar o mesmo texto daria o mesmo resultado.
        // A planilha (envio paralelo) segura o registro até a empresa existir.
        responder(false, 'empresa_nao_identificada');
    }

    // instrumento vigente e suas palavras — o estilo vem do banco
    $inst = Db::um('SELECT * FROM instrumentos WHERE ativo = 1 ORDER BY versao DESC LIMIT 1');
    if (!$inst) {
        responder(false, 'instrumento_ausente');
    }
    $palavras = Db::todos(
        'SELECT id, quadro, codigo, estilo FROM palavras WHERE instrumento_id = ? ORDER BY quadro, posicao',
        [(int)$inst['id']]
    );

    $respostas = is_array($data['respostas'] ?? null) ? $data['respostas'] : [];
    $porQuadro = [];
    foreach ($palavras as $p) {
        $porQuadro[(int)$p['quadro']][] = $p;
    }

    // validação estrita: permutação completa 0..peso_max em cada quadro
    $scores = ['A' => 0, 'C' => 0, 'P' => 0, 'E' => 0];
    $linhas = [];
    foreach ($porQuadro as $q => $lista) {
        $pesos = [];
        foreach ($lista as $p) {
            $v = $respostas[$p['codigo']] ?? null;
            if (!is_numeric($v) || (string)(int)$v !== (string)$v) {
                responder(false, 'invalid_weights_q' . $q);
            }
            $v = (int)$v;
            if ($v < 0 || $v > (int)$inst['peso_max']) {
                responder(false, 'invalid_weights_q' . $q);
            }
            $pesos[] = $v;
            $scores[$p['estilo']] += $v;
            $linhas[] = [(int)$p['id'], $q, $v];
        }
        if (count($pesos) !== (int)$inst['qtd_palavras_quadro']) {
            responder(false, 'invalid_weights_q' . $q);
        }
        if (count(array_unique($pesos)) !== count($pesos)) {
            responder(false, 'repeated_weights_q' . $q);
        }
        if (array_sum($pesos) !== 66) {
            responder(false, 'bad_sum_q' . $q);
        }
    }
    $total = array_sum($scores);
    if ($total !== (int)$inst['total_esperado']) {
        responder(false, 'bad_total');
    }

    // ranking e regra de flexibilidade — mesma lógica do engine.js.
    // Desempate do engine: ordem alfabética do nome curto (Atenção,
    // Comunicação, Equilibrado, Procedimento) = ordem ASCII de A, C, E, P.
    $chaves = ['A', 'C', 'E', 'P'];
    usort($chaves, fn($x, $y) => ($scores[$y] <=> $scores[$x]) ?: strcmp($x, $y));
    $difs = [
        $scores[$chaves[0]] - $scores[$chaves[1]],
        $scores[$chaves[1]] - $scores[$chaves[2]],
        $scores[$chaves[2]] - $scores[$chaves[3]],
    ];
    if ($chaves[0] === 'E') {
        $regra = 'EQUILIBRADO_MODELO';
    } elseif (max($difs) < LIMIAR_FLEXIBILIDADE) {
        $regra = 'EQUILIBRADO_NATURAL';
    } elseif ($difs[0] >= LIMIAR_FLEXIBILIDADE) {
        $regra = 'FORTE_APEGO';
    } else {
        $regra = 'FLEXIVEL';
    }

    // sanidade: se o cliente mandou scores, divergência vira marca de auditoria
    $cli = is_array($data['scores'] ?? null) ? $data['scores'] : null;
    $diverge = $cli !== null && (
        (int)($cli['A'] ?? -1) !== $scores['A'] || (int)($cli['C'] ?? -1) !== $scores['C'] ||
        (int)($cli['P'] ?? -1) !== $scores['P'] || (int)($cli['E'] ?? -1) !== $scores['E']
    );

    $pdo = Db::conn();
    $pdo->beginTransaction();
    try {
        // participante: reaproveita pelo nome dentro da empresa (série histórica)
        $part = Db::um(
            'SELECT id, funcao FROM participantes WHERE empresa_id = ? AND LOWER(nome) = LOWER(?) LIMIT 1',
            [(int)$empresa['id'], $nome]
        );
        if ($part) {
            $partId = (int)$part['id'];
            if ($funcao !== '' && $funcao !== (string)$part['funcao']) {
                Db::q('UPDATE participantes SET funcao = ? WHERE id = ?', [$funcao, $partId]);
            }
        } else {
            $partId = Db::inserir(
                'INSERT INTO participantes (empresa_id, nome, funcao) VALUES (?, ?, ?)',
                [(int)$empresa['id'], $nome, $funcao]
            );
        }

        $avalId = Db::inserir(
            "INSERT INTO avaliacoes
                    (uuid, empresa_id, participante_id, instrumento_id, tipo, status,
                     score_a, score_c, score_p, score_e, total,
                     estilo_predominante, regra_flexibilidade, dif_1, dif_2, dif_3,
                     concluida_em, ip_hash, user_agent)
             VALUES (?, ?, ?, ?, 'auto', 'concluida', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)",
            [
                $uuid, (int)$empresa['id'], $partId, (int)$inst['id'],
                $scores['A'], $scores['C'], $scores['P'], $scores['E'], $total,
                $chaves[0], $regra, $difs[0], $difs[1], $difs[2],
                $ipHash, mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            ]
        );

        $st = $pdo->prepare('INSERT INTO avaliacao_respostas (avaliacao_id, palavra_id, quadro, peso) VALUES (?, ?, ?, ?)');
        foreach ($linhas as $l) {
            $st->execute([$avalId, $l[0], $l[1], $l[2]]);
        }

        $aceite = date('Y-m-d H:i:s', strtotime($consent) ?: time());
        Db::q(
            'INSERT INTO consentimentos (participante_id, avaliacao_id, texto_versao, aceito_em, ip_hash) VALUES (?, ?, ?, ?, ?)',
            [$partId, $avalId, 'v1', $aceite, $ipHash]
        );

        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        // corrida entre dois reenvios simultâneos do mesmo uuid: o segundo
        // esbarra no UNIQUE — para o cliente, é o mesmo sucesso
        $ehDuplicidade = $ex instanceof PDOException
            && $ex->getCode() === '23000'
            && Db::valor('SELECT id FROM avaliacoes WHERE uuid = ?', [$uuid]);
        if ($ehDuplicidade) {
            responder(true, 'saved', ['dup' => true]);
        }
        throw $ex;
    }

    Audit::registrar(null, (int)$empresa['id'], 'avaliacao_recebida', 'avaliacoes', $avalId,
        ['uuid' => $uuid, 'predominante' => $chaves[0]] + ($diverge ? ['divergencia_cliente' => true] : []));

    responder(true, 'saved');
}

/* ============================================== relatório (passo 2 do envio) */
function receberRelatorio(array $data): never
{
    $uuid = limpar($data['id'] ?? '', 36);
    $html = (string)($data['relatorio'] ?? '');
    if ($uuid === '') {
        responder(false, 'missing_id');
    }
    if ($html === '' || strlen($html) > 800000) {
        responder(false, 'relatorio_invalido');
    }

    $aval = Db::um('SELECT id, empresa_id FROM avaliacoes WHERE uuid = ?', [$uuid]);
    if (!$aval) {
        // retryável de propósito: o diagnóstico pode estar na fila local e
        // chegar depois — o reenvio automático anexa o relatório então
        responder(false, 'avaliacao_nao_encontrada');
    }

    $rel = Db::um('SELECT id FROM relatorios WHERE avaliacao_id = ?', [(int)$aval['id']]);
    if ($rel) {
        Db::q('UPDATE relatorios SET html = ?, gerado_em = NOW() WHERE id = ?', [$html, (int)$rel['id']]);
    } else {
        Db::inserir("INSERT INTO relatorios (avaliacao_id, tipo, html) VALUES (?, 'individual', ?)", [(int)$aval['id'], $html]);
    }
    Audit::registrar(null, (int)$aval['empresa_id'], 'relatorio_recebido', 'relatorios', (int)$aval['id'], ['uuid' => $uuid]);
    responder(true, 'archived');
}
