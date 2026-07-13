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
const SHEET_360 = 'RESPOSTAS_360';
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

    // roteamento por ação
    if (data.action === 'relatorio') return arquivarRelatorio(data);
    if (data.action === '360') return receber360(data);
    return receberDiagnostico(data);
  } catch (err) {
    return reply(false, 'error');
  }
}

/* ---------- Envio principal (autoavaliação IPA) ---------- */
function receberDiagnostico(data) {
  const nome = clean(data.nome), org = clean(data.organizacao), funcao = clean(data.funcao);
  if (!nome || !org || !funcao) return reply(false, 'missing_fields');
  if (!data.consentimento) return reply(false, 'missing_consent');

  const respostas = data.respostas || {};
  const erro = validarRespostas(respostas);
  if (erro) return reply(false, erro);

  const scores = calcularScores(respostas);
  const total = scores.A + scores.C + scores.P + scores.E; // = 198 garantido

  gravar(SHEET_PROD, data, respostas, scores, total, '');

  // análise personalizada por IA (opcional — exige GEMINI_API_KEY configurada)
  const ia = gerarAnaliseIA(data, respostas, scores);

  return ContentService.createTextOutput(JSON.stringify({ ok: true, code: 'saved', ia: ia }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Passo 2: arquivamento do relatório final ---------- */
function arquivarRelatorio(data) {
  if (!data.id) return reply(false, 'missing_id');
  const link = salvarRelatorio(data);
  if (!link) return reply(false, 'archive_failed');

  // grava o link na linha correspondente (coluna ID)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_PROD);
  if (sh && sh.getLastRow() > 1) {
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const idCol = header.indexOf('ID');
    const linkCol = header.indexOf('Relatório (link)');
    if (idCol >= 0 && linkCol >= 0) {
      for (let i = values.length - 1; i >= 1; i--) {
        if (String(values[i][idCol]) === String(data.id)) {
          sh.getRange(i + 1, linkCol + 1).setValue(link);
          break;
        }
      }
    }
  }
  return reply(true, 'archived');
}

/* ---------- IPA 360°: avaliação externa (anônima) ---------- */
function receber360(data) {
  const avaliado = clean(data.avaliado), org = clean(data.organizacao), relacao = clean(data.relacao);
  if (!avaliado || !org || !relacao) return reply(false, 'missing_fields');

  const respostas = data.respostas || {};
  const erro = validarRespostas(respostas);
  if (erro) return reply(false, erro);

  const scores = calcularScores(respostas);
  const total = scores.A + scores.C + scores.P + scores.E;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_360);
  const header = ['Data/Hora', 'Avaliado', 'Organização', 'Relação']
    .concat(EXPECTED[1], EXPECTED[2], EXPECTED[3])
    .concat(['Score A', 'Score C', 'Score P', 'Score E', 'Total IPA']);
  if (!sh) {
    sh = ss.insertSheet(SHEET_360);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  const row = [new Date(), avaliado, org, relacao]
    .concat(EXPECTED[1].map(id => Number(respostas[id])))
    .concat(EXPECTED[2].map(id => Number(respostas[id])))
    .concat(EXPECTED[3].map(id => Number(respostas[id])))
    .concat([scores.A, scores.C, scores.P, scores.E, total]);
  sh.appendRow(row);
  return reply(true, 'saved_360');
}

/* ---------- validação e cálculo compartilhados ---------- */
function validarRespostas(respostas) {
  for (const q of [1, 2, 3]) {
    const pesos = EXPECTED[q].map(id => Number(respostas[id]));
    if (pesos.some(p => !Number.isInteger(p) || p < 0 || p > 11)) return 'invalid_weights_q' + q;
    if (new Set(pesos).size !== 12) return 'repeated_weights_q' + q;
    if (pesos.reduce((a, b) => a + b, 0) !== 66) return 'bad_sum_q' + q;
  }
  return null;
}

function calcularScores(respostas) {
  // o estilo está codificado na posição da palavra dentro do quadro: 0-2=A, 3-5=C, 6-8=P, 9-11=E
  const scores = { A: 0, C: 0, P: 0, E: 0 };
  for (const q of [1, 2, 3]) {
    EXPECTED[q].forEach(function (id, i) {
      const st = i < 3 ? 'A' : i < 6 ? 'C' : i < 9 ? 'P' : 'E';
      scores[st] += Number(respostas[id]);
    });
  }
  return scores;
}

/**
 * ---------- Relatório enriquecido por IA (Gemini) ----------
 * Para ativar: no editor do Apps Script, abra Configurações do projeto
 * (ícone de engrenagem) > Propriedades do script > Adicionar propriedade:
 *   Chave: GEMINI_API_KEY   Valor: sua chave do Google AI Studio
 * (obtenha grátis em https://aistudio.google.com/apikey)
 * Sem a chave, o relatório usa apenas os textos padrão da metodologia.
 */
function gerarAnaliseIA(data, respostas, scores) {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key) return null;

    const ord = ['A', 'C', 'P', 'E'].map(function (k) {
      return { k: k, nome: { A: 'Centrado na Atenção', C: 'Centrado na Comunicação', P: 'Centrado no Procedimento', E: 'Equilibrado' }[k], v: scores[k] };
    }).sort(function (a, b) { return b.v - a.v; });
    const difs = [ord[0].v - ord[1].v, ord[1].v - ord[2].v, ord[2].v - ord[3].v];
    const regra = ord[0].k === 'E' ? 'Equilibrado do modelo como 1ª preferência'
      : (difs[0] < 15 && difs[1] < 15 && difs[2] < 15) ? 'Equilibrado Natural (Adaptativo): todas as diferenças < 15'
      : difs[0] >= 15 ? 'Forte apego ao estilo predominante (diferença >= 15)'
      : 'Relativa flexibilidade entre 1º e 2º estilos (diferença < 15)';

    const palavras = [];
    [1, 2, 3].forEach(function (q) {
      EXPECTED[q].forEach(function (id, i) {
        const st = i < 3 ? 'Atenção' : i < 6 ? 'Comunicação' : i < 9 ? 'Procedimento' : 'Equilibrado';
        const momento = q === 1 ? 'Início' : q === 2 ? 'Durante' : 'Término';
        palavras.push({ palavra: id.split('_').slice(1).join(' '), estilo: st, momento: momento, nota: Number(respostas[id]) });
      });
    });
    const talentos = palavras.filter(function (p) { return p.nota >= 9; });
    const desenvolver = palavras.filter(function (p) { return p.nota <= 2; });

    const prompt =
      'Você é um Consultor Sênior de Desenvolvimento Humano, especialista em atendimento ao cliente e mestre na Abordagem ACP (Atenção, Comunicação e Procedimento — metodologia Zuvela). ' +
      'Premissas: Atenção atende à necessidade de AUTOESTIMA do cliente; Comunicação, à de SEGURANÇA; Procedimento, à de TRATAMENTO JUSTO. O atendimento tem 3 momentos: Início (rapport e acolhimento), Durante (execução técnica com escuta ativa) e Término (informar resultados com clareza e polidez). O Estilo Equilibrado é a referência de desenvolvimento. O cliente é um "alvo móvel"; o caminho é a versatilidade (flexibilidade + adaptação). ' +
      'REGRAS: tom encorajador e técnico, sem punição; notas baixas são "pontos a desenvolver" (nunca "pontos negativos" nem falhas de caráter); nunca misture conceitos dos estilos; escreva em português do Brasil, dirigindo-se ao profissional como "você". ' +
      'DADOS DO PESQUISADO: Nome: ' + clean(data.nome) + '. Função: ' + clean(data.funcao) + '. Organização: ' + clean(data.organizacao) + '. ' +
      'Pontuações (total 198): ' + ord.map(function (o) { return o.nome + ' = ' + o.v; }).join('; ') + '. Diferenças entre estilos consecutivos: ' + difs.join(', ') + '. Critério qualificador: ' + regra + '. ' +
      'Palavras com nota alta (9-11): ' + (talentos.map(function (p) { return p.palavra + ' (' + p.estilo + ', ' + p.momento + ', nota ' + p.nota + ')'; }).join('; ') || 'nenhuma') + '. ' +
      'Palavras com nota baixa (0-2): ' + (desenvolver.map(function (p) { return p.palavra + ' (' + p.estilo + ', ' + p.momento + ', nota ' + p.nota + ')'; }).join('; ') || 'nenhuma') + '. ' +
      'Gere um JSON com EXATAMENTE estas chaves (valores em texto corrido, parágrafos separados por \\n\\n, sem markdown): ' +
      '"interpretacao" (análise profunda e personalizada do perfil: dinâmica entre estilo predominante e secundário e impacto do critério qualificador no dia a dia, 3 parágrafos), ' +
      '"momentos" (análise da conduta provável no Início, Durante e Término com base nas notas, 3 parágrafos, um por momento), ' +
      '"talentos" (como as palavras de nota alta se manifestam como forças observáveis, 1-2 parágrafos), ' +
      '"desenvolvimento" (o que as notas baixas revelam como focos de capacitação, ligando cada palavra à necessidade do cliente que ela atende, 1-2 parágrafos), ' +
      '"recomendacoes" (3 a 5 ações práticas e específicas para este perfil, texto corrido com um parágrafo por ação), ' +
      '"conclusao" (síntese motivadora do perfil e da jornada rumo à versatilidade, 1 parágrafo).';

    const res = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
      {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: 'application/json' }
        })
      });
    if (res.getResponseCode() !== 200) return null;
    const out = JSON.parse(res.getContentText());
    const texto = out.candidates && out.candidates[0] && out.candidates[0].content.parts[0].text;
    if (!texto) return null;
    const ia = JSON.parse(texto);
    // aceita apenas as chaves esperadas, como texto puro
    const seguro = {};
    ['interpretacao', 'momentos', 'talentos', 'desenvolvimento', 'recomendacoes', 'conclusao'].forEach(function (k) {
      if (typeof ia[k] === 'string' && ia[k].trim()) seguro[k] = ia[k].trim();
    });
    return Object.keys(seguro).length ? seguro : null;
  } catch (err) {
    return null; // IA é opcional: falhas nunca bloqueiam o diagnóstico
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
    .concat(['Score A', 'Score C', 'Score P', 'Score E', 'Total IPA', 'Relatório (link)', 'ID']);
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
    .concat([scores.A, scores.C, scores.P, scores.E, total, linkRelatorio || '', clean(data.id || '')]);
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

/**
 * GET — usado apenas pelo Painel do Consultor, protegido por chave.
 * 1) Rode configurarChavePainel() uma vez no editor para gerar a chave.
 * 2) Informe a chave na tela de acesso do painel (painel/index.html).
 * Sem chave válida, nada é exposto.
 */
function doGet(e) {
  try {
    const key = (e && e.parameter && e.parameter.key) || '';
    const action = (e && e.parameter && e.parameter.action) || '';
    const stored = PropertiesService.getScriptProperties().getProperty('PANEL_KEY');
    if ((action !== 'list' && action !== 'list360') || !stored || key !== stored) {
      return reply(false, 'method_not_allowed');
    }

    if (action === 'list360') return listar360();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_PROD);
    if (!sh || sh.getLastRow() < 2) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, rows: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const values = sh.getDataRange().getValues();
    const header = values[0];
    const idx = {};
    header.forEach(function (h, i) { idx[h] = i; });
    const col = (row, name) => (idx[name] !== undefined ? row[idx[name]] : '');
    const rows = values.slice(1).map(function (row) {
      return {
        data: col(row, 'Data/Hora'),
        org: col(row, 'Organização'),
        nome: col(row, 'Nome'),
        funcao: col(row, 'Função'),
        A: Number(col(row, 'Score A')) || 0,
        C: Number(col(row, 'Score C')) || 0,
        P: Number(col(row, 'Score P')) || 0,
        E: Number(col(row, 'Score E')) || 0,
        link: col(row, 'Relatório (link)') || ''
      };
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true, rows: rows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return reply(false, 'error');
  }
}

/* Lista as avaliações 360° para o painel (mesma chave do painel) */
function listar360() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_360);
  if (!sh || sh.getLastRow() < 2) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true, rows: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const idx = {};
  header.forEach(function (h, i) { idx[h] = i; });
  const col = (row, name) => (idx[name] !== undefined ? row[idx[name]] : '');
  const rows = values.slice(1).map(function (row) {
    return {
      data: col(row, 'Data/Hora'),
      avaliado: col(row, 'Avaliado'),
      org: col(row, 'Organização'),
      relacao: col(row, 'Relação'),
      A: Number(col(row, 'Score A')) || 0,
      C: Number(col(row, 'Score C')) || 0,
      P: Number(col(row, 'Score P')) || 0,
      E: Number(col(row, 'Score E')) || 0
    };
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, rows: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Execute UMA VEZ no editor (Executar > configurarChavePainel).
 * Gera a chave de acesso do Painel do Consultor e a exibe no log
 * (Ver > Registro de execução). Guarde-a com segurança.
 * Para trocar a chave, basta executar novamente.
 */
function configurarChavePainel() {
  const key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('PANEL_KEY', key);
  Logger.log('Chave do Painel do Consultor: ' + key);
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
