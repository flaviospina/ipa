<?php
/**
 * Modelo de configuração do VIPEDia.
 *
 * COMO USAR
 *   1. copie este arquivo para config/config.php (mesma pasta)
 *   2. preencha a senha do banco
 *   3. NÃO envie config.php para o Git — ele está no .gitignore
 *
 * A pasta config/ tem um .htaccess que bloqueia acesso pela web. Se a sua
 * hospedagem permitir, o mais seguro ainda é mover config.php para fora de
 * public_html e ajustar o caminho em src/Db.php.
 */
declare(strict_types=1);

return [
    'db' => [
        'host'    => 'localhost',
        'porta'   => 3306,
        'nome'    => 'itthri79_vipedia',
        'usuario' => 'itthri79_vipedia_user',
        'senha'   => 'PREENCHA_A_SENHA_DO_BANCO',
    ],

    'app' => [
        // sem barra no fim
        'base_url'      => 'https://itthrive.com.br/vipedia/new_ipa',
        'ambiente'      => 'homologacao',   // 'homologacao' ou 'producao'
        'cookie_seguro' => true,            // exige HTTPS no cookie de sessão
    ],

    'sessao' => [
        'duracao_minutos' => 120,           // inatividade até precisar entrar de novo
    ],

    'login' => [
        'max_tentativas'   => 5,
        'bloqueio_minutos' => 15,
    ],
];
