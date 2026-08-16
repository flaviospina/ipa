<?php
/**
 * Ciclos 360° — lista e abertura.
 *
 * Um ciclo pertence a um participante (o avaliado). Os convites aos
 * avaliadores são gerados na tela de detalhe (ciclo.php).
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/layout.php';
require_once __DIR__ . '/../src/Ipa.php';

$eu     = Auth::exigirPapel(['admin_geral', 'admin_empresa', 'consultor']);
$escopo = Auth::escopoEmpresa();
$erros  = [];
$form   = ['participante_id' => '', 'novo_nome' => '', 'novo_funcao' => '', 'empresa_id' => (string)($escopo ?? ''),
           'min_avaliadores' => '3', 'prazo' => ''];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    Csrf::exigir();
    foreach (array_keys($form) as $c) {
        $form[$c] = trim((string)($_POST[$c] ?? ''));
    }

    $min = max(1, min(20, (int)$form['min_avaliadores']));
    $prazo = $form['prazo'] !== '' && strtotime($form['prazo']) ? $form['prazo'] : null;

    $partId = (int)$form['participante_id'];
    if ($partId > 0) {
        // participante existente — precisa estar no escopo
        $part = Db::um('SELECT id, empresa_id FROM participantes WHERE id = ?', [$partId]);
        if (!$part || !Auth::alcanca((int)$part['empresa_id'])) {
            $erros[] = 'Participante não encontrado.';
        } else {
            $empresaId = (int)$part['empresa_id'];
        }
    } else {
        // participante novo: nome + empresa
        $empresaId = $escopo ?? (int)$form['empresa_id'];
        if ($form['novo_nome'] === '') {
            $erros[] = 'Selecione um participante ou informe o nome do novo.';
        }
        if (!$empresaId || !Db::valor('SELECT id FROM empresas WHERE id = ?', [$empresaId])) {
            $erros[] = 'Selecione a empresa.';
        } elseif (!Auth::alcanca($empresaId)) {
            $erros[] = 'Você não pode abrir ciclos nessa empresa.';
        }
    }

    if (!$erros) {
        if ($partId <= 0) {
            // reaproveita pelo nome, como a API faz
            $existente = Db::um(
                'SELECT id FROM participantes WHERE empresa_id = ? AND LOWER(nome) = LOWER(?) LIMIT 1',
                [$empresaId, $form['novo_nome']]
            );
            $partId = $existente
                ? (int)$existente['id']
                : Db::inserir('INSERT INTO participantes (empresa_id, nome, funcao) VALUES (?, ?, ?)',
                              [$empresaId, $form['novo_nome'], $form['novo_funcao'] ?: null]);
        }
        $cicloId = Db::inserir(
            "INSERT INTO ciclos_360 (empresa_id, participante_id, status, min_avaliadores, prazo, criado_por)
             VALUES (?, ?, 'aberto', ?, ?, ?)",
            [$empresaId, $partId, $min, $prazo, (int)$eu['id']]
        );
        Audit::registrar((int)$eu['id'], $empresaId, 'ciclo360_criado', 'ciclos_360', $cicloId, ['participante' => $partId]);
        Auth::redirecionar('ciclo.php?id=' . $cicloId);
    }
}

/* ------------------------------------------------------------------ listas */
$onde = $escopo === null ? '' : ' WHERE p.empresa_id = ?';
$par  = $escopo === null ? [] : [$escopo];
$participantes = Db::todos(
    "SELECT p.id, p.nome, p.funcao, e.nome AS empresa_nome
       FROM participantes p JOIN empresas e ON e.id = p.empresa_id{$onde}
   ORDER BY e.nome, p.nome", $par
);
$empresas = Auth::ehAdminGeral()
    ? Db::todos("SELECT id, nome FROM empresas WHERE status = 'ativa' ORDER BY nome")
    : [];

$sqlC = "SELECT ci.*, p.nome AS avaliado, e.nome AS empresa_nome,
                (SELECT COUNT(*) FROM convites_360 c WHERE c.ciclo_id = ci.id AND c.status <> 'cancelado') AS convites,
                (SELECT COUNT(*) FROM convites_360 c WHERE c.ciclo_id = ci.id AND c.status = 'respondido')  AS respondidos
           FROM ciclos_360 ci
           JOIN participantes p ON p.id = ci.participante_id
           JOIN empresas e      ON e.id = ci.empresa_id";
