<?php
declare(strict_types=1);
require_once __DIR__ . '/../src/layout.php';

Auth::iniciarSessao();
if (Auth::logado()) {
    Auth::redirecionar('index.php');
}

$erro = null;
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    Csrf::exigir();
    $r = Auth::entrar((string)($_POST['email'] ?? ''), (string)($_POST['senha'] ?? ''));
    if ($r['ok']) {
        Auth::redirecionar(!empty($r['trocar_senha']) ? 'senha.php' : 'index.php');
    }
    $erro = $r['erro'] ?? 'Não foi possível entrar.';
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Entrar · VIPEDia</title>
<link rel="stylesheet" href="assets/admin.css">
</head>
<body class="tela-login">
<main class="cartao-login">
  <div class="marca-login">VIPEDia</div>
  <h1>Painel de resultados</h1>
  <p class="sub">Indicador de Preferência de Conduta — Abordagem ACP</p>

  <?php if ($erro !== null): ?>
    <div class="recado erro"><?= e($erro) ?></div>
  <?php endif; ?>

  <form method="post" autocomplete="on">
    <?= Csrf::campo() ?>
    <label for="email">E-mail</label>
    <input type="email" id="email" name="email" required autofocus
           value="<?= e((string)($_POST['email'] ?? '')) ?>" autocomplete="username">

    <label for="senha">Senha</label>
    <input type="password" id="senha" name="senha" required autocomplete="current-password">

    <button type="submit">Entrar</button>
  </form>

  <p class="ajuda">Acesso fornecido pelo administrador. Esqueceu a senha? Procure quem cadastrou o seu acesso.</p>
</main>
</body>
</html>
