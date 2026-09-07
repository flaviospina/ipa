/* ============================================================
   IPA — Motor de cálculo e geração do relatório (8 fases)
   ============================================================ */

const Engine = {};

/* ---------- Cálculo ----------
   answers: { [quadroId]: [wordId em ordem: [0]=peso 11, [1]=peso 0, [2..11]=pesos 10..1] } */
Engine.pesoDaPosicao = (i) => (i === 0 ? 11 : i === 1 ? 0 : 12 - i);

Engine.calcular = function (answers) {
    const porPalavra = [];             // { id, w, st, quadro, momento, peso, sig, risco }
    const totais = { A: 0, C: 0, P: 0, E: 0 };
    const porMomento = {};             // { [quadroId]: {A,C,P,E} }

    ACP.QUADROS.forEach(q => {
        const ordem = answers[q.id];
        if (!ordem || ordem.length !== 12) throw new Error(`Quadro ${q.id} incompleto`);
        porMomento[q.id] = { A: 0, C: 0, P: 0, E: 0 };
        ordem.forEach((wordId, i) => {
            const peso = Engine.pesoDaPosicao(i);
            const p = q.palavras.find(x => x.id === wordId);
            if (!p) throw new Error(`Palavra desconhecida: ${wordId}`);
            porPalavra.push({ ...p, quadro: q.id, momento: q.momento, peso });
            totais[p.st] += peso;
            porMomento[q.id][p.st] += peso;
        });
    });

    const total = totais.A + totais.C + totais.P + totais.E; // 198
    const ranking = ['A', 'C', 'P', 'E']
        .map(k => ({ key: k, ...ACP.STYLES[k], pontos: totais[k], pct: (totais[k] / total) * 100 }))
        .sort((a, b) => b.pontos - a.pontos || a.curto.localeCompare(b.curto));

    const difs = [
        ranking[0].pontos - ranking[1].pontos,
        ranking[1].pontos - ranking[2].pontos,
        ranking[2].pontos - ranking[3].pontos
    ];

    // Diagnóstico de flexibilidade (critérios qualificadores)
    let regra, diagnostico;
    if (ranking[0].key === 'E') {
        regra = 'EQUILIBRADO_MODELO';
        diagnostico = ACP.CRITERIOS.equilibradoModelo;
    } else if (difs.every(d => d < ACP.CRITERIOS.LIMIAR)) {
        regra = 'EQUILIBRADO_NATURAL';
        diagnostico = ACP.CRITERIOS.equilibradoNatural;
    } else if (difs[0] >= ACP.CRITERIOS.LIMIAR) {
        regra = 'FORTE_APEGO';
        diagnostico = ACP.CRITERIOS.forteApego(difs[0]);
    } else {
        regra = 'FLEXIVEL';
        diagnostico = ACP.CRITERIOS.flexivel(difs[0]);
    }

    const talentos = porPalavra.filter(p => p.peso >= 9).sort((a, b) => b.peso - a.peso);
    const desenvolver = porPalavra.filter(p => p.peso <= 2).sort((a, b) => a.peso - b.peso);

    return { totais, total, ranking, difs, regra, diagnostico, porPalavra, porMomento, talentos, desenvolver };
};

/* ---------- Helpers de render ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Gráfico de pizza (rosca) em SVG — fatias em ordem decrescente, separador
   branco entre fatias, rótulo de % dentro das fatias maiores e legenda com
   nome + pontos + % (a identidade nunca depende só da cor). */