$parC = [];
if ($escopo !== null) {
    $sqlC .= ' WHERE ci.empresa_id = ?';
    $parC[] = $escopo;
}
$sqlC .= ' ORDER BY ci.criado_em DESC LIMIT 200';
$ciclos = Db::todos($sqlC, $parC);

abrirPagina('Ciclos 360°', $eu, 'ciclos.php');
?>
<h1>Ciclos 360°</h1>
<p class="linha-apoio">Um ciclo reúne as avaliações externas de um profissional. Os avaliadores recebem
   links de uso único — ninguém digita nome de ninguém.</p>

<?php foreach ($erros as $msg): ?>
  <div class="recado erro"><?= e($msg) ?></div>
<?php endforeach; ?>

<details class="bloco" <?= $erros ? 'open' : '' ?>>
  <summary>Abrir novo ciclo</summary>
  <form method="post" class="form form-2col">
    <?= Csrf::campo() ?>
    <div>
      <label for="participante_id">Participante (avaliado)</label>
      <select id="participante_id" name="participante_id">
        <option value="">— novo participante —</option>
        <?php foreach ($participantes as $p): ?>
          <option value="<?= (int)$p['id'] ?>"<?= $form['participante_id'] === (string)$p['id'] ? ' selected' : '' ?>>
            <?= e($p['nome']) ?><?= $escopo === null ? ' · ' . e($p['empresa_nome']) : '' ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
    <div>
      <label for="novo_nome">Nome do novo participante <span class="opc">(se não estiver na lista)</span></label>
      <input type="text" id="novo_nome" name="novo_nome" value="<?= e($form['novo_nome']) ?>">
    </div>
    <div>
      <label for="novo_funcao">Função do novo participante <span class="opc">(opcional)</span></label>
      <input type="text" id="novo_funcao" name="novo_funcao" value="<?= e($form['novo_funcao']) ?>">
    </div>
    <?php if (Auth::ehAdminGeral()): ?>
    <div>
      <label for="empresa_id">Empresa <span class="opc">(para participante novo)</span></label>
      <select id="empresa_id" name="empresa_id">
        <option value="">Selecione…</option>
        <?php foreach ($empresas as $emp): ?>
          <option value="<?= (int)$emp['id'] ?>"<?= $form['empresa_id'] === (string)$emp['id'] ? ' selected' : '' ?>><?= e($emp['nome']) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <?php endif; ?>
    <div>
      <label for="min_avaliadores">Mínimo de respostas para exibir médias</label>
      <input type="number" id="min_avaliadores" name="min_avaliadores" min="1" max="20" value="<?= e($form['min_avaliadores']) ?>">
      <p class="dica">Protege o anonimato: abaixo desse número, as médias da relação não aparecem.</p>
    </div>
    <div>
      <label for="prazo">Prazo <span class="opc">(opcional)</span></label>
      <input type="date" id="prazo" name="prazo" value="<?= e($form['prazo']) ?>">
    </div>
    <div class="col-cheia acoes">
      <button type="submit">Abrir ciclo</button>
    </div>
  </form>
</details>

<div class="tabela-rolagem">
<table class="tabela">
  <thead><tr>
    <th>Avaliado</th><?php if ($escopo === null): ?><th>Empresa</th><?php endif; ?>
    <th>Situação</th><th class="num">Convites</th><th class="num">Respondidos</th>
    <th>Prazo</th><th>Aberto em</th><th></th>
  </tr></thead>
  <tbody>
  <?php if (!$ciclos): ?>
    <tr><td colspan="8" class="vazio">Nenhum ciclo aberto ainda.</td></tr>
  <?php endif; ?>
  <?php foreach ($ciclos as $c): ?>
    <tr>
      <td><strong><?= e($c['avaliado']) ?></strong></td>
      <?php if ($escopo === null): ?><td><?= e($c['empresa_nome']) ?></td><?php endif; ?>
      <td><span class="selo <?= $c['status'] === 'aberto' ? 'ativo' : '' ?>"><?= e($c['status']) ?></span></td>
      <td class="num"><?= (int)$c['convites'] ?></td>
      <td class="num"><?= (int)$c['respondidos'] ?></td>
      <td><?= $c['prazo'] ? dataBr($c['prazo'], false) : '—' ?></td>
      <td><?= dataBr($c['criado_em'], false) ?></td>
      <td><a href="ciclo.php?id=<?= (int)$c['id'] ?>">gerenciar</a></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>
<?php fecharPagina();
