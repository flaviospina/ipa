/**
 * Abordagem ACP + Indicador IPA — apresentação executiva
 * Gera: abordagem-acp-ipa.pptx
 */
const pptxgen = require("pptxgenjs");

/* ---------------------------------------------------------------- paleta */
const INK      = "0E2233"; // navy profundo — cor dominante
const INK_SOFT = "1B3A54"; // cartões sobre fundo escuro
const INK_LINE = "2C526E";
const PAPER    = "FFFFFF";
const MIST     = "F1F5F8"; // cartões sobre fundo claro
const MIST_2   = "E4EBF1";
const MUTED    = "6B7C8C";
const MUTED_D  = "9FB6C6"; // texto secundário sobre escuro

const ATE = "E07A5F"; // Atenção      — terracota
const COM = "E9B44C"; // Comunicação  — âmbar
const PRO = "2A9D8F"; // Procedimento — teal

const H = "Cambria";   // títulos
const B = "Calibri";   // corpo

const pres = new pptxgen();
pres.defineLayout({ name: "W16", width: 13.333, height: 7.5 });
pres.layout = "W16";
pres.author = "Francisco Milreu · Antonio Zuvela";
pres.company = "Abordagem ACP";
pres.title = "A Abordagem ACP — Estratégia de Atendimento Baseada em Comportamentos";

let page = 1; // a capa não recebe numeração

/* ------------------------------------------------------------- helpers */
const noLine = () => ({ width: 0 });

function newSlide(dark) {
  const s = pres.addSlide();
  s.background = { color: dark ? INK : PAPER };
  return s;
}

/** rodapé discreto + número de página */
function chrome(s, dark) {
  page += 1;
  s.addText("Abordagem ACP  ·  Indicador IPA", {
    x: 0.75, y: 6.92, w: 5, h: 0.28, margin: 0,
    fontFace: B, fontSize: 9, charSpacing: 1,
    color: dark ? "5E7385" : MUTED,
  });
  s.addText(String(page).padStart(2, "0"), {
    x: 11.9, y: 6.92, w: 0.7, h: 0.28, margin: 0, align: "right",
    fontFace: B, fontSize: 10, bold: true, color: dark ? MUTED_D : MUTED,
  });
}

/** cabeçalho padrão: eyebrow + título + subtítulo */
function head(s, o) {
  const dark = !!o.dark;
  s.addText(o.eyebrow, {
    x: 0.75, y: 0.52, w: 11.8, h: 0.3, margin: 0,
    fontFace: B, fontSize: 11, bold: true, charSpacing: 2,
    color: o.eyebrowColor || COM,
  });
  s.addText(o.title, {
    x: 0.75, y: 0.88, w: o.titleW || 11.6, h: o.titleH || 0.85, margin: 0, valign: "top",
    fontFace: H, fontSize: o.titleSize || 28, bold: true,
    color: dark ? PAPER : INK,
  });
  if (o.sub) {
    s.addText(o.sub, {
      x: 0.75, y: o.subY || 1.68, w: o.subW || 10.6, h: 0.5, margin: 0,
      fontFace: B, fontSize: 15, color: dark ? MUTED_D : MUTED,
    });
  }
}

/** cartão retangular arredondado */
function card(s, o) {
  s.addShape(pres.ShapeType.roundRect, {
    x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: 0.09,
    fill: { color: o.fill },
    line: o.line ? { color: o.line, width: 1 } : noLine(),
    shadow: o.shadow
      ? { type: "outer", angle: 90, blur: 14, offset: 3, color: "9FB0BE", opacity: 0.28 }
      : undefined,
  });
}

/** medalhão circular com letra ou número */
function badge(s, o) {
  s.addShape(pres.ShapeType.ellipse, {
    x: o.x, y: o.y, w: o.d, h: o.d,
    fill: { color: o.fill }, line: noLine(),
  });
  s.addText(o.label, {
    x: o.x, y: o.y, w: o.d, h: o.d, margin: 0,
    align: "center", valign: "middle",
    fontFace: o.face || H, fontSize: o.size || 18, bold: true,
    color: o.color || PAPER,
  });
}

/** faixa de pergunta-gatilho no rodapé do conteúdo */
function trigger(s, text, o) {
  o = o || {};
  const dark = !!o.dark;
  const y = o.y || 6.05;
  card(s, { x: 0.75, y: y, w: 11.83, h: o.h || 0.72, fill: dark ? INK_SOFT : MIST });
  s.addShape(pres.ShapeType.ellipse, {
    x: 1.0, y: y + 0.16, w: 0.4, h: 0.4, fill: { color: COM }, line: noLine(),
  });
  s.addText("?", {
    x: 1.0, y: y + 0.16, w: 0.4, h: 0.4, margin: 0, align: "center", valign: "middle",
    fontFace: H, fontSize: 17, bold: true, color: INK,
  });
  s.addText(text, {
    x: 1.55, y: y, w: 10.9, h: o.h || 0.72, margin: 0, valign: "middle",
    fontFace: B, fontSize: o.size || 14, italic: true,
    color: dark ? PAPER : INK,
  });
}

/* =============================================================== 01 CAPA */
{
  const s = newSlide(true);
  // motivo visual: a tríade como três círculos que se sobrepõem
  s.addShape(pres.ShapeType.ellipse, { x: 8.35, y: 1.05, w: 3.5, h: 3.5, fill: { color: ATE, transparency: 72 }, line: noLine() });
  s.addShape(pres.ShapeType.ellipse, { x: 9.55, y: 3.05, w: 3.5, h: 3.5, fill: { color: COM, transparency: 74 }, line: noLine() });
  s.addShape(pres.ShapeType.ellipse, { x: 7.25, y: 3.05, w: 3.5, h: 3.5, fill: { color: PRO, transparency: 72 }, line: noLine() });

  s.addText("APRESENTAÇÃO EXECUTIVA", {
    x: 0.9, y: 1.35, w: 6.5, h: 0.3, margin: 0,
    fontFace: B, fontSize: 12, bold: true, charSpacing: 3, color: COM,
  });
  s.addText("A ABORDAGEM ACP", {
    x: 0.9, y: 1.78, w: 6.6, h: 1.7, margin: 0, valign: "top",
    fontFace: H, fontSize: 46, bold: true, color: PAPER, lineSpacing: 50,
  });
  s.addText("Estratégia de atendimento baseada em comportamentos", {
    x: 0.9, y: 3.62, w: 7.0, h: 0.5, margin: 0,
    fontFace: B, fontSize: 17.5, color: MUTED_D,
  });

  const pills = [["ATENÇÃO", ATE, 0.9, 1.55], ["COMUNICAÇÃO", COM, 2.6, 2.15], ["PROCEDIMENTO", PRO, 4.9, 2.4]];
  pills.forEach(([t, c, x, w]) => {
    s.addShape(pres.ShapeType.roundRect, { x, y: 4.48, w, h: 0.42, rectRadius: 0.21, fill: { color: INK_SOFT }, line: noLine() });
    s.addText(t, { x, y: 4.48, w, h: 0.42, margin: 0, align: "center", valign: "middle", fontFace: B, fontSize: 10.5, bold: true, charSpacing: 1, color: c });
  });

  s.addText("Uma metodologia para transformar a linha de frente através da consciência e do desenvolvimento de competências comportamentais.", {
    x: 0.9, y: 5.32, w: 6.4, h: 0.7, margin: 0,
    fontFace: B, fontSize: 12.5, color: "7E93A3", lineSpacing: 18,
  });
  s.addText([
    { text: "Francisco José Santos Milreu", options: { bold: true, color: PAPER } },
    { text: "   ·   ", options: { color: INK_LINE } },
    { text: "Antonio Zuvela", options: { bold: true, color: PAPER } },
  ], { x: 0.9, y: 6.35, w: 7, h: 0.3, margin: 0, fontFace: B, fontSize: 13 });
  s.addText("Proposta de implantação  ·  Reunião de Diretoria", {
    x: 0.9, y: 6.7, w: 7, h: 0.3, margin: 0, fontFace: B, fontSize: 11, color: MUTED,
  });
  s.addNotes("Abertura. Apresentar os dois consultores em 30 segundos e ir direto para as três perguntas do próximo slide. Não vender ainda — perguntar.");
}

