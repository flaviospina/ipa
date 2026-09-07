/* ============================================================
   IPA 360° — fluxo do avaliador externo (anônimo)
   Reaproveita ACP (dados) e Engine (pesos/validação); a interface
   do ranking é a mesma do IPA, com instruções em 3ª pessoa.
   ============================================================ */

const App360 = {
    state: { avaliado: '', org: '', relacao: '', quadroAtual: 1, selecoes: { 1: [], 2: [], 3: [] } },

    goTo(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen-' + id).classList.add('active');
        window.scrollTo({ top: 0 });
    },

    progress() {
        const done = (this.state.quadroAtual - 1) * 12 + this.sel().length;
        document.getElementById('progress-bar').style.width = (10 + done / 36 * 88) + '%';
    },

    start(ev) {
        ev.preventDefault();
        if (document.getElementById('f-site').value.trim() !== '') return; // honeypot
        this.state.avaliado = document.getElementById('f-avaliado').value.trim();
        this.state.org = document.getElementById('f-org').value.trim();
        this.state.relacao = document.getElementById('f-relacao').value;
        document.getElementById('d-avaliado').textContent = this.state.avaliado;
        this.renderQuadro(1);
        this.goTo('survey');
    },

    quadro() { return ACP.QUADROS[this.state.quadroAtual - 1]; },
    sel() { return this.state.selecoes[this.state.quadroAtual]; },
    weightToIndex(w) { return w === 11 ? 0 : (w === 0 ? 1 : 12 - w); },

    renderQuadro(n) {
        this.state.quadroAtual = n;
        const q = this.quadro();
        document.getElementById('survey-step-badge').textContent = `Quadro ${n} de 3`;
        document.getElementById('survey-title').textContent = q.momento;

        const grid = document.getElementById('word-grid');
        grid.innerHTML = '';
        q.palavras.forEach(p => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'word-card';
            b.dataset.id = p.id;
            b.textContent = p.w;
            b.draggable = true;
            b.onclick = () => { const s = this.sel(); if (!s.includes(p.id) && s.length < 12) { s.push(p.id); this.renderRank(); } };
            b.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', p.id));
            grid.appendChild(b);
        });
        this.renderRank();
    },

    move(weight, dir) {
        const s = this.sel(), target = weight + dir;
        if (target > 10 || target < 1 || weight > 10 || weight < 1) return;
        const i = this.weightToIndex(weight), j = this.weightToIndex(target);
        if (s[i] !== undefined && s[j] !== undefined) { [s[i], s[j]] = [s[j], s[i]]; this.renderRank(); }
    },

    removeAt(weight) {
        const s = this.sel(), i = this.weightToIndex(weight);
        if (s[i] !== undefined) { s.splice(i, 1); this.renderRank(); }
    },

    resetQuadro() { this.state.selecoes[this.state.quadroAtual] = []; this.renderRank(); },

    dropWord(id, weight) {
        const s = this.sel();
        if (s.includes(id)) return;
        const idx = this.weightToIndex(weight);
        if (idx <= s.length) s.splice(idx, 0, id); else s.push(id);
        if (s.length > 12) s.length = 12;
        this.renderRank();
    },

    renderRank() {
        const q = this.quadro(), s = this.sel();
        const byId = Object.fromEntries(q.palavras.map(p => [p.id, p]));
        const list = document.getElementById('rank-list');
        list.innerHTML = '';
        [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].forEach(w => {
            const idx = this.weightToIndex(w), wordId = s[idx];
            const li = document.createElement('li');
            li.className = 'rank-item' + (w === 11 ? ' slot-max' : w === 0 ? ' slot-min' : '') + (wordId ? '' : ' empty');
            const placeholder = w === 11 ? 'a que MAIS representa' : w === 0 ? 'a que MENOS representa' : '—';
            li.innerHTML = `
                <span class="rank-weight">${w}</span>
                <span class="rank-word">${wordId ? byId[wordId].w : placeholder}</span>
                <span class="rank-ctrl">
                    ${wordId && w >= 1 && w <= 10 ? `
                        <button type="button" title="Subir" onclick="App360.move(${w},1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                        <button type="button" title="Descer" onclick="App360.move(${w},-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></button>` : ''}
                    ${wordId ? `<button type="button" class="rm" title="Remover" onclick="App360.removeAt(${w})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
                </span>`;
            li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('droptarget'); });
            li.addEventListener('dragleave', () => li.classList.remove('droptarget'));
            li.addEventListener('drop', e => { e.preventDefault(); li.classList.remove('droptarget'); this.dropWord(e.dataTransfer.getData('text/plain'), w); });
            list.appendChild(li);
        });

        document.querySelectorAll('.word-card').forEach(c => c.classList.toggle('used', s.includes(c.dataset.id)));
        document.getElementById('survey-counter').textContent = `${s.length} / 12`;

        const nome = this.state.avaliado.split(' ')[0] || 'a pessoa';
        const guide = document.getElementById('survey-guide');
        if (s.length === 0) guide.innerHTML = `Leia todas as palavras. Escolha a que <strong>MAIS</strong> representa o atendimento de ${nome}.`;
        else if (s.length === 1) guide.innerHTML = `Agora a palavra que <strong>MENOS</strong> representa o atendimento de ${nome}.`;
        else if (s.length < 12) guide.innerHTML = 'Ordene as demais em <strong>escala decrescente</strong>. Use as setas ou arraste para ajustar.';
        else guide.innerHTML = 'Quadro completo. Revise a escala e <strong>confirme</strong>.';

        const btn = document.getElementById('btn-quadro-next');
        btn.disabled = s.length !== 12;
        btn.textContent = this.state.quadroAtual < 3 ? 'Confirmar quadro' : 'Concluir e enviar avaliação';
        this.progress();
    },

    confirmQuadro() {
        if (this.sel().length !== 12) return;
        if (this.state.quadroAtual < 3) { this.renderQuadro(this.state.quadroAtual + 1); }
        else this.finish();
    },

    async finish() {
        const respostas = {};
        ACP.QUADROS.forEach(q => {
            this.state.selecoes[q.id].forEach((wordId, i) => { respostas[wordId] = Engine.pesoDaPosicao(i); });
        });
        const payload = {
            schema: IPA_CONFIG.SCHEMA_VERSION,
            action: '360',
            avaliado: this.state.avaliado,
            organizacao: this.state.org,
            relacao: this.state.relacao,
            respostas,
            enviadoEm: new Date().toISOString(),
            website: ''
        };
        this.goTo('done');
        const status = document.getElementById('done-status');
        try {
            const res = await fetch(IPA_CONFIG.ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const texto = await res.text();
            let out;
            try { out = JSON.parse(texto); }
            catch (e) { out = { ok: false, code: 'resposta_nao_json_http_' + res.status }; }
            status.textContent = out.ok
                ? 'Registro confirmado.'
                : (String(out.code).startsWith('resposta_nao_json') || out.code === 'erro_fatal_php'
                    ? 'Erro interno na API (' + out.code + ') — abra api/api.php?action=status para o diagnóstico (config.php ausente ou PHP < 7.4 são as causas comuns).'
                    : 'O servidor recusou o registro (código: ' + out.code + ').');
        } catch (e) {
            status.textContent = 'Sem conexão no momento — tente reenviar mais tarde.';
        }
        document.getElementById('progress-bar').style.width = '100%';
    },

    init() {
        // Convite por link: preenche e TRAVA os dados (evita erros de digitação).
        // Sem parâmetros, mantém a digitação manual como plano B.
        const p = new URLSearchParams(location.search);
        const avaliado = (p.get('avaliado') || '').slice(0, 120).trim();
        const org = (p.get('org') || '').slice(0, 120).trim();
        if (avaliado && org) {
            document.getElementById('f-avaliado').value = avaliado;
            document.getElementById('f-org').value = org;
            document.getElementById('f-avaliado').required = false;
            document.getElementById('f-org').required = false;
            document.getElementById('manual-fields').classList.add('hidden');
            document.getElementById('invite-card').classList.remove('hidden');
            document.getElementById('invite-nome').textContent = avaliado;
            document.getElementById('invite-org').textContent = org;
            document.getElementById('w-avaliado').textContent = avaliado;
            document.getElementById('w-avaliado-2').textContent = avaliado;
        } else {
            document.getElementById('w-avaliado').textContent = 'um(a) colega';
            document.getElementById('w-avaliado-2').textContent = 'um(a) profissional';
            if (avaliado) document.getElementById('f-avaliado').value = avaliado;
            if (org) document.getElementById('f-org').value = org;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => App360.init());
