/* ============================================================
   IPA — Fluxo da aplicação (telas, questionário, envio)
   ============================================================ */

const App = {
    state: {
        screen: 'welcome',
        consent: null,                 // ISO timestamp do aceite
        dados: { org: '', nome: '', funcao: '' },
        quadroAtual: 1,
        selecoes: { 1: [], 2: [], 3: [] },  // ids em ordem de escolha
        inicioEm: null
    },

    SCREENS: ['welcome', 'consent', 'cadastro', 'instrucoes', 'survey', 'sending', 'report'],
    PROGRESS: { welcome: 0, consent: 8, cadastro: 16, instrucoes: 24, survey: 30, sending: 92, report: 100 },

    /* ---------- Navegação ---------- */
    goTo(screen) {
        this.state.screen = screen;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen-' + screen).classList.add('active');
        this.updateProgress();
        window.scrollTo({ top: 0 });
    },

    updateProgress() {
        let pct = this.PROGRESS[this.state.screen] ?? 0;
        if (this.state.screen === 'survey') {
            const done = (this.state.quadroAtual - 1) * 12 + this.state.selecoes[this.state.quadroAtual].length;
            pct = 30 + (done / 36) * 60;
        }
        document.getElementById('progress-bar').style.width = pct + '%';
    },

    /* ---------- Consentimento ---------- */
    acceptConsent() {
        this.state.consent = new Date().toISOString();
        this.persist();
        this.goTo('cadastro');
    },

    /* ---------- Cadastro ---------- */
    submitCadastro(ev) {
        ev.preventDefault();
        // honeypot: se preenchido, é bot — não avança
        if (document.getElementById('f-site').value.trim() !== '') return;
        this.state.dados = {
            org: document.getElementById('f-org').value.trim(),
            nome: document.getElementById('f-nome').value.trim(),
            funcao: document.getElementById('f-funcao').value.trim()
        };
        this.persist();
        this.goTo('instrucoes');
    },

    /* ---------- Questionário ---------- */
    startSurvey() {
        if (!this.state.inicioEm) this.state.inicioEm = new Date().toISOString();
        this.renderQuadro(this.state.quadroAtual);
        this.goTo('survey');
    },

    quadro() { return ACP.QUADROS[this.state.quadroAtual - 1]; },
    sel() { return this.state.selecoes[this.state.quadroAtual]; },

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
            b.onclick = () => this.pickWord(p.id);
            b.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', p.id));
            grid.appendChild(b);
        });

        this.renderRank();
    },

    pickWord(id) {
        const s = this.sel();
        if (s.includes(id) || s.length >= 12) return;
        s.push(id);
        this.persist();
        this.renderRank();
    },

    /* insere via drag & drop na posição do peso alvo */
    dropWord(id, weight) {
        const s = this.sel();
        if (s.includes(id)) return;
        const idx = this.weightToIndex(weight);
        if (idx <= s.length) s.splice(idx, 0, id); else s.push(id);
        if (s.length > 12) s.length = 12;
        this.persist();
        this.renderRank();
    },

    weightToIndex(w) { return w === 11 ? 0 : (w === 0 ? 1 : 12 - w); },

    move(weight, dir) {
        const s = this.sel();
        const target = weight + dir;
        if (target > 10 || target < 1 || weight > 10 || weight < 1) return;
        const i = this.weightToIndex(weight), j = this.weightToIndex(target);
        if (s[i] !== undefined && s[j] !== undefined) {
            [s[i], s[j]] = [s[j], s[i]];
            this.persist(); this.renderRank();
        }
    },

    removeAt(weight) {
        const s = this.sel();
        const i = this.weightToIndex(weight);
        if (s[i] !== undefined) { s.splice(i, 1); this.persist(); this.renderRank(); }
    },

    resetQuadro() {
        this.state.selecoes[this.state.quadroAtual] = [];
        this.persist();
        this.renderRank();
    },

    renderRank() {
        const q = this.quadro(), s = this.sel();
        const byId = Object.fromEntries(q.palavras.map(p => [p.id, p]));
        const list = document.getElementById('rank-list');
        list.innerHTML = '';

        const pesos = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
        pesos.forEach(w => {
            const idx = this.weightToIndex(w);
            const wordId = s[idx];
            const li = document.createElement('li');
            li.className = 'rank-item' + (w === 11 ? ' slot-max' : w === 0 ? ' slot-min' : '') + (wordId ? '' : ' empty');
            const placeholder = w === 11 ? 'a que MAIS se aproxima' : w === 0 ? 'a que MENOS se aproxima' : '—';
            li.innerHTML = `
                <span class="rank-weight">${w}</span>
                <span class="rank-word">${wordId ? byId[wordId].w : placeholder}</span>
                <span class="rank-ctrl">
                    ${wordId && w >= 1 && w <= 10 ? `
                        <button type="button" title="Subir" onclick="App.move(${w},1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                        <button type="button" title="Descer" onclick="App.move(${w},-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></button>` : ''}
                    ${wordId ? `<button type="button" class="rm" title="Remover" onclick="App.removeAt(${w})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
                </span>`;
            li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('droptarget'); });
            li.addEventListener('dragleave', () => li.classList.remove('droptarget'));
            li.addEventListener('drop', e => {
                e.preventDefault(); li.classList.remove('droptarget');
                this.dropWord(e.dataTransfer.getData('text/plain'), w);
            });
            list.appendChild(li);
        });

        // estado das palavras usadas
        document.querySelectorAll('.word-card').forEach(c => c.classList.toggle('used', s.includes(c.dataset.id)));

        // contador + guia
        document.getElementById('survey-counter').textContent = `${s.length} / 12`;
        const guide = document.getElementById('survey-guide');
        if (s.length === 0) guide.innerHTML = 'Leia todas as palavras. Depois, escolha a que <strong>MAIS</strong> se aproxima da sua prática.';
        else if (s.length === 1) guide.innerHTML = 'Agora escolha a palavra que <strong>MENOS</strong> se aproxima da sua prática.';
        else if (s.length < 12) guide.innerHTML = 'Ordene as demais em <strong>escala decrescente</strong> — cada clique preenche a próxima posição. Use as setas ou arraste para ajustar.';
        else guide.innerHTML = 'Quadro completo. Revise a escala e <strong>confirme</strong>.';

        const btn = document.getElementById('btn-quadro-next');
        btn.disabled = s.length !== 12;
        btn.textContent = this.state.quadroAtual < 3 ? 'Confirmar quadro' : 'Concluir e gerar relatório';
        this.updateProgress();
    },

    confirmQuadro() {
        if (this.sel().length !== 12) return;
        if (this.state.quadroAtual < 3) {
            this.renderQuadro(this.state.quadroAtual + 1);
            window.scrollTo({ top: 0 });
        } else {
            this.finish();
        }
    },

    /* ---------- Conclusão: cálculo, relatório, IA e envio ---------- */
    async finish() {
        this.goTo('sending');
        let r;
        try {
            r = Engine.calcular(this.state.selecoes);
        } catch (e) {
            alert('Há um problema nas respostas: ' + e.message);
            this.goTo('survey');
            return;
        }

        document.getElementById('report').innerHTML = Engine.renderRelatorio(this.state.dados, r);
        this.goTo('report');
        localStorage.removeItem(IPA_CONFIG.STORAGE_KEY);
        this.sync(r);
    },

    async sync(r) {
        const ind = document.getElementById('sync-indicator');
        const id = 'ipa-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        const payload = Engine.montarPayload(this.state.dados, this.state.selecoes, r, this.state.consent, id);
        // identificador da empresa vindo do link (?empresa=slug) — permite ao
        // banco vincular a resposta à empresa cadastrada sem digitação livre
        payload.empresa = new URLSearchParams(location.search).get('empresa') || '';

        ind.className = 'sync-indicator pending';
        ind.textContent = 'Registrando respostas e gerando análise personalizada…';

        // transição: envia para a planilha (como hoje) E para o banco.
        // O indicador na tela segue o resultado da planilha; a gravação no
        // banco é silenciosa e tem fila própria de reenvio.
        const [out, db] = await Promise.all([this.send(payload), this.sendApi(payload)]);
        if (db.ok !== true && this.apiReenviavel(db.code)) this.enqueueApi(payload);
        if (!out || out.ok !== true) {
            this.enqueue(payload);
            ind.className = 'sync-indicator err';
            ind.textContent = this.explicarFalha(out) + ' Suas respostas ficaram salvas neste navegador e serão reenviadas automaticamente.';
            return;
        }

        // enriquece o relatório com a análise da IA, se disponível
        let reportHtml = document.getElementById('report').innerHTML;
        if (out.ia) {
            reportHtml = Engine.renderRelatorio(this.state.dados, r, out.ia);
            document.getElementById('report').innerHTML = reportHtml;
        }

        ind.textContent = out.ia
            ? '✓ Análise personalizada incluída · arquivando relatório…'
            : '✓ Respostas registradas · arquivando relatório…';

        // passo 2: arquiva o relatório final (com IA, se houver) no Drive
        const standalone = await Engine.relatorioStandalone(reportHtml, this.state.dados);
        const arch = { schema: IPA_CONFIG.SCHEMA_VERSION, action: 'relatorio', id,
                       nome: this.state.dados.nome, relatorio: standalone, website: '' };
        const [out2, db2] = await Promise.all([this.send(arch), this.sendApi(arch)]);
        if (db2.ok !== true && this.apiReenviavel(db2.code)) this.enqueueApi(arch);
        if (out2 && out2.ok === true) {
            ind.className = 'sync-indicator ok';
            ind.textContent = out.ia
                ? '✓ Respostas registradas, análise personalizada incluída e relatório arquivado'
                : '✓ Respostas registradas e relatório arquivado';
        } else if (out2 && out2.code === 'row_not_found') {
            // o PDF foi salvo, mas a linha da planilha não foi localizada para
            // receber o link. Reenviar não resolve — a fila só repetiria a falha.
            ind.className = 'sync-indicator ok';
            ind.textContent = '✓ Respostas registradas e relatório arquivado (o link não pôde ser vinculado à linha da planilha)';
        } else {
            this.enqueue(arch);
            ind.className = 'sync-indicator ok';
            ind.textContent = '✓ Respostas registradas (o arquivamento do relatório será reenviado automaticamente)';
        }
    },

    async send(payload) {
        if (!IPA_CONFIG.ENDPOINT || IPA_CONFIG.ENDPOINT.startsWith('COLE_AQUI')) return { ok: false, code: 'endpoint_nao_configurado' };
        try {
            // Content-Type text/plain = requisição simples (sem preflight):
            // o Apps Script responde com CORS liberado e conseguimos LER a resposta.
            const res = await fetch(IPA_CONFIG.ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const texto = await res.text();
            try { return JSON.parse(texto); }
            catch (e) { return { ok: false, code: 'resposta_nao_json_http_' + res.status }; }
        } catch (e) {
            return { ok: false, code: 'sem_conexao' };
        }
    },

    /* ---------- API do banco (itthri79_vipedia) ---------- */
    async sendApi(payload) {
        if (!IPA_CONFIG.API_ENDPOINT) return { ok: false, code: 'api_desativada' };
        try {
            const res = await fetch(IPA_CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const texto = await res.text();
            try { return JSON.parse(texto); }
            catch (e) { return { ok: false, code: 'api_resposta_invalida' }; }
        } catch (e) {
            return { ok: false, code: 'api_sem_conexao' };
        }
    },

    /* falhas transitórias entram na fila; recusas definitivas (empresa não
       cadastrada, dados inválidos) não — reenviar daria o mesmo resultado
       e a planilha, que continua recebendo em paralelo, segura o registro */
    apiReenviavel(code) {
        return ['api_sem_conexao', 'api_resposta_invalida', 'rate_limited',
                'error', 'avaliacao_nao_encontrada'].includes(String(code));
    },

    enqueueApi(payload) {
        const q = JSON.parse(localStorage.getItem(IPA_CONFIG.QUEUE_API_KEY) || '[]');
        q.push(payload);
        localStorage.setItem(IPA_CONFIG.QUEUE_API_KEY, JSON.stringify(q));
    },

    /* pré-preenche a organização a partir do link (?empresa=slug) */
    async prefillEmpresa() {
        const slug = new URLSearchParams(location.search).get('empresa');
        if (!slug || !IPA_CONFIG.API_ENDPOINT) return;
        try {
            const res = await fetch(IPA_CONFIG.API_ENDPOINT + '?action=empresa&slug=' + encodeURIComponent(slug));
            const out = await res.json();
            if (out.ok && out.nome) {
                const campo = document.getElementById('f-org');
                campo.value = out.nome;
                campo.readOnly = true;   // veio do link: não se digita a empresa
            }
        } catch (e) { /* sem conexão: o campo segue editável */ }
    },

    /* traduz o código de falha em orientação prática */
    explicarFalha(out) {
        const code = out ? out.code : 'sem_conexao';
        if (code === 'sem_conexao') return 'Sem conexão com o servidor.';
        if (code === 'endpoint_nao_configurado') return 'A URL do Apps Script não foi configurada (js/config.js).';
        if (String(code).startsWith('resposta_nao_json')) return 'O servidor devolveu uma página de login do Google em vez de dados — a implantação do Apps Script precisa estar com "Quem pode acessar: Qualquer pessoa". (código: ' + code + ')';
        return 'O servidor recusou o envio (código: ' + code + ').';
    },

    /* fila de reenvio */
    enqueue(payload) {
        const q = JSON.parse(localStorage.getItem(IPA_CONFIG.QUEUE_KEY) || '[]');
        q.push(payload);
        localStorage.setItem(IPA_CONFIG.QUEUE_KEY, JSON.stringify(q));
    },

    async flushQueue() {
        const q = JSON.parse(localStorage.getItem(IPA_CONFIG.QUEUE_KEY) || '[]');
        if (q.length) {
            const rest = [];
            for (const p of q) {
                const out = await this.send(p);
                if (!out || out.ok !== true) rest.push(p);
            }
            localStorage.setItem(IPA_CONFIG.QUEUE_KEY, JSON.stringify(rest));
        }

        // fila da API do banco: só ficam nela falhas transitórias
        const qa = JSON.parse(localStorage.getItem(IPA_CONFIG.QUEUE_API_KEY) || '[]');
        if (qa.length) {
            const resto = [];
            for (const p of qa) {
                const out = await this.sendApi(p);
                if (out.ok !== true && this.apiReenviavel(out.code)) resto.push(p);
            }
            localStorage.setItem(IPA_CONFIG.QUEUE_API_KEY, JSON.stringify(resto));
        }
    },

    /* ---------- Persistência local (retomada) ---------- */
    persist() {
        try {
            localStorage.setItem(IPA_CONFIG.STORAGE_KEY, JSON.stringify(this.state));
            const el = document.getElementById('save-status');
            el.hidden = false;
            clearTimeout(this._saveT);
            this._saveT = setTimeout(() => { el.hidden = true; }, 1500);
        } catch (e) { /* armazenamento indisponível */ }
    },

    restore() {
        try {
            const raw = localStorage.getItem(IPA_CONFIG.STORAGE_KEY);
            if (!raw) return false;
            const saved = JSON.parse(raw);
            if (!saved || !saved.consent) return false;
            const respostas = Object.values(saved.selecoes || {}).reduce((a, b) => a + b.length, 0);
            if (respostas === 0 && !saved.dados.nome) return false;
            if (!confirm('Encontramos um diagnóstico em andamento. Deseja continuar de onde parou?')) {
                localStorage.removeItem(IPA_CONFIG.STORAGE_KEY);
                return false;
            }
            this.state = saved;
            if (saved.dados.nome) {
                document.getElementById('f-org').value = saved.dados.org;
                document.getElementById('f-nome').value = saved.dados.nome;
                document.getElementById('f-funcao').value = saved.dados.funcao;
            }
            if (respostas > 0 || saved.screen === 'survey') { this.startSurvey(); }
            else this.goTo(saved.screen === 'welcome' ? 'consent' : saved.screen);
            return true;
        } catch (e) { return false; }
    },

    restart() {
        if (!confirm('Iniciar um novo diagnóstico? O relatório atual deixará de ser exibido.')) return;
        localStorage.removeItem(IPA_CONFIG.STORAGE_KEY);
        location.reload();
    },

    init() {
        document.getElementById('consent-check').addEventListener('change', e => {
            document.getElementById('btn-consent').disabled = !e.target.checked;
        });
        this.flushQueue();
        if (!this.restore()) this.prefillEmpresa();
        this.updateProgress();
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