/* ================================================= 02 ABERTURA / GATILHO */
{
  const s = newSlide(true);
  head(s, {
    dark: true,
    eyebrow: "ANTES DE COMEÇARMOS",
    title: "Três perguntas para a diretoria",
    sub: "Se as respostas forem confortáveis, esta reunião pode ser curta.",
  });

  const qs = [
    ["01", "Se eu perguntar a três dos seus clientes como foi o atendimento de ontem, as três respostas seriam iguais?", ATE],
    ["02", "Hoje, você consegue explicar com dados por que um profissional encanta e outro afasta?", COM],
    ["03", "Quanto da sua receita depende de um comportamento que ninguém mede?", PRO],
  ];
  qs.forEach(([n, q, c], i) => {
    const x = 0.75 + i * 4.0;
    card(s, { x, y: 2.45, w: 3.68, h: 3.05, fill: INK_SOFT });
    badge(s, { x: x + 0.42, y: 2.85, d: 0.66, fill: c, label: n, color: INK, size: 16, face: B });
    s.addText(q, {
      x: x + 0.42, y: 3.72, w: 2.85, h: 1.5, margin: 0, valign: "top",
      fontFace: B, fontSize: 15, color: PAPER, lineSpacing: 21,
    });
  });

  s.addText("Guarde as suas respostas. Vamos voltar a elas no final desta apresentação.", {
    x: 0.75, y: 5.85, w: 11.8, h: 0.4, margin: 0,
    fontFace: B, fontSize: 14, italic: true, color: COM,
  });
  chrome(s, true);
  s.addNotes("Fazer as três perguntas em voz alta e ESPERAR a resposta. O silêncio é o gatilho. Anotar a resposta do decisor — ela será usada no slide 19.");
}

/* ============================================== 03 O QUE ESTÁ EM JOGO */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "O CONTEXTO",
    eyebrowColor: ATE,
    title: "O cliente não reclama. Ele troca.",
    sub: "A experiência deixou de ser diferencial e virou critério de permanência.",
  });

  const stats = [
    ["52%", "dos consumidores deixaram de comprar de uma marca após uma experiência ruim", ATE],
    ["29%", "pararam especificamente por causa de um atendimento ruim — online ou presencial", COM],
    ["86%", "dizem estar dispostos a pagar mais por uma experiência superior", PRO],
  ];
  stats.forEach(([n, t, c], i) => {
    const x = 0.75 + i * 4.0;
    card(s, { x, y: 2.4, w: 3.68, h: 2.95, fill: MIST });
    s.addText(n, {
      x: x + 0.4, y: 2.68, w: 2.9, h: 1.15, margin: 0, valign: "middle",
      fontFace: H, fontSize: 58, bold: true, color: c,
    });
    s.addText(t, {
      x: x + 0.4, y: 3.92, w: 2.9, h: 1.25, margin: 0, valign: "top",
      fontFace: B, fontSize: 14, color: INK, lineSpacing: 20,
    });
  });
  s.addText("Fontes: PwC — Customer Experience Survey 2025 (52% e 29%); PwC — Experience Is Everything (86%).", {
    x: 0.75, y: 5.5, w: 11.8, h: 0.3, margin: 0, fontFace: B, fontSize: 10, color: MUTED,
  });

  trigger(s, "Na sua operação, quantos clientes saíram no último ano sem que ninguém soubesse o motivo real?");
  chrome(s, false);
  s.addNotes("Ancoragem com dado externo (autoridade). Não insistir no número — usar como ponte para a pergunta de implicação no rodapé.");
}

/* ================================================== 04 O PONTO CEGO */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "O PROBLEMA",
    eyebrowColor: ATE,
    title: "Todo mundo mede o resultado. Quase ninguém mede o comportamento que o produz.",
    titleW: 11.3, titleH: 1.0, titleSize: 28,
    sub: "É por isso que o mesmo treinamento gera resultados tão diferentes entre profissionais.",
    subY: 1.9,
  });

  card(s, { x: 0.75, y: 2.6, w: 5.75, h: 3.05, fill: MIST });
  s.addText("O QUE SE MEDE HOJE", {
    x: 1.15, y: 2.9, w: 5, h: 0.3, margin: 0,
    fontFace: B, fontSize: 11, bold: true, charSpacing: 2, color: MUTED,
  });
  s.addText(
    [
      "Tempo médio de atendimento (TMA)", "Volume de chamados e filas",
      "Nota de satisfação depois do fato", "Cumprimento de script e checklist",
    ].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })),
    { x: 1.15, y: 3.3, w: 4.95, h: 2.1, margin: 0, fontFace: B, fontSize: 15, color: INK, paraSpaceAfter: 9 }
  );

  card(s, { x: 6.85, y: 2.6, w: 5.73, h: 3.05, fill: INK });
  s.addText("O QUE DEFINE O JULGAMENTO DO CLIENTE", {
    x: 7.25, y: 2.9, w: 5, h: 0.3, margin: 0,
    fontFace: B, fontSize: 11, bold: true, charSpacing: 2, color: COM,
  });
  const right = [["A", "Como o profissional se mostra", ATE], ["C", "Como ele fala e escuta", COM], ["P", "Como ele executa e entrega", PRO]];
  right.forEach(([l, t, c], i) => {
    const y = 3.32 + i * 0.66;
    badge(s, { x: 7.25, y: y, d: 0.46, fill: c, label: l, color: INK, size: 15 });
    s.addText(t, { x: 7.88, y: y, w: 4.4, h: 0.46, margin: 0, valign: "middle", fontFace: B, fontSize: 15, color: PAPER });
  });
  s.addText("Nenhum desses três aparece em um relatório operacional.", {
    x: 7.25, y: 5.16, w: 4.9, h: 0.35, margin: 0, fontFace: B, fontSize: 12.5, italic: true, color: MUTED_D,
  });

  trigger(s, "Quantas das suas decisões sobre pessoas hoje se apoiam em percepção — e não em dado?");
  chrome(s, false);
}

