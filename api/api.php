<?php
/* ============================================================
   IPA — API MySQL (substitui o Google Apps Script)
   Hospedar na MESMA hospedagem do site (ex.: /vipedia/.../api/),
   assim não há CORS, não há implantação, não há URL externa.

   POST (JSON):
     (sem action)        -> registra um diagnóstico IPA
     action=relatorio    -> arquiva o HTML do relatório (por cliente_id)
     action=360          -> registra uma avaliação externa IPA 360°
   GET:
     action=list&key=      -> lista diagnósticos (Painel)
     action=list360&key=   -> lista avaliações 360° (Painel)
     action=relatorio&token= -> devolve o HTML do relatório arquivado
     (sem action)          -> {"ok":false,"code":"method_not_allowed","v":4}
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/config.php';

const VERSAO = 4;
const RATE_LIMIT_PER_MIN = 10;
const MAX_RELATORIO_BYTES = 900000;

const EXPECTED = [
    1 => ['Q1_ABERTO','Q1_ACOLHEDOR','Q1_ATENCIOSO','Q1_CLARO','Q1_EXPLICITO','Q1_ENFATICO_C','Q1_CONCENTRADO','Q1_FORMAL','Q1_IMPESSOAL','Q1_FLEXIVEL','Q1_INTERESSADO','Q1_CORDIAL_E'],
    2 => ['Q2_COMPREENSIVO','Q2_CUIDADOSO','Q2_RESPEITOSO','Q2_DESCRITIVO','Q2_INTERATIVO','Q2_OUVINTE','Q2_DISTANTE','Q2_EFICIENTE','Q2_OBJETIVO','Q2_RAPIDO_E','Q2_PRECISO','Q2_SOLICITO'],
    3 => ['Q3_AUTENTICO','Q3_CORDIAL_A','Q3_EMPATICO','Q3_ACESSIVEL','Q3_ELOQUENTE','Q3_ESPONTANEO','Q3_DIRETO','Q3_PROTOCOLAR','Q3_RAPIDO_P','Q3_CONSISTENTE','Q3_PRESTATIVO','Q3_ENFATICO_E'],
];

function out(array $o): void {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($o, JSON_UNESCAPED_UNICODE);
    exit;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = defined('DB_DSN') ? DB_DSN : ('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4');
        $pdo = new PDO($dsn, DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    }
    return $pdo;
}

function limpar($v): string {
    $v = preg_replace('/[=+@\t\r\n]/u', ' ', (string)$v);
    return mb_substr(trim($v), 0, 200);
}

/* permutação completa 0..11 em cada quadro (soma 66) */
function validar_respostas($respostas): ?string {
    if (!is_array($respostas)) return 'invalid_payload';
    foreach (EXPECTED as $q => $ids) {
        $pesos = [];
        foreach ($ids as $id) {
            if (!isset($respostas[$id]) || !is_numeric($respostas[$id])) return 'invalid_weights_q' . $q;
            $p = (int)$respostas[$id];
            if ($p < 0 || $p > 11) return 'invalid_weights_q' . $q;
            $pesos[] = $p;
        }
        if (count(array_unique($pesos)) !== 12) return 'repeated_weights_q' . $q;
        if (array_sum($pesos) !== 66) return 'bad_sum_q' . $q;
    }
    return null;
}

function calcular_scores(array $respostas): array {
    $s = ['A' => 0, 'C' => 0, 'P' => 0, 'E' => 0];
    foreach (EXPECTED as $ids) {
        foreach ($ids as $i => $id) {
            $st = $i < 3 ? 'A' : ($i < 6 ? 'C' : ($i < 9 ? 'P' : 'E'));
            $s[$st] += (int)$respostas[$id];
        }
    }
    return $s;
}

function classificar(array $s): array {
    arsort($s);
    $ordem = array_keys($s);
    $vals = array_values($s);
    $difs = [$vals[0] - $vals[1], $vals[1] - $vals[2], $vals[2] - $vals[3]];
    $nomes = ['A' => 'Atenção', 'C' => 'Comunicação', 'P' => 'Procedimento', 'E' => 'Equilibrado'];
    if ($ordem[0] === 'E') $regra = 'EQUILIBRADO_MODELO';
    elseif ($difs[0] < 15 && $difs[1] < 15 && $difs[2] < 15) $regra = 'EQUILIBRADO_NATURAL';
    elseif ($difs[0] >= 15) $regra = 'FORTE_APEGO';
    else $regra = 'FLEXIVEL';
    return [$nomes[$ordem[0]], $regra];
}

