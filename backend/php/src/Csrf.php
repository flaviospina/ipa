<?php
/**
 * Proteção contra CSRF.
 *
 * Sem isto, uma página de outro site poderia enviar um formulário para o
 * painel usando a sessão já aberta do administrador — criando empresa,
 * usuário ou trocando senha sem que ele perceba. Todo POST do painel
 * carrega e confere este token.
 */
declare(strict_types=1);

require_once __DIR__ . '/Auth.php';

final class Csrf
{
    public static function token(): string
    {
        Auth::iniciarSessao();
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }

    /** Campo oculto pronto para colar dentro do <form>. */
    public static function campo(): string
    {
        return '<input type="hidden" name="_csrf" value="' . htmlspecialchars(self::token(), ENT_QUOTES) . '">';
    }

    public static function valido(?string $enviado): bool
    {
        Auth::iniciarSessao();
        if (empty($_SESSION['csrf']) || $enviado === null || $enviado === '') {
            return false;
        }
        return hash_equals($_SESSION['csrf'], $enviado); // comparação em tempo constante
    }

    /** Interrompe a requisição se o token não conferir. */
    public static function exigir(): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            return;
        }
        if (!self::valido($_POST['_csrf'] ?? null)) {
            http_response_code(419);
            exit('<h1>Sessão expirada</h1><p>Recarregue a página e envie o formulário novamente.</p>');
        }
    }
}
