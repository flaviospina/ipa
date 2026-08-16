<?php
/**
 * Avaliações concluídas — a primeira tela que mostra dados do banco.
 * O escopo por empresa é aplicado na consulta, como em todo o painel.
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/layout.php';

$eu     = Auth::exigirLogin();
$escopo = Auth::escopoEmpresa();          // null = administrador geral

$sql = "SELECT a.uuid, a.concluida_em,
               a.score_a, a.score_c, a.score_p, a.score_e,
               a.estilo_predominante, a.regra_flexibilidade,
               p.nome AS participante, p.funcao,
               e.nome AS empresa_nome,
               (r.id IS NOT NULL) AS tem_relatorio
          FROM avaliacoes a
          JOIN participantes p ON p.id = a.participante_id
          JOIN empresas     e ON e.id = a.empresa_id
     LEFT JOIN relatorios   r ON r.avaliacao_id = a.id
         WHERE a.status = 'concluida' AND a.tipo = 'auto'";
$par = [];
if ($escopo !== null) {
    $sql .= ' AND a.empresa_id = ?';
    $par[] = $escopo;
}
$sql .= ' ORDER BY a.concluida_em DESC LIMIT 300';
$avaliacoes = Db::todos($sql, $par);

function rotuloRegra(?string $r): string
{
    return [
        'EQUILIBRADO_MODELO'  => 'Equilibrado (modelo)',
        'EQUILIBRADO_NATURAL' => 'Equilibrado natural',
        'FLEXIVEL'            => 'Flexível',
        'FORTE_APEGO'         => 'Forte apego',
    ][$r] ?? '—';
}

abrirPagina('Avaliações', $eu, 'avaliacoes.php');
?>
<h1>Avaliações</h1>
<p class="linha-apoio">
  Diagnósticos gravados no banco, com os scores recalculados no servidor.
  <?= $escopo === null ? 'Todas as empresas.' : '' ?>
</p>

<?php if (!$avaliacoes): ?>
  <div class="bloco vazio-guia">
    <h2>Nenhuma avaliação gravada ainda</h2>
    <p>O questionário grava aqui automaticamente ao ser concluído. Use o link com o identificador da
       empresa — ele aparece na tela <strong>Empresas</strong> — para que cada resposta entre já
       vinculada à empresa certa.</p>
  </div>
<?php else: ?>
<div class="tabela-rolagem">
<table class="tabela">
  <thead><tr>
    <th>Concluída em</th><th>Participante</th><th>Função</th>
    <?php if ($escopo === null): ?><th>Empresa</th><?php endif; ?>
    <th class="num">A</th><th class="num">C</th><th class="num">P</th><th class="num">E</th>
    <th>Predominante</th><th>Flexibilidade</th><th>Relatório</th>
  </tr></thead>
  <tbody>
  <?php foreach ($avaliacoes as $a): ?>
    <tr>
      <td><?= dataBr($a['concluida_em']) ?></td>
      <td><strong><?= e($a['participante']) ?></strong></td>
      <td><?= e($a['funcao'] ?? '') ?></td>
      <?php if ($escopo === null): ?><td><?= e($a['empresa_nome']) ?></td><?php endif; ?>
      <td class="num scores"><?= (int)$a['score_a'] ?></td>
      <td class="num scores"><?= (int)$a['score_c'] ?></td>
      <td class="num scores"><?= (int)$a['score_p'] ?></td>
      <td class="num scores"><?= (int)$a['score_e'] ?></td>
      <td><span class="est est-<?= e($a['estilo_predominante']) ?>"><?= e($a['estilo_predominante']) ?></span></td>
      <td><?= e(rotuloRegra($a['regra_flexibilidade'])) ?></td>
      <td>
        <?php if ($a['tem_relatorio']): ?>
          <a href="relatorio.php?uuid=<?= e($a['uuid']) ?>" target="_blank" rel="noopener">abrir</a>
        <?php else: ?>
          <span class="muted">—</span>
        <?php endif; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>
<?php endif; ?>
<?php fecharPagina();
