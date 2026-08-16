<?php
/**
 * Detalhe de um ciclo 360°: convites, acompanhamento e resultado consolidado.
 *
 * Os LINKS dos convites aparecem UMA única vez, na resposta da geração —
 * o banco guarda apenas o hash do token. Se um link se perder, cancele o
 * convite e gere outro.
 *
 * O consolidado compara a autoavaliação do participante com as médias das
 * avaliações externas. Médias por relação só aparecem quando a relação
 * atinge o mínimo de respostas do ciclo (anonimato).
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/layout.php';
require_once __DIR__ . '/../src/Ipa.php';

$eu     = Auth::exigirPapel(['admin_geral', 'admin_empresa', 'consultor']);
$cicloId = (int)($_GET['id'] ?? 0);

$ciclo = Db::um(
    "SELECT ci.*, p.nome AS avaliado, p.funcao, e.nome AS empresa_nome
       FROM ciclos_360 ci
       JOIN participantes p ON p.id = ci.participante_id
       JOIN empresas e      ON e.id = ci.empresa_id
      WHERE ci.id = ?",
    [$cicloId]
);
if (!$ciclo || !Auth::alcanca((int)$ciclo['empresa_id'])) {
    http_response_code(404);
    exit('<h1>404</h1><p>Ciclo não encontrado.</p>');
}

$RELACOES = ['gestor', 'par', 'liderado', 'cliente_interno', 'outro'];
$erros = [];
$linksGerados = [];   // [rotulo => url] — exibidos uma única vez

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    Csrf::exigir();
    $acao = (string)($_POST['acao'] ?? '');

    if ($acao === 'gerar' && $ciclo['status'] === 'aberto') {
        $validade = max(1, min(120, (int)($_POST['validade_dias'] ?? 30)));
        $base = rtrim((string)Db::opcao('app.base_url', ''), '/');
        $totalNovos = 0;
        foreach ($RELACOES as $rel) {
            $qtd = max(0, min(20, (int)($_POST['qtd_' . $rel] ?? 0)));
            for ($i = 0; $i < $qtd; $i++) {
                $token = bin2hex(random_bytes(20));   // 40 hex — só existe nesta resposta
                Db::inserir(
                    "INSERT INTO convites_360 (ciclo_id, relacao, token_hash, status, enviado_em, expira_em)
                     VALUES (?, ?, ?, 'enviado', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))",
                    [$cicloId, $rel, hash('sha256', $token), $validade]
                );
                $n = count(array_filter($linksGerados, fn($k) => str_starts_with($k, Ipa::rotuloRelacao($rel)), ARRAY_FILTER_USE_KEY)) + 1;
                $linksGerados[Ipa::rotuloRelacao($rel) . ' ' . $n] = $base . '/webapp/360.html?convite=' . $token;
                $totalNovos++;
            }
        }
        if ($totalNovos === 0) {
            $erros[] = 'Informe quantos convites gerar em pelo menos uma relação.';
        } else {
            Audit::registrar((int)$eu['id'], (int)$ciclo['empresa_id'], 'convites360_gerados', 'ciclos_360', $cicloId, ['qtd' => $totalNovos]);
        }
    }

    if ($acao === 'cancelar_convite') {
        $convId = (int)($_POST['convite_id'] ?? 0);
        $conv = Db::um('SELECT id, status FROM convites_360 WHERE id = ? AND ciclo_id = ?', [$convId, $cicloId]);
        if ($conv && $conv['status'] !== 'respondido') {
            Db::q("UPDATE convites_360 SET status = 'cancelado' WHERE id = ?", [$convId]);
            Audit::registrar((int)$eu['id'], (int)$ciclo['empresa_id'], 'convite360_cancelado', 'convites_360', $convId);
            recado('Convite cancelado.');
        }
        Auth::redirecionar('ciclo.php?id=' . $cicloId);
    }

    if ($acao === 'fechar' || $acao === 'reabrir') {
        $novo = $acao === 'fechar' ? 'fechado' : 'aberto';
        Db::q(
            "UPDATE ciclos_360 SET status = ?, fechado_em = " . ($novo === 'fechado' ? 'NOW()' : 'NULL') . " WHERE id = ?",
            [$novo, $cicloId]
        );
        Audit::registrar((int)$eu['id'], (int)$ciclo['empresa_id'], 'ciclo360_' . $novo, 'ciclos_360', $cicloId);
        recado($novo === 'fechado' ? 'Ciclo fechado — os links de convite param de aceitar respostas.' : 'Ciclo reaberto.');
        Auth::redirecionar('ciclo.php?id=' . $cicloId);
    }

    // recarrega o estado após ações que não redirecionam (gerar)
    $ciclo = array_merge($ciclo, Db::um('SELECT status FROM ciclos_360 WHERE id = ?', [$cicloId]) ?? []);
}

/* ------------------------------------------------------------- consultas */
$convites = Db::todos(
    'SELECT * FROM convites_360 WHERE ciclo_id = ? ORDER BY relacao, criado_em',
    [$cicloId]
);

