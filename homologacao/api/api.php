<?php
/* ============================================================
   IPA — HOMOLOGAÇÃO — API com relatório gerado por IA
   Separada da produção. O texto do relatório é escrito pela IA
   (Google Gemini), fundamentada nos documentos de referência da
   pasta referencia/ (Revisões Finais dos 4 estilos + mudança
   comportamental). Os NÚMEROS (pontuações, gráficos, tabelas)
   continuam calculados pelo sistema — a IA nunca calcula.

   POST (JSON):
     (sem action)       -> registra um diagnóstico (regra: 6 meses)
     action=ia          -> gera os textos do relatório via IA
     action=relatorio   -> arquiva o HTML final (por cliente_id)
   GET:
     action=status            -> autodiagnóstico
     action=relatorio&token=  -> devolve o HTML arquivado
   ============================================================ */
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'code' => 'erro_fatal_php',
                          'detalhe' => mb_substr($e['message'], 0, 300)], JSON_UNESCAPED_UNICODE);
    }
});

if (!is_file(__DIR__ . '/config.php')) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'code' => 'config_ausente',
                      'dica' => 'Copie config.example.php para config.php e preencha os dados.'], JSON_UNESCAPED_UNICODE);
    exit;
}
require __DIR__ . '/config.php';

const VERSAO = 'HML-1';
const MESES_REPETICAO = 6;            // regra Zuvela: novo preenchimento só após 6 meses
const MAX_RELATORIO_BYTES = 900000;

const EXPECTED = [
    1 => ['Q1_ABERTO','Q1_ACOLHEDOR','Q1_ATENCIOSO','Q1_CLARO','Q1_EXPLICITO','Q1_ENFATICO_C','Q1_CONCENTRADO','Q1_FORMAL','Q1_IMPESSOAL','Q1_FLEXIVEL','Q1_INTERESSADO','Q1_CORDIAL_E'],
    2 => ['Q2_COMPREENSIVO','Q2_CUIDADOSO','Q2_RESPEITOSO','Q2_DESCRITIVO','Q2_INTERATIVO','Q2_OUVINTE','Q2_DISTANTE','Q2_EFICIENTE','Q2_OBJETIVO','Q2_RAPIDO_E','Q2_PRECISO','Q2_SOLICITO'],
    3 => ['Q3_AUTENTICO','Q3_CORDIAL_A','Q3_EMPATICO','Q3_ACESSIVEL','Q3_ELOQUENTE','Q3_ESPONTANEO','Q3_DIRETO','Q3_PROTOCOLAR','Q3_RAPIDO_P','Q3_CONSISTENTE','Q3_PRESTATIVO','Q3_ENFATICO_E'],
];
const NOMES_ESTILO = ['A' => 'Centrado na Atenção', 'C' => 'Centrado na Comunicação', 'P' => 'Centrado no Procedimento', 'E' => 'Equilibrado'];
const MOMENTOS = [1 => 'Início', 2 => 'Durante', 3 => 'Término'];
const ESPERADO = [1 => 'A', 2 => 'P', 3 => 'C'];

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

function gravar_palavras(int $fkId, array $respostas): void {
    $st = db()->prepare('INSERT INTO ipa_respostas_palavras (resposta_id, quadro, palavra_id, estilo, peso) VALUES (?,?,?,?,?)');
    foreach (EXPECTED as $q => $ids) {
        foreach ($ids as $i => $id) {
            $estilo = $i < 3 ? 'A' : ($i < 6 ? 'C' : ($i < 9 ? 'P' : 'E'));
            $st->execute([$fkId, $q, $id, $estilo, (int)$respostas[$id]]);
        }
    }
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
    $nomes = NOMES_ESTILO;
    $ordem = array_keys($s);
    usort($ordem, function ($a, $b) use ($s) { return $s[$b] <=> $s[$a]; });
    $difs = [$s[$ordem[0]] - $s[$ordem[1]], $s[$ordem[1]] - $s[$ordem[2]], $s[$ordem[2]] - $s[$ordem[3]]];
    if ($ordem[0] === 'E') $regra = 'EQUILIBRADO_MODELO';
    elseif ($difs[0] < 15 && $difs[1] < 15 && $difs[2] < 15) $regra = 'EQUILIBRADO_NATURAL';
    elseif ($difs[0] >= 15) $regra = 'FORTE_APEGO';
    else $regra = 'FLEXIVEL';
    return [$nomes[$ordem[0]], $regra];
}

