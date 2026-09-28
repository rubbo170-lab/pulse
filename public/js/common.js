'use strict';
// Utilidades de todas as páginas: tradução, API, sessão, cabeçalho, login em janela, avisos.
const LANG = window.LANG || 'pt';
// T(<texto em português>, {var}) → texto no idioma da página (o português é a chave)
function T(pt, vars) {
  let s = (window.I18N && window.I18N[pt]) || pt;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
}
// P('create') → "/criar" | "/en/create" | "/es/crear"
const P = (page) => (window.PATHS && window.PATHS[page]) || '/';

const Site = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOC = { pt: 'pt-BR', en: 'en-US', es: 'es' }[LANG] || 'pt-BR';
  // reais no formato brasileiro; dólar sempre como "US$ 9.90" (em boa parte da América Latina, "$" é a moeda local)
  const fmtMoney = (cents, currency = 'BRL') => (currency === 'USD' ? `US$ ${(cents / 100).toFixed(2)}` : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const fmtBRL = (cents) => fmtMoney(cents, 'BRL');
  const fmtDate = (ms, withTime) => new Date(ms).toLocaleString(LOC, withTime ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtMB = (b) => `${(b / 1e6).toLocaleString(LOC, { maximumFractionDigits: 1 })} MB`;

  async function api(path, { method = 'GET', body, signal } = {}) {
    let res;
    const headers = { 'X-Lang': LANG };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      res = await fetch(path, { method, signal, credentials: 'same-origin', headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      const err = new Error(T('Sem conexão com o servidor. Confira sua internet e tente de novo.')); err.status = 0; throw err;
    }
    let data = null;
    try { data = await res.json(); } catch { /* sem corpo */ }
    if (!res.ok) { const err = new Error((data && data.error) || T('Erro {n}', { n: res.status })); err.status = res.status; err.data = data || {}; throw err; }
    return data;
  }

  let cfgP = null, meP = null, me = null;
  const config = () => (cfgP ||= api(`/api/config?lang=${LANG}`).catch(() => ({ currency: LANG === 'pt' ? 'BRL' : 'USD', prices: { 15: LANG === 'pt' ? 2990 : 990, 20: LANG === 'pt' ? 3490 : 1290 }, company: {} })));
  const loadMe = (force) => { if (force || !meP) meP = api('/api/me').then((r) => (me = r.user)).catch(() => (me = null)); return meP; };

  function toast(msg, isErr, ms = 4200) {
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : ''); el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function paintHeader() {
    document.querySelectorAll('[data-auth=in]').forEach((el) => { el.hidden = !me; });
    document.querySelectorAll('[data-auth=out]').forEach((el) => { el.hidden = !!me; });
    document.querySelectorAll('[data-auth=admin]').forEach((el) => { el.hidden = !(me && me.admin); });
    document.querySelectorAll('[data-me=name]').forEach((el) => { el.textContent = me ? me.name.split(' ')[0] : ''; });
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* ignora */ }
    me = null; meP = Promise.resolve(null); paintHeader();
    if ([P('videos'), P('order'), '/admin'].some((p) => location.pathname.startsWith(p))) location.href = P('home');
  }

  async function paintFooter() {
    const cfg = await config(), c = cfg.company || {};
    const parts = [`© ${new Date().getFullYear()} ${c.name || 'Pulso'}`];
    if (c.doc) parts.push(`CNPJ ${c.doc}`);
    if (c.city) parts.push(c.city);
    document.querySelectorAll('[data-co=line]').forEach((el) => { el.textContent = parts.join(' · '); });
    document.querySelectorAll('[data-co=name]').forEach((el) => { el.textContent = c.name || 'Pulso'; });
    document.querySelectorAll('[data-co=doc]').forEach((el) => { el.textContent = c.doc || T('(CNPJ a informar)'); });
    document.querySelectorAll('[data-co=email]').forEach((el) => { if (c.email) { el.textContent = c.email; if (el.tagName === 'A') el.href = `mailto:${c.email}`; } });
    document.querySelectorAll('[data-co=support]').forEach((el) => {
      if (c.whatsapp) { el.href = `https://wa.me/${c.whatsapp}`; el.target = '_blank'; el.rel = 'noopener'; el.hidden = false; }
      else if (c.email) { el.href = `mailto:${c.email}`; el.hidden = false; }
    });
    document.querySelectorAll('[data-price]').forEach((el) => { el.textContent = fmtMoney(cfg.prices[el.dataset.price || 15] || cfg.prices[15], cfg.currency); });
  }

  // no site em português, sugere a versão no idioma do navegador (sem redirecionar sozinho)
  function langHint() {
    if (LANG !== 'pt' || location.pathname !== '/') return;
    const nav = (navigator.language || '').slice(0, 2);
    if (!['en', 'es'].includes(nav)) return;
    try { if (localStorage.getItem('pulso.langhint')) return; } catch { /* sem armazenamento */ }
    const el = document.createElement('div');
    el.className = 'lang-hint';
    el.innerHTML = nav === 'en' ? '<span>Prefer English?</span><a href="/en" hreflang="en">View the English version</a>' : '<span>¿Prefieres español?</span><a href="/es" hreflang="es">Ver la versión en español</a>';
    const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', nav === 'en' ? 'Close' : 'Cerrar'); x.textContent = '×';
    x.addEventListener('click', () => { el.remove(); try { localStorage.setItem('pulso.langhint', '1'); } catch { /* ok */ } });
    el.appendChild(x);
    document.body.prepend(el);
  }

  // janela de login/cadastro; resolve com o usuário
  function ensureLogin({ title = T('Entre para continuar'), sub = T('Sua conta guarda seus vídeos e pedidos.'), mode = 'signup' } = {}) {
    return loadMe().then((u) => u || new Promise((resolve, reject) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'authTitle');
      wrap.innerHTML = `<div class="box">
        <button class="x-close" type="button" aria-label="${esc(T('Fechar'))}">×</button>
        <h2 id="authTitle">${esc(title)}</h2><p class="sub">${esc(sub)}</p>
        <div class="tabs" role="tablist"><button type="button" role="tab" data-t="signup">${esc(T('Criar conta'))}</button><button type="button" role="tab" data-t="login">${esc(T('Já tenho conta'))}</button></div>
        ${authFormHtml()}
      </div>`;
      document.body.appendChild(wrap);
      const prevFocus = document.activeElement;
      const close = (u) => { wrap.remove(); document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); if (u) resolve(u); else reject(Object.assign(new Error('cancelado'), { cancelled: true })); };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      wrap.addEventListener('click', (e) => { if (e.target === wrap) close(null); });
      $('.x-close', wrap).addEventListener('click', () => close(null));
      bindAuthForm(wrap, mode, (u) => close(u));
    }));
  }

  function authFormHtml() {
    return `<form class="stack" novalidate>
      <label class="fld" data-only="signup"><span>${esc(T('Seu nome'))}</span><input type="text" name="name" autocomplete="name" maxlength="60" required></label>
      <label class="fld"><span>${esc(T('E-mail'))}</span><input type="email" name="email" autocomplete="email" maxlength="254" required></label>
      <label class="fld" data-only="signup"><span>${esc(T('WhatsApp (opcional)'))}</span><input type="tel" name="phone" autocomplete="tel" maxlength="24" placeholder="${esc(T('(11) 90000-0000'))}"></label>
      <label class="fld"><span>${esc(T('Senha'))}</span><input type="password" name="password" autocomplete="current-password" minlength="8" maxlength="200" required></label>
      <label class="check" data-only="signup"><input type="checkbox" name="accept"><span>${esc(T('Li e aceito os'))} <a href="${P('terms')}" target="_blank">${esc(T('Termos de Uso'))}</a> ${esc(T('e a'))} <a href="${P('privacy')}" target="_blank">${esc(T('Política de Privacidade'))}</a>.</span></label>
      <p class="msg" aria-live="polite"></p>
      <button class="btn primary big block" type="submit"></button>
      <p class="dim" data-only="login" style="font-size:13px;margin:0">${esc(T('Esqueceu a senha?'))} <a data-co="support" href="#" hidden>${esc(T('Fale com o suporte'))}</a> ${esc(T('e enviamos um link para criar outra.'))}</p>
    </form>`;
  }

  function bindAuthForm(root, mode, onDone) {
    const form = $('form', root), msg = $('.msg', form), btn = $('button[type=submit]', form);
    const setMode = (m) => {
      mode = m;
      root.querySelectorAll('[data-t]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === m)));
      form.querySelectorAll('[data-only]').forEach((el) => { el.hidden = el.dataset.only !== m; });
      form.password.autocomplete = m === 'signup' ? 'new-password' : 'current-password';
      btn.textContent = m === 'signup' ? T('Criar conta e continuar') : T('Entrar');
      msg.textContent = ''; msg.className = 'msg';
      (m === 'signup' ? form.name : form.email).focus();
    };
    root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.t)));
    setMode(mode);
    paintFooter();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.className = 'msg'; msg.textContent = '';
      const v = { name: form.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(), password: form.password.value, accept: form.accept.checked, lang: LANG };
      if (mode === 'signup' && v.name.length < 2) return fail(T('Digite seu nome.'), form.name);
      if (!/^\S+@\S+\.\S+$/.test(v.email)) return fail(T('Digite um e-mail válido.'), form.email);
      if (v.password.length < 8) return fail(T('A senha precisa ter pelo menos 8 caracteres.'), form.password);
      if (mode === 'signup' && !v.accept) return fail(T('Para criar a conta, aceite os Termos e a Política de Privacidade.'), form.accept);
      btn.disabled = true; const label = btn.textContent; btn.textContent = T('Aguarde…');
      try {
        const r = mode === 'signup' ? await api('/api/auth/signup', { method: 'POST', body: v }) : await api('/api/auth/login', { method: 'POST', body: { email: v.email, password: v.password } });
        me = r.user; meP = Promise.resolve(me); paintHeader(); onDone(me);
      } catch (err) {
        fail(err.message);
        if (err.status === 409) setTimeout(() => { setMode('login'); form.email.value = v.email; form.password.focus(); msg.textContent = T('Você já tem conta com esse e-mail. Digite sua senha.'); }, 900);
      } finally { btn.disabled = false; btn.textContent = label; }
    });
    function fail(t, el) { msg.textContent = t; msg.className = 'msg err'; if (el) el.focus(); }
  }

  function init() {
    loadMe().then(paintHeader);
    document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', logout));
    paintFooter();
    langHint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { $, esc, api, config, loadMe, get me() { return me; }, toast, ensureLogin, bindAuthForm, authFormHtml, fmtMoney, fmtBRL, fmtDate, fmtMB, paintHeader, paintFooter, LOC };
})();
