'use strict';
(() => {
  const back = (() => { const v = new URLSearchParams(location.search).get('volta') || P('videos'); return /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) ? v : P('videos'); })();
  Site.loadMe().then((u) => {
    if (u) { location.replace(back); return; }
    const card = document.getElementById('authCard');
    document.getElementById('authForm').innerHTML = Site.authFormHtml();
    Site.bindAuthForm(card, new URLSearchParams(location.search).get('modo') === 'cadastro' ? 'signup' : 'login', () => location.replace(back));
  });
})();