/* ========================================== 05 PRINCÍPIOS FUNDAMENTAIS */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "PRINCÍPIOS FUNDAMENTAIS",
    title: "O cliente no centro, como pilar estratégico",
    sub: "A excelência começa com a compreensão profunda da jornada, das necessidades e das expectativas.",
  });

  const items = [
    ["01", "Contexto dinâmico", "O atendimento é uma competência crítica em ambientes de mudança constante nas necessidades, expectativas e perfis dos clientes.", ATE],
    ["02", "Jornada antes do script", "A entrega de valor nasce do entendimento da jornada real do cliente — não da repetição de um roteiro padronizado.", COM],
    ["03", "Comportamento é competência", "Postura, escuta e método podem ser diagnosticados, desenvolvidos e acompanhados como qualquer outra competência técnica.", PRO],
  ];
  items.forEach(([n, t, d, c], i) => {
    const y = 2.35 + i * 1.26;
    card(s, { x: 0.75, y, w: 11.83, h: 1.1, fill: MIST });
    badge(s, { x: 1.1, y: y + 0.29, d: 0.52, fill: c, label: n, color: INK, size: 14, face: B });
    s.addText(t, { x: 1.85, y: y + 0.14, w: 5.2, h: 0.4, margin: 0, valign: "middle", fontFace: H, fontSize: 18, bold: true, color: INK });
    s.addText(d, { x: 1.85, y: y + 0.52, w: 10.2, h: 0.5, margin: 0, valign: "top", fontFace: B, fontSize: 13.5, color: MUTED, lineSpacing: 18 });
  });

  trigger(s, "Hoje, sua equipe adapta o atendimento ao cliente — ou adapta o cliente ao processo?");
  chrome(s, false);
}

/* ============================================ 06 A TRÍADE FUNDAMENTAL */
{
  const s = newSlide(true);
  head(s, {
    dark: true,
    eyebrow: "O MODELO",
    title: "A tríade que decide toda experiência",
    sub: "Em qualquer atendimento, três variáveis atuam ao mesmo tempo — e juntas formam o julgamento do cliente.",
  });

  const tri = [
    ["A", "ATENÇÃO", "O que se MOSTRA", "Postura, gestos e apresentação que transmitem profissionalismo e prontidão.", ATE],
    ["C", "COMUNICAÇÃO", "O que se FALA/ESCUTA", "Clareza, escuta ativa e troca eficiente de informação em todo o relacionamento.", COM],
    ["P", "PROCEDIMENTO", "O que se FAZ", "Métodos e processos técnicos validados que asseguram a entrega efetiva do serviço.", PRO],
  ];
  tri.forEach(([l, t, sub, d, c], i) => {
    const x = 0.75 + i * 4.0;
    card(s, { x, y: 2.5, w: 3.68, h: 3.35, fill: INK_SOFT });
    badge(s, { x: x + 0.42, y: 2.82, d: 0.85, fill: c, label: l, color: INK, size: 30 });
    s.addText(t, { x: x + 0.42, y: 3.8, w: 3, h: 0.3, margin: 0, fontFace: B, fontSize: 12.5, bold: true, charSpacing: 1.5, color: c });
    s.addText(sub, { x: x + 0.42, y: 4.1, w: 3.05, h: 0.42, margin: 0, valign: "top", fontFace: H, fontSize: 16, bold: true, color: PAPER });
    s.addText(d, { x: x + 0.42, y: 4.62, w: 2.9, h: 1.1, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: MUTED_D, lineSpacing: 18 });
  });

  s.addText("Não é possível escolher duas. O cliente avalia as três — simultaneamente.", {
    x: 0.75, y: 6.15, w: 11.8, h: 0.4, margin: 0, fontFace: B, fontSize: 14, italic: true, color: COM,
  });
  chrome(s, true);
}

/* ======================================= 07 A PSICOLOGIA DO ATENDIMENTO */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "A PSICOLOGIA DO ATENDIMENTO",
    eyebrowColor: ATE,
    title: "Cada variável responde a uma necessidade humana",
    sub: "Quando uma delas falha, o cliente não sente uma falha de processo. Ele sente uma falha pessoal.",
  });

  const rows = [
    ["A", "ATENÇÃO", "Comportamento não verbal, gestos, postura e apresentação.", "AUTOESTIMA", "Ser visto e valorizado", ATE],
    ["C", "COMUNICAÇÃO", "Troca de informações, clareza na fala e escuta ativa.", "SEGURANÇA", "Saber o que vai acontecer", COM],
    ["P", "PROCEDIMENTO", "Métodos, processos validados e realização efetiva do serviço.", "TRATAMENTO JUSTO", "Receber o que foi combinado", PRO],
  ];
  rows.forEach(([l, t, acao, nec, necd, c], i) => {
    const y = 2.35 + i * 1.22;
    card(s, { x: 0.75, y, w: 11.83, h: 1.06, fill: MIST });
    badge(s, { x: 1.08, y: y + 0.25, d: 0.56, fill: c, label: l, color: INK, size: 18 });
    s.addText(t, { x: 1.85, y: y + 0.16, w: 2.5, h: 0.35, margin: 0, valign: "middle", fontFace: H, fontSize: 17, bold: true, color: INK });
    s.addText(acao, { x: 1.85, y: y + 0.52, w: 4.6, h: 0.4, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: MUTED, lineSpacing: 17 });
    // necessidade
    s.addShape(pres.ShapeType.roundRect, { x: 7.0, y: y + 0.26, w: 2.5, h: 0.5, rectRadius: 0.25, fill: { color: c, transparency: 68 }, line: noLine() });
    s.addText(nec, { x: 7.0, y: y + 0.26, w: 2.5, h: 0.5, margin: 0, align: "center", valign: "middle", fontFace: B, fontSize: 11.5, bold: true, charSpacing: 1, color: INK });
    s.addText(necd, { x: 9.75, y: y + 0.26, w: 2.6, h: 0.5, margin: 0, valign: "middle", fontFace: B, fontSize: 13.5, italic: true, color: INK });
  });

  trigger(s, "Qual dessas três necessidades o seu cliente sente que NÃO está sendo atendida hoje?");
  chrome(s, false);
}

