<?php
/* ============================================================
   IPA HOMOLOGAÇÃO — Configuração
   1. Copie este arquivo como config.php (nunca versione o real).
   2. Use um banco SEPARADO do de produção (ex.: itthri79_ipahml),
      criado no cPanel e com o schema.sql importado no phpMyAdmin.
   ============================================================ */

const DB_HOST = 'localhost';
const DB_NAME = 'usuario_ipahml';
const DB_USER = 'usuario_ipahmluser';
const DB_PASS = 'TROQUE-ESTA-SENHA';

/* IA que escreve os relatórios (Google Gemini — aistudio.google.com/apikey) */
const GEMINI_API_KEY = '';
const IA_MODELO = 'gemini-2.0-flash';

/* Chave da Área do Gestor (cadastro de funcionários) — invente uma longa */
const GESTOR_KEY = 'TROQUE-POR-UMA-CHAVE-LONGA-E-ALEATORIA';

/* Integração n8n: webhook que recebe os convites e dispara os e-mails.
   Crie um fluxo no n8n com um nó Webhook (POST) e cole aqui a URL de
   produção dele. O payload enviado contém: assunto e, por destinatário,
   nome, email, link exclusivo e o HTML pronto do e-mail. */
const N8N_WEBHOOK_URL = '';
/* Opcional: segredo compartilhado, enviado no cabeçalho X-Ipa-Token,
   para o fluxo do n8n validar que a chamada veio do IPA. */
const N8N_TOKEN = '';

/* Endereço público da pasta homologacao/ (para montar os links dos e-mails)
   ex.: 'https://itthrive.com.br/SUA-PASTA/homologacao' */
const BASE_URL = '';

/* Somente para testes locais: true desativa a IA e a chamada ao n8n */
const IA_SIMULADA = false;
const EMAIL_SIMULADO = false;