$auto = Db::um(
    "SELECT score_a, score_c, score_p, score_e, concluida_em
       FROM avaliacoes
      WHERE participante_id = ? AND tipo = 'auto' AND status = 'concluida'
   ORDER BY concluida_em DESC LIMIT 1",
    [(int)$ciclo['participante_id']]
);

$externas = Db::todos(
    "SELECT relacao, COUNT(*) AS n,
            AVG(score_a) AS ma, AVG(score_c) AS mc, AVG(score_p) AS mp, AVG(score_e) AS me
       FROM avaliacoes
      WHERE ciclo_id = ? AND tipo = '360' AND status = 'concluida'
   GROUP BY relacao",
    [$cicloId]
);
$totalRespostas = array_sum(array_map(fn($x) => (int)$x['n'], $externas));
$min = (int)$ciclo['min_avaliadores'];

$geral = $totalRespostas > 0 ? Db::um(
    "SELECT COUNT(*) AS n, AVG(score_a) AS ma, AVG(score_c) AS mc, AVG(score_p) AS mp, AVG(score_e) AS me
       FROM avaliacoes WHERE ciclo_id = ? AND tipo = '360' AND status = 'concluida'",
    [$cicloId]
) : null;

abrirPagina('Ciclo 360° — ' . $ciclo['avaliado'], $eu, 'ciclos.php');
?>
<p class="linha-apoio" style="margin-bottom:4px"><a href="ciclos.php">← Ciclos 360°</a></p>
<h1><?= e($ciclo['avaliado']) ?></h1>
<p class="linha-apoio">
  <?= e($ciclo['empresa_nome']) ?><?= $ciclo['funcao'] ? ' · ' . e($ciclo['funcao']) : '' ?>
  · ciclo <strong><?= e($ciclo['status']) ?></strong>
  · mínimo de <?= $min ?> resposta<?= $min > 1 ? 's' : '' ?> por relação para exibir médias
  <?= $ciclo['prazo'] ? ' · prazo ' . dataBr($ciclo['prazo'], false) : '' ?>
</p>

<?php foreach ($erros as $msg): ?>
  <div class="recado erro"><?= e($msg) ?></div>
<?php endforeach; ?>

<?php if ($linksGerados): ?>
  <div class="cartao-senha">
    <h2>Convites gerados — copie os links agora</h2>
    <p><strong>Os links aparecem só nesta tela.</strong> O sistema guarda apenas uma impressão digital
       de cada um. Distribua por WhatsApp ou e-mail; cada link aceita uma única resposta.</p>
    <textarea class="links-360" readonly rows="<?= min(12, count($linksGerados) + 1) ?>" onclick="this.select()"><?php
      foreach ($linksGerados as $rotulo => $url) { echo $rotulo . ":\n" . $url . "\n"; }
    ?></textarea>
    <p class="obs">Se um link se perder, cancele o convite na lista abaixo e gere outro.</p>
  </div>
<?php endif; ?>

<?php if ($ciclo['status'] === 'aberto'): ?>
<details class="bloco" <?= $erros ? 'open' : '' ?>>
  <summary>Gerar convites</summary>
  <form method="post" class="form form-2col">
    <?= Csrf::campo() ?>
    <input type="hidden" name="acao" value="gerar">
    <?php foreach ($RELACOES as $rel): ?>
      <div>
        <label for="qtd_<?= e($rel) ?>"><?= e(Ipa::rotuloRelacao($rel)) ?></label>
        <input type="number" id="qtd_<?= e($rel) ?>" name="qtd_<?= e($rel) ?>" min="0" max="20" value="0">
      </div>
    <?php endforeach; ?>
    <div>
      <label for="validade_dias">Validade dos links (dias)</label>
      <input type="number" id="validade_dias" name="validade_dias" min="1" max="120" value="30">
    </div>
    <div class="col-cheia acoes">
      <button type="submit">Gerar links de convite</button>
    </div>
  </form>
</details>
<?php endif; ?>

<h2 class="secao">Convites</h2>
<div class="tabela-rolagem">
<table class="tabela">
  <thead><tr><th>Relação</th><th>Situação</th><th>Gerado em</th><th>Respondido em</th><th>Expira</th><th></th></tr></thead>
  <tbody>
  <?php if (!$convites): ?>
    <tr><td colspan="6" class="vazio">Nenhum convite gerado ainda.</td></tr>
  <?php endif; ?>
  <?php foreach ($convites as $c): ?>
    <tr>
      <td><?= e(Ipa::rotuloRelacao((string)$c['relacao'])) ?></td>
      <td><span class="selo <?= $c['status'] === 'respondido' ? 'ativo' : ($c['status'] === 'cancelado' ? 'bloqueado' : '') ?>"><?= e($c['status']) ?></span></td>
      <td><?= dataBr($c['criado_em']) ?></td>
      <td><?= dataBr($c['respondido_em']) ?></td>
      <td><?= dataBr($c['expira_em'], false) ?></td>
      <td class="acoes-linha">
        <?php if (!in_array($c['status'], ['respondido', 'cancelado'], true)): ?>
        <form method="post" onsubmit="return confirm('Cancelar este convite? O link dele deixa de funcionar.')">
          <?= Csrf::campo() ?>
          <input type="hidden" name="acao" value="cancelar_convite">
          <input type="hidden" name="convite_id" value="<?= (int)$c['id'] ?>">
          <button type="submit" class="btn-txt">Cancelar</button>
        </form>
        <?php endif; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>