/* ============================================ 08 A DINÂMICA / GRÁFICO */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "A DINÂMICA DO ATENDIMENTO",
    title: "A excelência exige adaptação, não script.",
    sub: "A intensidade de cada variável muda ao longo do atendimento — e o profissional precisa mudar com ela.",
  });

  const cats = ["Início", "Durante", "Término"];
  s.addChart(
    pres.ChartType.line,
    [
      { name: "Atenção", labels: cats, values: [9, 5, 7] },
      { name: "Comunicação", labels: cats, values: [8, 7, 8.5] },
      { name: "Procedimento", labels: cats, values: [3, 9, 6] },
    ],
    {
      x: 0.65, y: 2.28, w: 7.3, h: 3.38,
      showTitle: false,
      chartColors: [ATE, COM, PRO],
      lineSize: 4, lineSmooth: true,
      lineDataSymbol: "circle", lineDataSymbolSize: 9,
      lineDataSymbolLineColor: PAPER, lineDataSymbolLineSize: 2,
      showLegend: true, legendPos: "b", legendColor: INK, legendFontSize: 12, legendFontFace: B,
      catAxisLabelColor: INK, catAxisLabelFontSize: 13, catAxisLabelFontFace: B, catAxisLabelFontBold: true,
      catAxisLineShow: false,
      valAxisHidden: true, valAxisMaxVal: 10, valAxisMinVal: 0,
      valGridLine: { color: MIST_2, size: 1 },
      catGridLine: { style: "none" },
      border: { pt: 0, color: PAPER },
    }
  );
  s.addText("Intensidade relativa esperada por momento do atendimento (representação conceitual do modelo ACP).", {
    x: 0.75, y: 5.68, w: 7.2, h: 0.3, margin: 0, fontFace: B, fontSize: 9.5, italic: true, color: MUTED,
  });

  const fases = [
    ["1", "Início — conexão", "Alta demanda por Atenção e Comunicação para estabelecer confiança imediata e acolhimento.", ATE],
    ["2", "Durante — execução", "Foco predominante no Procedimento técnico, mantendo fluidez informativa e agilidade.", PRO],
    ["3", "Término — fechamento", "Convergência das três variáveis para garantir satisfação final e percepção de valor.", COM],
  ];
  fases.forEach(([n, t, d, c], i) => {
    const y = 2.3 + i * 1.24;
    card(s, { x: 8.3, y, w: 4.28, h: 1.1, fill: MIST });
    badge(s, { x: 8.58, y: y + 0.3, d: 0.5, fill: c, label: n, color: INK, size: 14, face: B });
    s.addText(t, { x: 9.22, y: y + 0.12, w: 3.2, h: 0.32, margin: 0, valign: "middle", fontFace: H, fontSize: 14.5, bold: true, color: INK });
    s.addText(d, { x: 9.22, y: y + 0.44, w: 3.15, h: 0.6, margin: 0, valign: "top", fontFace: B, fontSize: 11.5, color: MUTED, lineSpacing: 15 });
  });

  trigger(s, "A sua equipe sabe mudar de postura no meio do atendimento — ou entrega sempre o mesmo padrão?");
  chrome(s, false);
}

/* ============================================= 09 ESTILOS DE CONDUTA */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "ESTILOS DE CONDUTA",
    title: "Quatro estilos. Apenas um se adapta a todos.",
    sub: "Cada profissional tende a privilegiar uma variável. Essa tendência é previsível — e mensurável.",
  });

  const st = [
    ["A", "Centrado na Atenção", "Foca na conexão interpessoal e no acolhimento. Supre a necessidade de valorização e reconhecimento.", ATE, MIST, INK, MUTED],
    ["C", "Centrado na Comunicação", "Privilegia transparência e troca constante. Garante que o cliente saiba de cada etapa do processo.", COM, MIST, INK, MUTED],
    ["P", "Centrado no Procedimento", "Prioriza precisão técnica e cumprimento rigoroso de métodos e normas operacionais.", PRO, MIST, INK, MUTED],
    ["=", "Estilo Equilibrado", "Transita entre as três variáveis conforme a demanda da situação. É a maturidade profissional em ação.", COM, INK, PAPER, MUTED_D],
  ];
  st.forEach(([l, t, d, c, bg, tc, dc], i) => {
    const x = 0.75 + (i % 2) * 6.1;
    const y = 2.4 + Math.floor(i / 2) * 1.75;
    card(s, { x, y, w: 5.73, h: 1.55, fill: bg });
    badge(s, { x: x + 0.35, y: y + 0.35, d: 0.6, fill: c, label: l, color: INK, size: 19 });
    s.addText(t, { x: x + 1.1, y: y + 0.24, w: 4.3, h: 0.4, margin: 0, valign: "middle", fontFace: H, fontSize: 17.5, bold: true, color: tc });
    s.addText(d, { x: x + 1.1, y: y + 0.66, w: 4.35, h: 0.75, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: dc, lineSpacing: 17.5 });
  });

  trigger(s, "Se eu descrevesse esses quatro estilos para a sua equipe, quantas pessoas você já consegue nomear?");
  chrome(s, false);
}

/* ============================================ 10 O ALVO: EQUILÍBRIO */
{
  const s = newSlide(true);
  head(s, {
    dark: true,
    eyebrow: "O ALVO",
    title: "O alvo não é o máximo. É o equilíbrio.",
    sub: "A excelência é medida pela diferença de pontuação entre os estilos: quanto menor a diferença, maior a adaptabilidade.",
  });

  card(s, { x: 0.75, y: 2.5, w: 3.62, h: 2.75, fill: INK_SOFT });
  s.addText("A ARMADILHA DA FALTA", { x: 1.1, y: 2.78, w: 3, h: 0.32, margin: 0, fontFace: B, fontSize: 11.5, bold: true, charSpacing: 1.5, color: ATE });
  s.addText("Impessoalidade e distanciamento levam à desumanização — e geram insegurança e indignação no cliente.", {
    x: 1.1, y: 3.2, w: 2.95, h: 1.85, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: MUTED_D, lineSpacing: 18,
  });

  card(s, { x: 4.72, y: 2.5, w: 3.9, h: 2.75, fill: COM });
  s.addText("A META", { x: 5.07, y: 2.78, w: 3.2, h: 0.32, margin: 0, fontFace: B, fontSize: 11.5, bold: true, charSpacing: 1.5, color: INK });
  s.addText("EQUILÍBRIO", { x: 5.07, y: 3.12, w: 3.2, h: 0.55, margin: 0, fontFace: H, fontSize: 29, bold: true, color: INK });
  s.addText("A justa medida: transitar entre Atenção, Comunicação e Procedimento sem ficar preso a nenhuma delas.", {
    x: 5.07, y: 3.78, w: 3.2, h: 1.3, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: "4A3B14", lineSpacing: 18,
  });

  card(s, { x: 8.97, y: 2.5, w: 3.61, h: 2.75, fill: INK_SOFT });
  s.addText("A ARMADILHA DO EXCESSO", { x: 9.32, y: 2.78, w: 3.1, h: 0.32, margin: 0, fontFace: B, fontSize: 11.5, bold: true, charSpacing: 1.5, color: PRO });
  s.addText("Excesso de atenção se torna invasivo. Excesso de procedimento vira burocracia. Excesso de comunicação vira ruído.", {
    x: 9.32, y: 3.2, w: 2.95, h: 1.85, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: MUTED_D, lineSpacing: 18,
  });

  s.addText([
    { text: "A métrica é a flexibilidade.  ", options: { bold: true, color: PAPER } },
    { text: "Não perguntamos quem é bom. Perguntamos quem consegue mudar.", options: { color: MUTED_D } },
  ], { x: 0.75, y: 5.6, w: 11.8, h: 0.45, margin: 0, fontFace: B, fontSize: 15, align: "center" });
  chrome(s, true);
}

