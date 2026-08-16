<?php
/**
 * Usuários.
 *
 * O administrador geral vê e cria usuários de qualquer empresa.
 * O administrador de empresa só vê e cria usuários da própria empresa —
 * a restrição é aplicada na consulta (escopoEmpresa), não na tela.
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/layout.php';

$eu     = Auth::exigirPapel(['admin_geral', 'admin_empresa']);
$escopo = Auth::escopoEmpresa();          // null = administrador geral
$erros  = [];
$criado = null;
$form   = ['nome' => '', 'email' => '', 'papel' => 'gestor', 'empresa_id' => (string)($escopo ?? '')];

/* ------------------------------------------------- criar / redefinir senha */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    Csrf::exigir();
    $acao = (string)($_POST['acao'] ?? 'criar');

    if ($acao === 'redefinir') {
        $alvoId = (int)($_POST['usuario_id'] ?? 0);
        $alvo   = Db::um('SELECT * FROM usuarios WHERE id = ?', [$alvoId]);

        if (!$alvo || ($alvo['empresa_id'] === null && !Auth::ehAdminGeral())) {
            $erros[] = 'Usuário não encontrado.';
        } elseif ($alvo['empresa_id'] !== null && !Auth::alcanca((int)$alvo['empresa_id'])) {
            $erros[] = 'Usuário não encontrado.';   // não confirma existência fora do escopo
        } elseif ((int)$alvo['id'] === (int)$eu['id']) {
            $erros[] = 'Para trocar a sua própria senha use a tela "Alterar senha".';
        } else {
            $nova = Auth::gerarSenhaTemporaria();
            Auth::definirSenha((int)$alvo['id'], $nova, true);
            Audit::registrar((int)$eu['id'], $alvo['empresa_id'] ? (int)$alvo['empresa_id'] : null,
                             'senha_redefinida', 'usuarios', (int)$alvo['id']);
            $criado = ['nome' => $alvo['nome'], 'email' => $alvo['email'], 'senha' => $nova, 'redefinicao' => true];
        }
    } else {
        foreach (['nome', 'email', 'papel', 'empresa_id'] as $c) {
            $form[$c] = trim((string)($_POST[$c] ?? ''));
        }
        // administrador de empresa não escolhe empresa: é sempre a dele
        $empresaId = $escopo ?? (int)$form['empresa_id'];

        $papeisPermitidos = Auth::ehAdminGeral()
            ? ['admin_empresa', 'consultor', 'gestor']
            : ['consultor', 'gestor'];   // admin de empresa não cria outro admin

        if ($form['nome'] === '')                                { $erros[] = 'Informe o nome.'; }
        if (!filter_var($form['email'], FILTER_VALIDATE_EMAIL))  { $erros[] = 'Informe um e-mail válido.'; }
        if (!in_array($form['papel'], $papeisPermitidos, true))  { $erros[] = 'Papel inválido para o seu nível de acesso.'; }
        if (!$empresaId || !Db::valor('SELECT id FROM empresas WHERE id = ?', [$empresaId])) {
            $erros[] = 'Selecione a empresa.';
        } elseif (!Auth::alcanca($empresaId)) {
            $erros[] = 'Você não pode criar usuários nessa empresa.';
        }
        if (Db::valor('SELECT id FROM usuarios WHERE email = ?', [mb_strtolower($form['email'])])) {
            $erros[] = 'Esse e-mail já está em uso.';
        }

        if (!$erros) {
            $senha = Auth::gerarSenhaTemporaria();
            $novoId = Db::inserir(
                'INSERT INTO usuarios (empresa_id, nome, email, senha_hash, papel, trocar_senha, criado_por)
                 VALUES (?, ?, ?, ?, ?, 1, ?)',
                [$empresaId, $form['nome'], mb_strtolower($form['email']),
                 password_hash($senha, PASSWORD_DEFAULT), $form['papel'], (int)$eu['id']]
            );
            Audit::registrar((int)$eu['id'], $empresaId, 'usuario_criado', 'usuarios', $novoId, [
                'email' => mb_strtolower($form['email']), 'papel' => $form['papel'],
            ]);
            $criado = ['nome' => $form['nome'], 'email' => mb_strtolower($form['email']), 'senha' => $senha];
            $form = ['nome' => '', 'email' => '', 'papel' => 'gestor', 'empresa_id' => (string)($escopo ?? '')];
        }
    }
}

/* ------------------------------------------------------------------ listar */
$sql = "SELECT u.*, e.nome AS empresa_nome
          FROM usuarios u
     LEFT JOIN empresas e ON e.id = u.empresa_id";
$par = [];
if ($escopo !== null) {
    $sql .= ' WHERE u.empresa_id = ?';   // ← a separação entre empresas acontece aqui
    $par[] = $escopo;
}
$sql .= ' ORDER BY e.nome IS NULL DESC, e.nome, u.nome';
$usuarios = Db::todos($sql, $par);

$empresas = Auth::ehAdminGeral()
    ? Db::todos("SELECT id, nome FROM empresas WHERE status = 'ativa' ORDER BY nome")
    : [];

