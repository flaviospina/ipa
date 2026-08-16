<?php
/**
 * Cria a conta do ADMINISTRADOR GERAL — a primeira do sistema.
 *
 * Execute UMA vez, logo após aplicar os scripts SQL:
 *   https://itthrive.com.br/vipedia/new_ipa/setup/criar-admin-geral.php
 *
 * O script se protege sozinho: se já existir um administrador geral, ele
 * recusa e não faz nada. Ainda assim, APAGUE a pasta setup/ depois de usar.
 *
 * A senha é sorteada aqui e mostrada UMA única vez. No banco fica apenas o
 * hash — nem este script nem o painel conseguem recuperá-la depois.
 */
declare(strict_types=1);

require_once __DIR__ . '/../src/Auth.php';

const ADMIN_NOME  = 'Flávio Spina';
const ADMIN_EMAIL = 'prof.flavio.spina@gmail.com';

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

$titulo = 'Instalação do VIPEDia';
$erro   = null;
$dados  = null;

try {
    if (!Db::valor('SELECT COUNT(*) FROM instrumentos')) {
        $erro = 'O banco está vazio. Aplique antes backend/sql/01-schema.sql e 02-dados-iniciais.sql.';
    } elseif (Db::valor("SELECT id FROM usuarios WHERE papel = 'admin_geral'")) {
        $erro = 'Já existe um administrador geral. Este script não faz mais nada — pode apagar a pasta setup/.';
    } else {
        $senha = Auth::gerarSenhaTemporaria();
        $id = Db::inserir(
            "INSERT INTO usuarios (empresa_id, nome, email, senha_hash, papel, trocar_senha)
             VALUES (NULL, ?, ?, ?, 'admin_geral', 1)",
            [ADMIN_NOME, mb_strtolower(ADMIN_EMAIL), password_hash($senha, PASSWORD_DEFAULT)]
        );
        Audit::registrar($id, null, 'admin_geral_criado', 'usuarios', $id, ['email' => mb_strtolower(ADMIN_EMAIL)]);
        $dados = ['email' => mb_strtolower(ADMIN_EMAIL), 'senha' => $senha];
    }
} catch (Throwable $ex) {
    $erro = 'Falha ao acessar o banco: ' . $ex->getMessage();
}

$base = (string)Db::opcao('app.base_url', '');
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= htmlspecialchars($titulo) ?></title>
<link rel="stylesheet" href="../admin/assets/admin.css">
</head>
<body class="tela-login">
<main class="cartao-login" style="max-width:560px">
  <div class="marca-login">VIPEDia</div>
  <h1>Instalação</h1>
  <p class="sub">Criação da conta do administrador geral</p>

  <?php if ($erro !== null): ?>
    <div class="recado erro"><?= htmlspecialchars($erro) ?></div>
    <p class="ajuda"><a href="<?= htmlspecialchars($base) ?>/admin/login.php">Ir para a tela de entrada</a></p>
  <?php else: ?>
    <div class="cartao-senha">
      <h2>Conta criada</h2>
      <p><strong>Anote a senha agora.</strong> Ela não aparece de novo: o banco guarda apenas o hash.</p>
      <dl class="credenciais">
        <dt>Endereço</dt><dd><?= htmlspecialchars($base) ?>/admin/login.php</dd>
        <dt>E-mail</dt><dd><?= htmlspecialchars($dados['email']) ?></dd>
        <dt>Senha</dt><dd class="senha"><?= htmlspecialchars($dados['senha']) ?></dd>
      </dl>
      <p class="obs">No primeiro acesso o sistema exige a troca por uma senha pessoal.</p>
    </div>
    <div class="recado aviso">Apague a pasta <code>setup/</code> do servidor depois de entrar.</div>
    <p class="ajuda"><a href="<?= htmlspecialchars($base) ?>/admin/login.php">Entrar no painel</a></p>
  <?php endif; ?>
</main>
</body>
</html>
