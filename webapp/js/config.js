/* ============================================================
   Configuração do IPA
   ------------------------------------------------------------
   SEGURANÇA — leia antes de publicar:

   1. ENDPOINT: aponte para a NOVA implantação do Google Apps
      Script (backend/apps-script.gs). A URL antiga (AKfycbxI2...)
      ficou exposta publicamente no código-fonte das páginas
      anteriores e deve ser DESATIVADA no painel do Apps Script
      (Implantar > Gerenciar implantações > Arquivar).

   2. Não existe mais área administrativa nem senha no front-end.
      Simulações de teste são feitas apenas pela função de teste
      do próprio Apps Script (ver backend/README.md) e gravam em
      aba separada, nunca na base de produção.

   3. O backend valida cada envio (permutação 0–11 por quadro),
      o que torna inútil a injeção de dados fabricados.
   ============================================================ */
const IPA_CONFIG = {
    // URL da implantação do Apps Script (termina em /exec)
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbxWRIWK5wX2PZqf6_hjMfykBhxk8-9UGQdX6Pa-Td90qAs8g8KmrDHB2mNN8SeN60EP0w/exec',

    // Versão do esquema de dados enviado ao backend
    SCHEMA_VERSION: 2,

    // Chave usada para salvar o progresso localmente no navegador
    STORAGE_KEY: 'ipa_v2_progress',

    // Fila local de envios pendentes (reenvio automático)
    QUEUE_KEY: 'ipa_v2_outbox'
};