function pieChart(ranking, total) {
    const cx = 110, cy = 110, r1 = 92, r0 = 52;
    const rad = (deg) => (deg - 90) * Math.PI / 180;
    const pt = (r, deg) => `${(cx + r * Math.cos(rad(deg))).toFixed(2)},${(cy + r * Math.sin(rad(deg))).toFixed(2)}`;
    let ang = 0, paths = '', labels = '';
    ranking.forEach(s => {
        const sweep = (s.pontos / total) * 360;
        const a0 = ang, a1 = ang + sweep;
        ang = a1;
        const large = sweep > 180 ? 1 : 0;
        paths += `<path d="M${pt(r1, a0)} A${r1},${r1} 0 ${large} 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0},${r0} 0 ${large} 0 ${pt(r0, a0)} Z"
            fill="${s.cor}" stroke="#ffffff" stroke-width="2"><title>${esc(s.curto)}: ${s.pontos} pts (${s.pct.toFixed(1)}%)</title></path>`;
        if (s.pct >= 8) {
            const mid = (a0 + a1) / 2, rm = (r1 + r0) / 2;
            labels += `<text x="${(cx + rm * Math.cos(rad(mid))).toFixed(1)}" y="${(cy + rm * Math.sin(rad(mid))).toFixed(1)}"
                text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#ffffff">${s.pct.toFixed(0)}%</text>`;
        }
    });
    const legenda = ranking.map(s => `
        <div class="pie-leg-row">
            <span class="chart-swatch" style="background:${s.cor}"></span>
            <span class="pie-leg-name">${esc(s.curto)}</span>
            <span class="pie-leg-val">${s.pontos} pts · ${s.pct.toFixed(1)}%</span>
        </div>`).join('');
    return `<div class="rp-pie-wrap">
        <svg viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="Distribuição dos estilos">
            ${paths}${labels}
            <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="20" font-weight="800" fill="#16213a">${total}</text>
            <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="10" font-weight="600" fill="#8a94ab">PONTOS</text>
        </svg>
        <div class="pie-legend">${legenda}</div>
    </div>`;
}

function barRow(label, cor, valor, max, sufixo) {
    const pctW = max > 0 ? (valor / max) * 100 : 0;
    return `<div class="chart-row">
        <span class="chart-label"><span class="chart-swatch" style="background:${cor}"></span>${esc(label)}</span>
        <div class="chart-track"><div class="chart-bar" style="width:${pctW.toFixed(1)}%;background:${cor}"></div></div>
        <span class="chart-value">${sufixo}</span>
    </div>`;
}

/* Bloco de análise personalizada por IA (texto puro -> parágrafos) */
function iaBlock(texto, titulo) {
    if (!texto) return '';
    const paras = String(texto).split(/\n{2,}|\r\n\r\n/).map(p => `<p>${esc(p.trim())}</p>`).join('');
    return `<div class="rp-ia"><h4>✦ ${esc(titulo || 'Análise personalizada')}</h4>${paras}</div>`;
}

/* ---------- Relatório (8 fases) ----------
   ia (opcional): { interpretacao, momentos, talentos, desenvolvimento,
   recomendacoes, conclusao } — gerado pelo backend via Gemini. */
