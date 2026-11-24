/* ============================================================
   PdfGen — geração de PDF DIRETO no navegador (sem impressão).
   Mantém cores, gráficos e layout: o relatório é renderizado em
   área própria, os SVGs viram imagens e cada página A4 é montada
   cortando apenas em fronteiras de blocos (nada fica pela metade).
   Requer: js/vendor/jspdf.umd.min.js + js/vendor/html2canvas.min.js
   ============================================================ */
const PdfGen = (() => {
    const MM = { w: 210, h: 297, ml: 11, mr: 11, mt: 10, mb: 12 }; // A4 + margens
    const LARGURA = 800;                                           // px de render

    /* data e hora de geração no formato do Brasil, válida em nome de arquivo:
       "24-11-2026 14h35" (barras e dois-pontos não podem aparecer no nome) */
    function dataBR() {
        const d = new Date(), p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}h${p(d.getMinutes())}`;
    }
    function limpar(s) {
        return String(s || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos (nome de arquivo universal)
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
        // garante que o navegador decodificou as imagens antes da captura
        await new Promise(r => setTimeout(r, 120));
    }

    /* fatias [yIni,yFim] (px) de um bloco: corta SÓ em fronteiras dos filhos */
    function fatiasDoBloco(bloco, capacidadePx) {
        const alturaTotal = bloco.scrollHeight;
        const filhos = Array.from(bloco.children).filter(f => f.offsetHeight > 0);
        if (alturaTotal <= capacidadePx || !filhos.length) return [[0, alturaTotal]];
        const fatias = [];
        let ini = 0;
        filhos.forEach(f => {
            const topo = f.offsetTop, fim = f.offsetTop + f.offsetHeight;
            if (fim - ini > capacidadePx) {
                if (topo > ini + 4) { fatias.push([ini, topo]); ini = topo; }
                while (fim - ini > capacidadePx) { fatias.push([ini, ini + capacidadePx]); ini += capacidadePx; }
            }
        });
        if (alturaTotal - ini > 4) fatias.push([ini, alturaTotal]);
        return fatias;
    }

    function canvasJpeg(c) { return c.toDataURL('image/jpeg', 0.92); }

    /* gera e baixa o PDF.
       fonte: elemento (usa o innerHTML) ou string HTML.
       opts: { escala (padrão 2), ajustarPagina: true encolhe cada bloco
               para caber em uma página (relatório Resumido de 1 página) } */
    async function baixar(fonte, nomeArquivo, opts = {}) {
        if (!window.jspdf || !window.html2canvas) {
            throw new Error('Bibliotecas de PDF não carregadas (js/vendor).');
        }
        const wrap = document.createElement('div');
        wrap.className = 'pdfgen-area';
        wrap.style.cssText = `position:absolute;left:-12000px;top:0;width:${LARGURA}px;background:#fff;`;
        wrap.innerHTML = typeof fonte === 'string' ? fonte : fonte.innerHTML;
        wrap.querySelectorAll('.ia-banner, .no-pdf, button').forEach(el => el.remove());
        document.body.appendChild(wrap);
        try {
            if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
            await svgsParaImagens(wrap);

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
            const larguraMm = MM.w - MM.ml - MM.mr;
            const alturaMm = MM.h - MM.mt - MM.mb;
            const pxPorMm = LARGURA / larguraMm;
            const capacidadePx = Math.floor(alturaMm * pxPorMm);

            const blocos = Array.from(wrap.children).filter(b =>
                b.tagName !== 'STYLE' && b.tagName !== 'SCRIPT' && b.offsetHeight > 2);
            let primeira = true;
            let cursorMm = MM.mt; // modo fluxo: posição vertical na página atual
            const ESPACO = 5;     // respiro entre blocos no modo fluxo (mm)
            for (const bloco of blocos) {
                bloco.style.position = 'relative'; // offsetTop dos filhos relativo ao bloco
                const canvas = await html2canvas(bloco, {
                    scale: opts.escala || 2, backgroundColor: '#ffffff',
                    logging: false, useCORS: true
                });
                const fator = canvas.width / bloco.offsetWidth;
                const blocoMm = (canvas.height / fator) / pxPorMm;

                /* modo FLUXO (ex.: visão coletiva): acumula blocos na mesma página
                   e só quebra quando o próximo não cabe */
                if (opts.fluxo && blocoMm <= alturaMm) {
                    if (!primeira && cursorMm + blocoMm > MM.h - MM.mb) {
                        pdf.addPage();
                        cursorMm = MM.mt;
                    }
                    if (primeira) { primeira = false; cursorMm = MM.mt; }
                    pdf.addImage(canvasJpeg(canvas), 'JPEG', MM.ml, cursorMm, larguraMm, blocoMm);
                    cursorMm += blocoMm + ESPACO;
                    continue;
                }

                const capPx = opts.ajustarPagina ? bloco.scrollHeight : capacidadePx;
                for (const [yA0, yB0] of fatiasDoBloco(bloco, capPx)) {
                    const yA = Math.max(0, Math.floor(yA0 * fator));
                    const yB = Math.min(canvas.height, Math.ceil(yB0 * fator));
                    const hPx = yB - yA;
                    if (hPx < 6) continue;
                    const corte = document.createElement('canvas');
                    corte.width = canvas.width; corte.height = hPx;
                    const cx = corte.getContext('2d');
                    cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, corte.width, corte.height);
                    cx.drawImage(canvas, 0, yA, canvas.width, hPx, 0, 0, canvas.width, hPx);
                    if (!primeira) pdf.addPage();
                    primeira = false;
                    let wMm = larguraMm, x = MM.ml;
                    let hMm = (hPx / fator) / pxPorMm;
                    if (hMm > alturaMm) { // encolhe para caber em 1 página
                        const f = alturaMm / hMm;
                        hMm = alturaMm; wMm = larguraMm * f;
                        x = MM.ml + (larguraMm - wMm) / 2;
                    }
                    pdf.addImage(corte.toDataURL('image/jpeg', 0.92), 'JPEG', x, MM.mt, wMm, hMm);
                }
                cursorMm = MM.h; // após bloco paginado, próximo bloco de fluxo começa em página nova
            }
            // download com o nome modelo (o save() do jsPDF perde o nome em
            // alguns navegadores — o link com atributo download é confiável)
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
            if (window.Msg) Msg.fire({ icon: 'error', titulo: 'Não foi possível gerar o PDF', html: String(e.message || e).replace(/[<>]/g, '') });
            else alert('Não foi possível gerar o PDF: ' + e.message);
        } finally {
            aviso.remove();
        }
    }

    return { baixar, baixarComAviso, nome, dataBR, limpar };
})();