function rate_limited(string $ip): bool {
    try {
        $st = db()->prepare(
            'SELECT (SELECT COUNT(*) FROM ipa_respostas WHERE ip = ? AND criado_em > NOW() - INTERVAL 1 MINUTE)
                  + (SELECT COUNT(*) FROM ipa_360 WHERE ip = ? AND criado_em > NOW() - INTERVAL 1 MINUTE) AS n');
        $st->execute([$ip, $ip]);
        return ((int)$st->fetchColumn()) >= RATE_LIMIT_PER_MIN;
    } catch (Throwable $e) {
        return false; // se o banco não suportar a consulta, não bloqueia o envio
    }
}

/* ---------- IA opcional (Gemini) — nunca bloqueia o diagnóstico ---------- */
function gerar_analise_ia(array $d, array $respostas, array $scores): ?array {
    if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') return null;
    try {
        $nomes = ['A' => 'Centrado na Atenção', 'C' => 'Centrado na Comunicação', 'P' => 'Centrado no Procedimento', 'E' => 'Equilibrado'];
        $ord = $scores; arsort($ord);
        $vals = array_values($ord);
        $difs = [$vals[0] - $vals[1], $vals[1] - $vals[2], $vals[2] - $vals[3]];
        $listaScores = [];
        foreach ($ord as $k => $v) $listaScores[] = $nomes[$k] . ' = ' . $v;

        $palavras = [];
        foreach (EXPECTED as $q => $ids) {
            foreach ($ids as $i => $id) {
                $st = $i < 3 ? 'Atenção' : ($i < 6 ? 'Comunicação' : ($i < 9 ? 'Procedimento' : 'Equilibrado'));
                $mom = $q === 1 ? 'Início' : ($q === 2 ? 'Durante' : 'Término');
                $palavras[] = ['p' => implode(' ', array_slice(explode('_', $id), 1)), 'st' => $st, 'm' => $mom, 'n' => (int)$respostas[$id]];
            }
        }
        $fmt = fn($x) => $x['p'] . ' (' . $x['st'] . ', ' . $x['m'] . ', nota ' . $x['n'] . ')';
        $altas = implode('; ', array_map($fmt, array_filter($palavras, fn($x) => $x['n'] >= 9))) ?: 'nenhuma';
        $baixas = implode('; ', array_map($fmt, array_filter($palavras, fn($x) => $x['n'] <= 2))) ?: 'nenhuma';

        $prompt =
            'Você é um Consultor Sênior de Desenvolvimento Humano, especialista em atendimento ao cliente e mestre na Abordagem ACP (Atenção, Comunicação e Procedimento — metodologia Zuvela). ' .
            'Premissas: Atenção atende à necessidade de AUTOESTIMA do cliente; Comunicação, à de SEGURANÇA; Procedimento, à de TRATAMENTO JUSTO. Momentos: Início (rapport), Durante (execução técnica com escuta ativa) e Término (clareza e polidez). O Estilo Equilibrado é a referência; o caminho é a versatilidade (flexibilidade + adaptação). ' .
            'LÓGICA DE DESENVOLVIMENTO (Campo de Forças de Kurt Lewin): notas 9-11 são práticas supervalorizadas cuja intensidade deve ser MODERADA quando a situação pedir outra variável; notas 0-2 são práticas negligenciadas que devem ser FORTALECIDAS até a faixa de equilíbrio (4-6). Nunca recomende "praticar mais" uma palavra cujo excesso seria nocivo — recomende buscar o equilíbrio, reduzindo forças restritivas e ativando forças impulsoras. ' .
            'REGRAS: tom encorajador e técnico; notas baixas são "pontos a desenvolver", nunca falhas; não misture conceitos dos estilos; português do Brasil, dirigindo-se ao profissional como "você". ' .
            'DADOS: Nome: ' . limpar($d['nome']) . '. Função: ' . limpar($d['funcao']) . '. Organização: ' . limpar($d['organizacao']) . '. ' .
            'Pontuações (total 198): ' . implode('; ', $listaScores) . '. Diferenças consecutivas: ' . implode(', ', $difs) . '. ' .
            'Notas altas (9-11): ' . $altas . '. Notas baixas (0-2): ' . $baixas . '. ' .
            'Gere um JSON com EXATAMENTE estas chaves (texto corrido, parágrafos separados por \n\n, sem markdown): ' .
            '"interpretacao" (dinâmica entre estilo predominante e secundário e impacto do critério de flexibilidade no dia a dia, 3 parágrafos), ' .
            '"momentos" (conduta provável no Início, Durante e Término com base nas notas, 3 parágrafos), ' .
            '"talentos" (como as notas altas se manifestam como forças observáveis — e onde o excesso delas pode atrapalhar, 2 parágrafos), ' .
            '"desenvolvimento" (o que as notas baixas revelam, ligando cada palavra à necessidade do cliente, 2 parágrafos), ' .
            '"recomendacoes" (3 a 5 ações práticas usando a lógica do equilíbrio/Campo de Forças: o que moderar e o que fortalecer, um parágrafo por ação), ' .
            '"conclusao" (síntese motivadora, 1 parágrafo).';

        $body = json_encode([
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => ['temperature' => 0.7, 'maxOutputTokens' => 4096, 'responseMimeType' => 'application/json'],
        ], JSON_UNESCAPED_UNICODE);

        $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' . GEMINI_API_KEY);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 40,
        ]);
        $res = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($res === false || $http !== 200) return null;
        $j = json_decode($res, true);
        $texto = $j['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (!$texto) return null;
        $ia = json_decode($texto, true);
        if (!is_array($ia)) return null;
        $seguro = [];
        foreach (['interpretacao', 'momentos', 'talentos', 'desenvolvimento', 'recomendacoes', 'conclusao'] as $k) {
            if (isset($ia[$k]) && is_string($ia[$k]) && trim($ia[$k]) !== '') $seguro[$k] = trim($ia[$k]);
        }
        return $seguro ?: null;
    } catch (Throwable $e) {
        return null;
    }
}