<h2 class="secao">Resultado consolidado</h2>
<?php if (!$auto && $totalRespostas === 0): ?>
  <div class="bloco vazio-guia">
    <h2>Ainda sem dados</h2>
    <p>O consolidado compara a autoavaliação de <?= e($ciclo['avaliado']) ?> com as médias das
       avaliações externas, assim que as respostas chegarem.</p>
  </div>
<?php else: ?>
<div class="tabela-rolagem">
<table class="tabela">
  <thead><tr>
    <th>Fonte</th><th class="num">Respostas</th>
    <th class="num">A</th><th class="num">C</th><th class="num">P</th><th class="num">E</th>
  </tr></thead>
  <tbody>
    <tr>
      <td><strong>Autoavaliação</strong><?= $auto ? ' <span class="muted">(' . dataBr($auto['concluida_em'], false) . ')</span>' : '' ?></td>
      <?php if ($auto): ?>
        <td class="num">1</td>
        <td class="num scores"><?= (int)$auto['score_a'] ?></td>
        <td class="num scores"><?= (int)$auto['score_c'] ?></td>
        <td class="num scores"><?= (int)$auto['score_p'] ?></td>
        <td class="num scores"><?= (int)$auto['score_e'] ?></td>
      <?php else: ?>
        <td colspan="5" class="muted">o participante ainda não fez o diagnóstico IPA</td>
      <?php endif; ?>
    </tr>
    <?php foreach ($externas as $ex): $n = (int)$ex['n']; ?>
    <tr>
      <td><?= e(Ipa::rotuloRelacao((string)$ex['relacao'])) ?></td>
      <td class="num"><?= $n ?></td>
      <?php if ($n >= $min): ?>
        <td class="num scores"><?= number_format((float)$ex['ma'], 1, ',', '') ?></td>
        <td class="num scores"><?= number_format((float)$ex['mc'], 1, ',', '') ?></td>
        <td class="num scores"><?= number_format((float)$ex['mp'], 1, ',', '') ?></td>
        <td class="num scores"><?= number_format((float)$ex['me'], 1, ',', '') ?></td>
      <?php else: ?>
        <td colspan="4" class="muted">médias ocultas até <?= $min ?> resposta<?= $min > 1 ? 's' : '' ?> nesta relação (anonimato)</td>
      <?php endif; ?>
    </tr>
    <?php endforeach; ?>
    <?php if ($geral): $n = (int)$geral['n']; ?>
    <tr>
      <td><strong>Percepção externa — geral</strong></td>
      <td class="num"><?= $n ?></td>
      <?php if ($n >= $min): ?>
        <td class="num scores"><strong><?= number_format((float)$geral['ma'], 1, ',', '') ?></strong></td>
        <td class="num scores"><strong><?= number_format((float)$geral['mc'], 1, ',', '') ?></strong></td>
        <td class="num scores"><strong><?= number_format((float)$geral['mp'], 1, ',', '') ?></strong></td>
        <td class="num scores"><strong><?= number_format((float)$geral['me'], 1, ',', '') ?></strong></td>
      <?php else: ?>
        <td colspan="4" class="muted">médias ocultas até <?= $min ?> resposta<?= $min > 1 ? 's' : '' ?> no total</td>
      <?php endif; ?>
    </tr>
    <?php endif; ?>
  </tbody>
</table>
</div>
<p class="dica" style="margin-top:10px">A leitura mais valiosa é a diferença entre a autoavaliação e a
   percepção externa: onde a pessoa se vê diferente de como é vista.</p>
<?php endif; ?>

<div class="acoes" style="margin-top:26px">
  <?php if ($ciclo['status'] === 'aberto'): ?>
  <form method="post" onsubmit="return confirm('Fechar o ciclo? Os links de convite param de aceitar respostas.')">
    <?= Csrf::campo() ?><input type="hidden" name="acao" value="fechar">
    <button type="submit">Fechar ciclo</button>
  </form>
  <?php elseif ($ciclo['status'] === 'fechado'): ?>
  <form method="post">
    <?= Csrf::campo() ?><input type="hidden" name="acao" value="reabrir">
    <button type="submit">Reabrir ciclo</button>
  </form>
  <?php endif; ?>
</div>
<?php fecharPagina();