/* ================================================= 11 O INSTRUMENTO IPA */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "O INSTRUMENTO",
    eyebrowColor: ATE,
    title: "IPA — Indicador de Preferência de Conduta",
    sub: "Uma ferramenta de diagnóstico que transforma percepções subjetivas em dados acionáveis para a liderança.",
  });

  const bl = [
    ["Percepção vs. realidade", "Avaliação focada em ações concretas e comportamentos observáveis, indo além da autoimagem ou das intenções do colaborador.", ATE],
    ["Base para desenvolvimento", "Identificação dos perfis predominantes para a criação de planos de capacitação e coaching altamente personalizados.", COM],
    ["Dados para gestão", "Conversão de comportamentos em indicadores objetivos, facilitando a decisão estratégica e o acompanhamento da evolução.", PRO],
  ];
  bl.forEach(([t, d, c], i) => {
    const x = 0.75 + i * 4.0;
    card(s, { x, y: 2.45, w: 3.68, h: 3.2, fill: MIST });
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.42, y: 2.75, w: 0.5, h: 0.5, fill: { color: c }, line: noLine() });
    s.addText(t, { x: x + 0.42, y: 3.42, w: 3.0, h: 0.62, margin: 0, valign: "top", fontFace: H, fontSize: 17.5, bold: true, color: INK, lineSpacing: 21 });
    s.addText(d, { x: x + 0.42, y: 4.12, w: 2.9, h: 1.4, margin: 0, valign: "top", fontFace: B, fontSize: 12.5, color: MUTED, lineSpacing: 17 });
  });

  trigger(s, "Se você tivesse esse mapa em mãos hoje, qual seria a primeira decisão que tomaria?");
  chrome(s, false);
}

/* ========================================= 12 ARQUITETURA CAMADA DUPLA */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "COMO O IPA FUNCIONA",
    eyebrowColor: ATE,
    title: "Arquitetura de camada dupla",
    sub: "O profissional responde sobre o que faz. O sistema interpreta o que isso significa.",
  });

  // camada 1
  card(s, { x: 0.75, y: 2.35, w: 11.83, h: 1.55, fill: MIST });
  s.addText("CAMADA 1  ·  A EXPERIÊNCIA DO PROFISSIONAL", { x: 1.1, y: 2.55, w: 5.5, h: 0.3, margin: 0, fontFace: B, fontSize: 11, bold: true, charSpacing: 1.5, color: MUTED });
  s.addText("Relato de ações concretas em ordem cronológica — o que reduz a carga cognitiva e aumenta a precisão da resposta.", {
    x: 1.1, y: 2.88, w: 6.0, h: 0.75, margin: 0, valign: "top", fontFace: B, fontSize: 14, color: INK, lineSpacing: 19,
  });
  ["Início", "Durante", "Término"].forEach((t, i) => {
    const x = 7.55 + i * 1.72;
    s.addShape(pres.ShapeType.roundRect, { x, y: 2.85, w: 1.5, h: 0.62, rectRadius: 0.1, fill: { color: PAPER }, line: { color: MIST_2, width: 1 } });
    s.addText(t, { x, y: 2.85, w: 1.5, h: 0.62, margin: 0, align: "center", valign: "middle", fontFace: B, fontSize: 13, bold: true, color: INK });
    if (i < 2) s.addText("›", { x: x + 1.5, y: 2.85, w: 0.22, h: 0.62, margin: 0, align: "center", valign: "middle", fontFace: B, fontSize: 18, bold: true, color: MUTED });
  });

  // camada 2
  card(s, { x: 0.75, y: 4.08, w: 11.83, h: 1.55, fill: INK });
  s.addText("CAMADA 2  ·  A LÓGICA ANALÍTICA (OCULTA)", { x: 1.1, y: 4.28, w: 5.5, h: 0.3, margin: 0, fontFace: B, fontSize: 11, bold: true, charSpacing: 1.5, color: COM });
  s.addText("As respostas são mapeadas para os perfis comportamentais — o que impede a manipulação do resultado e garante integridade estatística.", {
    x: 1.1, y: 4.61, w: 6.0, h: 0.75, margin: 0, valign: "top", fontFace: B, fontSize: 14, color: PAPER, lineSpacing: 19,
  });
  [["A", ATE], ["C", COM], ["P", PRO]].forEach(([l, c], i) => {
    badge(s, { x: 7.9 + i * 1.0, y: 4.55, d: 0.62, fill: c, label: l, color: INK, size: 21 });
  });
  s.addText("Perfis ACP", { x: 10.9, y: 4.55, w: 1.5, h: 0.62, margin: 0, valign: "middle", fontFace: B, fontSize: 13.5, bold: true, color: MUTED_D });

  s.addText("Do “deveria fazer” para o “realmente faço”.", {
    x: 0.75, y: 5.85, w: 11.8, h: 0.45, margin: 0, align: "center",
    fontFace: H, fontSize: 21, bold: true, italic: true, color: INK,
  });
  chrome(s, false);
}