/* ============================ ROTEAMENTO ============================ */
try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? '';

        if ($action === 'relatorio') {
            $token = preg_replace('/[^a-f0-9]/', '', (string)($_GET['token'] ?? ''));
            if (strlen($token) !== 32) out(['ok' => false, 'code' => 'bad_token']);
            $st = db()->prepare('SELECT nome, relatorio FROM ipa_respostas WHERE token = ? LIMIT 1');
            $st->execute([$token]);
            $row = $st->fetch();
            if (!$row || !$row['relatorio']) out(['ok' => false, 'code' => 'not_found']);
            header('Content-Type: text/html; charset=utf-8');
            header('X-Robots-Tag: noindex, nofollow');
            echo $row['relatorio'];
            exit;
        }

        if ($action === 'list' || $action === 'list360') {
            if (($_GET['key'] ?? '') !== PANEL_KEY || PANEL_KEY === '' || strpos(PANEL_KEY, 'TROQUE') === 0) {
                out(['ok' => false, 'code' => 'method_not_allowed', 'v' => VERSAO]);
            }
            if ($action === 'list') {
                $rows = db()->query(
                    "SELECT criado_em AS data, organizacao AS org, nome, funcao,
                            score_a AS A, score_c AS C, score_p AS P, score_e AS E,
                            token, (relatorio IS NOT NULL AND relatorio <> '') AS tem_rel
                     FROM ipa_respostas ORDER BY criado_em")->fetchAll();
                foreach ($rows as &$r) {
                    $r['link'] = $r['tem_rel'] ? ('../api/api.php?action=relatorio&token=' . $r['token']) : '';
                    unset($r['token'], $r['tem_rel']);
                }
                unset($r);
            } else {
                $rows = db()->query(
                    "SELECT criado_em AS data, avaliado, organizacao AS org, relacao,
                            score_a AS A, score_c AS C, score_p AS P, score_e AS E
                     FROM ipa_360 ORDER BY criado_em")->fetchAll();
            }
            foreach ($rows as &$r) { $r['A'] = (int)$r['A']; $r['C'] = (int)$r['C']; $r['P'] = (int)$r['P']; $r['E'] = (int)$r['E']; }
            out(['ok' => true, 'rows' => $rows]);
        }

        out(['ok' => false, 'code' => 'method_not_allowed', 'v' => VERSAO]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['ok' => false, 'code' => 'method_not_allowed', 'v' => VERSAO]);

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) out(['ok' => false, 'code' => 'invalid_json']);
    if (!empty($data['website'])) out(['ok' => false, 'code' => 'rejected']);          // honeypot
    if ((int)($data['schema'] ?? 0) !== 2) out(['ok' => false, 'code' => 'bad_schema']);

    $action = (string)($data['action'] ?? '');

    /* ----- arquivamento do relatório (passo 2 do fluxo) ----- */
    if ($action === 'relatorio') {
        $cid = limpar($data['id'] ?? '');
        $html = (string)($data['relatorio'] ?? '');
        if ($cid === '' || $html === '') out(['ok' => false, 'code' => 'missing_fields']);
        if (strlen($html) > MAX_RELATORIO_BYTES) out(['ok' => false, 'code' => 'too_large']);
        $st = db()->prepare('UPDATE ipa_respostas SET relatorio = ? WHERE cliente_id = ? LIMIT 1');
        $st->execute([$html, $cid]);
        out(['ok' => $st->rowCount() > 0, 'code' => $st->rowCount() > 0 ? 'archived' : 'not_found']);
    }

    if (rate_limited($ip)) out(['ok' => false, 'code' => 'rate_limited']);

    /* ----- avaliação externa IPA 360° (anônima) ----- */
    if ($action === '360') {
        $avaliado = limpar($data['avaliado'] ?? '');
        $org = limpar($data['organizacao'] ?? '');
        $relacao = limpar($data['relacao'] ?? '');
        if ($avaliado === '' || $org === '' || $relacao === '') out(['ok' => false, 'code' => 'missing_fields']);
        $erro = validar_respostas($data['respostas'] ?? null);
        if ($erro) out(['ok' => false, 'code' => $erro]);
        $s = calcular_scores($data['respostas']);
        $st = db()->prepare(
            'INSERT INTO ipa_360 (avaliado, organizacao, relacao, respostas, score_a, score_c, score_p, score_e, total, ip)
             VALUES (?,?,?,?,?,?,?,?,?,?)');
        $st->execute([$avaliado, $org, $relacao, json_encode($data['respostas']),
                      $s['A'], $s['C'], $s['P'], $s['E'], array_sum($s), $ip]);
        out(['ok' => true, 'code' => 'saved_360']);
    }

    /* ----- diagnóstico IPA (autoavaliação) ----- */
    $nome = limpar($data['nome'] ?? '');
    $org = limpar($data['organizacao'] ?? '');
    $funcao = limpar($data['funcao'] ?? '');
    $cid = limpar($data['id'] ?? '');
    if ($nome === '' || $org === '' || $funcao === '' || $cid === '') out(['ok' => false, 'code' => 'missing_fields']);
    if (empty($data['consentimento'])) out(['ok' => false, 'code' => 'missing_consent']);
    $erro = validar_respostas($data['respostas'] ?? null);
    if ($erro) out(['ok' => false, 'code' => $erro]);

    $s = calcular_scores($data['respostas']);
    [$predominante, $regra] = classificar($s);
    $token = bin2hex(random_bytes(16));

    $st = db()->prepare(
        'INSERT INTO ipa_respostas (cliente_id, token, organizacao, nome, funcao, consentimento, respostas,
                                    score_a, score_c, score_p, score_e, total, predominante, regra, ip)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$cid, $token, $org, $nome, $funcao, limpar($data['consentimento']),
                  json_encode($data['respostas']), $s['A'], $s['C'], $s['P'], $s['E'],
                  array_sum($s), $predominante, $regra, $ip]);

    $ia = gerar_analise_ia($data, $data['respostas'], $s);
    out(['ok' => true, 'code' => 'saved', 'ia' => $ia]);

} catch (PDOException $e) {
    /* 23000 = violação de chave única (reenvio da fila com o mesmo cliente_id) */
    if ($e->getCode() === '23000') out(['ok' => true, 'code' => 'duplicate_ignored', 'ia' => null]);
    out(['ok' => false, 'code' => 'db_error']);
} catch (Throwable $e) {
    out(['ok' => false, 'code' => 'error']);
}
