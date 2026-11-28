/* ============================================================
   PdfGen — geração de PDF DIRETO no navegador (sem impressão).
   O relatório é renderizado no MESMO padrão da página web e flui
   de forma contínua pelas páginas A4: as quebras acontecem apenas
   entre parágrafos, tabelas, gráficos e itens — nunca no meio de
   um bloco — e um título nunca fica sozinho no fim da página.
   Requer: js/vendor/jspdf.umd.min.js + js/vendor/html2canvas.min.js
   ============================================================ */
const PdfGen = (() => {
    const MM = { w: 210, h: 297, ml: 13, mr: 13, mt: 12, mb: 15 }; // A4 + margens
    const TOLERANCIA_PX = 10;      // um bloco pode avançar ~2,5 mm na margem inferior em vez de pular de página
    const LARGURA_RELATORIO = 780; // px — proporção da página web, com corpo de texto ~10,5pt no A4
    const LARGURA_PAINEL = 800;    // px — relatório resumido (1 página)

    /* data e hora de geração no formato do Brasil, válida em nome de arquivo:
       "24-11-2026 14h35" (barras e dois-pontos não podem aparecer no nome) */
    function dataBR() {
        const d = new Date(), p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}h${p(d.getMinutes())}`;
    }
    function limpar(s) {
        return String(s || '')
            .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos (nome de arquivo universal)
            .replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    /* nome modelo: partes unidas por hífen, ex.:
       "Organização-Nome do Funcionário-24-11-2026 14h35-Completo.pdf" */
    function nome(partes) {
        return partes.map(limpar).filter(Boolean).join('-') + '.pdf';
    }

    /* troca cada <svg> por uma imagem rasterizada do mesmo tamanho
       (html2canvas não desenha SVG com fidelidade — padrões, curvas) */
    async function svgsParaImagens(raiz) {
        const svgs = Array.from(raiz.querySelectorAll('svg'));
        await Promise.all(svgs.map(svg => new Promise(res => {
            const rect = svg.getBoundingClientRect();
            const w = Math.max(10, Math.round(rect.width)), h = Math.max(10, Math.round(rect.height));
            const clone = svg.cloneNode(true);
            clone.setAttribute('width', w);
            clone.setAttribute('height', h);
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            clone.setAttribute('font-family', "'Inter','Segoe UI',Arial,sans-serif");
            const img = new Image();
            img.width = w; img.height = h;
            img.style.cssText = 'display:block;max-width:100%';
            img.onload = img.onerror = () => res();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
            svg.replaceWith(img);
        })));
        await new Promise(r => setTimeout(r, 120)); // decodificação das imagens
    }

    /* Unidades indivisíveis de um bloco (parágrafo, tabela, gráfico, item de
       lista, título…), com topo/base em px relativos ao bloco. Contêineres
       altos são abertos recursivamente para permitir quebras internas. */
    function unidades(bloco, capacidadePx) {
        const base = bloco.getBoundingClientRect().top;
        const lista = [];
        const INTEIROS = '.rp-pie-wrap,.rp-line-wrap,.rp-hero-style,.rp-cover,.rz-page,.chart-row,.rp-quote,.callout';
        /* só abre um contêiner quando TODOS os filhos são blocos: se houver texto
           solto ou elementos em linha, um corte poderia atravessar uma linha */
        const blocoPuro = (el) => !Array.from(el.childNodes).some(n =>
            (n.nodeType === 3 && n.textContent.trim() !== '') ||
            (n.nodeType === 1 && n.getBoundingClientRect().height > 0 &&
             /^inline/.test(getComputedStyle(n).display)));
        const visitar = (el, nivel) => {
            for (const c of el.children) {
                const r = c.getBoundingClientRect();
                if (r.height < 1 || c.tagName === 'STYLE' || c.tagName === 'SCRIPT') continue;
                const tag = c.tagName;
                const titulo = /^H[1-6]$/.test(tag) || tag === 'THEAD' || c.classList.contains('rp-momento-titulo');
                const candidato = !titulo && nivel < 7 && c.children.length > 0 && !c.matches(INTEIROS);
                let abrir = false;
                if (candidato) {
                    if (tag === 'TABLE') abrir = r.height > capacidadePx * 0.5;       // tabela longa: quebra por linhas
                    else if (tag === 'TBODY' || tag === 'OL' || tag === 'UL') abrir = true;
                    else if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') abrir = r.height > 110 && blocoPuro(c);
                    else if (tag === 'LI' && r.height > 200) {
                        /* item longo com sub-lista (plano de ação): o cabeçalho do item
                           fica preso ao 1º sub-item e as quebras só ocorrem entre sub-itens */
                        const sub = c.querySelector(':scope > ul, :scope > ol, :scope > div > ul, :scope > div > ol');
                        if (sub && sub.children.length > 1) {
                            const rs = sub.getBoundingClientRect();
                            lista.push({ top: r.top - base, bottom: rs.top - base, titulo: true, id: 'LI-cabeca' });
                            visitar(sub, nivel + 1);
                            if (r.bottom - rs.bottom > 6) lista.push({ top: rs.bottom - base, bottom: r.bottom - base, titulo: false, id: 'LI-fim' });
                            continue;
                        }
                    }
                }
                if (abrir) visitar(c, nivel + 1);
                else lista.push({ top: r.top - base, bottom: r.bottom - base, titulo, id: tag + '.' + (c.className || '') });
            }
        };
        visitar(bloco, 0);
        lista.sort((a, b) => a.top - b.top);
        return lista;
    }

    let FORMATO = 'JPEG', QUALIDADE = 0.86; // medido: nítido e ~4,5 MB para 14 páginas
    function fatia(canvas, yA, yB) {
        const corte = document.createElement('canvas');
        corte.width = canvas.width; corte.height = Math.max(1, yB - yA);
        const cx = corte.getContext('2d');
        cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, corte.width, corte.height);
        cx.drawImage(canvas, 0, yA, canvas.width, yB - yA, 0, 0, canvas.width, yB - yA);
        return FORMATO === 'PNG' ? corte.toDataURL('image/png') : corte.toDataURL('image/jpeg', QUALIDADE);
    }

    /* gera e baixa o PDF.
       fonte: elemento (usa o innerHTML) ou string HTML.
       opts: { ajustarPagina: true → painel de 1 página (relatório Resumido);
               rodape: texto à esquerda do rodapé; escala (padrão 2) } */
    async function baixar(fonte, nomeArquivo, opts = {}) {
        if (!window.jspdf || !window.html2canvas) {
            throw new Error('Bibliotecas de PDF não carregadas (js/vendor).');
        }
        const painel = !!opts.ajustarPagina;
        if (opts.formato) FORMATO = opts.formato;
        if (opts.qualidade) QUALIDADE = opts.qualidade;
        const largura = painel ? LARGURA_PAINEL : LARGURA_RELATORIO;
        const wrap = document.createElement('div');
        // "report-sheet": aplica as MESMAS regras visuais da página web
        wrap.className = painel ? 'pdfgen-area' : 'pdfgen-area report-sheet';
        wrap.style.cssText = `position:absolute;left:-12000px;top:0;width:${largura}px;max-width:none;` +
            'background:#fff;border:0;box-shadow:none;border-radius:0;padding:0;margin:0;';
        wrap.innerHTML = typeof fonte === 'string' ? fonte : fonte.innerHTML;
        wrap.querySelectorAll('.ia-banner, .no-pdf, .no-print, button').forEach(el => el.remove());
        document.body.appendChild(wrap);
        try {
            if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
            await svgsParaImagens(wrap);

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
            const larguraMm = MM.w - MM.ml - MM.mr;
            const alturaMm = MM.h - MM.mt - MM.mb;
            const pxPorMm = largura / larguraMm;
            const capacidadePx = Math.floor(alturaMm * pxPorMm);
            const escala = opts.escala || (painel ? 2 : 1.6);

            const blocos = Array.from(wrap.children).filter(b =>
                b.tagName !== 'STYLE' && b.tagName !== 'SCRIPT' && b.offsetHeight > 2);

            if (painel) {
                /* painel: cada bloco ocupa uma página, encolhido se preciso */
                let primeira = true;
                for (const bloco of blocos) {
                    const canvas = await html2canvas(bloco, { scale: escala, backgroundColor: '#ffffff', logging: false, useCORS: true });
                    if (!primeira) pdf.addPage();
                    primeira = false;
                    let wMm = larguraMm, x = MM.ml;
                    let hMm = (canvas.height / (canvas.width / bloco.offsetWidth)) / pxPorMm;
                    if (hMm > alturaMm) { const f = alturaMm / hMm; hMm = alturaMm; wMm = larguraMm * f; x = MM.ml + (larguraMm - wMm) / 2; }
                    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', x, MM.mt, wMm, hMm);
                }
            } else {
                /* relatório: FLUXO CONTÍNUO. O cursor (yMm) percorre a página; cada
                   bloco é fatiado só entre unidades e continua de onde o anterior parou. */
                let yMm = MM.mt, paginaVazia = true;
                const restantePx = () => Math.max(0, (MM.h - MM.mb - yMm) * pxPorMm);
                const novaPagina = () => { pdf.addPage(); yMm = MM.mt; paginaVazia = true; };

                for (const bloco of blocos) {
                    const estilo = getComputedStyle(bloco);
                    const margemAbaixoMm = Math.min(14, (parseFloat(estilo.marginBottom) || 0) / pxPorMm);
                    const canvas = await html2canvas(bloco, { scale: escala, backgroundColor: '#ffffff', logging: false, useCORS: true });
                    const alturaPx = bloco.getBoundingClientRect().height;
                    const fator = canvas.height / alturaPx;
                    const us = unidades(bloco, capacidadePx);
                    const emitir = (a, b) => {
                        if (b - a < 1.5) return;
                        const yA = Math.max(0, Math.floor(a * fator)), yB = Math.min(canvas.height, Math.ceil(b * fator));
                        if (yB - yA < 2) return;
                        const hMm = (b - a) / pxPorMm;
                        pdf.addImage(fatia(canvas, yA, yB), FORMATO, MM.ml, yMm, larguraMm, hMm, undefined, 'FAST');
                        yMm += hMm; paginaVazia = false;
                    };

                    let seg = 0;   // início (px) do trecho ainda não colocado no PDF
                    let ini = 0;   // primeira unidade ainda não colocada
                    let i = 0, guarda = 0;
                    while (i < us.length && guarda++ < 5000) {
                        // título(s) + a unidade seguinte precisam caber juntos
                        let j = i;
                        while (us[j].titulo && j + 1 < us.length) j++;
                        if (us[j].bottom - seg <= restantePx() + TOLERANCIA_PX) { i = j + 1; continue; }

                        if (opts.debug) console.log('QUEBRA pag', pdf.getNumberOfPages(), 'antes de', us[i].id, 'alt', Math.round(us[j].bottom - us[i].top),
                            'grupoAte', us[j].id, 'precisa', Math.round(us[j].bottom - seg), 'resta', Math.round(restantePx()), 'i', i, 'ini', ini);
                        if (i > ini) {
                            // coloca o que já cabe e continua na página seguinte
                            const corte = (us[i - 1].bottom + us[i].top) / 2;
                            emitir(seg, corte);
                            seg = corte; ini = i;
                            novaPagina();
                        } else if (!paginaVazia) {
                            novaPagina();                         // nada coube aqui: começa em página nova
                        } else {
                            // unidade maior que uma página inteira: corte forçado
                            const lim = seg + restantePx();
                            emitir(seg, lim);
                            seg = lim;
                            while (i < us.length && us[i].bottom <= seg) i++;
                            ini = i;
                            novaPagina();
                        }
                    }
                    const fim = Math.min(alturaPx, seg + restantePx() + TOLERANCIA_PX);
                    emitir(seg, fim);
                    yMm += margemAbaixoMm;                          // respiro entre seções, como na web
                }

                /* rodapé discreto com numeração */
                const total = pdf.getNumberOfPages();
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(138, 148, 171);
                for (let p = 1; p <= total; p++) {
                    pdf.setPage(p);
                    if (opts.rodape) pdf.text(String(opts.rodape), MM.ml, MM.h - 7);
                    pdf.text(`Página ${p} de ${total}`, MM.w - MM.mr, MM.h - 7, { align: 'right' });
                }
            }

            // download com o nome modelo (link com atributo download: confiável
            // em todos os navegadores)
            const blob = pdf.output('blob');
            const urlBlob = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlBlob; a.download = nomeArquivo;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(urlBlob), 5000);
            return true;
        } finally {
            wrap.remove();
        }
    }

    /* com aviso visual (bloqueia duplo clique e dá retorno ao usuário) */
    async function baixarComAviso(fonte, nomeArquivo, opts = {}) {
        const aviso = document.createElement('div');
        aviso.className = 'pdfgen-aviso';
        aviso.innerHTML = '<span class="pdfgen-spin"></span> Gerando o PDF — aguarde…';
        document.body.appendChild(aviso);
        try {
            await baixar(fonte, nomeArquivo, opts);
        } catch (e) {
            if (typeof Msg !== 'undefined') Msg.fire({ icon: 'error', titulo: 'Não foi possível gerar o PDF', html: String(e.message || e).replace(/[<>]/g, '') });
            else alert('Não foi possível gerar o PDF: ' + e.message);
        } finally {
            aviso.remove();
        }
    }

    return { baixar, baixarComAviso, nome, dataBR, limpar };
})();
