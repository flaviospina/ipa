<?php
/**
 * VIPEDia — Diagnóstico geral do sistema.
 *
 * Publicar na RAIZ da instalação (new_ipa/status.php) e abrir no navegador:
 *   https://itthrive.com.br/vipedia/new_ipa/status.php
 *
 * A página verifica cada elo da corrente — PHP, arquivos, configuração,
 * banco, APIs, webapp publicado e Apps Script — e para cada falha diz o
 * que fazer. Também inspeciona a fila local do navegador e permite
 * reenviar agora os diagnósticos que ficaram presos.
 *
 * IMPORTANTE: este arquivo é escrito em PHP "antigo" de propósito
 * (sem tipos modernos, sem arrow functions). Assim ele roda e REPORTA o
 * problema mesmo quando o servidor está com PHP anterior ao 8.1 — que é
 * exatamente um dos defeitos que ele precisa detectar, já que o restante
 * do sistema exige PHP 8.1+.
 */

error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

// raiz da instalação = pasta onde este arquivo foi publicado
// (SCRIPT_FILENAME respeita a pasta servida mesmo quando há links simbólicos)
$RAIZ = isset($_SERVER['SCRIPT_FILENAME']) ? dirname($_SERVER['SCRIPT_FILENAME']) : __DIR__;
$checks = array();   // cada item: array(secao, status ok|warn|fail|info, titulo, detalhe)

function marcar(&$checks, $secao, $status, $titulo, $detalhe = '')
{
    $checks[] = array($secao, $status, $titulo, $detalhe);
}

function tem($agulha, $palheiro)
{
    return strpos($palheiro, $agulha) !== false;
}

/** GET simples com timeout curto; devolve array(status_http|0, corpo). */
function http_get($url)
{
    $ctx = stream_context_create(array(
        'http' => array('method' => 'GET', 'timeout' => 8, 'ignore_errors' => true,
                        'header' => "User-Agent: VIPEDia-status\r\n"),
        'ssl'  => array('verify_peer' => true, 'verify_peer_name' => true),
    ));
    $corpo = @file_get_contents($url, false, $ctx);
    $status = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) { $status = (int)$m[1]; }
        }
    }
    if ($corpo === false && function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        curl_setopt($ch, CURLOPT_USERAGENT, 'VIPEDia-status');
        $corpo = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    }
    return array($status, $corpo === false ? '' : (string)$corpo);
}

/* ================================================== A. AMBIENTE PHP */
$phpOk = version_compare(PHP_VERSION, '8.1.0', '>=');
marcar($checks, 'Ambiente', $phpOk ? 'ok' : 'fail',
    'Versão do PHP: ' . PHP_VERSION,
    $phpOk ? 'O sistema exige 8.1 ou superior — atendido.'
           : 'O painel e as APIs EXIGEM PHP 8.1+. No cPanel, abra "Select PHP Version" (ou "MultiPHP Manager") e selecione PHP 8.1, 8.2 ou 8.3 para este domínio. Esta é uma causa clássica de "não grava no banco": as APIs nem chegam a executar.');

foreach (array('pdo_mysql' => 'conexão com o MySQL', 'mbstring' => 'texto acentuado', 'json' => 'APIs') as $ext => $uso) {
    $temExt = extension_loaded($ext);
    marcar($checks, 'Ambiente', $temExt ? 'ok' : 'fail',
        'Extensão ' . $ext . ($temExt ? ' presente' : ' AUSENTE'),
        $temExt ? '' : 'Necessária para ' . $uso . '. Ative em "Select PHP Version > Extensions" no cPanel.');
}

/* ============================================ B. ARQUIVOS PUBLICADOS */
$arquivos = array(
    'config/config.php'        => 'Configuração com a senha do banco (copiar de config.exemplo.php e preencher)',
    'src/Db.php'               => 'Código de apoio (pasta src/ de backend/php)',
    'src/Ipa.php'              => 'Núcleo de cálculo (Fases 3-4) — reenvie a pasta src/ se estiver ausente',
    'admin/login.php'          => 'Painel administrativo (pasta admin/)',
    'api/diagnostico.php'      => 'API que grava o diagnóstico no banco (pasta api/)',
    'api/convite360.php'       => 'API dos convites 360° (pasta api/)',
    'webapp/index.html'        => 'Questionário IPA — precisa estar em new_ipa/webapp/ (com esse nome)',
    'webapp/360.html'          => 'Questionário 360°',
    'webapp/js/config.js'      => 'Configuração do questionário',
    'home/index.html'          => 'Página inicial',
);
foreach ($arquivos as $rel => $desc) {
    $existe = is_file($RAIZ . '/' . $rel);
    marcar($checks, 'Arquivos', $existe ? 'ok' : 'fail', $rel . ($existe ? '' : ' AUSENTE'), $existe ? '' : $desc);
}
if (is_dir($RAIZ . '/setup')) {
    marcar($checks, 'Arquivos', 'warn', 'Pasta setup/ ainda está no servidor',
        'Depois de criar o administrador geral, apague a pasta setup/ por segurança.');
}

