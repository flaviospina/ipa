<?php
/* ============================================================
   IPA — API Administrativa (empresas, gestores e indicadores)
   Acesso em dois níveis, sempre via sessão:
     ADMIN  : consultor (chave ADMIN_KEY do config.php) — cria
              empresas e gestores, vê tudo.
     GESTOR : responsável da empresa (e-mail + senha) — vê somente
              os dados da própria empresa.

   Segurança aplicada:
     - senhas com password_hash (Argon2id quando disponível; senão bcrypt)
     - bloqueio de força bruta: 5 falhas/15 min por IP e por e-mail
     - sessão com cookie HttpOnly + SameSite=Strict (+ Secure em HTTPS),
       ID regenerado no login e expiração por inatividade (30 min)
     - token CSRF obrigatório em toda ação que altera dados
     - mensagens de erro genéricas (não revelam se o e-mail existe)
     - consultas sempre preparadas (PDO) e escopadas pela empresa da sessão
     - cabeçalhos: nosniff, DENY frame, referrer mínimo, sem cache
     - auditoria de tentativas de login em ipa_login_log
   ============================================================ */
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'code' => 'erro_fatal_php'], JSON_UNESCAPED_UNICODE);
    }
});

if (!is_file(__DIR__ . '/config.php')) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'code' => 'config_ausente'], JSON_UNESCAPED_UNICODE);
    exit;
}
require __DIR__ . '/config.php';

const SESSAO_MINUTOS = 30;
const LOGIN_MAX_FALHAS = 5;
const LOGIN_JANELA_SEG = 900; // 15 minutos

/* chave do admin: ADMIN_KEY no config.php (recomendado); na falta, PANEL_KEY */
function admin_key(): string {
    if (defined('ADMIN_KEY') && ADMIN_KEY !== '' && strpos(ADMIN_KEY, 'TROQUE') !== 0) return ADMIN_KEY;
    if (defined('PANEL_KEY') && PANEL_KEY !== '' && strpos(PANEL_KEY, 'TROQUE') !== 0) return PANEL_KEY;
    return '';
}

function out(array $o, int $http = 200): void {
    http_response_code($http);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
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

/* ---------- sessão endurecida ---------- */
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
      || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('IPASESS');
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'httponly' => true,
    'secure' => $https, 'samesite' => 'Strict',
]);
session_start();

/* expiração por inatividade */
if (isset($_SESSION['ult']) && time() - (int)$_SESSION['ult'] > SESSAO_MINUTOS * 60) {
    session_unset();
    session_destroy();
    session_start();
}
$_SESSION['ult'] = time();

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function exigir_csrf(array $data): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($data['csrf'] ?? ''))) {
        out(['ok' => false, 'code' => 'csrf_invalido'], 403);
    }
}
function e_admin(): bool { return !empty($_SESSION['admin']); }
function gestor_id(): int { return (int)($_SESSION['gestor_id'] ?? 0); }
function empresa_sessao(): int { return (int)($_SESSION['empresa_id'] ?? 0); }
function exigir_admin(): void { if (!e_admin()) out(['ok' => false, 'code' => 'nao_autorizado'], 401); }
function exigir_login(): void { if (!e_admin() && !gestor_id()) out(['ok' => false, 'code' => 'nao_autorizado'], 401); }

/* ---------- proteção contra força bruta ---------- */
function falhas_recentes(string $ip, string $email): int {
    try {
        $desde = gmdate('Y-m-d H:i:s', time() - LOGIN_JANELA_SEG);
        $st = db()->prepare('SELECT COUNT(*) FROM ipa_login_log WHERE ok = 0 AND criado_em > ? AND (ip = ? OR (email <> \'\' AND email = ?))');
        $st->execute([$desde, $ip, $email]);
        return (int)$st->fetchColumn();
    } catch (Throwable $e) { return 0; }
}
function registrar_login(string $ip, string $email, bool $ok): void {
    try {
        $st = db()->prepare('INSERT INTO ipa_login_log (email, ip, ok, criado_em) VALUES (?,?,?,?)');
        $st->execute([mb_substr($email, 0, 190), $ip, $ok ? 1 : 0, gmdate('Y-m-d H:i:s')]);
    } catch (Throwable $e) { /* auditoria nunca derruba o fluxo */ }
}

/* ---------- utilidades ---------- */
function codigo_opaco(): string {
    return rtrim(strtr(base64_encode(random_bytes(16)), '+/', '-_'), '=');  // 22 chars URL-safe
}
function hash_senha(string $s): string {
    return password_hash($s, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT);
}

