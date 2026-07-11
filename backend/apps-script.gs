/**
 * ============================================================
 * IPA — Backend Google Apps Script (versão endurecida, schema v2)
 * ============================================================
 *
 * SEGURANÇA — o que este script corrige em relação à versão anterior:
 *
 * 1. VALIDAÇÃO ESTRITA: cada envio precisa conter, para cada um dos
 *    3 quadros, uma permutação completa dos pesos 0..11 (as 12 palavras
 *    esperadas, cada peso usado exatamente uma vez, soma 66). Envios
 *    fabricados fora desse formato são rejeitados — injetar lixo na
 *    base deixa de ser possível mesmo com a URL pública.
 * 2. HONEYPOT: o campo "website" deve chegar vazio (bots o preenchem).
 * 3. RATE LIMIT: no máximo N gravações por minuto (CacheService) —
 *    bloqueia rajadas de spam/batch.
 * 4. DADOS DE TESTE SEPARADOS: a função de simulação grava na aba
 *    "SIMULADOS", nunca na base de produção, e só roda pelo editor
 *    do Apps Script (exige login de editor da planilha).
 * 5. RESPOSTA VERIFICÁVEL: devolve JSON { ok: true/false } para o
 *    front-end confirmar a gravação (sem no-cors cego).
 * 6. CONSENTIMENTO LGPD: registra o timestamp do aceite.
 *
 * IMPLANTAÇÃO: ver backend/README.md. IMPORTANTE: arquive a
 * implantação antiga (URL AKfycbxI2...) — ela ficou exposta.
 */

const SHEET_PROD = 'RESPOSTAS';
const SHEET_TEST = 'SIMULADOS';
const RATE_LIMIT_PER_MIN = 10;

/* Palavras esperadas por quadro (ids do schema v2) */
const EXPECTED = {
  1: ['Q1_ABERTO','Q1_ACOLHEDOR','Q1_ATENCIOSO','Q1_CLARO','Q1_EXPLICITO','Q1_ENFATICO_C','Q1_CONCENTRADO','Q1_FORMAL','Q1_IMPESSOAL','Q1_FLEXIVEL','Q1_INTERESSADO','Q1_CORDIAL_E'],
  2: ['Q2_COMPREENSIVO','Q2_CUIDADOSO','Q2_RESPEITOSO','Q2_DESCRITIVO','Q2_INTERATIVO','Q2_OUVINTE','Q2_DISTANTE','Q2_EFICIENTE','Q2_OBJETIVO','Q2_RAPIDO_E','Q2_PRECISO','Q2_SOLICITO'],
  3: ['Q3_AUTENTICO','Q3_CORDIAL_A','Q3_EMPATICO','Q3_ACESSIVEL','Q3_ELOQUENTE','Q3_ESPONTANEO','Q3_DIRETO','Q3_PROTOCOLAR','Q3_RAPIDO_P','Q3_CONSISTENTE','Q3_PRESTATIVO','Q3_ENFATICO_E']
};

function doPost(e) {
  try {
    // rate limit global simples
    const cache = CacheService.getScriptCache();
    const bucket = 'rl_' + Math.floor(Date.now() / 60000);
    const count = Number(cache.get(bucket) || 0);
    if (count >= RATE_LIMIT_PER_MIN) return reply(false, 'rate_limited');
    cache.put(bucket, String(count + 1), 90);

    const data = JSON.parse(e.postData.contents);

    // honeypot + schema
    if (data.website) return reply(false, 'rejected');
    if (Number(data.schema) !== 2) return reply(false, 'bad_schema');

    // campos de identificação
    const nome = clean(data.nome), org = clean(data.organizacao), funcao = clean(data.funcao);
    if (!nome || !org || !funcao) return reply(false, 'missing_fields');
    if (!data.consentimento) return reply(false, 'missing_consent');

    // validação estrita: permutação 0..11 em cada quadro
    const respostas = data.respostas || {};
    for (const q of [1, 2, 3]) {
      const ids = EXPECTED[q];
      const pesos = ids.map(id => Number(respostas[id]));
      if (pesos.some(p => !Number.isInteger(p) || p < 0 || p > 11)) return reply(false, 'invalid_weights_q' + q);
      const set = new Set(pesos);
      if (set.size !== 12) return reply(false, 'repeated_weights_q' + q);
      const soma = pesos.reduce((a, b) => a + b, 0);
      if (soma !== 66) return reply(false, 'bad_sum_q' + q);
    }

    // recalcula os scores no servidor (não confia no cliente)
    const scores = { A: 0, C: 0, P: 0, E: 0 };
    // o estilo está codificado na posição da palavra dentro do quadro: 0-2=A, 3-5=C, 6-8=P, 9-11=E
    for (const q of [1, 2, 3]) {
      EXPECTED[q].forEach(function (id, i) {
        const st = i < 3 ? 'A' : i < 6 ? 'C' : i < 9 ? 'P' : 'E';
        scores[st] += Number(respostas[id]);
      });
    }
    const total = scores.A + scores.C + scores.P + scores.E; // = 198 garantido pela validação

    // arquiva o relatório individual no Drive (PDF; HTML como plano B)
    const linkRelatorio = salvarRelatorio(data);

    gravar(SHEET_PROD, data, respostas, scores, total, linkRelatorio);
    return reply(true, 'saved');
  } catch (err) {
    return reply(false, 'error');
  }
}

