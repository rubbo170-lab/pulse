'use strict';
// Página do pedido: acompanha pagamento → fila → render → download.
(() => {
  const $ = (id) => document.getElementById(id);
  const id = (location.pathname.match(/\/([a-z0-9]{16})\/?$/) || [])[1];
  const qs = new URLSearchParams(location.search);
  let returnPayment = qs.get('payment_id') || qs.get('collection_id');
  let returnSession = qs.get('session_id');
  const returnStatus = qs.get('status') || qs.get('collection_status') || (qs.get('canceled') ? 'canceled' : null);
  if (qs.toString()) history.replaceState(null, '', location.pathname);
  let timer = null, current = null, shownVideo = 0, cfg = null;

  const STEPS = ['pay', 'queue', 'render', 'ready'];
  function track(stepNow, doneUpTo) {
    document.querySelectorAll('#track li').forEach((li) => {
      const i = STEPS.indexOf(li.dataset.step);
      li.classList.toggle('done', i <= doneUpTo);
      li.classList.toggle('now', li.dataset.step === stepNow);
    });
  }
  function actions(html) { $('oActions').innerHTML = html; }
  const methodLabel = (m) => ({ pix: 'Pix', credit_card: T('cartão'), card: T('cartão'), debit_card: T('cartão de débito'), manual: T('liberado pelo suporte') }[m] || m);
  function facts(o) {
    const rows = [[T('Pedido'), o.id], [T('Empresa'), Site.esc(o.brand)], [T('Duração'), `${o.duration} s`], [T('Valor'), Site.fmtMoney(o.priceCents, o.currency)], [T('Criado em'), Site.fmtDate(o.createdAt, true)]];
    if (o.paidAt) rows.push([T('Pago em'), `${Site.fmtDate(o.paidAt, true)}${o.payMethod ? ` · ${Site.esc(methodLabel(o.payMethod))}` : ''}`]);
    if (o.hasVideo && o.expiresAt) rows.push([T('Disponível até'), Site.fmtDate(o.expiresAt)]);
    $('oFacts').innerHTML = rows.map(([k, v]) => `<dt>${Site.esc(k)}</dt><dd>${v}</dd>`).join('');
  }
  function waiting(text) { $('oVideo').hidden = true; $('oPoster').hidden = true; $('oWaiting').hidden = false; $('oWaitText').textContent = text; }
  const support = () => (cfg && cfg.company && cfg.company.whatsapp ? `<a class="btn" href="https://wa.me/${cfg.company.whatsapp}" target="_blank" rel="noopener">${Site.esc(T('Falar com o suporte'))}</a>` : cfg && cfg.company && cfg.company.email ? `<a class="btn" href="mailto:${Site.esc(cfg.company.email)}">${Site.esc(T('Falar com o suporte'))}</a>` : '');

  function render(o) {
    current = o;
    $('oBrand').textContent = o.brand;
    $('prog').hidden = true;
    facts(o);
    const q = o.queue || {};
    switch (o.status) {
      case 'awaiting_payment':
      case 'expired': {
        const pending = returnStatus === 'pending' || returnStatus === 'in_process';
        track('pay', -1);
        $('oTitle').textContent = pending ? T('Esperando o pagamento cair') : o.status === 'expired' ? T('Este pedido ficou sem pagamento') : T('Falta só o pagamento');
        $('oText').textContent = pending ? T('Assim que o pagamento for confirmado, seu vídeo começa a ser gerado. Pode deixar esta página aberta.') : returnStatus === 'canceled' ? T('O pagamento foi cancelado. Você pode tentar de novo quando quiser.') : T('Pague com Pix ou cartão pelo Mercado Pago. O vídeo começa a ser gerado assim que o pagamento for aprovado.');
        actions(`<button class="btn primary big" id="payBtn" type="button">${Site.esc(T('Pagar {price}', { price: Site.fmtMoney(o.priceCents, o.currency) }))}</button><a class="btn ghost big" href="${P('create')}">${Site.esc(T('Voltar e editar'))}</a>`);
        $('payBtn').addEventListener('click', pay);
        waiting(pending ? T('Aguardando a confirmação do pagamento') : T('Aguardando pagamento'));
        break;
      }
      case 'paid':
        track('queue', 0);
        $('oTitle').textContent = T('Pagamento confirmado!');
        $('oText').textContent = q.position > 1 ? T('Seu vídeo está na fila ({n}º). Ele começa em instantes.', { n: q.position }) : T('Seu vídeo vai começar a ser gerado agora.');
        actions('');
        waiting(T('Na fila para gerar'));
        break;
      case 'rendering': {
        track('render', 1);
        const pct = Math.round((q.p || 0) * 100);
        const eta = q.eta ? (q.eta > 90 ? T('cerca de {n} min', { n: Math.round(q.eta / 60) }) : T('cerca de {n} s', { n: q.eta })) : '';
        $('oTitle').textContent = T('Gerando seu vídeo…');
        $('oText').textContent = `${pct}%${eta ? ` · ${eta}` : ''}. ${T('Pode fechar esta página: o vídeo fica salvo em Meus vídeos.')}`;
        $('prog').hidden = false; $('bar').style.width = `${Math.max(3, pct)}%`;
        actions('');
        waiting(pct ? T('Gerando · {n}%', { n: pct }) : T('Preparando'));
        break;
      }
      case 'ready':
        track(null, 3);
        if (o.hasVideo) {
          $('oTitle').textContent = T('Seu vídeo está pronto!');
          $('oText').textContent = T('Baixe o MP4 e poste nos Reels, no TikTok ou no Status do WhatsApp.');
          const dl = `/api/orders/${o.id}/video?download=1&v=${o.version}`;
          actions(`<a class="btn primary big" href="${dl}" download><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>${Site.esc(T('Baixar vídeo'))}${o.fileSize ? ` (${Site.fmtMB(o.fileSize)})` : ''}</a>`
            + (o.hasCover ? `<a class="btn big" href="/api/orders/${o.id}/cover?download=1&v=${o.version}" download>${Site.esc(T('Baixar capa (JPG)'))}</a>` : '')
            + (o.canRevise ? `<a class="btn big" href="${P('create')}?revisar=${o.id}">${Site.esc(T('Corrigir texto ({n} grátis)', { n: o.editsLeft }))}</a>` : '')
            + `<a class="btn ghost big" href="${P('create')}">${Site.esc(T('Criar outro vídeo'))}</a>`);
          if (shownVideo !== o.version) {
            shownVideo = o.version;
            const v = $('oVideo');
            v.poster = o.hasPoster ? `/api/orders/${o.id}/poster?v=${o.version}` : '';
            v.src = `/api/orders/${o.id}/video?v=${o.version}`;
            v.hidden = false; $('oPoster').hidden = true; $('oWaiting').hidden = true;
          }
        } else {
          $('oTitle').textContent = T('O arquivo deste vídeo expirou');
          $('oText').textContent = T('Os vídeos ficam disponíveis por um tempo depois de prontos. Fale com o suporte se precisar dele de novo.');
          actions(support() + `<a class="btn ghost big" href="${P('create')}">${Site.esc(T('Criar outro vídeo'))}</a>`);
          waiting(T('Arquivo expirado'));
        }
        break;
      case 'failed':
        track('render', 1);
        $('oTitle').textContent = T('Tivemos um problema ao gerar');
        $('oText').textContent = T('Seu pagamento está confirmado e nada se perdeu. Nossa equipe já foi avisada e vai refazer o vídeo; se preferir, fale com o suporte.');
        actions(support());
        waiting(T('Refazendo em breve'));
        break;
      case 'refunded':
        track(null, -1);
        $('oTitle').textContent = T('Pedido reembolsado');
        $('oText').textContent = T('O valor foi devolvido. O prazo para aparecer depende do seu banco ou cartão.');
        actions(`<a class="btn primary big" href="${P('create')}">${Site.esc(T('Criar um vídeo'))}</a>`);
        waiting(T('Reembolsado'));
        break;
      default:
        $('oTitle').textContent = o.statusLabel || o.status;
    }
  }

  async function pay() {
    const b = $('payBtn'); b.disabled = true; b.textContent = T('Abrindo o pagamento…');
    try { const r = await Site.api(`/api/orders/${id}/checkout`, { method: 'POST', body: {} }); location.href = r.url; }
    catch (e) { $('oMsg').textContent = e.message; $('oMsg').className = 'msg err'; b.disabled = false; b.textContent = T('Tentar de novo'); }
  }

  const delay = (s) => ({ awaiting_payment: 4000, expired: 15000, paid: 2500, rendering: 2000 }[s] || 0);
  async function refresh() {
    clearTimeout(timer);
    try {
      const p = new URLSearchParams();
      if (returnPayment) p.set('payment_id', returnPayment);
      if (returnSession) p.set('session_id', returnSession);
      const r = await Site.api(`/api/orders/${id}${p.toString() ? `?${p}` : ''}`);
      returnPayment = null; returnSession = null;
      const prev = current && current.status;
      render(r.order);
      if (prev && prev !== 'ready' && r.order.status === 'ready' && r.order.hasVideo) Site.toast(T('Seu vídeo ficou pronto!'));
      $('oMsg').textContent = ''; $('oMsg').className = 'msg';
    } catch (e) {
      if (e.status === 401) {
        try { await Site.ensureLogin({ title: T('Entre para ver seu pedido'), sub: T('Use a mesma conta da compra.'), mode: 'login' }); return refresh(); }
        catch { location.href = `${P('signin')}?volta=${encodeURIComponent(location.pathname)}`; return; }
      }
      if (e.status === 404) { $('oTitle').textContent = T('Pedido não encontrado'); $('oText').textContent = T('Confira se você entrou com a mesma conta usada na compra.'); waiting(T('Não encontrado')); return; }
      $('oMsg').textContent = e.message; $('oMsg').className = 'msg err';
      timer = setTimeout(refresh, 6000); return;
    }
    const d = delay(current.status);
    if (d) timer = setTimeout(refresh, document.hidden ? d * 3 : d);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current && delay(current.status)) refresh(); });

  if (!id) { $('oTitle').textContent = T('Pedido não encontrado'); return; }
  Site.config().then((c) => { cfg = c; });
  refresh();
})();
