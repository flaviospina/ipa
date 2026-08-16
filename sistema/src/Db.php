<?php
/**
 * Conexão com o banco itthri79_vipedia.
 *
 * Toda consulta do sistema passa por aqui, sempre com prepared statement:
 * valor de usuário nunca é concatenado em SQL.
 */
declare(strict_types=1);

final class Db
{
    private static ?PDO $pdo = null;
    private static ?array $cfg = null;

    /** Configuração lida de config/config.php (fora do controle de versão). */
    public static function config(): array
    {
        if (self::$cfg === null) {
            $arquivo = __DIR__ . '/../config/config.php';
            if (!is_file($arquivo)) {
                throw new RuntimeException(
                    'config/config.php não encontrado. Copie config/config.exemplo.php ' .
                    'para config/config.php e preencha os dados do banco.'
                );
            }
            self::$cfg = require $arquivo;
        }
        return self::$cfg;
    }

    public static function opcao(string $caminho, mixed $padrao = null): mixed
    {
        $atual = self::config();
        foreach (explode('.', $caminho) as $parte) {
            if (!is_array($atual) || !array_key_exists($parte, $atual)) {
                return $padrao;
            }
            $atual = $atual[$parte];
        }
        return $atual;
    }

    public static function conn(): PDO
    {
        if (self::$pdo === null) {
            $c = self::config()['db'];
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $c['host'],
                (int)($c['porta'] ?? 3306),
                $c['nome']
            );
            self::$pdo = new PDO($dsn, $c['usuario'], $c['senha'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false, // prepared statements de verdade, no servidor
            ]);
        }
        return self::$pdo;
    }

    public static function q(string $sql, array $params = []): PDOStatement
    {
        $st = self::conn()->prepare($sql);
        $st->execute($params);
        return $st;
    }

    public static function um(string $sql, array $params = []): ?array
    {
        $linha = self::q($sql, $params)->fetch();
        return $linha === false ? null : $linha;
    }

    public static function todos(string $sql, array $params = []): array
    {
        return self::q($sql, $params)->fetchAll();
    }

    public static function valor(string $sql, array $params = []): mixed
    {
        $v = self::q($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    public static function inserir(string $sql, array $params = []): int
    {
        self::q($sql, $params);
        return (int)self::conn()->lastInsertId();
    }
}