/* ======================================= C. WEBAPP PUBLICADO É ATUAL? */
$cfgJs = @file_get_contents($RAIZ . '/webapp/js/config.js');
$appJs = @file_get_contents($RAIZ . '/webapp/js/app.js');
if ($cfgJs !== false) {
    if (!tem('API_ENDPOINT', $cfgJs)) {
        marcar($checks, 'Webapp', 'fail', 'webapp publicado é ANTERIOR à Fase 3 — não envia ao banco',
            'O js/config.js no servidor não tem API_ENDPOINT. Reenvie a pasta webapp/js/ do repositório (config.js, app.js, app360.js). Enquanto isso, cada resposta vai só para a planilha — e nada chega ao banco. Esta é a causa mais comum do sintoma "registro feito, banco vazio".');
    } else {
        $detalhe = tem('location.pathname', $cfgJs)
            ? 'Endereços das APIs calculados automaticamente a partir da pasta publicada — funciona em qualquer caminho.'
            : 'Endereço fixo em config.js — confirme que aponta para ESTA instalação.';
        marcar($checks, 'Webapp', 'ok', 'config.js publicado tem API_ENDPOINT (Fase 3+)', $detalhe);
    }
    if ($appJs !== false && !tem('sendApi', $appJs)) {
        marcar($checks, 'Webapp', 'fail', 'js/app.js publicado é antigo (sem envio ao banco)',
            'Reenvie webapp/js/app.js do repositório.');
    }
}

