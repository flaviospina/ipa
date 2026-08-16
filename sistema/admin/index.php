<?php
/**
 * Início do painel. Mostra o panorama dentro do escopo do usuário:
 * o administrador geral vê o sistema todo; o da empresa, só a dele.
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/layout.php';

$eu     = Auth::exigirLogin();
$escopo = Auth::escopoEmpresa();          // null = administrador geral

$onde = $escopo === null ? '' : ' WHERE empresa_id = ?';
$par  = $escopo === null ? [] : [$escopo];

$numeros = [
    'participantes' => (int)Db::valor("SELECT COUNT(*) FROM participantes{$onde}", $par),
    'avaliacoes'    => (int)Db::valor(
        "SELECT COUNT(*) FROM avaliacoes WHERE status = 'concluida'" .
        ($escopo === null ? '' : ' AND empresa_id = ?'), $par),
    'ciclos'        => (int)Db::valor(
        "SELECT COUNT(*) FROM ciclos_360 WHERE status = 'aberto'" .
        ($escopo === null ? '' : ' AND empresa_id = ?'), $par),
];
if ($escopo === null) {
    $numeros['empresas'] = (int)Db::valor("SELECT COUNT(*) FROM empresas WHERE status = 'ativa'");
}

$recentes = Db::todos(
    "SELECT l.acao, l.criado_em, u.nome AS usuario, e.nome AS empresa
       FROM log_auditoria l
  LEFT JOIN usuarios u ON u.id = l.usuario_id
  LEFT JOIN empresas e ON e.id = l.empresa_id" .
    ($escopo === null ? '' : ' WHERE l.empresa_id = ?') .
    ' ORDER BY l.criado_em DESC LIMIT 12',
    $par
);

abrirPagina('Início', $eu, 'index.php');
?>
<h1>Olá, <?= e(explode(' ', trim($eu['nome']))[0]) ?></h1>
<p class="linha-apoio">
  <?= $escopo === null
      ? 'Você é o administrador geral: enxerga todas as empresas do sistema.'
      : 'Painel de ' . e((string)$eu['empresa_nome']) . '.' ?>
</p>

<div class="cartoes">
  <?php if (isset($numeros['empresas'])): ?>
  <a class="cartao" href="empresas.php">
    <span class="cartao-n"><?= $numeros['empresas'] ?></span>
    <span class="cartao-r">empresas ativas</span>
  </a>
  <?php endif; ?>
  <div class="cartao">
    <span class="cartao-n"><?= $numeros['participantes'] ?></span>
    <span class="cartao-r">participantes</span>
  </div>
  <a class="cartao" href="avaliacoes.php">
    <span class="cartao-n"><?= $numeros['avaliacoes'] ?></span>
    <span class="cartao-r">avaliações concluídas</span>
  </a>
  <div class="cartao">
    <span class="cartao-n"><?= $numeros['ciclos'] ?></span>
    <span class="cartao-r">ciclos 360° abertos</span>
  </div>
</div>

<?php if ($numeros['avaliacoes'] === 0): ?>
  <div class="bloco vazio-guia">
    <h2>Ainda não há avaliações no banco</h2>
    <p>O questionário grava aqui automaticamente ao ser concluído. Compartilhe o link do questionário
       com o identificador da empresa — ele aparece na tela <strong>Empresas</strong> — para que cada
       resposta entre já vinculada à empresa certa.</p>
  </div>
<?php endif; ?>

<?php if (Auth::ehAdminGeral()): ?>
  <p class="linha-apoio" style="margin-top:6px">
    Algo não está gravando? Abra o <a href="../status.php">diagnóstico do sistema</a> —
    ele testa PHP, arquivos, banco, APIs e a fila local do navegador, e diz onde corrigir.
  </p>
<?php endif; ?>

<h2 class="secao">Atividade recente</h2>
<div class="tabela-rolagem">
<table class="tabela">
  <thead><tr><th>Quando</th><th>Ação</th><th>Usuário</th><?php if ($escopo === null): ?><th>Empresa</th><?php endif; ?></tr></thead>
  <tbody>
  <?php if (!$recentes): ?>
    <tr><td colspan="4" class="vazio">Nada registrado ainda.</td></tr>
  <?php endif; ?>
  <?php foreach ($recentes as $r): ?>
    <tr>
      <td><?= dataBr($r['criado_em']) ?></td>
      <td><code><?= e($r['acao']) ?></code></td>
      <td><?= $r['usuario'] ? e($r['usuario']) : '<span class="muted">—</span>' ?></td>
      <?php if ($escopo === null): ?>
        <td><?= $r['empresa'] ? e($r['empresa']) : '<span class="muted">—</span>' ?></td>
      <?php endif; ?>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>
<?php fecharPagina();
