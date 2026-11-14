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
        if (this.bloqueado) return;
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
        q.palavras.forEach((p, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'word-card';
            b.style.setProperty('--i', i);
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

    async resetQuadro() {
        if (this.sel().length > 0 &&
            !(await Msg.confirma('Limpar este quadro?', 'As palavras já ordenadas neste quadro serão desmarcadas.', 'Limpar', 'Manter'))) return;
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
            Msg.erro('Respostas incompletas', 'Há um problema nas respostas: ' + e.message);
            this.goTo('survey');
            return;
        }

        document.getElementById('report').innerHTML = this.telaProgresso('Registrando as suas respostas…');
        this.goTo('report');
        localStorage.removeItem(IPA_CONFIG.STORAGE_KEY);
        this.sync(r);
    },

    async sync(r) {
        const ind = document.getElementById('sync-indicator');
        const id = 'ipa-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        const payload = Engine.montarPayload(this.state.dados, this.state.selecoes, r, this.state.consent, id);
        if (this.funcionarioCodigo) payload.funcionario = this.funcionarioCodigo;

        ind.className = 'sync-indicator pending';
        ind.textContent = 'Registrando respostas…';

        const out = await this.send(payload);
        if (out && out.code === 'preenchimento_recente') {
            ind.className = 'sync-indicator err';
            ind.textContent = 'Preenchimento não registrado — intervalo mínimo de 6 meses.';
            document.getElementById('report').innerHTML = `<div class="card card-narrow center" style="margin:40px auto">
                <div style="font-size:46px">🗓️</div><h2>Preenchimento recente</h2>
                <p class="muted">${(out.dica || '').replace(/[<>]/g, '')}</p></div>`;
            Msg.fire({ icon: 'warning', titulo: 'Preenchimento recente',
                html: (out.dica || 'Um novo preenchimento só é possível após 6 meses.').replace(/[<>]/g, ''),
                confirmText: 'Entendi' });
            return;
        }
        if (!out || (out.ok !== true && out.code !== 'duplicate_ignored')) {
            this.enqueue(payload);
            const motivo = this.explicarFalha(out);
            ind.className = 'sync-indicator err';
            ind.textContent = motivo;
            document.getElementById('report').innerHTML = this.telaErro('Envio pendente',
                motivo + ' Suas respostas ficaram salvas neste navegador — recarregue a página para reenviar.');
            return;
        }
        // Relatório instantâneo (como na produção): estrutura, números e
        // gráficos aparecem NA HORA; os textos da IA preenchem em seguida.
        this.ultimoId = id;
        this.ultimoR = r;
        this.mostrarRelatorioParcial(r);
        this.gerarIA(id, r);
    },

    /* renderiza o relatório com placeholders de prosa + banner de progresso no topo */
    mostrarRelatorioParcial(r) {
        const rep = document.getElementById('report');
        rep.innerHTML = `<div id="ia-banner" class="ia-banner">${this.bannerEscrevendo()}</div>` +
            Engine.renderRelatorioIA(this.state.dados, r, null);
        window.scrollTo({ top: 0 });
    },

    bannerEscrevendo() {
        return `<div class="ia-banner-in">
            <div class="spinner spinner-sm" aria-hidden="true"></div>
            <div class="ia-banner-txt">
                <strong>Seu relatório já está pronto abaixo — a IA está escrevendo os textos personalizados…</strong>
                <span class="muted" id="ia-etapa">Preparando…</span>
            </div>
            <div class="ia-banner-cron" id="ia-cronometro">00:00</div>
        </div>
        <p class="muted ia-banner-nota">Os números, tabelas e gráficos já são definitivos. Os textos chegam sozinhos em instantes — <strong>não feche esta página</strong>.</p>`;
    },

    bannerSet(html) {
        let b = document.getElementById('ia-banner');
        if (!b) {
            if (this.ultimoR) { this.mostrarRelatorioParcial(this.ultimoR); b = document.getElementById('ia-banner'); }
            else return;
        }
        b.innerHTML = html;
    },

    telaProgresso(msg) {
        return `<div class="card card-narrow center" style="margin:40px auto">
            <div class="spinner" aria-hidden="true"></div>
            <h2>Escrevendo o seu relatório…</h2>
            <p class="muted" id="ia-status">${msg}</p>
            <p style="font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;margin:8px 0" id="ia-cronometro">00:00</p>
            <p class="muted" id="ia-etapa" style="min-height:20px">Preparando…</p>
            <p class="muted" style="font-size:12.5px">A IA está redigindo um relatório <strong>único e personalizado</strong> para você,
            com base na metodologia ACP. O processo costuma levar de 1 a 3 minutos —
            <strong>não feche esta página</strong>: suas respostas já estão salvas e o relatório chega sozinho.</p></div>`;
    },

    /* cronômetro + etapas rotativas enquanto a IA escreve */
    iniciarCronometro() {
        this.pararCronometro();
        const t0 = Date.now();
        const etapas = [
            '📖 A IA está lendo a metodologia ACP e as suas pontuações…',
            '🧭 Interpretando o seu estilo predominante…',
            '⏱️ Analisando os três momentos do atendimento…',
            '💪 Descrevendo os seus talentos comportamentais…',
            '🌱 Elaborando os focos de desenvolvimento…',
            '📝 Escrevendo as recomendações e o plano de ação…',
            '🔎 Revisando o texto final do relatório…'
        ];
        this.cronometroIA = setInterval(() => {
            const s = Math.floor((Date.now() - t0) / 1000);
            const mm = String(Math.floor(s / 60)).padStart(2, '0');
            const ss = String(s % 60).padStart(2, '0');
            const elC = document.getElementById('ia-cronometro');
            if (elC) elC.textContent = mm + ':' + ss;
            const elE = document.getElementById('ia-etapa');
            if (elE) elE.textContent = etapas[Math.min(Math.floor(s / 18), etapas.length - 1)];
        }, 1000);
    },
    pararCronometro() {
        if (this.cronometroIA) { clearInterval(this.cronometroIA); this.cronometroIA = null; }
    },

    telaErro(titulo, texto) {
        return `<div class="card card-narrow center" style="margin:40px auto">
            <div style="font-size:46px">⚠️</div>
            <h2>${titulo}</h2>
            <p class="muted">${texto}</p>
            <button class="btn btn-primary" onclick="App.tentarIA()">Tentar novamente</button></div>`;
    },

    /* geração dos textos do relatório pela IA (com nova tentativa manual) */
    async gerarIA(id, r) {
        this.ultimoId = id;
        this.ultimoR = r;
        const ind = document.getElementById('sync-indicator');
        const st = document.getElementById('ia-status');
        if (st) st.textContent = 'Respostas registradas. A IA está escrevendo o seu relatório personalizado…';
        ind.className = 'sync-indicator pending';
        ind.textContent = 'Gerando o relatório com a IA…';

        this.iniciarCronometro();
        const out = await this.send({ schema: IPA_CONFIG.SCHEMA_VERSION, action: 'ia', id, website: '' });
        this.pararCronometro();
        if (!out || out.ok !== true || !out.ia) {
            // alta demanda OU conexão encerrada no meio: re-tenta sozinho (até 6 vezes).
            // Se o servidor tiver concluído nesse meio-tempo, a re-tentativa pega o
            // relatório pronto do cache instantaneamente.
            const reTentavel = !out || out.code === 'ia_ocupada' || out.code === 'ia_sem_conexao';
            if (reTentavel && (this.autoTentativas = (this.autoTentativas || 0) + 1) <= 6) {
                ind.className = 'sync-indicator pending';
                ind.textContent = 'Nova tentativa automática em instantes…';
                const semResposta = !out || out.code === 'ia_sem_conexao';
                const segundos = semResposta ? 12 : 20 + 8 * this.autoTentativas;
                this.bannerSet(`<div class="ia-banner-in">
                    <div class="spinner spinner-sm" aria-hidden="true"></div>
                    <div class="ia-banner-txt">
                        <strong>${semResposta ? 'A resposta da IA demorou — verificando se o texto já ficou pronto…' : 'A IA está com alta demanda (pico no serviço do Google)…'}</strong>
                        <span class="muted">Nova verificação automática em <strong id="ia-contagem">${segundos}</strong> s (tentativa ${this.autoTentativas} de 6).
                        O relatório abaixo já está pronto — só os textos personalizados estão pendentes.</span>
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="App.tentarIA()">Tentar agora</button></div>`);
                let restante = segundos;
                this.contagemIA = setInterval(() => {
                    restante--;
                    const el = document.getElementById('ia-contagem');
                    if (el) el.textContent = restante;
                    if (restante <= 0) { clearInterval(this.contagemIA); this.tentarIA(); }
                }, 1000);
                return;
            }
            ind.className = 'sync-indicator err';
            ind.textContent = 'Falha na geração dos textos pela IA.';
            this.bannerSet(`<div class="ia-banner-in ia-banner-err">
                <div class="ia-banner-txt">
                    <strong>Não foi possível gerar os textos personalizados agora.</strong>
                    <span class="muted">${((out && out.dica) ? String(out.dica).replace(/[<>]/g, '') + ' ' : '')}Suas respostas e o relatório abaixo estão registrados com segurança.</span>
                </div>
                <button class="btn btn-primary btn-sm" onclick="App.tentarIA()">Tentar novamente</button></div>`);
            return;
        }
        this.autoTentativas = 0;

        /* preenche os textos da IA no relatório que já está na tela */
        if (document.querySelector('#report [data-ia]')) {
            Engine.preencherProsaIA(out.ia);
        } else {
            document.getElementById('report').innerHTML = Engine.renderRelatorioIA(this.state.dados, r, out.ia);
            window.scrollTo({ top: 0 });
        }
        const banner = document.getElementById('ia-banner');
        if (banner) banner.remove();
        ind.textContent = '✓ Relatório escrito pela IA · arquivando…';

        const standalone = await Engine.relatorioStandalone(document.getElementById('report').innerHTML, this.state.dados);
        const arch = { schema: IPA_CONFIG.SCHEMA_VERSION, action: 'relatorio', id, relatorio: standalone, website: '' };
        const out2 = await this.send(arch);
        if (out2 && out2.ok === true) {
            ind.className = 'sync-indicator ok';
            ind.textContent = '✓ Relatório personalizado gerado pela IA e arquivado';
        } else {
            this.enqueue(arch);
            ind.className = 'sync-indicator ok';
            ind.textContent = '✓ Relatório gerado (o arquivamento será reenviado automaticamente)';
        }
        this.dialogoFinal(r, true);
    },

    tentarIA() {
        if (this.contagemIA) { clearInterval(this.contagemIA); this.contagemIA = null; }
        if (!this.ultimoId || !this.ultimoR) { location.reload(); return; }
        this.bannerSet(this.bannerEscrevendo());
        this.gerarIA(this.ultimoId, this.ultimoR);
    },

    /* Impressão segura do relatório: espera o modal fechar por completo e
       remove qualquer resíduo do SweetAlert no <body> (classes/estilos que
       travam a altura da página e fazem o navegador imprimir SÓ a capa). */
    imprimirRelatorio() {
        const limpar = () => {
            document.querySelectorAll('.swal2-container, .msgv-overlay').forEach(el => el.remove());
            document.body.classList.remove('swal2-shown', 'swal2-height-auto', 'swal2-no-backdrop', 'swal2-toast-shown');
            ['overflow', 'overflow-y', 'padding-right', 'height'].forEach(p => {
                document.body.style.removeProperty(p);
                document.documentElement.style.removeProperty(p);
            });
        };
        setTimeout(() => {
            limpar();
            requestAnimationFrame(() => setTimeout(() => window.print(), 60));
        }, 350);
    },

    /* janela de conclusão: baixar o PDF dali mesmo ou ver no site */
    async dialogoFinal(r, comIA) {
        const pred = r.ranking[0];
        const escolha = await Msg.fire({
            icon: 'success',
            titulo: 'Diagnóstico concluído!',
            html: `Suas respostas foram registradas com sucesso.<br>
                   Seu estilo predominante é
                   <strong style="color:${pred.cor}">${pred.nome}</strong>
                   (${pred.pontos} pontos · ${pred.pct.toFixed(1)}%).` +
                  (comIA ? '<br>O relatório inclui a análise personalizada do consultor IA.' : ''),
            confirmText: '📄 Baixar em PDF',
            denyText: 'Ver relatório no site'
        });
        if (escolha === 'confirm') this.imprimirRelatorio();
    },

    async send(payload) {
        if (!IPA_CONFIG.ENDPOINT || IPA_CONFIG.ENDPOINT.startsWith('COLE_AQUI')) return { ok: false, code: 'endpoint_nao_configurado' };
        try {
            // Content-Type text/plain = requisição simples (sem preflight),
            // aceita pela API na mesma origem sem cabeçalhos extras.
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

    /* traduz o código de falha em orientação prática */
    explicarFalha(out) {
        const code = out ? out.code : 'sem_conexao';
        if (code === 'sem_conexao') return 'Sem conexão com o servidor.';
        if (code === 'endpoint_nao_configurado') return 'A URL da API não foi configurada (js/config.js).';
        if (code === 'config_ausente') return 'O arquivo api/config.php não existe no servidor — renomeie o config.example.php para config.php e preencha os dados do banco.';
        if (code === 'db_error') return 'A API não conseguiu acessar o banco de dados — confira usuário, senha e nome do banco no api/config.php (e importe o schema.sql no phpMyAdmin).';
        if (code === 'erro_fatal_php') return 'Erro interno na API (PHP): ' + (out.detalhe || '') + ' — verifique se a versão do PHP é 7.4 ou superior (cPanel → MultiPHP Manager).';
        if (String(code).includes('http_404')) return 'A API não foi encontrada (HTTP 404) — confira se a pasta api/ com o api.php foi enviada ao servidor.';
        if (String(code).startsWith('resposta_nao_json')) return 'A API retornou um erro interno do servidor (' + code + '). Abra api/api.php?action=status no navegador para ver o diagnóstico — as causas comuns são api/config.php ausente ou versão do PHP inferior a 7.4 (cPanel → MultiPHP Manager).';
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
        if (!q.length) return;
        const rest = [];
        for (const p of q) {
            const out = await this.send(p);
            if (!out || out.ok !== true) rest.push(p);
        }
        localStorage.setItem(IPA_CONFIG.QUEUE_KEY, JSON.stringify(rest));
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

    async restore() {
        try {
            const raw = localStorage.getItem(IPA_CONFIG.STORAGE_KEY);
            if (!raw) return false;
            const saved = JSON.parse(raw);
            if (!saved || !saved.consent) return false;
            const respostas = Object.values(saved.selecoes || {}).reduce((a, b) => a + b.length, 0);
            if (respostas === 0 && !saved.dados.nome) return false;
            if (!(await Msg.confirma('Continuar de onde parou?',
                    'Encontramos um diagnóstico em andamento neste navegador.', 'Continuar', 'Começar de novo'))) {
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

    async restart() {
        if (!(await Msg.confirma('Iniciar um novo diagnóstico?',
                'O relatório atual deixará de ser exibido nesta tela (ele continua arquivado no sistema).', 'Novo diagnóstico', 'Voltar'))) return;
        localStorage.removeItem(IPA_CONFIG.STORAGE_KEY);
        location.reload();
    },

    /* HOMOLOGAÇÃO — link pessoal do funcionário (?f=CODIGO): busca o
       cadastro feito pelo gestor e preenche/trava nome, função e
       organização. Sem o código, o preenchimento manual continua
       disponível (ambiente de homologação). */
    async carregarFuncionario() {
        const cod = (new URLSearchParams(location.search).get('f') || '').trim();
        if (!cod || cod.length < 16) return;
        try {
            const r = await fetch(IPA_CONFIG.ENDPOINT + '?action=funcionario&c=' + encodeURIComponent(cod));
            const j = await r.json();
            if (!j || j.ok !== true) {
                Msg.fire({ icon: 'warning', titulo: 'Link pessoal inválido',
                    html: 'O link utilizado não foi reconhecido — pode ter sido copiado incompleto ou o cadastro está inativo.<br>Solicite um novo link ao seu gestor. Você ainda pode preencher manualmente.',
                    confirmText: 'Entendi' });
                return;
            }
            this.funcionarioCodigo = cod;
            const campos = { 'f-nome': j.nome, 'f-funcao': j.funcao, 'f-org': j.organizacao };
            Object.keys(campos).forEach(idc => {
                const el = document.getElementById(idc);
                el.value = campos[idc];
                el.readOnly = true;
                el.style.background = 'var(--surface)';
            });
            const f = document.getElementById('f-org');
            const dica = document.createElement('p');
            dica.className = 'muted';
            dica.style.cssText = 'font-size:12.5px;margin:-6px 0 10px';
            dica.textContent = '👤 Identificação preenchida pelo cadastro do seu gestor — basta avançar.';
            f.parentElement.appendChild(dica);
        } catch (e) { /* sem rede agora: segue manual */ }
    },

    init() {
        document.getElementById('consent-check').addEventListener('change', e => {
            document.getElementById('btn-consent').disabled = !e.target.checked;
        });
        this.flushQueue();
        this.restore();
        this.updateProgress();
        this.carregarFuncionario();
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
