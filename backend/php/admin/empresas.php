<?php
/**
 * Cadastro de empresas — exclusivo do administrador geral.
 *
 * Ao cadastrar uma empresa, o administrador geral já cria nela o primeiro
 * usuário administrador e define a senha inicial, que é temporária: no
 * primeiro acesso o sistema obriga a troca.
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/layout.php';

$eu    = Auth::exigirPapel(['admin_geral']);
$erros = [];
$form  = ['nome' => '', 'slug' => '', 'cnpj' => '', 'admin_nome' => '', 'admin_email' => ''];
$criado = null;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    Csrf::exigir();
    foreach ($form as $campo => $_) {
        $form[$campo] = trim((string)($_POST[$campo] ?? ''));
    }
    if ($form['slug'] === '') {
        $form['slug'] = gerarSlug($form['nome']);
    }

    if ($form['nome'] === '')                                    { $erros[] = 'Informe o nome da empresa.'; }
    if (!preg_match('/^[a-z0-9][a-z0-9\-]{1,58}$/', $form['slug'])) { $erros[] = 'O identificador deve ter apenas letras minúsculas, números e hífen.'; }
    if (Db::valor('SELECT id FROM empresas WHERE slug = ?', [$form['slug']])) { $erros[] = 'Já existe uma empresa com esse identificador.'; }
    if ($form['admin_nome'] === '')                              { $erros[] = 'Informe o nome do administrador da empresa.'; }
    if (!filter_var($form['admin_email'], FILTER_VALIDATE_EMAIL)) { $erros[] = 'Informe um e-mail válido para o administrador.'; }
    if (Db::valor('SELECT id FROM usuarios WHERE email = ?', [mb_strtolower($form['admin_email'])])) {
        $erros[] = 'Esse e-mail já está em uso por outro acesso.';
    }

    if (!$erros) {
        $senhaInicial = Auth::gerarSenhaTemporaria();
        $pdo = Db::conn();
        $pdo->beginTransaction();
        try {
            $empresaId = Db::inserir(
                'INSERT INTO empresas (nome, slug, cnpj, contato_nome, contato_email) VALUES (?, ?, ?, ?, ?)',
                [$form['nome'], $form['slug'], $form['cnpj'] ?: null, $form['admin_nome'], mb_strtolower($form['admin_email'])]
            );
            $usuarioId = Db::inserir(
                "INSERT INTO usuarios (empresa_id, nome, email, senha_hash, papel, trocar_senha, criado_por)
                 VALUES (?, ?, ?, ?, 'admin_empresa', 1, ?)",
                [
                    $empresaId,
                    $form['admin_nome'],
                    mb_strtolower($form['admin_email']),
                    password_hash($senhaInicial, PASSWORD_DEFAULT),
                    (int)$eu['id'],
                ]
            );
            $pdo->commit();
        } catch (Throwable $ex) {
            $pdo->rollBack();
            throw $ex;
        }

        Audit::registrar((int)$eu['id'], $empresaId, 'empresa_criada', 'empresas', $empresaId, ['nome' => $form['nome']]);
        Audit::registrar((int)$eu['id'], $empresaId, 'usuario_criado', 'usuarios', $usuarioId, [
            'email' => mb_strtolower($form['admin_email']), 'papel' => 'admin_empresa',
        ]);

        // a senha aparece UMA vez, aqui. Não fica guardada em lugar nenhum em texto.
        $criado = ['empresa' => $form['nome'], 'email' => mb_strtolower($form['admin_email']), 'senha' => $senhaInicial];
        $form = array_map(fn() => '', $form);
    }
}

$empresas = Db::todos(
    "SELECT e.*,
            (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id = e.id AND u.status = 'ativo') AS usuarios,
            (SELECT COUNT(*) FROM participantes p WHERE p.empresa_id = e.id) AS participantes
       FROM empresas e
   ORDER BY e.nome"
);

function gerarSlug(string $texto): string
{
    $t = iconv('UTF-8', 'ASCII//TRANSLIT', $texto) ?: $texto;
    $t = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $t) ?? '');
    return trim($t, '-');
}

abrirPagina('Empresas', $eu, 'empresas.php');
?>
<h1>Empresas</h1>
<p class="linha-apoio">Cada empresa é uma fronteira de dados. O administrador dela enxerga apenas os próprios resultados.</p>

<?php if ($criado !== null): ?>
  <div class="cartao-senha">
    <h2>Acesso criado para <?= e($criado['empresa']) ?></h2>
    <p>Envie estes dados ao administrador da empresa. <strong>A senha aparece só agora</strong> — ela é guardada
       apenas com hash e não pode ser consultada depois.</p>
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
  <summary>Cadastrar nova empresa</summary>
  <form method="post" class="form form-2col">
    <?= Csrf::campo() ?>
    <div>
      <label for="nome">Nome da empresa</label>
      <input type="text" id="nome" name="nome" required value="<?= e($form['nome']) ?>">
    </div>
    <div>
      <label for="slug">Identificador <span class="opc">(opcional)</span></label>
      <input type="text" id="slug" name="slug" value="<?= e($form['slug']) ?>" placeholder="gerado a partir do nome">
    </div>
    <div>
      <label for="cnpj">CNPJ <span class="opc">(opcional)</span></label>
      <input type="text" id="cnpj" name="cnpj" value="<?= e($form['cnpj']) ?>">
    </div>
    <div class="col-cheia"><hr><p class="sub-form">Primeiro acesso da empresa</p></div>
    <div>
      <label for="admin_nome">Nome do administrador</label>
      <input type="text" id="admin_nome" name="admin_nome" required value="<?= e($form['admin_nome']) ?>">
    </div>
    <div>
      <label for="admin_email">E-mail do administrador</label>
      <input type="email" id="admin_email" name="admin_email" required value="<?= e($form['admin_email']) ?>">
    </div>
    <div class="col-cheia acoes">
      <button type="submit">Cadastrar empresa e gerar acesso</button>
    </div>
  </form>
</details>

<div class="tabela-rolagem">
<table class="tabela">
  <thead><tr>
    <th>Empresa</th><th>Identificador</th><th class="num">Usuários</th>
    <th class="num">Participantes</th><th>Situação</th><th>Cadastro</th>
  </tr></thead>
  <tbody>
  <?php if (!$empresas): ?>
    <tr><td colspan="6" class="vazio">Nenhuma empresa cadastrada ainda.</td></tr>
  <?php endif; ?>
  <?php foreach ($empresas as $emp): ?>
    <tr>
      <td><strong><?= e($emp['nome']) ?></strong></td>
      <td><code><?= e($emp['slug']) ?></code></td>
      <td class="num"><?= (int)$emp['usuarios'] ?></td>
      <td class="num"><?= (int)$emp['participantes'] ?></td>
      <td><span class="selo <?= e($emp['status']) ?>"><?= e($emp['status']) ?></span></td>
      <td><?= dataBr($emp['criado_em'], false) ?></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>
<?php fecharPagina();