/* ============================================ 13 MAPA DE CALOR (EXEMPLO) */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "O QUE A LIDERANÇA PASSA A ENXERGAR",
    eyebrowColor: ATE,
    title: "Mapa de calor da equipe",
    sub: "Onde a sua equipe está concentrada — e o que ela deixa de entregar por causa disso.",
  });

  const cols = [["A", ATE, 2.35], ["C", COM, 4.05], ["P", PRO, 5.75]];
  cols.forEach(([l, c, x]) => {
    badge(s, { x: x + 0.55, y: 2.28, d: 0.45, fill: c, label: l, color: INK, size: 15 });
  });

  const data = [
    ["Profissional 1", 30, 40, 85], ["Profissional 2", 25, 35, 90],
    ["Profissional 3", 68, 62, 58], ["Profissional 4", 20, 30, 88],
    ["Profissional 5", 45, 32, 80], ["Profissional 6", 35, 45, 76],
  ];
  data.forEach((row, r) => {
    const y = 2.92 + r * 0.6;
    s.addText(row[0], { x: 0.75, y, w: 1.5, h: 0.5, margin: 0, valign: "middle", fontFace: B, fontSize: 12, color: INK });
    [1, 2, 3].forEach((k) => {
      const [, c, x] = cols[k - 1];
      const v = row[k];
      s.addShape(pres.ShapeType.roundRect, { x, y, w: 1.55, h: 0.5, rectRadius: 0.06, fill: { color: MIST }, line: noLine() });
      s.addShape(pres.ShapeType.roundRect, { x, y, w: 1.55, h: 0.5, rectRadius: 0.06, fill: { color: c, transparency: Math.round(100 - v * 0.95) }, line: noLine() });
      s.addText(String(v), { x, y, w: 1.55, h: 0.5, margin: 0, align: "center", valign: "middle", fontFace: B, fontSize: 12.5, bold: true, color: v > 60 ? PAPER : INK });
    });
  });
  s.addText("Exemplo ilustrativo · escala de intensidade 0–100", {
    x: 0.75, y: 6.6, w: 6.5, h: 0.28, margin: 0, fontFace: B, fontSize: 9.5, italic: true, color: MUTED,
  });

  card(s, { x: 7.75, y: 2.28, w: 4.83, h: 2.35, fill: INK });
  s.addText("LEITURA EXECUTIVA", { x: 8.1, y: 2.52, w: 4, h: 0.3, margin: 0, fontFace: B, fontSize: 11, bold: true, charSpacing: 1.5, color: COM });
  s.addText("Cinco dos seis profissionais estão concentrados em Procedimento e têm baixa Atenção. Essa equipe entrega o serviço — e perde o cliente no caminho.", {
    x: 8.1, y: 2.9, w: 4.15, h: 1.55, margin: 0, valign: "top", fontFace: B, fontSize: 14, color: PAPER, lineSpacing: 20,
  });

  card(s, { x: 7.75, y: 4.83, w: 4.83, h: 1.55, fill: MIST });
  s.addText("ÍNDICE DE FLEXIBILIDADE", { x: 8.1, y: 5.05, w: 4, h: 0.3, margin: 0, fontFace: B, fontSize: 11, bold: true, charSpacing: 1.5, color: MUTED });
  s.addText("Mede a capacidade de cada colaborador de mudar a postura conforme o atendimento evolui — do início ao fechamento.", {
    x: 8.1, y: 5.38, w: 4.15, h: 0.9, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: INK, lineSpacing: 18,
  });
  chrome(s, false);
}

/* ==================================== 14 DO DIAGNÓSTICO AO DESENVOLVIMENTO */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "DO DIAGNÓSTICO AO DESENVOLVIMENTO",
    title: "Não classificamos pessoas. Expandimos repertório.",
    sub: "É essa premissa que garante a adesão da equipe e a veracidade das respostas.",
  });

  const pr = [
    ["01", "Sem julgamento", "Não existe perfil “bom” ou “mau”. O foco é o autoconhecimento e a análise neutra, sem juízos de valor simplistas.", ATE],
    ["02", "Expansão de repertório", "O objetivo é desenvolver a flexibilidade para transitar entre estilos com naturalidade e eficácia situacional.", COM],
    ["03", "Plano de ação", "Sugestões concretas e personalizadas para fortalecer os perfis com menor pontuação, conectadas às metas do negócio.", PRO],
  ];
  pr.forEach(([n, t, d, c], i) => {
    const x = 0.75 + i * 4.0;
    card(s, { x, y: 2.5, w: 3.68, h: 3.15, fill: MIST });
    badge(s, { x: x + 0.42, y: 2.8, d: 0.6, fill: c, label: n, color: INK, size: 15, face: B });
    s.addText(t, { x: x + 0.42, y: 3.52, w: 3.0, h: 0.62, margin: 0, valign: "top", fontFace: H, fontSize: 17.5, bold: true, color: INK, lineSpacing: 21 });
    s.addText(d, { x: x + 0.42, y: 4.2, w: 2.9, h: 1.35, margin: 0, valign: "top", fontFace: B, fontSize: 12.5, color: MUTED, lineSpacing: 17 });
  });

  trigger(s, "O que sua equipe faria se soubesse exatamente qual comportamento desenvolver — em vez de receber mais um treinamento genérico?");
  chrome(s, false);
}

/* ==================================== 15 INTELIGÊNCIA ORGANIZACIONAL */
{
  const s = newSlide(true);
  head(s, {
    dark: true,
    eyebrow: "GESTÃO DE TALENTOS",
    title: "O que muda na mesa da liderança",
    sub: "O IPA entrega à gestão uma linguagem técnica comum para falar de comportamento.",
  });

  const gs = [
    ["Formação direcionada", "Identificação de lacunas coletivas para desenhar treinamentos de alto impacto — otimizando recursos e maximizando o retorno sobre o investimento em capacitação.", ATE],
    ["Suporte à gestão", "Gestores instrumentados com vocabulário padronizado para feedbacks estruturados sobre performance, em vez de conversas baseadas em impressão.", COM],
    ["Equipes multidisciplinares", "Times complementares onde perfis de alta Atenção equilibram perfis de alto Procedimento — cobrindo todas as necessidades do cliente pela soma dos talentos.", PRO],
  ];
  gs.forEach(([t, d, c], i) => {
    const y = 2.4 + i * 1.28;
    card(s, { x: 0.75, y, w: 11.83, h: 1.12, fill: INK_SOFT });
    s.addShape(pres.ShapeType.ellipse, { x: 1.1, y: y + 0.32, w: 0.48, h: 0.48, fill: { color: c }, line: noLine() });
    s.addText(t, { x: 1.82, y: y + 0.14, w: 5.4, h: 0.4, margin: 0, valign: "middle", fontFace: H, fontSize: 18, bold: true, color: PAPER });
    s.addText(d, { x: 1.82, y: y + 0.52, w: 10.2, h: 0.52, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: MUTED_D, lineSpacing: 18 });
  });

  s.addText("Evitar a homogeneidade é uma decisão estratégica — não uma consequência do acaso na contratação.", {
    x: 0.75, y: 6.35, w: 11.8, h: 0.4, margin: 0, fontFace: B, fontSize: 14, italic: true, color: COM,
  });
  chrome(s, true);
}

