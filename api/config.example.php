<?php
/* ============================================================
   IPA — Configuração do backend MySQL
   1. Copie este arquivo como  config.php  (nunca versione o real).
   2. Preencha com os dados do banco criado no cPanel do HostGator
      (MySQL Databases: crie o banco, o usuário e associe os dois).
   3. Defina uma PANEL_KEY forte (é a senha do Painel do Consultor).
   ============================================================ */

const DB_HOST = 'localhost';                    // no HostGator normalmente é localhost
const DB_NAME = 'usuario_ipa';                  // ex.: itthri00_ipa
const DB_USER = 'usuario_ipauser';              // ex.: itthri00_ipauser
const DB_PASS = 'TROQUE-ESTA-SENHA';

/* Chave de acesso do Painel do Consultor (invente uma longa e aleatória) */
const PANEL_KEY = 'TROQUE-POR-UMA-CHAVE-LONGA-E-ALEATORIA';

/* Opcional: análise personalizada por IA no relatório.
   Obtenha grátis em https://aistudio.google.com/apikey e cole aqui.
   Deixe '' (vazio) para desativar — o relatório funciona normalmente sem. */
const GEMINI_API_KEY = '';
