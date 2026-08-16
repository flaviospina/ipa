<?php
/**
 * Registro de auditoria.
 *
 * Grava quem fez o quê e quando. É o que permite responder "houve acesso
 * indevido?" com fato em vez de suposição — exigência prática da LGPD
 * quando o sistema guarda dados comportamentais de funcionários.
 *
 * Nunca registra senha, token ou conteúdo de relatório.
 */
declare(strict_types=1);

require_once __DIR__ . '/Db.php';

final class Audit
{
    public static function registrar(
        ?int $usuarioId,
        ?int $empresaId,
        string $acao,
        ?string $entidade = null,
        ?int $entidadeId = null,
        array $detalhes = []
    ): void {
        try {
            Db::q(
                'INSERT INTO log_auditoria (usuario_id, empresa_id, acao, entidade, entidade_id, detalhes, ip)
                 VALUES (?, ?, ?, ?, ?, ?, INET6_ATON(?))',
                [
                    $usuarioId,
                    $empresaId,
                    mb_substr($acao, 0, 60),
                    $entidade === null ? null : mb_substr($entidade, 0, 40),
                    $entidadeId,
                    $detalhes ? json_encode($detalhes, JSON_UNESCAPED_UNICODE) : null,
                    $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
                ]
            );
        } catch (Throwable $e) {
            // auditoria nunca derruba a operação que estava sendo auditada
            error_log('[vipedia] falha ao registrar auditoria: ' . $e->getMessage());
        }
    }
}