/* ======================================== 16 IMPACTO NOS RESULTADOS */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "IMPACTO NO NEGÓCIO",
    eyebrowColor: ATE,
    title: "Conectando soft skills a hard numbers",
    sub: "Perfis ACP correlacionados aos seus KPIs operacionais formam um modelo preditivo de sucesso no atendimento.",
  });

  card(s, { x: 0.75, y: 2.45, w: 5.75, h: 1.75, fill: MIST });
  s.addText("OTIMIZAÇÃO DA QUALIDADE", { x: 1.15, y: 2.68, w: 5, h: 0.3, margin: 0, fontFace: B, fontSize: 11, bold: true, charSpacing: 1.5, color: MUTED });
  s.addText("Aumento de retenção e de satisfação (NPS) por ajustes de conduta no ponto exato em que o cliente julga a experiência.", {
    x: 1.15, y: 3.02, w: 5.0, h: 1.0, margin: 0, valign: "top", fontFace: B, fontSize: 14, color: INK, lineSpacing: 19,
  });

  card(s, { x: 6.85, y: 2.45, w: 5.73, h: 1.75, fill: MIST });
  s.addText("EFICIÊNCIA OPERACIONAL", { x: 7.25, y: 2.68, w: 5, h: 0.3, margin: 0, fontFace: B, fontSize: 11, bold: true, charSpacing: 1.5, color: MUTED });
  s.addText("Menos retrabalho e melhor TMA pela assertividade da conduta — menos repetições, menos escalonamentos, menos reaberturas.", {
    x: 7.25, y: 3.02, w: 5.0, h: 1.0, margin: 0, valign: "top", fontFace: B, fontSize: 14, color: INK, lineSpacing: 19,
  });

  card(s, { x: 0.75, y: 4.42, w: 11.83, h: 1.42, fill: INK });
  s.addText([
    { text: "Perfis ACP", options: { color: ATE, bold: true } },
    { text: "   +   ", options: { color: MUTED } },
    { text: "Dados IPA", options: { color: COM, bold: true } },
    { text: "   =   ", options: { color: MUTED } },
    { text: "Modelo preditivo de sucesso", options: { color: PAPER, bold: true } },
  ], { x: 1.15, y: 4.62, w: 11, h: 0.5, margin: 0, fontFace: H, fontSize: 24 });
  s.addText("Identificar antecipadamente qual conduta gera o maior retorno em cada tipo de atendimento — e replicá-la.", {
    x: 1.15, y: 5.18, w: 11, h: 0.45, margin: 0, fontFace: B, fontSize: 14, color: MUTED_D,
  });

  trigger(s, "Se o seu NPS subisse dez pontos nos próximos doze meses, quanto isso valeria para o negócio?");
  chrome(s, false);
}

/* ================================================= 17 ENTREGAS */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "ENTREGAS",
    title: "O que a diretoria recebe ao final do processo",
    sub: "Quatro entregas concretas, prontas para virar decisão.",
  });

  const ent = [
    ["01", "Mapa de calor da equipe", "Identificação visual de onde a equipe está concentrada e quais necessidades do cliente ficam descobertas.", ATE],
    ["02", "Índice de flexibilidade", "Medição da capacidade de cada colaborador de mudar a postura conforme o atendimento evolui.", COM],
    ["03", "Relatórios individuais", "Devolutiva por profissional, com análise neutra e plano de ação personalizado por perfil.", PRO],
    ["04", "Programa de desenvolvimento", "Módulos específicos para corrigir os gaps identificados estatisticamente — no lugar de treinamento genérico.", ATE],
  ];
  ent.forEach(([n, t, d, c], i) => {
    const x = 0.75 + (i % 2) * 6.1;
    const y = 2.35 + Math.floor(i / 2) * 1.72;
    card(s, { x, y, w: 5.73, h: 1.52, fill: MIST });
    badge(s, { x: x + 0.35, y: y + 0.33, d: 0.56, fill: c, label: n, color: INK, size: 14, face: B });
    s.addText(t, { x: x + 1.06, y: y + 0.22, w: 4.35, h: 0.4, margin: 0, valign: "middle", fontFace: H, fontSize: 17.5, bold: true, color: INK });
    s.addText(d, { x: x + 1.06, y: y + 0.64, w: 4.4, h: 0.72, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: MUTED, lineSpacing: 17.5 });
  });

  s.addText("“A consciência precede a mudança.”", {
    x: 0.75, y: 6.05, w: 11.8, h: 0.45, margin: 0, align: "center",
    fontFace: H, fontSize: 20, bold: true, italic: true, color: INK,
  });
  chrome(s, false);
}

/* ================================================ 18 CRONOGRAMA */
{
  const s = newSlide(false);
  head(s, {
    eyebrow: "IMPLANTAÇÃO",
    eyebrowColor: ATE,
    title: "Sete semanas, do diagnóstico ao desenvolvimento",
    sub: "Minuta de cronograma — ajustável ao calendário e ao público que a diretoria definir.",
  });

  const fases = [
    ["DIAGNÓSTICO", "FASE 1 · SEM. 1 A 3", ATE, [
      "Apresentação da abordagem à Diretoria",
      "Aplicação do instrumento IPA — via digital",
      "Processamento, identificação de perfis e análise",
    ]],
    ["DEFINIÇÃO", "FASE 2 · SEM. 3 A 4", COM, [
      "Apresentação dos resultados à Diretoria",
      "Revisão da Política de Atendimento / Perfil Ideal",
      "Análise dos gaps entre perfil ideal e perfis reais",
    ]],
    ["DESENVOLVIMENTO", "FASE 3 · SEM. 5 A 7", PRO, [
      "Aprovação do Programa de Desenvolvimento",
      "Realização do programa + relatórios individuais",
      "Reunião final de avaliação com a Direção",
    ]],
  ];
  fases.forEach(([t, prazo, c, items], i) => {
    const x = 0.75 + i * 4.0;
    card(s, { x, y: 2.4, w: 3.68, h: 3.4, fill: MIST });
    s.addShape(pres.ShapeType.roundRect, { x: x + 0.4, y: 2.72, w: 2.15, h: 0.38, rectRadius: 0.19, fill: { color: c }, line: noLine() });
    s.addText(prazo, { x: x + 0.4, y: 2.72, w: 2.15, h: 0.38, margin: 0, align: "center", valign: "middle", fontFace: B, fontSize: 10.5, bold: true, charSpacing: 0.5, color: INK });
    s.addText(t, { x: x + 0.4, y: 3.22, w: 3.0, h: 0.42, margin: 0, valign: "middle", fontFace: H, fontSize: 18, bold: true, color: INK });
    s.addText(
      items.map((it, k, a) => ({ text: it, options: { bullet: true, breakLine: k < a.length - 1 } })),
      { x: x + 0.4, y: 3.72, w: 2.92, h: 1.85, margin: 0, valign: "top", fontFace: B, fontSize: 13, color: MUTED, paraSpaceAfter: 10, lineSpacing: 17 }
    );
  });

  trigger(s, "Para começar na semana que vem, o que precisa acontecer entre esta reunião e a sexta-feira?");
  chrome(s, false);
}

