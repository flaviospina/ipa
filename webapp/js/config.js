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
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbylZsc3U-fpSzHO9dYbtFB1dNKAsAhQCwXJ1R1IpiRJNr_074-47pmcjFRp7fvEq9W0HA/exec',

    // API que grava no banco itthri79_vipedia (Fase 3). Durante a transição
    // o envio vai para os DOIS destinos: banco e planilha. Deixe vazio ('')
    // para desativar temporariamente a gravação no banco.
    API_ENDPOINT: 'https://itthrive.com.br/vipedia/new_ipa/api/diagnostico.php',

    // API dos convites 360° (Fase 4): valida o link de uso único e grava
    // a avaliação externa no banco.
    API_360_ENDPOINT: 'https://itthrive.com.br/vipedia/new_ipa/api/convite360.php',

    // Versão do esquema de dados enviado ao backend
    SCHEMA_VERSION: 2,

    // Chave usada para salvar o progresso localmente no navegador
    STORAGE_KEY: 'ipa_v2_progress',

    // Fila local de envios pendentes (reenvio automático)
    QUEUE_KEY: 'ipa_v2_outbox',

    // Fila local de envios pendentes para a API do banco
    QUEUE_API_KEY: 'ipa_v2_outbox_db'
};