try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        out(['ok' => false, 'code' => 'method_not_allowed']);
    }
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) out(['ok' => false, 'code' => 'invalid_json']);
    $action = (string)($data['action'] ?? '');

    /* ===== estado da sessão (para as páginas restaurarem o contexto) ===== */
    if ($action === 'ping') {
        $resp = ['ok' => true, 'admin' => e_admin(), 'gestor' => null, 'csrf' => csrf_token()];
        if (gestor_id()) {
            $resp['gestor'] = ['nome' => (string)($_SESSION['gestor_nome'] ?? ''),
                               'empresa' => (string)($_SESSION['empresa_nome'] ?? '')];
        }
        out($resp);
    }

    /* ===== login do administrador (consultor) ===== */
    if ($action === 'admin_login') {
        if (falhas_recentes($ip, 'admin') >= LOGIN_MAX_FALHAS) {
            out(['ok' => false, 'code' => 'muitas_tentativas'], 429);
        }
        $chave = admin_key();
        $okLogin = $chave !== '' && hash_equals($chave, (string)($data['key'] ?? ''));
        registrar_login($ip, 'admin', $okLogin);
        if (!$okLogin) out(['ok' => false, 'code' => 'credenciais_invalidas'], 401);
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        unset($_SESSION['gestor_id'], $_SESSION['empresa_id'], $_SESSION['gestor_nome'], $_SESSION['empresa_nome'], $_SESSION['csrf']);
        out(['ok' => true, 'csrf' => csrf_token()]);
    }

    /* ===== login do gestor da empresa ===== */
    if ($action === 'gestor_login') {
        $email = mb_strtolower(trim((string)($data['email'] ?? '')));
        $senha = (string)($data['senha'] ?? '');
        if (falhas_recentes($ip, $email) >= LOGIN_MAX_FALHAS) {
            out(['ok' => false, 'code' => 'muitas_tentativas'], 429);
        }
        $okLogin = false; $g = null;
        if ($email !== '' && $senha !== '') {
            $st = db()->prepare(
                'SELECT g.id, g.nome, g.senha_hash, g.empresa_id, e.nome AS empresa, e.ativo AS empresa_ativa
                 FROM ipa_gestores g JOIN ipa_empresas e ON e.id = g.empresa_id
                 WHERE g.email = ? AND g.ativo = 1 LIMIT 1');
            $st->execute([$email]);
            $g = $st->fetch();
            $okLogin = $g && (int)$g['empresa_ativa'] === 1 && password_verify($senha, $g['senha_hash']);
        }
        registrar_login($ip, $email, $okLogin);
        if (!$okLogin) out(['ok' => false, 'code' => 'credenciais_invalidas'], 401);
        session_regenerate_id(true);
        unset($_SESSION['admin'], $_SESSION['csrf']);
        $_SESSION['gestor_id'] = (int)$g['id'];
        $_SESSION['empresa_id'] = (int)$g['empresa_id'];
        $_SESSION['gestor_nome'] = $g['nome'];
        $_SESSION['empresa_nome'] = $g['empresa'];
        out(['ok' => true, 'csrf' => csrf_token(),
             'gestor' => ['nome' => $g['nome'], 'empresa' => $g['empresa']]]);
    }

    if ($action === 'logout') {
        session_unset();
        session_destroy();
        out(['ok' => true]);
    }

    /* ===== administração (somente ADMIN) ===== */
    if ($action === 'empresa_create') {
        exigir_admin(); exigir_csrf($data);
        $nome = limpar($data['nome'] ?? '');
        if (mb_strlen($nome) < 2) out(['ok' => false, 'code' => 'nome_invalido']);
        $st = db()->prepare('INSERT INTO ipa_empresas (nome, codigo) VALUES (?, ?)');
        $st->execute([$nome, codigo_opaco()]);
        out(['ok' => true, 'id' => (int)db()->lastInsertId()]);
    }

    if ($action === 'empresa_list') {
        exigir_admin();
        $rows = db()->query(
            'SELECT e.id, e.nome, e.codigo, e.ativo, e.criado_em,
                    (SELECT COUNT(*) FROM ipa_gestores g WHERE g.empresa_id = e.id AND g.ativo = 1) AS gestores,
                    (SELECT COUNT(*) FROM ipa_respostas r WHERE r.empresa_id = e.id) AS respondentes,
                    (SELECT COUNT(*) FROM ipa_360 a WHERE a.empresa_id = e.id) AS avaliacoes360
             FROM ipa_empresas e ORDER BY e.nome')->fetchAll();
        foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['ativo'] = (int)$r['ativo']; }
        out(['ok' => true, 'rows' => $rows]);
    }

    if ($action === 'empresa_toggle') {
        exigir_admin(); exigir_csrf($data);
        $st = db()->prepare('UPDATE ipa_empresas SET ativo = ? WHERE id = ?');
        $st->execute([(int)!empty($data['ativo']), (int)($data['id'] ?? 0)]);
        out(['ok' => true]);
    }

    if ($action === 'gestor_create') {
        exigir_admin(); exigir_csrf($data);
        $empresaId = (int)($data['empresa_id'] ?? 0);
        $nome = limpar($data['nome'] ?? '');
        $email = mb_strtolower(trim((string)($data['email'] ?? '')));
        $senha = (string)($data['senha'] ?? '');
        if ($empresaId <= 0 || mb_strlen($nome) < 2) out(['ok' => false, 'code' => 'dados_invalidos']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) out(['ok' => false, 'code' => 'email_invalido']);
        if (mb_strlen($senha) < 10) out(['ok' => false, 'code' => 'senha_curta', 'dica' => 'Use pelo menos 10 caracteres.']);
        $st = db()->prepare('INSERT INTO ipa_gestores (empresa_id, nome, email, senha_hash) VALUES (?,?,?,?)');
        $st->execute([$empresaId, $nome, $email, hash_senha($senha)]);
        out(['ok' => true, 'id' => (int)db()->lastInsertId()]);
    }

    if ($action === 'gestor_list') {
        exigir_admin();
        $rows = db()->query(
            'SELECT g.id, g.nome, g.email, g.ativo, g.criado_em, e.nome AS empresa
             FROM ipa_gestores g JOIN ipa_empresas e ON e.id = g.empresa_id
             ORDER BY e.nome, g.nome')->fetchAll();
        foreach ($rows as &$r) { $r['id'] = (int)$r['id']; $r['ativo'] = (int)$r['ativo']; }
        out(['ok' => true, 'rows' => $rows]);
    }

    if ($action === 'gestor_toggle') {
        exigir_admin(); exigir_csrf($data);
        $st = db()->prepare('UPDATE ipa_gestores SET ativo = ? WHERE id = ?');
        $st->execute([(int)!empty($data['ativo']), (int)($data['id'] ?? 0)]);
        out(['ok' => true]);
    }

    if ($action === 'gestor_senha') {
        exigir_admin(); exigir_csrf($data);
        $senha = (string)($data['senha'] ?? '');
        if (mb_strlen($senha) < 10) out(['ok' => false, 'code' => 'senha_curta']);
        $st = db()->prepare('UPDATE ipa_gestores SET senha_hash = ? WHERE id = ?');
        $st->execute([hash_senha($senha), (int)($data['id'] ?? 0)]);
        out(['ok' => true]);
    }

    /* ===== painel da empresa (GESTOR; admin pode informar empresa_id) ===== */
    if ($action === 'dash') {
        exigir_login();
        $empresaId = e_admin() ? (int)($data['empresa_id'] ?? 0) : empresa_sessao();
        if ($empresaId <= 0) out(['ok' => false, 'code' => 'empresa_invalida']);

        $st = db()->prepare('SELECT id, nome, codigo, ativo FROM ipa_empresas WHERE id = ? LIMIT 1');
        $st->execute([$empresaId]);
        $empresa = $st->fetch();
        if (!$empresa) out(['ok' => false, 'code' => 'empresa_invalida']);

        $st = db()->prepare(
            "SELECT criado_em AS data, nome, funcao, predominante, regra,
                    score_a AS A, score_c AS C, score_p AS P, score_e AS E,
                    token, (relatorio IS NOT NULL AND relatorio <> '') AS tem_rel
             FROM ipa_respostas WHERE empresa_id = ? ORDER BY nome, criado_em");
        $st->execute([$empresaId]);
        $funcionarios = $st->fetchAll();
        foreach ($funcionarios as &$f) {
            $f['A'] = (int)$f['A']; $f['C'] = (int)$f['C']; $f['P'] = (int)$f['P']; $f['E'] = (int)$f['E'];
            $f['link'] = $f['tem_rel'] ? ('../api/api.php?action=relatorio&token=' . $f['token']) : '';
            unset($f['token'], $f['tem_rel']);
        }
        unset($f);

        $st = db()->prepare('SELECT avaliado, COUNT(*) AS n FROM ipa_360 WHERE empresa_id = ? GROUP BY avaliado');
        $st->execute([$empresaId]);
        $av360 = $st->fetchAll();
        foreach ($av360 as &$a) { $a['n'] = (int)$a['n']; }

        out(['ok' => true,
             'empresa' => ['id' => (int)$empresa['id'], 'nome' => $empresa['nome'],
                           'codigo' => e_admin() ? $empresa['codigo'] : null],
             'funcionarios' => $funcionarios,
             'avaliacoes360' => $av360,
             'csrf' => csrf_token()]);
    }

    out(['ok' => false, 'code' => 'acao_desconhecida']);

} catch (PDOException $e) {
    if ($e->getCode() === '23000') out(['ok' => false, 'code' => 'duplicado',
        'dica' => 'Já existe um registro com esse nome/e-mail.']);
    out(['ok' => false, 'code' => 'db_error']);
} catch (Throwable $e) {
    out(['ok' => false, 'code' => 'error']);
}
