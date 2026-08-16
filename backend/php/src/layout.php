<?php
/**
 * Moldura visual do painel: cabeçalho, navegação, rodapé e utilitários
 * de escape. Toda saída de dado vindo do banco passa por e().
 */
declare(strict_types=1);

require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/Csrf.php';

/** Escapa para HTML. Use SEMPRE ao imprimir valor vindo do banco ou do usuário. */
function e(?string $texto): string
{
    return htmlspecialchars((string)$texto, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function dataBr(?string $iso, bool $comHora = true): string
{
    if (!$iso) {
        return '—';
    }
    $ts = strtotime($iso);
    return $ts ? date($comHora ? 'd/m/Y H:i' : 'd/m/Y', $ts) : '—';
}

/** Mensagem de uma tela para a próxima (após redirecionamento). */
function recado(?string $texto = null, string $tipo = 'ok'): ?array
{
    Auth::iniciarSessao();
    if ($texto !== null) {
        $_SESSION['recado'] = ['texto' => $texto, 'tipo' => $tipo];
        return null;
    }
    $r = $_SESSION['recado'] ?? null;
    unset($_SESSION['recado']);
    return $r;
}

function abrirPagina(string $titulo, ?array $usuario = null, string $ativo = ''): void
{
    $nav = [
        'index.php'    => 'Início',
        'empresas.php' => 'Empresas',
        'usuarios.php' => 'Usuários',
    ];
    if ($usuario !== null && $usuario['papel'] !== 'admin_geral') {
        unset($nav['empresas.php']); // administrador de empresa não gerencia empresas
    }
    ?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($titulo) ?> · VIPEDia</title>
<link rel="stylesheet" href="assets/admin.css">
</head>
<body>
<?php if ($usuario !== null): ?>
<header class="topo">
  <div class="topo-in">
    <a class="marca" href="index.php">VIPEDia<span>painel</span></a>
    <nav class="nav">
      <?php foreach ($nav as $arquivo => $rotulo): ?>
        <a href="<?= e($arquivo) ?>"<?= $ativo === $arquivo ? ' class="on"' : '' ?>><?= e($rotulo) ?></a>
      <?php endforeach; ?>
    </nav>
    <div class="eu">
      <span class="eu-nome"><?= e($usuario['nome']) ?></span>
      <span class="eu-papel"><?= e(rotuloPapel($usuario['papel'])) ?><?php
        if ($usuario['empresa_nome']) { echo ' · ' . e($usuario['empresa_nome']); } ?></span>
    </div>
    <a class="sair" href="logout.php">Sair</a>
  </div>
</header>
<?php endif; ?>
<main class="corpo">
<?php
    $r = recado();
    if ($r) {
        echo '<div class="recado ' . e($r['tipo']) . '">' . e($r['texto']) . '</div>';
    }
}

function fecharPagina(): void
{
    ?>
</main>
<footer class="rodape">VIPEDia · Indicador de Preferência de Conduta<?php
    $amb = Db::opcao('app.ambiente', 'producao');
    if ($amb !== 'producao') { echo ' · <strong>' . e((string)$amb) . '</strong>'; }
?></footer>
</body>
</html>
<?php
}

function rotuloPapel(string $papel): string
{
    return [
        'admin_geral'   => 'Administrador geral',
        'admin_empresa' => 'Administrador da empresa',
        'consultor'     => 'Consultor',
        'gestor'        => 'Gestor',
    ][$papel] ?? $papel;
}
