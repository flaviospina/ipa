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
require_once __DIR__ . '/../src/Ipa.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

const VERSAO_API = 1;

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
    $ipHash = Ipa::ipHash();
    if (Ipa::estourouLimite($ipHash)) {
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
        if ($org === '') {
            responder(false, 'missing_fields');
        }
        // AUTO-CADASTRO: nenhuma resposta é recusada por falta de empresa.
        // A organização digitada vira uma empresa nova, marcada como criada
        // automaticamente — o administrador geral pode renomear no painel e
        // criar o acesso dela quando quiser. O caminho preferencial continua
        // sendo o link com ?empresa=SLUG, que evita variações de digitação.
        $slugNovo = slugificar($org);
        if ($slugNovo === '') {
            $slugNovo = 'organizacao';
        }
        $s = $slugNovo;
        $n = 1;
        while (Db::valor('SELECT id FROM empresas WHERE slug = ?', [$s])) {
            $n++;
            $s = $slugNovo . '-' . $n;
        }
        $novoId = Db::inserir(
            'INSERT INTO empresas (nome, slug, observacoes) VALUES (?, ?, ?)',
            [$org, $s, 'Criada automaticamente pelo questionário a partir da organização digitada. Revise o nome e crie o acesso do administrador quando for o caso.']
        );
        Audit::registrar(null, $novoId, 'empresa_autocriada', 'empresas', $novoId, ['texto' => $org]);
        $empresa = ['id' => $novoId, 'nome' => $org];
    }

    // validação e cálculo no servidor — fonte única em src/Ipa.php
    $calc = Ipa::avaliar($data['respostas'] ?? null);
    if (isset($calc['erro'])) {
        responder(false, $calc['erro']);
    }
    $scores = $calc['scores'];
    $inst   = $calc['instrumento'];

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
                $scores['A'], $scores['C'], $scores['P'], $scores['E'], $calc['total'],
                $calc['pred'], $calc['regra'], $calc['difs'][0], $calc['difs'][1], $calc['difs'][2],
                $ipHash, mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            ]
        );

        Ipa::gravarRespostas($avalId, $calc['linhas']);

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
        ['uuid' => $uuid, 'predominante' => $calc['pred']] + ($diverge ? ['divergencia_cliente' => true] : []));

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