/**
 * Salva o relatório enviado pelo webapp numa pasta do Drive
 * ("IPA - Relatórios") e devolve a URL do arquivo. O arquivo fica
 * PRIVADO (visível só para a conta dona da planilha) — adequado à
 * LGPD; baixe ou compartilhe individualmente quando necessário.
 */
function salvarRelatorio(data) {
  try {
    const html = String(data.relatorio || '');
    if (!html || html.length > 800000) return ''; // sem relatório ou grande demais

    const folderName = 'IPA - Relatórios';
    const it = DriveApp.getFoldersByName(folderName);
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);

    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
    const base = 'IPA - ' + clean(data.nome) + ' - ' + stamp;
    const htmlBlob = Utilities.newBlob(html, 'text/html', base + '.html');

    let file;
    try {
      // converte para PDF (mantém o arquivo pronto para download)
      file = folder.createFile(htmlBlob.getAs('application/pdf').setName(base + '.pdf'));
    } catch (e) {
      // plano B: guarda o HTML (abre no navegador e imprime em PDF)
      file = folder.createFile(htmlBlob);
    }
    return file.getUrl();
  } catch (e) {
    return '';
  }
}

function gravar(sheetName, data, respostas, scores, total, linkRelatorio) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(sheetName);
  const header = ['Data/Hora', 'Consentimento LGPD', 'Organização', 'Nome', 'Função']
    .concat(EXPECTED[1], EXPECTED[2], EXPECTED[3])
    .concat(['Score A', 'Score C', 'Score P', 'Score E', 'Total IPA', 'Relatório (link)']);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < header.length) {
    // planilha criada por versão anterior: completa o cabeçalho novo
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  const row = [new Date(), data.consentimento, clean(data.organizacao), clean(data.nome), clean(data.funcao)]
    .concat(EXPECTED[1].map(id => Number(respostas[id])))
    .concat(EXPECTED[2].map(id => Number(respostas[id])))
    .concat(EXPECTED[3].map(id => Number(respostas[id])))
    .concat([scores.A, scores.C, scores.P, scores.E, total, linkRelatorio || '']);
  sh.appendRow(row);
}

function clean(v) {
  return String(v || '').replace(/[=+\-@\t\r\n]/g, ' ').trim().slice(0, 200); // anti fórmula-injection
}

function reply(ok, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok, code: code }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* GET não expõe nada */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, code: 'method_not_allowed' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * SIMULAÇÃO DE TESTE (substitui o antigo "Envio em Lote" da página pública).
 * Só pode ser executada por um editor da planilha, dentro do editor do
 * Apps Script: Executar > simularRespostas. Grava APENAS na aba SIMULADOS.
 */
function simularRespostas() {
  const N = 10;
  for (let n = 0; n < N; n++) {
    const respostas = {};
    for (const q of [1, 2, 3]) {
      const pesos = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      EXPECTED[q].forEach(function (id, i) { respostas[id] = pesos[i]; });
    }
    const scores = { A: 0, C: 0, P: 0, E: 0 };
    for (const q of [1, 2, 3]) {
      EXPECTED[q].forEach(function (id, i) {
        const st = i < 3 ? 'A' : i < 6 ? 'C' : i < 9 ? 'P' : 'E';
        scores[st] += respostas[id];
      });
    }
    gravar(SHEET_TEST, {
      consentimento: 'SIMULADO',
      organizacao: 'TESTE LAB',
      nome: 'Simulado ' + (n + 1),
      funcao: 'Teste'
    }, respostas, scores, 198);
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