abrirPagina('Usuários', $eu, 'usuarios.php');
?>
<h1>Usuários</h1>
<p class="linha-apoio">
  <?= Auth::ehAdminGeral()
      ? 'Todos os acessos do sistema. A senha inicial é definida aqui e trocada pelo usuário no primeiro acesso.'
      : 'Acessos da sua empresa.' ?>
</p>

<?php if ($criado !== null): ?>
  <div class="cartao-senha">
    <h2><?= empty($criado['redefinicao']) ? 'Acesso criado' : 'Senha redefinida' ?> — <?= e($criado['nome']) ?></h2>
    <p>Envie estes dados ao usuário. <strong>A senha aparece só agora</strong>: ela é guardada apenas com hash.</p>
    <dl class="credenciais">
      <dt>Endereço</dt><dd><?= e((string)Db::opcao('app.base_url', '')) ?>/admin/login.php</dd>
      <dt>E-mail</dt><dd><?= e($criado['email']) ?></dd>
      <dt>Senha inicial</dt><dd class="senha"><?= e($criado['senha']) ?></dd>
    </dl>
    <p class="obs">No primeiro acesso o sistema exige a troca por uma senha pessoal.</p>
  </div>
<?php endif; ?>

<?php foreach ($erros as $msg): ?>
  <div class="recado erro"><?= e($msg) ?></div>
<?php endforeach; ?>

<details class="bloco" <?= $erros ? 'open' : '' ?>>
  <summary>Criar novo acesso</summary>
  <form method="post" class="form form-2col">
    <?= Csrf::campo() ?>
    <input type="hidden" name="acao" value="criar">
    <div>
      <label for="nome">Nome</label>
      <input type="text" id="nome" name="nome" required value="<?= e($form['nome']) ?>">
    </div>
    <div>
      <label for="email">E-mail</label>
      <input type="email" id="email" name="email" required value="<?= e($form['email']) ?>">
    </div>
    <?php if (Auth::ehAdminGeral()): ?>
    <div>
      <label for="empresa_id">Empresa</label>
      <select id="empresa_id" name="empresa_id" required>
        <option value="">Selecione…</option>
        <?php foreach ($empresas as $emp): ?>
          <option value="<?= (int)$emp['id'] ?>"<?= $form['empresa_id'] === (string)$emp['id'] ? ' selected' : '' ?>>
            <?= e($emp['nome']) ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
    <?php endif; ?>
    <div>
      <label for="papel">Papel</label>
      <select id="papel" name="papel" required>
        <?php if (Auth::ehAdminGeral()): ?>
          <option value="admin_empresa"<?= $form['papel'] === 'admin_empresa' ? ' selected' : '' ?>>Administrador da empresa</option>
        <?php endif; ?>
        <option value="consultor"<?= $form['papel'] === 'consultor' ? ' selected' : '' ?>>Consultor</option>
        <option value="gestor"<?= $form['papel'] === 'gestor' ? ' selected' : '' ?>>Gestor</option>
      </select>
    </div>
    <div class="col-cheia acoes">
      <button type="submit">Criar acesso e gerar senha</button>
    </div>
  </form>
</details>

<div class="tabela-rolagem">
<table class="tabela">
  <thead><tr>
    <th>Nome</th><th>E-mail</th><?php if (Auth::ehAdminGeral()): ?><th>Empresa</th><?php endif; ?>
    <th>Papel</th><th>Último acesso</th><th>Situação</th><th></th>
  </tr></thead>
  <tbody>
  <?php foreach ($usuarios as $u): ?>
    <tr>
      <td><strong><?= e($u['nome']) ?></strong><?= (int)$u['id'] === (int)$eu['id'] ? ' <span class="voce">você</span>' : '' ?></td>
      <td><?= e($u['email']) ?></td>
      <?php if (Auth::ehAdminGeral()): ?>
        <td><?= $u['empresa_nome'] ? e($u['empresa_nome']) : '<span class="muted">— geral —</span>' ?></td>
      <?php endif; ?>
      <td><?= e(rotuloPapel($u['papel'])) ?></td>
      <td><?= dataBr($u['ultimo_login_em']) ?></td>
      <td>
        <span class="selo <?= e($u['status']) ?>"><?= e($u['status']) ?></span>
        <?php if ((int)$u['trocar_senha'] === 1): ?><span class="selo aviso">senha temporária</span><?php endif; ?>
      </td>
      <td class="acoes-linha">
        <?php if ((int)$u['id'] !== (int)$eu['id']): ?>
        <form method="post" onsubmit="return confirm('Gerar uma nova senha temporária para <?= e($u['nome']) ?>?')">
          <?= Csrf::campo() ?>
          <input type="hidden" name="acao" value="redefinir">
          <input type="hidden" name="usuario_id" value="<?= (int)$u['id'] ?>">
          <button type="submit" class="btn-txt">Redefinir senha</button>
        </form>
        <?php endif; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>
<?php fecharPagina();