/* ---------- IA: montagem do contexto e chamada ---------- */

function referencia(): string {
    $txt = '';
    foreach (glob(__DIR__ . '/referencia/*.md') ?: [] as $f) {
        $txt .= "\n\n===== DOCUMENTO DE REFERÊNCIA: " . basename($f) . " =====\n\n" . file_get_contents($f);
    }
    return $txt;
}

/* dados comportamentais p/ o prompt (significados, nunca as palavras do instrumento) */
function dados_do_respondente(array $row, array $respostas): array {
    $sig = require __DIR__ . '/significados.php';   // id => [sig, estilo, quadro]
    $s = calcular_scores($respostas);
    [$pred, $regra] = classificar($s);
    $porMomento = [1 => ['A'=>0,'C'=>0,'P'=>0,'E'=>0], 2 => ['A'=>0,'C'=>0,'P'=>0,'E'=>0], 3 => ['A'=>0,'C'=>0,'P'=>0,'E'=>0]];
    $altas = []; $baixas = [];
    foreach (EXPECTED as $q => $ids) {
        foreach ($ids as $i => $id) {
            $st = $i < 3 ? 'A' : ($i < 6 ? 'C' : ($i < 9 ? 'P' : 'E'));
            $n = (int)$respostas[$id];
            $porMomento[$q][$st] += $n;
            $item = ['comportamento' => $sig[$id] ?? $id, 'estilo' => NOMES_ESTILO[$st], 'momento' => MOMENTOS[$q], 'pontuacao' => $n];
            if ($n >= 9) $altas[] = $item;
            if ($n <= 2) $baixas[] = $item;
        }
    }
    arsort($s);
    $rank = [];
    foreach ($s as $k => $v) $rank[] = NOMES_ESTILO[$k] . ' = ' . $v . ' pontos (' . round($v / 198 * 100, 1) . '%)';
    $momentos = [];
    foreach ([1, 2, 3] as $q) {
        $m = $porMomento[$q];
        arsort($m);
        $lider = array_key_first($m);
        $momentos[] = MOMENTOS[$q] . ': líder ' . NOMES_ESTILO[$lider] . ' (' . $m[$lider] . ' pts; o momento tipicamente pede ' . NOMES_ESTILO[ESPERADO[$q]] . '; A=' . $porMomento[$q]['A'] . ', C=' . $porMomento[$q]['C'] . ', P=' . $porMomento[$q]['P'] . ', E=' . $porMomento[$q]['E'] . ')';
    }
    return [
        'nome' => $row['nome'], 'funcao' => $row['funcao'], 'organizacao' => $row['organizacao'],
        'ranking' => $rank, 'predominante' => $pred, 'regra' => $regra,
        'momentos' => $momentos, 'altas' => $altas, 'baixas' => $baixas,
    ];
}

