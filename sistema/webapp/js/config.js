/* ============================================================
   Configuração do IPA
   ------------------------------------------------------------
   ENDEREÇOS DO BANCO CALCULADOS SOZINHOS: as APIs ficam sempre em
   ../api/ em relação à pasta webapp/ — então o endereço é derivado
   do próprio local em que o questionário está publicado. A mesma
   pasta funciona em new_ipa/, em homologação ou em qualquer outro
   caminho do servidor, sem editar nada aqui.

   Só o ENDPOINT do Apps Script (planilha, legado da transição) é
   fixo, porque mora no Google.
   ============================================================ */
const IPA_CONFIG = (function () {
    // raiz da instalação = tudo antes de /webapp/ no endereço atual
    var raiz = '';
    if ((location.protocol === 'http:' || location.protocol === 'https:') &&
        /\/webapp\//.test(location.pathname)) {
        raiz = location.origin + location.pathname.replace(/\/webapp\/.*$/, '');
    }
    return {
        // URL da implantação do Apps Script (termina em /exec) — planilha
        ENDPOINT: 'https://script.google.com/macros/s/AKfycbylZsc3U-fpSzHO9dYbtFB1dNKAsAhQCwXJ1R1IpiRJNr_074-47pmcjFRp7fvEq9W0HA/exec',

        // API que grava no banco itthri79_vipedia (calculada; vazia = só planilha,
        // acontece p.ex. ao abrir o arquivo direto do computador via file://)
        API_ENDPOINT: raiz ? raiz + '/api/diagnostico.php' : '',

        // API dos convites 360° (calculada)
        API_360_ENDPOINT: raiz ? raiz + '/api/convite360.php' : '',

        // Versão do esquema de dados enviado ao backend
        SCHEMA_VERSION: 2,

        // Chave usada para salvar o progresso localmente no navegador
        STORAGE_KEY: 'ipa_v2_progress',

        // Fila local de envios pendentes (reenvio automático) — planilha
        QUEUE_KEY: 'ipa_v2_outbox',

        // Fila local de envios pendentes para a API do banco
        QUEUE_API_KEY: 'ipa_v2_outbox_db'
    };
})();