/* ================================= 19 AS PERGUNTAS QUE DEFINEM O PRÓXIMO PASSO */
{
  const s = newSlide(true);
  head(s, {
    dark: true,
    eyebrow: "VOLTANDO AO INÍCIO",
    title: "As quatro perguntas que definem o próximo passo",
    sub: "As mesmas três perguntas da abertura, agora com uma quarta.",
  });

  const qs = [
    ["Qual seria o impacto no resultado se toda a linha de frente entregasse a experiência do seu melhor profissional?", ATE],
    ["Se você tivesse hoje o mapa comportamental da sua equipe, que decisão tomaria já na segunda-feira?", COM],
    ["Quanto custa manter esse ponto cego por mais doze meses — em clientes, em retrabalho e em rotatividade?", PRO],
    ["O que precisa acontecer nesta reunião para que a aplicação do IPA comece na próxima semana?", COM],
  ];
  qs.forEach(([q, c], i) => {
    const x = 0.75 + (i % 2) * 6.1;
    const y = 2.45 + Math.floor(i / 2) * 1.72;
    card(s, { x, y, w: 5.73, h: 1.52, fill: INK_SOFT });
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.38, y: y + 0.5, w: 0.5, h: 0.5, fill: { color: c }, line: noLine() });
    s.addText("?", { x: x + 0.38, y: y + 0.5, w: 0.5, h: 0.5, margin: 0, align: "center", valign: "middle", fontFace: H, fontSize: 20, bold: true, color: INK });
    s.addText(q, { x: x + 1.06, y: y + 0.2, w: 4.4, h: 1.15, margin: 0, valign: "middle", fontFace: B, fontSize: 14.5, color: PAPER, lineSpacing: 20 });
  });

  s.addText("Nenhuma dessas perguntas é respondida com opinião. Todas são respondidas com dado.", {
    x: 0.75, y: 6.1, w: 11.8, h: 0.45, margin: 0, align: "center",
    fontFace: B, fontSize: 15, italic: true, color: COM,
  });
  chrome(s, true);
}

/* ================================================= 20 PRÓXIMO PASSO */
{
  const s = newSlide(true);
  head(s, {
    dark: true,
    eyebrow: "PRÓXIMO PASSO",
    title: "Uma decisão hoje. Um diagnóstico em três semanas.",
    sub: "Não pedimos um projeto. Pedimos a definição de um público para a aplicação do IPA.",
  });

  const steps = [
    ["01", "Definir o público", "A diretoria escolhe a área ou o time que será diagnosticado nesta primeira aplicação.", ATE],
    ["02", "Aplicar o IPA", "Aplicação digital, individual, sem interromper a operação da equipe.", COM],
    ["03", "Receber o diagnóstico", "Mapa de calor, índice de flexibilidade e relatórios individuais apresentados à Diretoria.", PRO],
  ];
  steps.forEach(([n, t, d, c], i) => {
    const x = 0.75 + i * 4.0;
    card(s, { x, y: 2.55, w: 3.68, h: 2.85, fill: INK_SOFT });
    badge(s, { x: x + 0.42, y: 2.85, d: 0.62, fill: c, label: n, color: INK, size: 16, face: B });
    s.addText(t, { x: x + 0.42, y: 3.6, w: 3.05, h: 0.58, margin: 0, valign: "top", fontFace: H, fontSize: 18, bold: true, color: PAPER, lineSpacing: 22 });
    s.addText(d, { x: x + 0.42, y: 4.24, w: 2.9, h: 1.05, margin: 0, valign: "top", fontFace: B, fontSize: 12.5, color: MUTED_D, lineSpacing: 17 });
  });

  card(s, { x: 0.75, y: 5.62, w: 11.83, h: 0.95, fill: COM });
  s.addText("A consciência precede a mudança — e a mudança começa por uma decisão de agenda.", {
    x: 1.15, y: 5.62, w: 11.0, h: 0.95, margin: 0, valign: "middle",
    fontFace: H, fontSize: 19, bold: true, color: INK,
  });
  chrome(s, true);
}

/* ================================================= 21 CONTATO */
{
  const s = newSlide(true);
  s.addShape(pres.ShapeType.ellipse, { x: 9.1, y: 0.7, w: 3.3, h: 3.3, fill: { color: ATE, transparency: 76 }, line: noLine() });
  s.addShape(pres.ShapeType.ellipse, { x: 10.2, y: 2.6, w: 3.3, h: 3.3, fill: { color: COM, transparency: 78 }, line: noLine() });
  s.addShape(pres.ShapeType.ellipse, { x: 8.0, y: 2.6, w: 3.3, h: 3.3, fill: { color: PRO, transparency: 76 }, line: noLine() });

  s.addText("OBRIGADO", {
    x: 0.9, y: 1.6, w: 6.5, h: 0.9, margin: 0,
    fontFace: H, fontSize: 44, bold: true, color: PAPER,
  });
  s.addText("Seguimos à disposição para detalhar o instrumento, o cronograma e o escopo da primeira aplicação.", {
    x: 0.9, y: 2.6, w: 6.3, h: 0.8, margin: 0, fontFace: B, fontSize: 15, color: MUTED_D, lineSpacing: 22,
  });

  const contatos = [
    ["Francisco José Santos Milreu", "(11) 9 9601-9682", "milreu@gmail.com", ATE],
    ["Antonio Zuvela", "(11) 9 9904-8188", "azuvela.td@gmail.com", PRO],
  ];
  contatos.forEach(([n, tel, mail, c], i) => {
    const y = 3.85 + i * 1.28;
    card(s, { x: 0.9, y, w: 6.3, h: 1.1, fill: INK_SOFT });
    s.addShape(pres.ShapeType.ellipse, { x: 1.22, y: y + 0.31, w: 0.48, h: 0.48, fill: { color: c }, line: noLine() });
    s.addText(n, { x: 1.94, y: y + 0.18, w: 4.2, h: 0.35, margin: 0, valign: "middle", fontFace: H, fontSize: 16.5, bold: true, color: PAPER });
    s.addText(`${tel}   ·   ${mail}`, { x: 1.94, y: y + 0.55, w: 4.3, h: 0.35, margin: 0, valign: "middle", fontFace: B, fontSize: 13, color: MUTED_D });
  });

  s.addText("Abordagem ACP  ·  Indicador de Preferência de Conduta (IPA)", {
    x: 0.9, y: 6.65, w: 7, h: 0.3, margin: 0, fontFace: B, fontSize: 10.5, charSpacing: 1, color: "5E7385",
  });
}

pres.writeFile({ fileName: "abordagem-acp-ipa.pptx" }).then((f) => console.log("Gerado:", f));