function prompt_ia(array $d): string {
    $fmtItem = function ($x) {
        return '- ' . $x['comportamento'] . ' [' . $x['estilo'] . ' · ' . $x['momento'] . ' · pontuação ' . $x['pontuacao'] . ']';
    };
    return
"Você é um Consultor Sênior de Desenvolvimento Humano, mestre na Abordagem ACP (Atenção, Comunicação e Procedimento — metodologia Zuvela). Os DOCUMENTOS DE REFERÊNCIA abaixo são a sua única fonte conceitual: fundamente TODO o texto neles.\n" .
referencia() . "\n\n" .
"===== REGRAS EDITORIAIS OBRIGATÓRIAS =====\n" .
"1. TOM CONDICIONAL, NUNCA TAXATIVO: jamais defina a pessoa de forma categórica. Use sempre formulações como 'pode ser que você...', 'é possível que...', 'você tende a...', 'os resultados sugerem que...', 'talvez você perceba que...'. A pessoa não pode se sentir rotulada ou ofendida.\n" .
"2. SEMPRE O POSITIVO ANTES DO NEGATIVO: em toda seção, apresente primeiro as forças e aspectos positivos; só depois, com respeito e de forma construtiva, os pontos de desenvolvimento. Seja direto, mas jamais depreciativo — pontos baixos são 'focos de desenvolvimento', nunca falhas ou defeitos.\n" .
"3. NUNCA cite as palavras do instrumento (os vocábulos do questionário) nem notas numéricas individuais de palavras; descreva comportamentos.\n" .
"4. Dirija-se ao profissional como 'você', em português do Brasil, tom técnico, caloroso e encorajador.\n" .
"5. Lógica de desenvolvimento (Campo de Forças de Kurt Lewin, conforme a referência): pontuações altas são forças a preservar cuja intensidade pode ser modulada; pontuações baixas são práticas a fortalecer rumo à faixa de equilíbrio (4 a 6). O caminho nunca é abandonar uma força, mas moderá-la e valorizar, ao mesmo tempo, a variável que o momento pede.\n" .
"6. Use os números fornecidos EXATAMENTE como estão; não calcule nem invente números.\n\n" .
"===== DADOS DO PROFISSIONAL (calculados pelo sistema) =====\n" .
'Nome: ' . $d['nome'] . ' | Função: ' . $d['funcao'] . ' | Organização: ' . $d['organizacao'] . "\n" .
'Pontuações (total 198): ' . implode('; ', $d['ranking']) . "\n" .
'Estilo predominante: ' . $d['predominante'] . ' | Perfil de flexibilidade: ' . $d['regra'] . "\n" .
"Momentos do atendimento (66 pontos cada): \n" . implode("\n", $d['momentos']) . "\n" .
"Comportamentos mais valorizados (pontuação 9 a 11):\n" . (implode("\n", array_map($fmtItem, $d['altas'])) ?: 'nenhum') . "\n" .
"Comportamentos menos valorizados (pontuação 0 a 2):\n" . (implode("\n", array_map($fmtItem, $d['baixas'])) ?: 'nenhum') . "\n\n" .
"===== TAREFA =====\n" .
"Escreva os textos do relatório individual, personalizado e único deste profissional. Responda APENAS com um JSON válido com EXATAMENTE estas chaves (strings com parágrafos separados por \\n\\n, sem markdown, sem títulos dentro do texto):\n" .
'{"f1_apresentacao": "2 parágrafos apresentando a Abordagem ACP e o propósito do relatório, personalizado ao contexto do profissional",' .
'"f3_resultados": "2 parágrafos lendo o ranking de pontuações e o que o estilo predominante sugere",' .
'"f4_predominante": "3 a 4 parágrafos interpretando em profundidade o estilo predominante deste profissional, com base na Revisão Final do estilo (forças primeiro, depois vigilâncias, em tom condicional)",' .
'"f4_secundario": "1 a 2 parágrafos sobre o papel do estilo secundário",' .
'"f5_momentos": "2 a 3 parágrafos analisando a distribuição nos 3 momentos, comparando com o que cada momento tipicamente pede",' .
'"f5_grafico": "1 a 2 parágrafos de leitura da trajetória (como as ênfases variam do Início ao Término)",' .
'"f6_talentos": "2 parágrafos sobre as forças comportamentais reveladas (sem citar palavras do instrumento)",' .
'"f6_desenvolver": "2 parágrafos sobre os focos de desenvolvimento, construtivos e condicionais",' .
'"f7_recomendacoes": "3 a 4 parágrafos de recomendações de desenvolvimento, aplicando a lógica de Lewin e a mudança comportamental da referência",' .
'"f8_plano": [{"titulo": "título curto da ação", "como": "como fazer na prática, 2 a 4 frases"} — EXATAMENTE 4 itens, ordenados do fortalecimento de forças para os focos de desenvolvimento],' .
'"conclusao": "1 parágrafo final encorajador"}';
}

