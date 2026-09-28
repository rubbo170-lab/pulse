'use strict';
(() => {
  const token = location.hash.slice(1);
  if (token) history.replaceState(null, '', location.pathname);
  const form = document.getElementById('resetForm'), msg = document.getElementById('resetMsg');
  const say = (t, cls) => { msg.textContent = t; msg.className = 'msg' + (cls ? ' ' + cls : ''); };
  if (!token) say(T('Este link está incompleto. Peça um novo ao suporte.'), 'err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!token) return;
    if (form.p1.value.length < 8) return say(T('A senha precisa ter pelo menos 8 caracteres.'), 'err');
    if (form.p1.value !== form.p2.value) return say(T('As duas senhas não são iguais.'), 'err');
    const b = form.querySelector('button'); b.disabled = true;
    try { await Site.api('/api/auth/reset', { method: 'POST', body: { token, password: form.p1.value } }); say(T('Senha trocada! Entrando…'), 'ok'); location.replace(P('videos')); }
    catch (err) { say(err.message, 'err'); b.disabled = false; }
  });
})();
