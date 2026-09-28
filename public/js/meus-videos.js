'use strict';
(() => {
  const list = document.getElementById('list');
  const CHIP = { awaiting_payment: 'warn', expired: '', paid: 'run', rendering: 'run', ready: 'ok', failed: 'err', refunded: '' };
  async function load() {
    let r;
    try { r = await Site.api('/api/orders'); }
    catch (e) {
      if (e.status === 401) {
        try { await Site.ensureLogin({ title: T('Entre na sua conta'), sub: T('Seus vídeos ficam salvos aqui.'), mode: 'login' }); return load(); }
        catch { location.href = `${P('signin')}?volta=${encodeURIComponent(P('videos'))}`; return; }
      }
      list.innerHTML = `<p class="msg err">${Site.esc(e.message)}</p>`; return;
    }
    if (!r.orders.length) {
      list.innerHTML = `<div class="empty"><b>${Site.esc(T('Você ainda não tem vídeos.'))}</b><span>${Site.esc(T('Monte o primeiro e veja a prévia na hora.'))}</span><a class="btn primary big" href="${P('create')}">${Site.esc(T('Criar meu vídeo'))}</a></div>`;
      return;
    }
    list.innerHTML = `<div class="vgrid">${r.orders.map((o) => {
      const label = o.status === 'ready' && !o.hasVideo ? T('Expirado') : T(o.statusLabel);
      const thumb = o.hasPoster && o.hasVideo ? `<img src="/api/orders/${o.id}/poster?v=${o.version}" alt="" loading="lazy">` : `<span class="ini">${Site.esc((o.brand || '?').trim().charAt(0).toUpperCase())}</span>`;
      return `<a class="vcard" href="${P('order')}/${o.id}"><div class="thumb">${thumb}<span class="chip ${CHIP[o.status] || ''}">${Site.esc(label)}</span></div><b>${Site.esc(o.brand)}</b><small>${Site.fmtDate(o.createdAt)} · ${o.duration} s · ${Site.fmtMoney(o.priceCents, o.currency)}</small></a>`;
    }).join('')}</div>`;
    if (r.orders.some((o) => o.status === 'paid' || o.status === 'rendering')) setTimeout(load, 5000);
  }
  load();
})();
