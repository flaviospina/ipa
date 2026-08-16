<?php
/**
 * Troca de senha. Obrigatória no primeiro acesso, porque a senha inicial
 * foi definida por outra pessoa — o administrador que criou a conta.
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/layout.php';

$usuario     = Auth::exigirLogin();   // senha.php é a única tela liberada com trocar_senha = 1
$obrigatoria = (int)$usuario['trocar_senha'] === 1;
$erros       = [];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    Csrf::exigir();
    $atual   = (string)($_POST['atual'] ?? '');
    $nova    = (string)($_POST['nova'] ?? '');
    $repetir = (string)($_POST['repetir'] ?? '');

    if (!password_verify($atual, $usuario['senha_hash'])) {
        $erros[] = 'A senha atual não confere.';
    }
    if ($nova !== $repetir) {
        $erros[] = 'A nova senha e a repetição não são iguais.';
    }
    if ($nova === $atual) {
        $erros[] = 'A nova senha precisa ser diferente da atual.';
    }
    foreach (Auth::criticarSenha($nova) as $regra) {
        $erros[] = 'A nova senha precisa ' . $regra . '.';
    }

    if (!$erros) {
        Auth::definirSenha((int)$usuario['id'], $nova, false);
        Audit::registrar((int)$usuario['id'], $usuario['empresa_id'] ? (int)$usuario['empresa_id'] : null,
                         'senha_alterada', 'usuarios', (int)$usuario['id']);
        recado('Senha alterada. Use a nova senha no próximo acesso.');
        Auth::redirecionar('index.php');
    }
}

abrirPagina('Alterar senha', $obrigatoria ? null : $usuario, '');
?>
<div class="painel estreito">
  <h1>Alterar senha</h1>
  <?php if ($obrigatoria): ?>
    <p class="aviso">Sua senha foi definida pelo administrador. Escolha uma senha pessoal para continuar.</p>
  <?php endif; ?>

  <?php foreach ($erros as $msg): ?>
    <div class="recado erro"><?= e($msg) ?></div>
  <?php endforeach; ?>

  <form method="post" class="form">
    <?= Csrf::campo() ?>
    <label for="atual">Senha atual</label>
    <input type="password" id="atual" name="atual" required autocomplete="current-password" autofocus>

    <label for="nova">Nova senha</label>
    <input type="password" id="nova" name="nova" required autocomplete="new-password">
    <p class="dica">Mínimo de 10 caracteres, com maiúscula, minúscula e número.</p>

    <label for="repetir">Repita a nova senha</label>
    <input type="password" id="repetir" name="repetir" required autocomplete="new-password">

    <div class="acoes">
      <button type="submit">Salvar nova senha</button>
      <?php if (!$obrigatoria): ?><a class="btn-txt" href="index.php">Cancelar</a><?php endif; ?>
    </div>
  </form>
</div>
<?php fecharPagina();
