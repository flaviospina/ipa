<?php
/**
 * Autenticação e escopo de acesso.
 *
 * Duas garantias que este arquivo carrega:
 *
 * 1. SENHA nunca é guardada nem comparada em texto. password_hash() na
 *    gravação, password_verify() na conferência.
 * 2. ESCOPO — escopoEmpresa() devolve o id da empresa do usuário logado, ou
 *    null quando ele é o administrador geral. Toda consulta que lê dados de
 *    cliente aplica esse filtro. Um administrador de empresa não alcança
 *    outra nem forçando a URL, porque o filtro está na consulta, não na tela.
 */
declare(strict_types=1);

require_once __DIR__ . '/Db.php';
require_once __DIR__ . '/Audit.php';

final class Auth
{
    /** Hash válido usado só para gastar o mesmo tempo quando o e-mail não existe. */
    private const HASH_ISCA = '$2y$12$h4fSIVT52DsOMUINbQ0mx.wLwOK9pIQTPA.VgzQIy6I32F3dJTGXu';

    private static ?array $usuario = null;
    private static bool $carregado = false;

    public static function iniciarSessao(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => (bool)Db::opcao('app.cookie_seguro', true),
            'httponly' => true,          // JavaScript não enxerga o cookie
            'samesite' => 'Lax',         // não viaja em requisição de outro site
        ]);
        session_name('vipedia_sess');
        session_start();
    }

    /* ---------------------------------------------------------------- login */

    /** @return array{ok:bool, erro?:string, trocar_senha?:bool} */
    public static function entrar(string $email, string $senha): array
    {
        self::iniciarSessao();
        $email   = mb_strtolower(trim($email));
        $recusa  = ['ok' => false, 'erro' => 'E-mail ou senha incorretos.'];
        $usuario = Db::um('SELECT * FROM usuarios WHERE email = ?', [$email]);

        if (!$usuario) {
            // conferência falsa: o tempo de resposta não denuncia se o e-mail existe
            password_verify($senha, self::HASH_ISCA);
            Audit::registrar(null, null, 'login_falha', 'usuarios', null, ['email' => $email, 'motivo' => 'inexistente']);
            return $recusa;
        }

        if ($usuario['status'] !== 'ativo') {
            Audit::registrar((int)$usuario['id'], self::empresaDe($usuario), 'login_falha', 'usuarios', (int)$usuario['id'], ['motivo' => 'status_' . $usuario['status']]);
            return ['ok' => false, 'erro' => 'Esta conta está inativa. Procure o administrador.'];
        }

        if ($usuario['bloqueado_ate'] !== null && strtotime((string)$usuario['bloqueado_ate']) > time()) {
            $ate = date('H:i', strtotime((string)$usuario['bloqueado_ate']));
            return ['ok' => false, 'erro' => "Conta bloqueada por excesso de tentativas. Tente de novo às {$ate}."];
        }

        if (!password_verify($senha, $usuario['senha_hash'])) {
            self::registrarFalha($usuario);
            return $recusa;
        }

        // senha correta — atualiza o hash se o custo padrão do PHP mudou
        if (password_needs_rehash($usuario['senha_hash'], PASSWORD_DEFAULT)) {
            Db::q('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [password_hash($senha, PASSWORD_DEFAULT), $usuario['id']]);
        }

        Db::q(
            'UPDATE usuarios SET ultimo_login_em = NOW(), tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ?',
            [$usuario['id']]
        );

        self::abrirSessao((int)$usuario['id']);
        Audit::registrar((int)$usuario['id'], self::empresaDe($usuario), 'login_ok', 'usuarios', (int)$usuario['id']);

        return ['ok' => true, 'trocar_senha' => (bool)$usuario['trocar_senha']];
    }

    private static function registrarFalha(array $usuario): void
    {
        $max      = (int)Db::opcao('login.max_tentativas', 5);
        $minutos  = (int)Db::opcao('login.bloqueio_minutos', 15);
        $falhas   = (int)$usuario['tentativas_falhas'] + 1;

        if ($falhas >= $max) {
            Db::q(
                'UPDATE usuarios SET tentativas_falhas = ?, bloqueado_ate = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
                [$falhas, $minutos, $usuario['id']]
            );
            Audit::registrar((int)$usuario['id'], self::empresaDe($usuario), 'conta_bloqueada', 'usuarios', (int)$usuario['id'], ['tentativas' => $falhas]);
        } else {
            Db::q('UPDATE usuarios SET tentativas_falhas = ? WHERE id = ?', [$falhas, $usuario['id']]);
        }
        Audit::registrar((int)$usuario['id'], self::empresaDe($usuario), 'login_falha', 'usuarios', (int)$usuario['id'], ['motivo' => 'senha']);
    }

    private static function abrirSessao(int $usuarioId): void
    {
        session_regenerate_id(true); // impede fixação de sessão

        $token   = bin2hex(random_bytes(32));
        $minutos = (int)Db::opcao('sessao.duracao_minutos', 120);

        Db::q(
            'INSERT INTO sessoes (id, usuario_id, ip, user_agent, expira_em)
             VALUES (?, ?, INET6_ATON(?), ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
            [
                hash('sha256', $token),
                $usuarioId,
                $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
                mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
                $minutos,
            ]
        );

        $_SESSION['uid']   = $usuarioId;
        $_SESSION['token'] = $token;
    }

    public static function sair(): void
    {
        self::iniciarSessao();
        if (!empty($_SESSION['token'])) {
            Db::q('UPDATE sessoes SET encerrada_em = NOW() WHERE id = ?', [hash('sha256', $_SESSION['token'])]);
        }
        $u = self::usuario();
        if ($u) {
            Audit::registrar((int)$u['id'], self::empresaDe($u), 'logout', 'usuarios', (int)$u['id']);
        }
        $_SESSION = [];
        session_destroy();
        self::$usuario  = null;
        self::$carregado = true;
    }

    /* -------------------------------------------------------------- consulta */

    public static function usuario(): ?array
    {
        if (self::$carregado) {
            return self::$usuario;
        }
        self::$carregado = true;
        self::iniciarSessao();

        if (empty($_SESSION['uid']) || empty($_SESSION['token'])) {
            return self::$usuario = null;
        }

        $sessao = Db::um(
            'SELECT usuario_id FROM sessoes
              WHERE id = ? AND encerrada_em IS NULL AND expira_em > NOW()',
            [hash('sha256', $_SESSION['token'])]
        );
        if (!$sessao || (int)$sessao['usuario_id'] !== (int)$_SESSION['uid']) {
            return self::$usuario = null; // sessão revogada, expirada ou adulterada
        }

        $u = Db::um(
            "SELECT u.*, e.nome AS empresa_nome
               FROM usuarios u
          LEFT JOIN empresas e ON e.id = u.empresa_id
              WHERE u.id = ? AND u.status = 'ativo'",
            [(int)$sessao['usuario_id']]
        );
        if (!$u) {
            return self::$usuario = null;
        }

        // renova a janela de expiração a cada requisição autenticada
        Db::q(
            'UPDATE sessoes SET ultima_em = NOW(), expira_em = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
            [(int)Db::opcao('sessao.duracao_minutos', 120), hash('sha256', $_SESSION['token'])]
        );

        return self::$usuario = $u;
    }

    public static function logado(): bool
    {
        return self::usuario() !== null;
    }

    public static function ehAdminGeral(): bool
    {
        $u = self::usuario();
        return $u !== null && $u['papel'] === 'admin_geral';
    }

    /**
     * Empresa a que o usuário logado está restrito.
     * null = administrador geral, enxerga todas as empresas.
     */
    public static function escopoEmpresa(): ?int
    {
        $u = self::usuario();
        if ($u === null || $u['papel'] === 'admin_geral') {
            return null;
        }
        return (int)$u['empresa_id'];
    }

    /** O usuário logado pode acessar dados desta empresa? */
    public static function alcanca(int $empresaId): bool
    {
        $escopo = self::escopoEmpresa();
        return self::ehAdminGeral() ? true : $escopo === $empresaId;
    }

    /* ------------------------------------------------------------- proteção */

    public static function exigirLogin(): array
    {
        $u = self::usuario();
        if ($u === null) {
            self::redirecionar('login.php');
        }
        // senha definida pelo administrador: troca obrigatória antes de qualquer outra tela
        if ((int)$u['trocar_senha'] === 1 && basename((string)($_SERVER['SCRIPT_NAME'] ?? '')) !== 'senha.php') {
            self::redirecionar('senha.php');
        }
        return $u;
    }

    /** @param string[] $papeis */
    public static function exigirPapel(array $papeis): array
    {
        $u = self::exigirLogin();
        if (!in_array($u['papel'], $papeis, true)) {
            Audit::registrar((int)$u['id'], self::empresaDe($u), 'acesso_negado', null, null, [
                'tela'   => basename((string)($_SERVER['SCRIPT_NAME'] ?? '')),
                'papel'  => $u['papel'],
            ]);
            http_response_code(403);
            exit('<h1>403</h1><p>Você não tem permissão para acessar esta área.</p>');
        }
        return $u;
    }

    /* --------------------------------------------------------------- senhas */

    /** Regras mínimas de senha. @return string[] lista de problemas (vazia = ok) */
    public static function criticarSenha(string $senha): array
    {
        $erros = [];
        if (mb_strlen($senha) < 10)        { $erros[] = 'ter pelo menos 10 caracteres'; }
        if (!preg_match('/[a-zà-ÿ]/u', $senha)) { $erros[] = 'conter uma letra minúscula'; }
        if (!preg_match('/[A-ZÀ-Ý]/u', $senha)) { $erros[] = 'conter uma letra maiúscula'; }
        if (!preg_match('/\d/', $senha))   { $erros[] = 'conter um número'; }
        return $erros;
    }

    public static function definirSenha(int $usuarioId, string $senha, bool $temporaria = false): void
    {
        Db::q(
            'UPDATE usuarios SET senha_hash = ?, trocar_senha = ?, tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ?',
            [password_hash($senha, PASSWORD_DEFAULT), $temporaria ? 1 : 0, $usuarioId]
        );
    }

    /** Senha inicial legível, gerada por sorteio — sem caracteres ambíguos. */
    public static function gerarSenhaTemporaria(): string
    {
        $letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $baixas = 'abcdefghijkmnopqrstuvwxyz';
        $nums   = '23456789';
        $senha  = $letras[random_int(0, strlen($letras) - 1)];
        for ($i = 0; $i < 7; $i++) { $senha .= $baixas[random_int(0, strlen($baixas) - 1)]; }
        for ($i = 0; $i < 3; $i++) { $senha .= $nums[random_int(0, strlen($nums) - 1)]; }
        return $senha;
    }

    /* -------------------------------------------------------------- auxiliar */

    private static function empresaDe(array $usuario): ?int
    {
        return $usuario['empresa_id'] === null ? null : (int)$usuario['empresa_id'];
    }

    public static function redirecionar(string $destino): never
    {
        header('Location: ' . $destino);
        exit;
    }
}
