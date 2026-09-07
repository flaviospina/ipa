/* ============================================================
   IPA — Mensagens (SweetAlert2 com fallback embutido)
   Usa o SweetAlert2 quando carregado (CDN); se indisponível,
   renderiza um modal próprio com o mesmo visual. API única:
   Msg.fire({icon,titulo,html,confirmText,denyText,cancelText})
     -> Promise<'confirm'|'deny'|'cancel'>
   Msg.sucesso / Msg.erro / Msg.confirma / Msg.toast
   ============================================================ */

const Msg = (() => {
    const BRAND = '#1e3a8a';

    /* ---------- fallback: modal próprio (sem dependências) ---------- */
    const ICONES = {
        success: { simbolo: '✓', cor: '#0e9f6e' },
        error:   { simbolo: '✕', cor: '#c22b1a' },
        warning: { simbolo: '!', cor: '#b45309' },
        question:{ simbolo: '?', cor: BRAND },
        info:    { simbolo: 'i', cor: BRAND }
    };

    function garantirCss() {
        if (document.getElementById('msgv-css')) return;
        const st = document.createElement('style');
        st.id = 'msgv-css';
        st.textContent = `
        .msgv-overlay{position:fixed;inset:0;background:rgba(16,26,53,.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;animation:msgvF .2s ease-out}
        @keyframes msgvF{from{opacity:0}to{opacity:1}}
        .msgv{background:#fff;border-radius:20px;max-width:440px;width:100%;padding:34px 30px 26px;text-align:center;box-shadow:0 20px 60px rgba(16,26,53,.35);animation:msgvP .22s ease-out}
        @keyframes msgvP{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
        .msgv-icone{width:72px;height:72px;border-radius:50%;margin:0 auto 18px;display:grid;place-items:center;font-size:36px;font-weight:800;color:#fff}
        .msgv h2{margin:0 0 10px;font-size:22px;letter-spacing:-.02em;color:#16213a}
        .msgv .msgv-html{color:#4b5772;font-size:15px;line-height:1.55;margin-bottom:22px}
        .msgv-botoes{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .msgv-botoes button{font:inherit;font-weight:700;border:0;cursor:pointer;border-radius:11px;padding:12px 22px;font-size:14.5px}
        .msgv-confirm{background:${BRAND};color:#fff}
        .msgv-deny{background:#475569;color:#fff}
        .msgv-cancel{background:#e4e8ef;color:#4b5772}
        .msgv-toast{position:fixed;top:18px;right:18px;background:#16213a;color:#fff;font-weight:600;font-size:13.5px;padding:12px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(16,26,53,.3);z-index:9999;animation:msgvF .2s ease-out}`;
        document.head.appendChild(st);
    }

    function modalProprio({ icon = 'info', titulo = '', html = '', confirmText = 'OK', denyText = null, cancelText = null }) {
        garantirCss();
        return new Promise(resolve => {
            const ov = document.createElement('div');
            ov.className = 'msgv-overlay';
            const ic = ICONES[icon] || ICONES.info;
            ov.innerHTML = `<div class="msgv" role="alertdialog" aria-modal="true">
                <div class="msgv-icone" style="background:${ic.cor}">${ic.simbolo}</div>
                <h2>${titulo}</h2>
                <div class="msgv-html">${html}</div>
                <div class="msgv-botoes">
                    ${denyText ? `<button class="msgv-deny">${denyText}</button>` : ''}
                    ${cancelText ? `<button class="msgv-cancel">${cancelText}</button>` : ''}
                    <button class="msgv-confirm">${confirmText}</button>
                </div></div>`;
            const fechar = (r) => { ov.remove(); resolve(r); };
            ov.querySelector('.msgv-confirm').onclick = () => fechar('confirm');
            const d = ov.querySelector('.msgv-deny'); if (d) d.onclick = () => fechar('deny');
            const c = ov.querySelector('.msgv-cancel'); if (c) c.onclick = () => fechar('cancel');
            document.body.appendChild(ov);
            ov.querySelector('.msgv-confirm').focus();
        });
    }

    /* ---------- API unificada ---------- */
    function fire(cfg) {
        if (typeof Swal !== 'undefined') {
            return Swal.fire({
                icon: cfg.icon || 'info',
                title: cfg.titulo || '',
                html: cfg.html || '',
                confirmButtonText: cfg.confirmText || 'OK',
                showDenyButton: !!cfg.denyText,
                denyButtonText: cfg.denyText || undefined,
                showCancelButton: !!cfg.cancelText,
                cancelButtonText: cfg.cancelText || undefined,
                confirmButtonColor: BRAND,
                denyButtonColor: '#475569',
                cancelButtonColor: '#94a3b8',
                allowOutsideClick: false
            }).then(r => (r.isConfirmed ? 'confirm' : r.isDenied ? 'deny' : 'cancel'));
        }
        return modalProprio(cfg);
    }

    function toast(texto) {
        if (typeof Swal !== 'undefined') {
            return Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: texto,
                               showConfirmButton: false, timer: 2200, timerProgressBar: true });
        }
        garantirCss();
        const t = document.createElement('div');
        t.className = 'msgv-toast';
        t.textContent = texto;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2200);
    }

    return {
        fire,
        toast,
        sucesso: (titulo, html, confirmText) => fire({ icon: 'success', titulo, html, confirmText }),
        erro: (titulo, html) => fire({ icon: 'error', titulo, html, confirmText: 'Entendi' }),
        confirma: (titulo, html, confirmText, cancelText) =>
            fire({ icon: 'question', titulo, html, confirmText: confirmText || 'Sim',
                   cancelText: cancelText || 'Cancelar' }).then(r => r === 'confirm')
    };
})();
