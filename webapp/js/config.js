/* ============================================================
   Configuração do IPA — armazenamento 100% em banco MySQL
   ------------------------------------------------------------
   1. O backend é a pasta api/ (api.php + config.php), hospedada
      junto com o site. Guia completo em api/README.md.
   2. As implantações antigas do Google Apps Script devem ser
      ARQUIVADAS (Implantar > Gerenciar implantações > Arquivar)
      — as URLs ficaram expostas e a planilha foi descontinuada.
   3. O backend valida cada envio (permutação 0–11 por quadro),
      o que torna inútil a injeção de dados fabricados.
   ============================================================ */
const IPA_CONFIG = {
    // Backend MySQL/PHP hospedado junto com o site (pasta api/ irmã desta).
    // TODOS os dados são registrados no banco MySQL — a planilha Google
    // foi descontinuada. Mesma origem = sem CORS, sem implantação.
    ENDPOINT: '../api/api.php',

    // Versão do esquema de dados enviado ao backend
    SCHEMA_VERSION: 2,

    // Chave usada para salvar o progresso localmente no navegador
    STORAGE_KEY: 'ipa_v2_progress',

    // Fila local de envios pendentes (reenvio automático)
    QUEUE_KEY: 'ipa_v2_outbox'
};