/* ================================================ D. CONFIG + BANCO */
$pdo = null;
$cfg = null;
if (is_file($RAIZ . '/config/config.php')) {
    $cfg = @include $RAIZ . '/config/config.php';
    if (!is_array($cfg) || !isset($cfg['db'])) {
        marcar($checks, 'Banco', 'fail', 'config/config.php não devolve a configuração esperada',
            'Compare com config/config.exemplo.php — o arquivo deve terminar com "return [ ... ];".');
    } elseif (tem('PREENCHA', (string)$cfg['db']['senha'])) {
        marcar($checks, 'Banco', 'fail', 'A senha do banco não foi preenchida em config/config.php',
            'Edite config/config.php e coloque a senha real do usuário ' . $cfg['db']['usuario'] . '.');
    } else {
        try {
            $dsn = 'mysql:host=' . $cfg['db']['host'] . ';port=' . (isset($cfg['db']['porta']) ? $cfg['db']['porta'] : 3306) .
                   ';dbname=' . $cfg['db']['nome'] . ';charset=utf8mb4';
            $pdo = new PDO($dsn, $cfg['db']['usuario'], $cfg['db']['senha'],
                array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
            marcar($checks, 'Banco', 'ok', 'Conexão com ' . $cfg['db']['nome'] . ' estabelecida',
                'host ' . $cfg['db']['host'] . ' · usuário ' . $cfg['db']['usuario']);
        } catch (Exception $e) {
            $dica = 'Confira em config/config.php: nome do banco, usuário e senha. No cPanel, o usuário precisa estar ADICIONADO ao banco com ALL PRIVILEGES (Bancos de Dados MySQL > Adicionar usuário ao banco).';
            if (tem('Unknown database', $e->getMessage())) {
                $dica = 'O banco ' . $cfg['db']['nome'] . ' não existe neste servidor. Crie-o no cPanel e importe backend/sql/01-schema.sql e 02-dados-iniciais.sql (ver backend/sql/README.md).';
            }
            marcar($checks, 'Banco', 'fail', 'Não conectou ao banco: ' . $e->getMessage(), $dica);
        }
    }
}

if ($pdo !== null) {
    // tabelas
    $esperadas = array('empresas','usuarios','usuario_tokens','sessoes','instrumentos','palavras',
                       'participantes','ciclos_360','avaliacoes','avaliacao_respostas','relatorios',
                       'convites_360','consentimentos','log_auditoria');
    $st = $pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()");
    $existentes = $st->fetchAll(PDO::FETCH_COLUMN);
    $faltando = array_values(array_diff($esperadas, $existentes));
    marcar($checks, 'Banco', count($faltando) === 0 ? 'ok' : 'fail',
        count($faltando) === 0 ? 'As 14 tabelas existem' : 'Tabelas faltando: ' . implode(', ', $faltando),
        count($faltando) === 0 ? '' : 'Importe backend/sql/01-schema.sql pelo phpMyAdmin (é reaplicável, não apaga dados).');

    if (in_array('palavras', $existentes)) {
        $n = (int)$pdo->query('SELECT COUNT(*) FROM palavras')->fetchColumn();
        marcar($checks, 'Banco', $n === 36 ? 'ok' : 'fail', 'Instrumento: ' . $n . ' palavras carregadas',
            $n === 36 ? '' : 'Importe backend/sql/02-dados-iniciais.sql (deve resultar em 36).');
    }
    if (in_array('usuarios', $existentes)) {
        $n = (int)$pdo->query("SELECT COUNT(*) FROM usuarios WHERE papel = 'admin_geral'")->fetchColumn();
        marcar($checks, 'Banco', $n > 0 ? 'ok' : 'warn',
            $n > 0 ? 'Administrador geral criado' : 'Ainda não há administrador geral',
            $n > 0 ? '' : 'Abra setup/criar-admin-geral.php uma vez (e depois apague a pasta setup/).');
    }
    if (in_array('avaliacoes', $existentes)) {
        $r = $pdo->query("SELECT COUNT(*) t,
                                 SUM(tipo='auto') a, SUM(tipo='360') x,
                                 MAX(concluida_em) ult
                            FROM avaliacoes WHERE status='concluida'")->fetch(PDO::FETCH_ASSOC);
        marcar($checks, 'Banco', 'info',
            'Avaliações no banco: ' . (int)$r['t'] . ' (IPA: ' . (int)$r['a'] . ' · 360°: ' . (int)$r['x'] . ')',
            $r['ult'] ? 'Última: ' . $r['ult'] : 'Nenhuma gravada ainda — veja os testes de API abaixo e a fila do navegador no fim da página.');
        $e = (int)$pdo->query("SELECT COUNT(*) FROM empresas WHERE status='ativa'")->fetchColumn();
        marcar($checks, 'Banco', $e > 0 ? 'info' : 'warn', 'Empresas ativas: ' . $e,
            $e > 0 ? '' : 'Sem empresa cadastrada, os envios são recusados com "empresa_nao_identificada". Cadastre no painel (Empresas) e use o link do questionário com ?empresa=SLUG.');
    }
    // teste de gravação (só quando pedido, para a página não escrever sozinha)
    if (isset($_GET['teste_gravacao'])) {
        try {
            $pdo->exec("INSERT INTO log_auditoria (acao, detalhes) VALUES ('diagnostico_sistema', '{\"origem\":\"status.php\"}')");
            marcar($checks, 'Banco', 'ok', 'Teste de gravação: INSERT funcionou', 'Registrado em log_auditoria.');
        } catch (Exception $e) {
            marcar($checks, 'Banco', 'fail', 'Teste de gravação FALHOU: ' . $e->getMessage(),
                'O usuário do banco precisa de INSERT/UPDATE/DELETE — confira os privilégios no cPanel.');
        }
    } else {
        marcar($checks, 'Banco', 'info', 'Teste de gravação disponível',
            'Abra status.php?teste_gravacao=1 para testar um INSERT real.');
    }
}

/* ==================================== E. HTTP DO PRÓPRIO SERVIDOR */
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$base = $https . '://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost') .
        rtrim(dirname(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/'), '/');

if (php_sapi_name() === 'cli-server') {
    // o servidor embutido do PHP atende uma requisição por vez: chamar a si
    // mesmo travaria a página. Os testes equivalentes rodam pelo navegador.
    marcar($checks, 'APIs', 'info', 'Autochamadas puladas (servidor de desenvolvimento)',
        'Em produção (Apache) esta seção testa as APIs e a proteção da pasta config/ a partir do próprio servidor.');
    $s1 = -1;
} else {
    list($s1, $b1) = http_get($base . '/api/diagnostico.php');
}
if ($s1 === -1) { /* desenvolvimento: seção coberta pelos testes do navegador */ } else
if ($s1 === 200 && tem('method_not_allowed', $b1)) {
    marcar($checks, 'APIs', 'ok', 'api/diagnostico.php responde JSON', trim($b1));
} elseif ($s1 === 0) {
    marcar($checks, 'APIs', 'warn', 'O servidor não conseguiu chamar a si mesmo (comum em hospedagem compartilhada)',
        'Não é necessariamente um erro — veja o teste feito PELO NAVEGADOR na seção final desta página.');
} else {
    marcar($checks, 'APIs', 'fail', 'api/diagnostico.php devolveu HTTP ' . $s1 . ' em vez de JSON',
        'Resposta: ' . substr(strip_tags($b1), 0, 160) . ' — se for erro 500, a causa típica é PHP < 8.1 (veja Ambiente) ou config/config.php ausente.');
}
$s2 = -1;
if (php_sapi_name() !== 'cli-server') {
    list($s2, $b2) = http_get($base . '/config/config.exemplo.php');
}
if ($s2 === -1) { /* desenvolvimento */ } elseif ($s2 === 403 || $s2 === 404) {
    marcar($checks, 'APIs', 'ok', 'Pasta config/ protegida da web (HTTP ' . $s2 . ')');
} elseif ($s2 === 200) {
    marcar($checks, 'APIs', 'fail', 'Pasta config/ EXPOSTA pela web',
        'O .htaccess não está sendo aplicado (AllowOverride desligado?). Mova config/ e src/ para fora de public_html e ajuste o caminho no topo de src/Db.php.');
} elseif ($s2 !== 0) {
    marcar($checks, 'APIs', 'warn', 'config/ devolveu HTTP ' . $s2, 'Esperado 403. Verifique o .htaccess da pasta.');
}

/* ================================================== RENDERIZAÇÃO */
$rotStatus = array('ok' => 'OK', 'warn' => 'ATENÇÃO', 'fail' => 'FALHA', 'info' => 'INFO');
$tot = array('ok' => 0, 'warn' => 0, 'fail' => 0, 'info' => 0);
foreach ($checks as $c) { $tot[$c[1]]++; }
$veredito = $tot['fail'] > 0 ? 'fail' : ($tot['warn'] > 0 ? 'warn' : 'ok');
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Diagnóstico do sistema · VIPEDia</title>
<style>
:root{--ok:#2a7462;--okw:#e2f0eb;--warn:#8d6a1c;--warnw:#f8efd9;--fail:#a93a2a;--failw:#f9e8e4;
      --info:#1f6f8b;--infow:#e2eff4;--ink:#121d25;--ink2:#43535f;--ink3:#6f818d;--line:#d9e2e8;--panel:#f3f6f8}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:15px/1.55 -apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.wrap{max-width:940px;margin:0 auto;padding:30px 20px 70px}
h1{font-size:24px;margin:0 0 4px}
.sub{color:var(--ink3);margin:0 0 20px;font-size:14px}
.resumo{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 26px}
.pill{padding:7px 14px;border-radius:20px;font-weight:700;font-size:13px}
.pill.ok{background:var(--okw);color:var(--ok)}.pill.warn{background:var(--warnw);color:var(--warn)}
.pill.fail{background:var(--failw);color:var(--fail)}.pill.info{background:var(--infow);color:var(--info)}
.veredito{padding:14px 18px;border-radius:9px;font-weight:700;margin:0 0 26px}
.veredito.ok{background:var(--okw);color:var(--ok)}
.veredito.warn{background:var(--warnw);color:var(--warn)}
.veredito.fail{background:var(--failw);color:var(--fail)}
h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid var(--line);padding-bottom:6px}
.item{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid #eef2f5;align-items:baseline}
.st{flex:0 0 74px;text-align:center;font-size:11px;font-weight:800;padding:3px 0;border-radius:4px}
.st.ok{background:var(--okw);color:var(--ok)}.st.warn{background:var(--warnw);color:var(--warn)}
.st.fail{background:var(--failw);color:var(--fail)}.st.info{background:var(--infow);color:var(--info)}
.tx{flex:1;min-width:0}
.tt{font-weight:650}
.dt{color:var(--ink2);font-size:13.5px;margin-top:2px;word-break:break-word}
code{background:var(--panel);padding:1px 5px;border-radius:3px;font-size:.88em}
button{font:inherit;font-weight:600;padding:8px 14px;border:0;border-radius:7px;background:var(--info);color:#fff;cursor:pointer}
.mini{font-size:12.5px;color:var(--ink3)}
#fila .dt{white-space:pre-wrap}
</style>
</head>
<body>
<div class="wrap">
  <h1>Diagnóstico do sistema VIPEDia</h1>
  <p class="sub">Gerado em <?php echo date('d/m/Y H:i:s'); ?> · instalação: <?php echo htmlspecialchars($base); ?></p>

  <div class="veredito <?php echo $veredito; ?>">
    <?php if ($veredito === 'ok') { echo 'Tudo certo: nenhum problema encontrado no servidor.'; }
          elseif ($veredito === 'warn') { echo 'Funcional, com pontos de atenção listados abaixo.'; }
          else { echo 'Há falhas impedindo o funcionamento — os itens FALHA abaixo dizem exatamente o que corrigir.'; } ?>
  </div>
  <div class="resumo">
    <span class="pill ok"><?php echo $tot['ok']; ?> ok</span>
    <span class="pill warn"><?php echo $tot['warn']; ?> atenção</span>
    <span class="pill fail"><?php echo $tot['fail']; ?> falhas</span>
    <span class="pill info"><?php echo $tot['info']; ?> informativos</span>
  </div>

  <?php
  $secAtual = null;
  foreach ($checks as $c) {
      if ($c[0] !== $secAtual) { if ($secAtual !== null) { echo ''; } $secAtual = $c[0]; echo '<h2>' . htmlspecialchars($secAtual) . '</h2>'; }
      echo '<div class="item"><span class="st ' . $c[1] . '">' . $rotStatus[$c[1]] . '</span><div class="tx">';
      echo '<div class="tt">' . htmlspecialchars($c[2]) . '</div>';
      if ($c[3] !== '') { echo '<div class="dt">' . htmlspecialchars($c[3]) . '</div>'; }
      echo '</div></div>';
  }
  ?>

  <h2>Testes pelo navegador (executados agora, nesta página)</h2>
  <div id="cli"><div class="item"><span class="st info">INFO</span><div class="tx"><div class="tt">Executando…</div></div></div></div>

  <h2>Fila local deste navegador</h2>
  <p class="mini">Quando um envio falha, o questionário guarda a resposta neste navegador e reenvia depois.
     Abra esta página <strong>no mesmo navegador e aparelho</strong> em que o diagnóstico foi feito para ver e reenviar o que ficou preso.</p>
  <div id="fila"></div>

<script>
(function () {
  var cli = document.getElementById('cli');
  var itens = [];
  function render() {
    cli.innerHTML = itens.map(function (i) {
      return '<div class="item"><span class="st ' + i[0] + '">' +
        ({ok:'OK',warn:'ATENÇÃO',fail:'FALHA',info:'INFO'})[i[0]] + '</span><div class="tx"><div class="tt">' +
        i[1] + '</div>' + (i[2] ? '<div class="dt">' + i[2] + '</div>' : '') + '</div></div>';
    }).join('');
  }
  function add(st, tt, dt) { itens.push([st, tt, dt || '']); render(); }

  // 1. API do banco, chamada DO NAVEGADOR (o mesmo caminho que o questionário usa)
  fetch('api/diagnostico.php').then(function (r) { return r.text().then(function (t) {
    try {
      var j = JSON.parse(t);
      add(j.code === 'method_not_allowed' ? 'ok' : 'warn',
          'Navegador → api/diagnostico.php respondeu (v' + (j.v || '?') + ')',
          'É por este caminho que o questionário grava no banco.');
    } catch (e) {
      add('fail', 'Navegador → api/diagnostico.php devolveu algo que não é JSON (HTTP ' + r.status + ')',
          'Causa típica: PHP < 8.1 ou config/config.php ausente — veja as seções acima. Trecho: ' +
          t.replace(/</g, '&lt;').slice(0, 140));
    }
  }); }).catch(function () {
    add('fail', 'Navegador não alcançou api/diagnostico.php', 'A pasta api/ está publicada nesta instalação?');
  });

  // 2. config.js publicado + Apps Script (planilha)
  fetch('webapp/js/config.js').then(function (r) {
    if (!r.ok) { throw new Error('http ' + r.status); }
    return r.text();
  }).then(function (t) {
    var mEnd = t.match(/ENDPOINT:\s*'([^']+)'/);
    if (t.indexOf('API_ENDPOINT') === -1) {
      add('fail', 'webapp publicado é ANTERIOR à Fase 3',
          'js/config.js no servidor não tem API_ENDPOINT — reenvie a pasta webapp/ completa. Sem isso, nada chega ao banco.');
    } else {
      add('ok', 'webapp publicado envia ao banco (Fase 3+)',
          'Os endereços das APIs são calculados a partir da própria pasta publicada.');
    }
    if (mEnd) {
      fetch(mEnd[1]).then(function (r2) { return r2.text(); }).then(function (t2) {
        try {
          var j = JSON.parse(t2);
          var v = j.v || '?';
          add(v >= 4 ? 'ok' : 'warn',
              'Apps Script (planilha) respondeu — versão ' + v,
              v >= 4 ? 'Correção do arquivamento (Fase 0) está no ar.'
                     : 'Versão anterior à correção da Fase 0: reimplante backend/apps-script.gs (esperado v4).');
        } catch (e) {
          add('fail', 'Apps Script devolveu página em vez de JSON',
              'A implantação precisa estar com acesso "Qualquer pessoa" — ou a URL foi arquivada. Confira em Implantar > Gerenciar implantações.');
        }
      }).catch(function () {
        add('fail', 'Navegador não alcançou o Apps Script (planilha)',
            'É a mesma falha "Sem conexão" vista no questionário. Se a internet está ok, a URL do ENDPOINT em webapp/js/config.js pode ter sido arquivada no Apps Script.');
      });
    }
  }).catch(function () {
    add('fail', 'webapp/js/config.js não foi encontrado nesta instalação',
        'A pasta webapp/ precisa estar em new_ipa/webapp/ — com esse nome.');
  });

  // 3. fila local
  var fila = document.getElementById('fila');
  function chave(k, rot, destino) {
    var q = [];
    try { q = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) {}
    var bloco = document.createElement('div');
    bloco.className = 'item';
    var st = q.length ? 'warn' : 'ok';
    bloco.innerHTML = '<span class="st ' + st + '">' + (q.length ? 'ATENÇÃO' : 'OK') + '</span>' +
      '<div class="tx"><div class="tt">' + rot + ': ' + q.length + ' envio(s) pendente(s)</div>' +
      (q.length ? '<div class="dt">' + q.map(function (p) {
          return '• ' + (p.action === 'relatorio' ? 'relatório de ' : '') + (p.nome || p.avaliado || p.id || 'envio');
        }).join('\n') + '</div><p><button data-k="' + k + '" data-d="' + destino + '">Reenviar agora</button> <span class="mini"></span></p>' : '') +
      '</div>';
    fila.appendChild(bloco);
  }
  chave('ipa_v2_outbox_db', 'Fila do banco (API)', 'api/diagnostico.php');
  chave('ipa_v2_outbox', 'Fila da planilha (Apps Script)', 'gas');

  fila.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-k]');
    if (!b) return;
    b.disabled = true;
    var k = b.getAttribute('data-k'), destino = b.getAttribute('data-d');
    var q = JSON.parse(localStorage.getItem(k) || '[]');
    var resto = [], feito = 0;
    var enviar = function (i) {
      if (i >= q.length) {
        localStorage.setItem(k, JSON.stringify(resto));
        b.nextElementSibling.textContent = feito + ' reenviado(s), ' + resto.length + ' ainda pendente(s). Recarregue a página para atualizar.';
        return;
      }
      var url = destino;
      if (destino === 'gas') {
        fetch('webapp/js/config.js').then(function (r) { return r.text(); }).then(function (t) {
          var m = t.match(/ENDPOINT:\s*'([^']+)'/);
          postar(m ? m[1] : '', i);
        });
        return;
      }
      postar(url, i);
    };
    var postar = function (url, i) {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(q[i]) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.ok) { feito++; } else { resto.push(q[i]); } enviar(i + 1); })
        .catch(function () { resto.push(q[i]); enviar(i + 1); });
    };
    enviar(0);
  });
})();
</script>
</div>
</body>
</html>