Engine.renderRelatorio = function (dados, r, ia) {
    ia = ia || {};
    const pred = r.ranking[0], sec = r.ranking[1], terc = r.ranking[2], quart = r.ranking[3];
    const perfilPred = ACP.PERFIS[pred.key];
    const perfilSec = ACP.PERFIS[sec.key];
    const dataFmt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    /* Fase 3 — tabela + gráfico geral */
    const tabela = r.ranking.map((s, i) => {
        const gap = i === 0 ? '—' : `−${r.difs[i - 1]}`;
        const classif = ['Predominante (1ª preferência)', 'Secundário (2ª preferência)', '3º estilo', '4º estilo'][i];
        return `<tr class="${i === 0 ? 'hl' : ''}">
            <td><span class="chart-label"><span class="chart-swatch" style="background:${s.cor}"></span>${esc(s.curto)}</span></td>
            <td class="num">${s.pontos}</td>
            <td class="num">${s.pct.toFixed(1)}%</td>
            <td class="num">${gap}</td>
            <td>${classif}</td>
        </tr>`;
    }).join('');

    const graficoGeral = pieChart(r.ranking, r.total);

    /* Fase 5 — matriz única estilos × momentos + implicações de desenvolvimento */
    const matrizLinhas = ['A', 'C', 'P', 'E'].map(k => {
        const vals = [1, 2, 3].map(q => r.porMomento[q][k]);
        return `<tr>
            <td><span class="chart-label"><span class="chart-swatch" style="background:${ACP.STYLES[k].cor}"></span>${ACP.STYLES[k].nome}</span></td>
            ${vals.map((v, i) => `<td class="num${v === Math.max(...['A','C','P','E'].map(x => r.porMomento[i+1][x])) ? ' hl-cell' : ''}">${v}</td>`).join('')}
        </tr>`;
    }).join('');
    const matriz = `<table class="rp-table rp-table-sm rp-matrix">
        <thead><tr><th>Estilos / Momentos</th><th class="num">Q1 · Início</th><th class="num">Q2 · Durante</th><th class="num">Q3 · Término</th></tr></thead>
        <tbody>${matrizLinhas}
        <tr class="tot"><td>Total</td><td class="num">66</td><td class="num">66</td><td class="num">66</td></tr></tbody>
    </table>`;

    const implicacoes = ACP.QUADROS.map(q => {
        const m = r.porMomento[q.id];
        const lider = ['A', 'C', 'P', 'E'].reduce((a, b) => m[a] >= m[b] ? a : b);
        const esperado = q.enfase;
        const alinhado = lider === esperado || m[lider] - m[esperado] <= 3;
        if (alinhado) {
            return `<p><strong>Q${q.id} — ${esc(q.momento)}:</strong> sua maior ênfase (${ACP.STYLES[lider].curto}, ${m[lider]} pontos) está alinhada ao que este momento tipicamente pede. <em>Implicação:</em> este é um ponto forte a preservar — a necessidade de <strong>${ACP.STYLES[esperado].necessidade.toLowerCase()}</strong> do cliente tende a ser bem atendida aqui.</p>`;
        }
        return `<p><strong>Q${q.id} — ${esc(q.momento)}:</strong> sua maior ênfase foi <strong>${ACP.STYLES[lider].curto}</strong> (${m[lider]} pontos), enquanto este momento tipicamente pede destaque em <strong>${ACP.STYLES[esperado].curto}</strong> (você atribuiu ${m[esperado]} pontos). <em>Implicação para o desenvolvimento:</em> quando a variável ${ACP.STYLES[esperado].curto} fica em segundo plano neste momento, a necessidade de <strong>${ACP.STYLES[esperado].necessidade.toLowerCase()}</strong> do cliente pode ficar descoberta. O caminho não é abandonar sua força em ${ACP.STYLES[lider].curto}, e sim incluir conscientemente comportamentos de ${ACP.STYLES[esperado].curto} neste momento do atendimento.</p>`;
    }).join('');

    const analiseMomentos = ACP.QUADROS.map(q => {
        const m = r.porMomento[q.id];
        const lider = ['A', 'C', 'P', 'E'].reduce((a, b) => m[a] >= m[b] ? a : b);
        return `<p><strong>Q${q.id} — ${esc(q.momento)}:</strong> o objetivo deste momento é ${q.objetivo}. ${q.enfaseTexto}
        Nas suas escolhas, a variável mais valorizada aqui foi <strong>${ACP.STYLES[lider].curto}</strong> (${m[lider]} pontos).</p>`;
    }).join('');

    /* Fase 6 — tabelas de talentos e pontos a desenvolver */
    const cabecaTabela = `<thead><tr><th>Palavra</th><th class="num">Pontos</th><th>Variável</th><th>Momento</th><th>Significado</th></tr></thead>`;
    const linhaPalavra = (p, comDetalhe) => {
        const det = ACP.DETALHE[p.id] || {};
        const detalhe = comDetalhe && det.baixo ? `<tr class="det"><td colspan="5">
            <strong>Pontuação baixa (0 a 2):</strong> ${esc(det.baixo)}
            <strong>No sentido oposto, a valorização excessiva (9 a 11):</strong> ${esc(det.alto)}
            <em>A faixa de equilíbrio situa-se entre 4 e 6 pontos.</em></td></tr>` : '';
        return `<tr>
            <td><strong>${esc(p.w)}</strong></td>
            <td class="num"><span class="w-pill" style="background:${comDetalhe ? '#6b7280' : ACP.STYLES[p.st].cor}">${p.peso}</span></td>
            <td><span class="chart-label"><span class="chart-swatch" style="background:${ACP.STYLES[p.st].cor}"></span>${ACP.STYLES[p.st].curto}</span></td>
            <td>Q${p.quadro} · ${esc(p.momento.split(' ')[0])}</td>
            <td class="sig">${esc(p.sig)}</td>
        </tr>${detalhe}`;
    };
    const talentosHtml = r.talentos.length
        ? `<div class="tbl-scroll"><table class="rp-table rp-table-sm rp-words-tbl">${cabecaTabela}<tbody>${r.talentos.map(p => linhaPalavra(p, false)).join('')}</tbody></table></div>`
        : '<p class="rp-prose">Nenhuma palavra recebeu pontuação 9 ou superior de forma destacada.</p>';
    const desenvolverHtml = r.desenvolver.length
        ? `<div class="tbl-scroll"><table class="rp-table rp-table-sm rp-words-tbl">${cabecaTabela}<tbody>${r.desenvolver.map(p => linhaPalavra(p, true)).join('')}</tbody></table></div>`
        : '<p class="rp-prose">Nenhuma palavra ficou com pontuação crítica (0 a 2).</p>';

    /* Fase 7 — Campo de Forças: moderar as práticas supervalorizadas e
       fortalecer as negligenciadas até a faixa de equilíbrio (4 a 6) */
    const moderar = r.talentos.filter(p => p.peso >= 10).slice(0, 4).map(p => {
        const det = ACP.DETALHE[p.id] || {};
        return `<li><div><strong>${esc(p.w)}</strong> (${ACP.STYLES[p.st].curto} · Q${p.quadro}, nota ${p.peso}) — força a preservar, intensidade a calibrar. ${esc(det.alto || '')} <em>Estratégia:</em> use esta força quando a situação a pedir — e reduza conscientemente sua intensidade quando o momento exigir outra variável.</div></li>`;
    }).join('');
    const fortalecer = r.desenvolver.slice(0, 4).map(p => {
        const det = ACP.DETALHE[p.id] || {};
        return `<li><div><strong>${esc(p.w)}</strong> (${ACP.STYLES[p.st].curto} · Q${p.quadro}, nota ${p.peso}). ${esc(det.baixo || p.risco)} <em>Estratégia:</em> a meta não é maximizar esta prática, e sim levá-la à faixa de equilíbrio (4 a 6): escolha um atendimento por dia para exercitá-la conscientemente no momento "${esc(p.momento)}", sem abandonar as suas forças, e registre a reação do cliente.</div></li>`;
    }).join('');
    const lewin = `<div class="rp-diag"><h4>O método: Campo de Forças (Kurt Lewin)</h4>
        <p>Toda mudança de comportamento acontece dentro de um campo de forças: as <strong>forças impulsoras</strong>, que estimulam a mudança (feedbacks recebidos, situações em que o estilo atual não funcionou, o desejo de crescer), e as <strong>forças restritivas</strong>, que a impedem (o hábito, a crença de que "meu jeito sempre funcionou", o desconforto de agir diferente). Desenvolver-se é quebrar o equilíbrio atual e construir um novo: <strong>fortalecer as práticas negligenciadas</strong> (notas 0 a 2) e <strong>modular as supervalorizadas</strong> (notas 9 a 11), aproximando ambas da faixa de equilíbrio — em que cada variável é usada na intensidade que a situação pede.</p></div>`;

    /* Fase 8 — plano de ação com o "como fazer" */
    const alvos = r.desenvolver.slice(0, 2).map(p => `<strong>${esc(p.w)}</strong> (Q${p.quadro} · ${esc(p.momento.split(' ')[0])})`).join(' e ');
    const comoFazer = (perfilPred.comoFazer || []).map(x => `<li>${esc(x)}</li>`).join('');
    const plano = `
        <li><div><strong>Compromisso de versatilidade — como fazer, na prática:</strong>
            <ul class="rp-sublist">
                <li><em>Antes do atendimento (30 segundos):</em> observe o cliente e pergunte-se: o que esta pessoa, nesta situação, precisa agora — Atenção, Comunicação ou Procedimento?</li>
                <li><em>No início:</em> acolha antes de registrar — cumprimente, olhe nos olhos e só então conduza os trâmites.</li>
                <li><em>Durante:</em> a cada etapa técnica, faça um "checkpoint" consciente: o cliente está acompanhando? Como ele está reagindo?</li>
                <li><em>No término:</em> informe o resultado com clareza, confirme se ficou alguma dúvida e encerre com polidez — o final define a memória da experiência.</li>
            </ul></div></li>
        <li><div><strong>Autopoliciamento do seu estilo predominante (${esc(perfilPred.titulo)}).</strong> ${esc(perfilPred.autopoliciamento)} Na prática:
            <ul class="rp-sublist">${comoFazer}</ul></div></li>
        <li><div><strong>Prática dos pontos a desenvolver.</strong> Suas metas de prática semanal são ${alvos || 'as palavras de menor pontuação identificadas na Fase 6'}: um atendimento por dia exercitando conscientemente cada uma, no momento correspondente, buscando a faixa de equilíbrio (4 a 6) — nem negligência, nem excesso.</div></li>
        <li><div><strong>Feedback contínuo — como pedir:</strong> ao final da semana, pergunte a um colega ou gestor: "nesta semana, em que momento do atendimento você me viu mais rígido(a) no meu jeito habitual? E em que momento me viu me adaptar bem ao cliente?" Registre as respostas — o Estilo Equilibrado, nas pesquisas da Abordagem ACP, é quase sempre fruto de aprendizado a partir de feedbacks reais.</div></li>`;

    return `
    <!-- CAPA -->
    <div class="rp-cover">
        <div class="rp-logo">IPA</div>
        <h1>Relatório do Perfil de Atendimento</h1>
        <div class="rp-sub">Abordagem ACP · Atenção, Comunicação e Procedimento</div>
        <p class="rp-nome">${esc(dados.nome)}</p>
        <p class="rp-meta">${esc(dados.org)}</p>
        <p class="rp-date">${dataFmt}</p>
    </div>

    <!-- FASE 1 -->
    <section class="rp-section">
        <h2>1 · Apresentação</h2>
        <div class="rp-prose">
            ${ACP.FASE1.map(p => `<p>${p}</p>`).join('')}
        </div>
    </section>

    <!-- FASE 2 -->
    <section class="rp-section">
        <h2>2 · Objetivos</h2>
        <div class="rp-prose"><p>Este relatório tem por objetivo:</p>
        <ul>${ACP.FASE2.map(o => `<li>${o}</li>`).join('')}</ul></div>
    </section>

    <!-- FASE 3 -->
    <section class="rp-section">
        <h2>3 · Resultados da Pesquisa</h2>
        <div class="rp-hero-style" style="background:${pred.cor}">
            <div class="h-label">Seu estilo predominante</div>
            <div class="h-name">${esc(perfilPred.titulo)}</div>
            <div class="h-pts">${pred.pontos} pontos · ${pred.pct.toFixed(1)}% do total de ${r.total}</div>
        </div>
        <table class="rp-table rp-table-sm">
            <thead><tr><th>Estilo</th><th class="num">Pontos</th><th class="num">%</th><th class="num">Diferença</th><th>Classificação</th></tr></thead>
            <tbody>${tabela}</tbody>
        </table>
        ${graficoGeral}
        <p class="chart-note">Participação de cada estilo no total de ${r.total} pontos, em ordem decrescente.</p>
    </section>

    <!-- FASE 4 -->
    <section class="rp-section">
        <h2>4 · Interpretação do Perfil</h2>
        <h3>Diagnóstico de flexibilidade</h3>
        <div class="rp-diag"><h4>A premissa do modelo</h4><p>${ACP.CRITERIOS.premissa}</p></div>
        <div class="rp-diag"><h4>O seu resultado</h4><p>${r.diagnostico}</p></div>
        <h3>Estilo predominante — ${esc(perfilPred.titulo)}</h3>
        <div class="rp-prose">${perfilPred.descricao.map(p => `<p>${esc(p)}</p>`).join('')}</div>
        <div class="rp-diag"><h4>Quando o estilo funciona bem</h4><p>${esc(perfilPred.adequado)}</p></div>
        <div class="rp-diag"><h4>Pontos de vigilância</h4><p>${esc(perfilPred.inadequado)}</p></div>
        <h3>Estilo secundário — ${esc(perfilSec.titulo)}</h3>
        <div class="rp-prose"><p>Com ${sec.pontos} pontos (${sec.pct.toFixed(1)}%), o estilo ${esc(sec.curto)} ${esc(perfilSec.comoSecundario)}</p></div>
        ${iaBlock(ia.interpretacao, 'Análise personalizada do seu perfil')}
        <h3>Terceiro e quarto estilos</h3>
        <div class="rp-prose"><p>Os estilos <strong>${esc(terc.curto)}</strong> (${terc.pontos} pontos) e <strong>${esc(quart.curto)}</strong> (${quart.pontos} pontos) foram os menos valorizados nas suas escolhas.
        A menor prevalência dessas condutas indica que os comportamentos a elas associados tendem a aparecer menos espontaneamente no seu atendimento — vale observar os momentos em que a situação os exige.</p></div>
    </section>

    <!-- FASE 5 -->
    <section class="rp-section">
        <h2>5 · Os Momentos do Atendimento</h2>
        <div class="rp-prose">${analiseMomentos}</div>
        <h3>Sua pontuação por estilo em cada momento</h3>
        ${matriz}
        <p class="chart-note">Cada momento distribui 66 pontos entre os quatro estilos (máximo de 30 por estilo). A célula destacada indica a maior ênfase do momento.</p>
        <h3>O que isso significa para o seu desenvolvimento</h3>
        <div class="rp-prose">${implicacoes}</div>
        ${iaBlock(ia.momentos, 'Como isso tende a aparecer nos seus atendimentos')}
    </section>

    <!-- FASE 6 -->
    <section class="rp-section">
        <h2>6 · Talentos e Pontos a Desenvolver</h2>
        <h3>Talentos comportamentais (pontuações 9 a 11)</h3>
        <div class="rp-prose"><p>Estas são as práticas que você mais valoriza — suas forças visíveis, que brilham quando usadas no momento certo:</p></div>
        <div class="rp-words">${talentosHtml}</div>
        ${iaBlock(ia.talentos, 'Suas forças em ação')}
        <h3>Pontos a desenvolver (pontuações 0 a 2)</h3>
        <div class="rp-prose"><p>As pontuações baixas não são falhas de caráter — são <strong>focos primários de capacitação</strong>. Elas revelam comportamentos pouco espontâneos que, quando a situação os exige, podem virar "vazamentos de energia relacional" ou gargalos de conformidade:</p></div>
        <div class="rp-words">${desenvolverHtml}</div>
        ${iaBlock(ia.desenvolvimento, 'O que priorizar na sua capacitação')}
    </section>

    <!-- FASE 7 -->
    <section class="rp-section">
        <h2>7 · Recomendações para o Desenvolvimento</h2>
        <div class="rp-prose">${ACP.FASE7.padrao.map(p => `<p>${esc(p)}</p>`).join('')}</div>
        ${lewin}
        ${moderar ? `<h3>Práticas a modular (notas 10 e 11 — forças que não podem virar excesso)</h3><ol class="rp-plan">${moderar}</ol>` : ''}
        ${fortalecer ? `<h3>Práticas a fortalecer (notas 0 a 2 — rumo à faixa de equilíbrio)</h3><ol class="rp-plan">${fortalecer}</ol>` : ''}
        ${iaBlock(ia.recomendacoes, 'Recomendações personalizadas para você')}
    </section>

    <!-- FASE 8 -->
    <section class="rp-section">
        <h2>8 · Plano de Ação Individual</h2>
        <ol class="rp-plan">${plano}</ol>
        ${iaBlock(ia.conclusao, 'Síntese do consultor IA')}
        <p class="rp-quote">O autoconhecimento é o primeiro passo para a maestria no atendimento humano. A busca pelo equilíbrio é uma jornada constante — e ela começa no seu próximo atendimento.</p>
    </section>`;
};