function chamar_ia(string $prompt): array {
    if (defined('IA_SIMULADA') && IA_SIMULADA) {
        $p = '[TEXTO SIMULADO — homologação local, sem chamada real à IA] Pode ser que você reconheça neste relatório vários dos seus comportamentos; é possível que alguns pontos surpreendam — e tudo bem.';
        $sim = ['f1_apresentacao' => $p, 'f3_resultados' => $p, 'f4_predominante' => $p, 'f4_secundario' => $p,
                'f5_momentos' => $p, 'f5_grafico' => $p, 'f6_talentos' => $p, 'f6_desenvolver' => $p,
                'f7_recomendacoes' => $p, 'conclusao' => $p,
                'f8_plano' => [['titulo' => 'Ação simulada 1', 'como' => $p], ['titulo' => 'Ação simulada 2', 'como' => $p],
                               ['titulo' => 'Ação simulada 3', 'como' => $p], ['titulo' => 'Ação simulada 4', 'como' => $p]]];
        return ['ok' => true, 'ia' => $sim];
    }
    if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
        return ['ok' => false, 'code' => 'ia_sem_chave', 'dica' => 'Preencha GEMINI_API_KEY no config.php da homologação.'];
    }
    set_time_limit(300);
    /* modelo configurado + substitutos automáticos: se o Google
       descontinuar um modelo, a API tenta o próximo da lista sozinha */
    $modelos = array_values(array_unique(array_filter([
        defined('IA_MODELO') ? IA_MODELO : '',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
    ])));
    $resp = false; $http = 0; $j = null; $ultimoErro = ''; $sucesso = false; $foiOcupado = false;
    foreach ($modelos as $modelo) {
        /* até 3 tentativas por modelo quando o erro for de capacidade
           ("high demand"/429/503), com espera progressiva */
        for ($t = 0; $t < 3; $t++) {
            $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models/' . $modelo . ':generateContent?key=' . GEMINI_API_KEY);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 240,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode([
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => [
                        'temperature' => 0.7,
                        'maxOutputTokens' => 8192,
                        'responseMimeType' => 'application/json',
                    ],
                ], JSON_UNESCAPED_UNICODE),
            ]);
            $resp = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($resp === false) return ['ok' => false, 'code' => 'ia_sem_conexao'];
            $j = json_decode($resp, true);
            if ($http === 200 && isset($j['candidates'][0]['content']['parts'][0]['text'])) { $sucesso = true; break 2; }
            $ultimoErro = (string)($j['error']['message'] ?? $resp);
            $ocupado = in_array($http, [429, 500, 503], true)
                || stripos($ultimoErro, 'high demand') !== false
                || stripos($ultimoErro, 'overloaded') !== false
                || stripos($ultimoErro, 'try again later') !== false
                || stripos($ultimoErro, 'RESOURCE_EXHAUSTED') !== false
                || stripos($ultimoErro, 'UNAVAILABLE') !== false;
            $indisponivel = $http === 404
                || stripos($ultimoErro, 'no longer available') !== false
                || stripos($ultimoErro, 'not found') !== false
                || stripos($ultimoErro, 'not supported') !== false;
            if ($ocupado) { $foiOcupado = true; if ($t < 2) { sleep(5 + 5 * $t); continue; } break; }
            if ($indisponivel) break;      /* próximo modelo */
            break 2;                       /* erro definitivo (ex.: chave inválida) */
        }
    }
    if (!$sucesso) {
        if ($foiOcupado) {
            return ['ok' => false, 'code' => 'ia_ocupada',
                    'dica' => 'O serviço de IA está com alta demanda neste momento (pico temporário do Google). O sistema já tentou algumas vezes — uma nova tentativa automática será feita em instantes.',
                    'detalhe' => mb_substr($ultimoErro, 0, 200)];
        }
        return ['ok' => false, 'code' => 'ia_http_' . $http,
                'dica' => mb_substr($ultimoErro, 0, 200)];
    }
    $ia = json_decode($j['candidates'][0]['content']['parts'][0]['text'], true);
    if (!is_array($ia)) return ['ok' => false, 'code' => 'ia_json_invalido'];
    $chaves = ['f1_apresentacao','f3_resultados','f4_predominante','f4_secundario','f5_momentos','f5_grafico',
               'f6_talentos','f6_desenvolver','f7_recomendacoes','f8_plano','conclusao'];
    foreach ($chaves as $k) if (empty($ia[$k])) return ['ok' => false, 'code' => 'ia_incompleta', 'dica' => 'faltou ' . $k];
    return ['ok' => true, 'ia' => $ia];
}

