<?php
/**
 * Exibe o relatório arquivado de uma avaliação.
 *
 * Controle de acesso: exige login e a avaliação precisa estar no escopo do
 * usuário. Fora do escopo a resposta é 404 — não confirmamos a existência
 * de dados de outra empresa.
 *
 * O HTML armazenado foi gerado no navegador do respondente, então é tratado
 * como conteúdo não confiável: o CSP abaixo impede execução de script na
 * visualização. O relatório usa apenas HTML e CSS inline, que continuam
 * funcionando normalmente.
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/Auth.php';

$eu   = Auth::exigirLogin();
$uuid = trim((string)($_GET['uuid'] ?? ''));

$aval = $uuid === '' ? null : Db::um(
    'SELECT a.id, a.empresa_id, r.html
       FROM avaliacoes a
  LEFT JOIN relatorios r ON r.avaliacao_id = a.id
      WHERE a.uuid = ?',
    [$uuid]
);

if (!$aval || !Auth::alcanca((int)$aval['empresa_id'])) {
    http_response_code(404);
    exit('<h1>404</h1><p>Relatório não encontrado.</p>');
}
if (empty($aval['html'])) {
    http_response_code(404);
    exit('<h1>404</h1><p>Esta avaliação ainda não tem relatório arquivado.</p>');
}

Audit::registrar((int)$eu['id'], (int)$aval['empresa_id'], 'relatorio_visto', 'relatorios', (int)$aval['id'], ['uuid' => $uuid]);

header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:");
header('X-Robots-Tag: noindex, nofollow');
echo $aval['html'];