/* ---------- Relatório autônomo (arquivo para download/arquivo no Drive) ---------- */
Engine.relatorioStandalone = async function (reportInnerHtml, dados) {
    let css = '';
    try {
        // inline do CSS quando servido via http(s); em file:// segue sem estilo externo
        const res = await fetch('css/app.css');
        if (res.ok) css = await res.text();
    } catch (e) { /* segue sem css */ }
    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório IPA — ${esc(dados.nome)}</title>
<style>${css}
body { background:#fff; } .report-sheet { border:0; box-shadow:none; max-width:800px; padding:24px; }</style>
</head><body><div class="report-sheet">${reportInnerHtml}</div></body></html>`;
};

/* ---------- Payload para o backend ---------- */
Engine.montarPayload = function (dados, answers, r, consent, id) {
    const respostas = {};
    ACP.QUADROS.forEach(q => {
        answers[q.id].forEach((wordId, i) => { respostas[wordId] = Engine.pesoDaPosicao(i); });
    });
    return {
        schema: IPA_CONFIG.SCHEMA_VERSION,
        organizacao: dados.org,
        nome: dados.nome,
        funcao: dados.funcao,
        consentimento: consent,       // ISO timestamp do aceite LGPD
        respostas,                    // { wordId: peso }
        scores: { A: r.totais.A, C: r.totais.C, P: r.totais.P, E: r.totais.E },
        total: r.total,
        predominante: r.ranking[0].curto,
        regra: r.regra,
        id: id,                       // identifica a linha p/ o arquivamento posterior
        enviadoEm: new Date().toISOString(),
        website: ''                   // honeypot — deve chegar vazio
    };
};