/* ============================================================ */
try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? '';
        if ($action === 'status') {
            $st = ['ok' => true, 'code' => 'status', 'v' => VERSAO, 'php' => PHP_VERSION,
                   'config' => true, 'banco' => false, 'tabelas' => [],
                   'referencias' => count(glob(__DIR__ . '/referencia/*.md') ?: []),
                   'gestor_key' => (defined('GESTOR_KEY') && GESTOR_KEY !== '' && strpos(GESTOR_KEY, 'TROQUE') !== 0) ? 'configurada' : 'NAO CONFIGURADA',
                   'n8n' => (defined('N8N_WEBHOOK_URL') && N8N_WEBHOOK_URL !== '') ? 'configurado' : 'NAO CONFIGURADO',
                   'ia' => defined('IA_SIMULADA') && IA_SIMULADA ? 'SIMULADA'
                         : ((defined('GEMINI_API_KEY') && GEMINI_API_KEY !== '') ? (defined('IA_MODELO') ? IA_MODELO : 'gemini-3.8-flash') : 'SEM CHAVE')];
            try {
                db();
                $st['banco'] = true;
                foreach (['ipa_respostas', 'ipa_respostas_palavras'] as $t) {
                    try { db()->query("SELECT COUNT(*) FROM {$t}"); $st['tabelas'][$t] = 'ok'; }
                    catch (Throwable $e) { $st['tabelas'][$t] = 'AUSENTE — importe o schema.sql'; }
                }
            } catch (Throwable $e) { $st['dica'] = 'Sem conexão com o banco — confira o config.php.'; }
            out($st);
        }
        if ($action === 'relatorio') {
            $token = preg_replace('/[^a-f0-9]/', '', (string)($_GET['token'] ?? ''));
            if (strlen($token) !== 32) out(['ok' => false, 'code' => 'bad_token']);
            $st = db()->prepare('SELECT relatorio FROM ipa_respostas WHERE token = ? LIMIT 1');
            $st->execute([$token]);
            $html = $st->fetchColumn();
            if (!$html) out(['ok' => false, 'code' => 'not_found']);
            if (!empty($_GET['print'])) {
                $html = str_replace('</body>', '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},500);});</script></body>', $html);
            }
            header('Content-Type: text/html; charset=utf-8');
            header('X-Robots-Tag: noindex, nofollow');
            echo $html;
            exit;
        }

        /* dados do funcionário pelo código do link pessoal (?f=) */
        if ($action === 'funcionario') {
            $cod = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_GET['c'] ?? ''));
            if (strlen($cod) < 16) out(['ok' => false, 'code' => 'bad_code']);
            $st = db()->prepare('SELECT nome, funcao, organizacao FROM ipa_funcionarios WHERE codigo = ? AND ativo = 1 LIMIT 1');
            $st->execute([$cod]);
            $f = $st->fetch();
            if (!$f) out(['ok' => false, 'code' => 'not_found']);
            out(['ok' => true, 'nome' => $f['nome'], 'funcao' => $f['funcao'], 'organizacao' => $f['organizacao']]);
        }
        out(['ok' => false, 'code' => 'method_not_allowed', 'v' => VERSAO]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['ok' => false, 'code' => 'method_not_allowed']);
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) out(['ok' => false, 'code' => 'invalid_json']);
    if (!empty($data['website'])) out(['ok' => false, 'code' => 'rejected']);
    $action = (string)($data['action'] ?? '');

    /* ===== Área do Gestor (cadastro de funcionários) — exige GESTOR_KEY ===== */
    if (strpos($action, 'gestor_') === 0) {
        if (!defined('GESTOR_KEY') || GESTOR_KEY === '' || strpos(GESTOR_KEY, 'TROQUE') === 0) {
            out(['ok' => false, 'code' => 'gestor_key_nao_configurada',
                 'dica' => 'Defina a constante GESTOR_KEY no arquivo homologacao/api/config.php do servidor (invente uma chave longa). Ela ainda está ausente ou com o valor padrão.']);
        }
        if (!hash_equals(GESTOR_KEY, (string)($data['key'] ?? ''))) {
            out(['ok' => false, 'code' => 'nao_autorizado']);
        }

        if ($action === 'gestor_func_create') {
            $nome = limpar($data['nome'] ?? '');
            $email = mb_strtolower(trim((string)($data['email'] ?? '')));
            $org = limpar($data['organizacao'] ?? '');
            $funcao = limpar($data['funcao'] ?? '');
            $area = limpar($data['area'] ?? '');
            $segmento = limpar($data['segmento'] ?? '');
            $obs = mb_substr(trim((string)($data['obs'] ?? '')), 0, 500);
            if (mb_strlen($nome) < 2 || $org === '' || $funcao === '' || $area === '' || $segmento === '') {
                out(['ok' => false, 'code' => 'dados_invalidos', 'dica' => 'Preencha nome, organização, função, área de atuação e segmento.']);
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) out(['ok' => false, 'code' => 'email_invalido']);
            $codigo = rtrim(strtr(base64_encode(random_bytes(16)), '+/', '-_'), '=');
            $st = db()->prepare('INSERT INTO ipa_funcionarios (nome, email, organizacao, funcao, area_atuacao, segmento, obs, codigo) VALUES (?,?,?,?,?,?,?,?)');
            $st->execute([$nome, $email, $org, $funcao, $area, $segmento, $obs, $codigo]);
            out(['ok' => true, 'id' => (int)db()->lastInsertId(), 'codigo' => $codigo]);
        }

        if ($action === 'gestor_func_list') {
            $rows = db()->query(
                "SELECT f.id, f.criado_em, f.nome, f.email, f.organizacao, f.funcao, f.area_atuacao, f.segmento, f.obs, f.codigo, f.ativo,
                        (SELECT r.criado_em FROM ipa_respostas r WHERE r.funcionario_id = f.id ORDER BY r.criado_em DESC LIMIT 1) AS respondido_em,
                        (SELECT r.token FROM ipa_respostas r WHERE r.funcionario_id = f.id AND r.relatorio IS NOT NULL ORDER BY r.criado_em DESC LIMIT 1) AS token_rel
                 FROM ipa_funcionarios f ORDER BY f.nome")->fetchAll();
            foreach ($rows as &$r2) {
                $r2['id'] = (int)$r2['id']; $r2['ativo'] = (int)$r2['ativo'];
                $r2['link_rel'] = $r2['token_rel'] ? ('api/api.php?action=relatorio&token=' . $r2['token_rel']) : '';
                unset($r2['token_rel']);
            }
            out(['ok' => true, 'rows' => $rows]);
        }

        if ($action === 'gestor_func_toggle') {
            $st = db()->prepare('UPDATE ipa_funcionarios SET ativo = ? WHERE id = ?');
            $st->execute([(int)!empty($data['ativo']), (int)($data['id'] ?? 0)]);
            out(['ok' => true]);
        }

        /* envio do link pessoal por e-mail VIA N8N: individual, por área,
           por segmento ou todos. A API monta destinatários + conteúdo e
           chama o webhook do n8n, que executa o disparo dos e-mails. */
        if ($action === 'gestor_func_email') {
            $tipo = (string)($data['tipo'] ?? '');
            if ($tipo === 'individual') {
                $st = db()->prepare('SELECT nome, email, codigo, area_atuacao, segmento, organizacao FROM ipa_funcionarios WHERE id = ? AND ativo = 1');
                $st->execute([(int)($data['id'] ?? 0)]);
            } elseif ($tipo === 'area') {
                $st = db()->prepare('SELECT nome, email, codigo, area_atuacao, segmento, organizacao FROM ipa_funcionarios WHERE area_atuacao = ? AND ativo = 1');
                $st->execute([limpar($data['valor'] ?? '')]);
            } elseif ($tipo === 'segmento') {
                $st = db()->prepare('SELECT nome, email, codigo, area_atuacao, segmento, organizacao FROM ipa_funcionarios WHERE segmento = ? AND ativo = 1');
                $st->execute([limpar($data['valor'] ?? '')]);
            } elseif ($tipo === 'todos') {
                $st = db()->query('SELECT nome, email, codigo, area_atuacao, segmento, organizacao FROM ipa_funcionarios WHERE ativo = 1');
            } else {
                out(['ok' => false, 'code' => 'tipo_invalido']);
            }
            $destinos = $st->fetchAll();
            if (!$destinos) out(['ok' => false, 'code' => 'sem_destinatarios',
                                 'dica' => 'Nenhum funcionário ativo encontrado para esse filtro.']);

            /* base pública do link: BASE_URL do config ou deduzida da requisição */
            $base = (defined('BASE_URL') && BASE_URL !== '')
                ? rtrim(BASE_URL, '/')
                : ((!empty($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost')
                   . rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/'));

            $assunto = 'Convite: seu diagnóstico IPA — Perfil de Atendimento';
            $destinatarios = [];
            foreach ($destinos as $f2) {
                $link = $base . '/index.html?f=' . $f2['codigo'];
                $destinatarios[] = [
                    'nome' => $f2['nome'],
                    'email' => $f2['email'],
                    'organizacao' => $f2['organizacao'],
                    'area' => $f2['area_atuacao'],
                    'segmento' => $f2['segmento'],
                    'link' => $link,
                    'html' => '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#16213a">'
                        . '<div style="background:#1e3a8a;color:#fff;border-radius:12px 12px 0 0;padding:18px 24px;font-size:18px;font-weight:bold">IPA — Indicador do Perfil de Atendimento</div>'
                        . '<div style="border:1px solid #e4e8ef;border-top:0;border-radius:0 0 12px 12px;padding:24px">'
                        . '<p>Olá, <strong>' . htmlspecialchars($f2['nome'], ENT_QUOTES, 'UTF-8') . '</strong>!</p>'
                        . '<p>Você foi convidado(a) a realizar o seu diagnóstico comportamental <strong>IPA</strong> (Abordagem ACP). '
                        . 'Leva cerca de <strong>12 minutos</strong> e gera, na hora, o seu relatório individual e personalizado de desenvolvimento.</p>'
                        . '<p>Este é o seu <strong>link pessoal e exclusivo</strong> — não o repasse a outras pessoas:</p>'
                        . '<p style="text-align:center;margin:26px 0"><a href="' . $link . '" style="background:#2952cc;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:bold">Iniciar o meu diagnóstico</a></p>'
                        . '<p style="font-size:13px;color:#4b5772">Se o botão não funcionar, copie e cole este endereço no navegador:<br>' . $link . '</p>'
                        . '<p style="font-size:12px;color:#8a94ab">Não há respostas certas ou erradas — responda pelo que você realmente pratica. Seus dados são tratados conforme a LGPD.</p>'
                        . '</div></div>',
                ];
            }

            /* modo simulado (testes locais): não chama o n8n */
            if (defined('EMAIL_SIMULADO') && EMAIL_SIMULADO) {
                out(['ok' => true, 'enviados' => count($destinatarios), 'falhas' => [], 'simulado' => true]);
            }
            if (!defined('N8N_WEBHOOK_URL') || N8N_WEBHOOK_URL === '') {
                out(['ok' => false, 'code' => 'n8n_nao_configurado',
                     'dica' => 'Preencha N8N_WEBHOOK_URL no config.php da homologação.']);
            }

            $payloadN8n = [
                'origem' => 'ipa-homologacao',
                'evento' => 'convite_ipa',
                'tipo_envio' => $tipo,
                'filtro' => limpar($data['valor'] ?? ''),
                'assunto' => $assunto,
                'total' => count($destinatarios),
                'destinatarios' => $destinatarios,
            ];
            $ch = curl_init(N8N_WEBHOOK_URL);
            $headers = ['Content-Type: application/json'];
            if (defined('N8N_TOKEN') && N8N_TOKEN !== '') $headers[] = 'X-Ipa-Token: ' . N8N_TOKEN;
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 60,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_POSTFIELDS => json_encode($payloadN8n, JSON_UNESCAPED_UNICODE),
            ]);
            $resp = curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($resp === false || $http < 200 || $http >= 300) {
                out(['ok' => false, 'code' => 'n8n_falhou',
                     'dica' => 'O webhook do n8n respondeu HTTP ' . (int)$http . '. Verifique se o fluxo está ativo.']);
            }
            out(['ok' => true, 'enviados' => count($destinatarios), 'falhas' => [], 'via' => 'n8n']);
        }

        out(['ok' => false, 'code' => 'acao_desconhecida']);
    }

    /* ----- geração dos textos por IA ----- */
    if ($action === 'ia') {
        $cid = limpar($data['id'] ?? '');
        if ($cid === '') out(['ok' => false, 'code' => 'missing_fields']);
        $st = db()->prepare('SELECT id, nome, funcao, organizacao, respostas, ia_json FROM ipa_respostas WHERE cliente_id = ? LIMIT 1');
        $st->execute([$cid]);
        $row = $st->fetch();
        if (!$row) out(['ok' => false, 'code' => 'not_found']);
        if (!empty($row['ia_json'])) {
            $pronto = json_decode($row['ia_json'], true);
            if (is_array($pronto)) out(['ok' => true, 'code' => 'ia_cache', 'ia' => $pronto]);
        }
        $respostas = json_decode((string)$row['respostas'], true);
        if (!is_array($respostas)) out(['ok' => false, 'code' => 'respostas_corrompidas']);
        $r = chamar_ia(prompt_ia(dados_do_respondente($row, $respostas)));
        if (!$r['ok']) out($r);
        $up = db()->prepare('UPDATE ipa_respostas SET ia_json = ? WHERE id = ?');
        $up->execute([json_encode($r['ia'], JSON_UNESCAPED_UNICODE), (int)$row['id']]);
        out(['ok' => true, 'code' => 'ia_gerada', 'ia' => $r['ia']]);
    }

    /* ----- arquivamento do HTML final ----- */
    if ($action === 'relatorio') {
        $cid = limpar($data['id'] ?? '');
        $html = (string)($data['relatorio'] ?? '');
        if ($cid === '' || $html === '') out(['ok' => false, 'code' => 'missing_fields']);
        if (strlen($html) > MAX_RELATORIO_BYTES) out(['ok' => false, 'code' => 'too_large']);
        $st = db()->prepare('UPDATE ipa_respostas SET relatorio = ? WHERE cliente_id = ?');
        $st->execute([$html, $cid]);
        out(['ok' => $st->rowCount() > 0, 'code' => $st->rowCount() > 0 ? 'archived' : 'not_found']);
    }

    /* ----- registro do diagnóstico (com a regra dos 6 meses) ----- */
    if ((int)($data['schema'] ?? 0) !== 2) out(['ok' => false, 'code' => 'bad_schema']);
    $nome = limpar($data['nome'] ?? '');
    $org = limpar($data['organizacao'] ?? '');
    $funcao = limpar($data['funcao'] ?? '');
    $cid = limpar($data['id'] ?? '');

    /* link pessoal do funcionário (?f=): identificação vem do cadastro do
       gestor — o respondente não consegue alterá-la */
    $funcionarioId = null;
    $codF = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($data['funcionario'] ?? ''));
    if (strlen($codF) >= 16) {
        $st = db()->prepare('SELECT id, nome, funcao, organizacao FROM ipa_funcionarios WHERE codigo = ? AND ativo = 1 LIMIT 1');
        $st->execute([$codF]);
        $f = $st->fetch();
        if (!$f) out(['ok' => false, 'code' => 'funcionario_invalido']);
        $funcionarioId = (int)$f['id'];
        $nome = $f['nome']; $funcao = $f['funcao']; $org = $f['organizacao'];
    }

    if ($nome === '' || $org === '' || $funcao === '' || $cid === '') out(['ok' => false, 'code' => 'missing_fields']);
    if (empty($data['consentimento'])) out(['ok' => false, 'code' => 'missing_consent']);
    $erro = validar_respostas($data['respostas'] ?? null);
    if ($erro) out(['ok' => false, 'code' => $erro]);

    /* Regra Zuvela: um novo preenchimento só após 6 meses — aplicada
       SOMENTE a funcionário cadastrado que acessa pelo código exclusivo
       (quem preenche manualmente, sem código, não é bloqueado). */
    $recente = false;
    if ($funcionarioId) {
        $limite = gmdate('Y-m-d H:i:s', strtotime('-' . MESES_REPETICAO . ' months'));
        $st = db()->prepare('SELECT criado_em FROM ipa_respostas WHERE funcionario_id = ? AND criado_em > ? ORDER BY criado_em DESC LIMIT 1');
        $st->execute([$funcionarioId, $limite]);
        $recente = $st->fetchColumn();
    }
    if ($recente) {
        $proxima = gmdate('d/m/Y', strtotime((string)$recente . ' +' . MESES_REPETICAO . ' months'));
        out(['ok' => false, 'code' => 'preenchimento_recente',
             'dica' => 'Você já preencheu o IPA em ' . gmdate('d/m/Y', strtotime((string)$recente)) .
                       '. Um novo preenchimento será possível a partir de ' . $proxima .
                       ' — o intervalo de ' . MESES_REPETICAO . ' meses permite verificar a mudança comportamental com base nas recomendações do seu relatório. Casos especiais: fale com o administrador.']);
    }

    $s = calcular_scores($data['respostas']);
    [$predominante, $regra] = classificar($s);
    $token = bin2hex(random_bytes(16));

    db()->beginTransaction();
    $st = db()->prepare(
        'INSERT INTO ipa_respostas (cliente_id, token, organizacao, nome, funcao, consentimento, respostas,
                                    score_a, score_c, score_p, score_e, total, predominante, regra, ip, funcionario_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$cid, $token, $org, $nome, $funcao, limpar($data['consentimento']),
                  json_encode($data['respostas']), $s['A'], $s['C'], $s['P'], $s['E'],
                  array_sum($s), $predominante, $regra, $ip, $funcionarioId]);
    gravar_palavras((int)db()->lastInsertId(), $data['respostas']);
    db()->commit();
    out(['ok' => true, 'code' => 'saved']);

} catch (PDOException $e) {
    try { if (db()->inTransaction()) db()->rollBack(); } catch (Throwable $x) {}
    if ($e->getCode() === '23000') out(['ok' => true, 'code' => 'duplicate_ignored']);
    out(['ok' => false, 'code' => 'db_error']);
} catch (Throwable $e) {
    try { if (db()->inTransaction()) db()->rollBack(); } catch (Throwable $x) {}
    out(['ok' => false, 'code' => 'error']);
}
