'use strict';
// Painel do dono (em português): vendas por moeda, pedidos, clientes, reembolsos.
(() => {
  const $ = (id) => document.getElementById(id), E = Site.esc, M = Site.fmtMoney;
  const CHIP = { awaiting_payment: 'warn', paid: 'run', rendering: 'run', ready: 'ok', failed: 'err', refunded: '', expired: '' };
  const KIND = {
    'payment.duplicate': 'Cobrança em dobro (devolva a extra)', 'payment.mismatch': 'Pagamento diferente do esperado', 'render.failed': 'Vídeo falhou 3 vezes',
    'webhook.bad_signature': 'Aviso de pagamento com assinatura inválida', 'disk.low': 'Pouco espaço no disco (Volume)',
  };
  const PROVIDER = { mercadopago: 'Mercado Pago', stripe: 'Stripe' };
  const LANG = { pt: 'PT', en: 'EN', es: 'ES' };
  const ORDER_PATH = { pt: '/pedido/', en: '/en/order/', es: '/es/pedido/' };
  let page = 0, qTimer = null;

  // soma de vendas: reais em destaque, dólar embaixo quando houver
  const salesKpi = (label, v) => `<div class="kpi"><small>${label}</small><b>${M(v.BRL || 0, 'BRL')}</b><span>${v.USD ? `+ ${M(v.USD, 'USD')} · ` : ''}${v.n} ${v.n === 1 ? 'vídeo' : 'vídeos'}</span></div>`;

  async function summary() {
    const s = await Site.api('/api/admin/summary');
    const langs = Object.entries(s.byLang || {}).map(([l, n]) => `${LANG[l] || l} ${n}`).join(' · ') || 'nenhum ainda';
    $('kpis').innerHTML = salesKpi('Hoje', s.today) + salesKpi('7 dias', s.d7) + salesKpi('30 dias', s.d30) + salesKpi('Total', s.all)
      + `<div class="kpi"><small>Contas</small><b>${s.users}</b><span>+${s.usersD7} em 7 dias · pagos por idioma: ${E(langs)}</span></div>`
      + `<div class="kpi"><small>Na fila / gerando</small><b>${(s.byStatus.paid || 0) + (s.byStatus.rendering || 0)}</b><span>${s.byStatus.awaiting_payment || 0} aguardando pagamento</span></div>`
      + `<div class="kpi"><small>Tempo de render</small><b>${s.renderAvgMs ? Math.round(s.renderAvgMs / 1000) + ' s' : '—'}</b><span>média de 30 dias</span></div>`
      + `<div class="kpi"><small>Disco livre</small><b>${s.freeMB >= 1e6 ? '—' : (s.freeMB / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' GB'}</b><span>IA hoje: ${s.aiToday} roteiros</span></div>`;
    const c = s.config, chip = (ok, txt, cls) => `<span class="chip ${cls || (ok ? 'ok' : 'err')}">${E(txt)}</span>`;
    const p = c.prices || {};
    $('cfg').innerHTML = chip(c.paymentsBRL, c.paymentsBRL ? 'Reais: Mercado Pago ligado' : 'Reais desligado (MP_ACCESS_TOKEN)')
      + (c.sandbox ? chip(false, c.testOpen ? 'Mercado Pago em modo teste' : 'Mercado Pago em modo teste: só os seus pedidos pagam', 'warn') : '')
      + chip(c.webhookSecret, c.webhookSecret ? 'Aviso do Mercado Pago com assinatura' : 'Sem MP_WEBHOOK_SECRET', c.webhookSecret ? 'ok' : 'warn')
      + chip(c.paymentsUSD, c.paymentsUSD ? 'Dólar: Stripe ligado' : 'Dólar desligado (STRIPE_SECRET_KEY)')
      + (c.paymentsUSD ? chip(c.stripeWebhook, c.stripeWebhook ? 'Aviso do Stripe com assinatura' : 'Falta STRIPE_WEBHOOK_SECRET') : '')
      + (c.paymentsUSD && c.stripeTest ? chip(false, c.testOpen ? 'Stripe em modo teste' : 'Stripe em modo teste: só os seus pedidos pagam (clientes veem "abre em breve")', 'warn') : '')
      + (c.paymentsUSD ? chip(true, `Stripe: ${c.stripeInvoices ? 'fatura por e-mail' : 'sem fatura'} · ${c.stripeTax === 'on' ? 'imposto automático' : 'sem imposto automático'}`) : '')
      + (c.paymentsUSD && c.stripeTax === 'blocked' ? chip(false, 'Stripe recusou o imposto automático (conta sem Stripe Tax): vendas seguem sem ele; deixe STRIPE_TAX=0', 'warn') : '')
      + chip(c.aiEnabled, c.aiEnabled ? 'IA ligada' : 'IA desligada (ANTHROPIC_API_KEY)')
      + (p.BRL ? [15, 20, 30].map((d) => `<span class="chip">${d} s: ${M(p.BRL[d], 'BRL')} · ${M(p.USD[d], 'USD')}</span>`).join('') : '')
      + `<span class="chip">${E(c.appUrl)}</span><span class="chip">${c.fps} fps</span>`;
    $('alerts').innerHTML = (s.alerts || []).map((a) => `<div class="alert"><b>${E(KIND[a.kind] || a.kind)}</b> · ${Site.fmtDate(a.at, true)}${a.order_id ? ` · <button class="link" type="button" data-open="${E(a.order_id)}">pedido ${E(a.order_id)}</button>` : ''}<div class="dim">${E(a.detail || '')}</div></div>`).join('');
  }

  async function orders() {
    const qs = new URLSearchParams({ status: $('fStatus').value, q: $('fQ').value.trim(), page });
    const r = await Site.api('/api/admin/orders?' + qs);
    $('oRows').innerHTML = r.orders.map((o) => `<tr data-open="${o.id}" style="cursor:pointer">
      <td>${Site.fmtDate(o.createdAt, true)}</td><td class="mono">${o.id}</td>
      <td>${E(o.userEmail)}<span class="sub2">${E(o.userName)}${o.userPhone ? ' · ' + E(o.userPhone) : ''}</span></td>
      <td>${E(o.brand)}<span class="sub2">${LANG[o.lang] || ''} · ${o.duration} s</span></td><td><span class="chip ${CHIP[o.status] || ''}">${E(o.statusLabel)}</span></td>
      <td class="num">${M(o.priceCents, o.currency)}</td><td>${o.payMethod ? E(o.payMethod) : '—'}<span class="sub2">${E(PROVIDER[o.provider] || '')}${o.mpPaymentId ? ` <span class="mono">${E(o.mpPaymentId)}</span>` : ''}</span></td>
      <td>${o.renderMs ? Math.round(o.renderMs / 1000) + ' s' : '—'}${o.renderError ? `<span class="sub2" style="color:var(--err)">${E(o.renderError.slice(0, 80))}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Nenhum pedido.</td></tr>';
    $('pgInfo').textContent = `Página ${page + 1}`;
    $('prevPg').disabled = page === 0; $('nextPg').disabled = r.orders.length < 50;
  }

  async function users() {
    const r = await Site.api('/api/admin/users?q=' + encodeURIComponent($('uQ').value.trim()));
    $('uRows').innerHTML = r.users.map((u) => `<tr><td>${Site.fmtDate(u.created_at)}</td><td>${E(u.name)}</td><td>${E(u.email)}</td><td>${E(u.phone || '')}</td><td>${LANG[u.lang] || ''}</td><td class="num">${u.paid}</td>
      <td><button class="btn small" data-reset="${u.id}" type="button">Link de nova senha</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Ninguém encontrado.</td></tr>';
  }

  async function openOrder(id) {
    const d = $('drawer');
    d.hidden = false; d.innerHTML = '<p class="muted">Carregando…</p>';
    let r;
    try { r = await Site.api('/api/admin/orders/' + encodeURIComponent(id)); } catch (e) { d.innerHTML = `<p class="msg err">${E(e.message)}</p>`; return; }
    const o = r.order, prov = PROVIDER[o.provider] || o.provider;
    const act = [];
    if (o.status === 'ready' && o.hasVideo) act.push(`<a class="btn small" href="/api/orders/${o.id}/video?download=1&v=${o.version}">Baixar vídeo</a>`);
    if (['ready', 'failed'].includes(o.status)) act.push('<button class="btn small" data-act="rerender" type="button">Refazer vídeo</button>');
    if (['awaiting_payment', 'expired'].includes(o.status)) act.push('<button class="btn small" data-act="mark-paid" type="button">Marcar como pago (manual)</button>');
    if (o.status !== 'refunded' && o.paidAt) act.push('<button class="btn small danger" data-act="refund" type="button">Reembolsar o pedido</button>');
    // cobranças aprovadas que não são a do pedido (cliente pagou duas vezes) podem ser devolvidas uma a uma
    const extra = (p) => ['approved', 'paid'].includes(p.status) && !p.refunded_at && String(p.mp_payment_id) !== String(o.mpPaymentId);
    const pays = r.payments.map((p) => `<div class="ev"><b>${E(PROVIDER[p.provider] || p.provider || '')} #${E(p.mp_payment_id)}</b> · ${E(p.status)} ${p.status_detail ? '(' + E(p.status_detail) + ')' : ''} · ${M(p.amount_cents || 0, p.currency || o.currency)} · ${E(p.method || '')} · ${E(p.payer_email || '')}
      ${String(p.mp_payment_id) === String(o.mpPaymentId) ? '<span class="chip ok">do pedido</span>' : ''}${p.refunded_at ? `<span class="chip">devolvido ${Site.fmtDate(p.refunded_at, true)}</span>` : ''}
      ${extra(p) ? `<button class="btn small danger" type="button" data-refund-pay="${E(p.mp_payment_id)}">Devolver esta cobrança</button>` : ''}</div>`).join('');
    d.innerHTML = `<div class="bar-row" style="justify-content:space-between"><h2 style="margin:0;font-family:var(--display)">${E(o.brand)}</h2><button class="btn small" id="dClose" type="button">Fechar</button></div>
      <div class="bar-row"><span class="chip ${CHIP[o.status] || ''}">${E(o.statusLabel)}</span><span class="chip mono">${o.id}</span><span class="chip">${LANG[o.lang] || ''} · ${o.duration} s</span><a class="btn small ghost" href="${ORDER_PATH[o.lang] || '/pedido/'}${o.id}" target="_blank" rel="noopener">Página do cliente</a></div>
      <dl class="facts-list"><dt>Cliente</dt><dd>${E(r.user.name)} · ${E(r.user.email)}${r.user.phone ? ' · ' + E(r.user.phone) : ''}</dd>
      <dt>Valor</dt><dd>${M(o.priceCents, o.currency)} · ${E(prov)}</dd><dt>Pagamento</dt><dd>${E(o.payMethod || '—')} ${o.mpPaymentId ? `<span class="mono">#${E(o.mpPaymentId)}</span>` : ''}</dd>
      <dt>Criado</dt><dd>${Site.fmtDate(o.createdAt, true)}</dd>${o.paidAt ? `<dt>Pago</dt><dd>${Site.fmtDate(o.paidAt, true)}</dd>` : ''}${o.readyAt ? `<dt>Pronto</dt><dd>${Site.fmtDate(o.readyAt, true)} · v${o.version}${o.fileSize ? ' · ' + Site.fmtMB(o.fileSize) : ''}</dd>` : ''}
      <dt>Correções</dt><dd>${o.editsLeft} restante(s)</dd>${o.renderError ? `<dt>Erro</dt><dd style="color:var(--err)">${E(o.renderError)}</dd>` : ''}</dl>
      <div class="bar-row">${act.join('')}</div><p class="msg" id="dMsg"></p>
      <h3 style="margin:6px 0 0">Cobranças (${E(prov)})</h3>${pays || '<p class="dim">Nenhuma ainda.</p>'}
      <h3 style="margin:6px 0 0">Histórico</h3>${r.events.map((ev) => `<div class="ev"><b>${E(ev.kind)}</b> · ${Site.fmtDate(ev.at, true)}${ev.detail ? `<div class="dim">${E(ev.detail)}</div>` : ''}</div>`).join('')}
      <h3 style="margin:6px 0 0">Roteiro</h3><pre>${E(JSON.stringify(o.spec, null, 2))}</pre>`;
    $('dClose').addEventListener('click', () => { d.hidden = true; });
    const run = async (b, pathPart, body, ask) => {
      if (!window.confirm(ask)) return;
      b.disabled = true;
      try { await Site.api(`/api/admin/orders/${o.id}/${pathPart}`, { method: 'POST', body }); Site.toast('Feito.'); openOrder(o.id); refresh(); }
      catch (e) { $('dMsg').textContent = e.message; $('dMsg').className = 'msg err'; b.disabled = false; }
    };
    d.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      const ask = {
        refund: `Devolver o dinheiro deste pedido pelo ${prov}? O cliente perde o acesso ao vídeo.`,
        'mark-paid': 'Marcar como pago sem pagamento registrado? O vídeo será gerado.', rerender: 'Gerar o vídeo de novo?',
      }[a];
      run(b, a, {}, ask);
    }));
    d.querySelectorAll('[data-refund-pay]').forEach((b) => b.addEventListener('click', () => run(b, 'refund', { paymentId: b.dataset.refundPay }, `Devolver a cobrança #${b.dataset.refundPay} pelo ${prov}? O pedido e o vídeo continuam com o cliente.`)));
  }

  function refresh() { summary().catch(() => {}); orders().catch((e) => Site.toast(e.message, true)); }

  document.addEventListener('click', async (e) => {
    const open = e.target.closest('[data-open]');
    if (open) { openOrder(open.dataset.open); return; }
    const reset = e.target.closest('[data-reset]');
    if (reset) {
      reset.disabled = true;
      try {
        const r = await Site.api(`/api/admin/users/${reset.dataset.reset}/reset-link`, { method: 'POST', body: {} });
        try { await navigator.clipboard.writeText(r.url); Site.toast('Link copiado. Envie ao cliente; vale por 24 horas.'); }
        catch { window.prompt('Envie este link ao cliente (vale por 24 horas):', r.url); }
      } catch (err) { Site.toast(err.message, true); } finally { reset.disabled = false; }
    }
  });
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $('tabOrders').hidden = b.dataset.tab !== 'orders'; $('tabUsers').hidden = b.dataset.tab !== 'users';
    if (b.dataset.tab === 'users') users().catch((e) => Site.toast(e.message, true));
  }));
  $('fStatus').addEventListener('change', () => { page = 0; orders(); });
  $('fQ').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { page = 0; orders(); }, 300); });
  $('uQ').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(users, 300); });
  $('prevPg').addEventListener('click', () => { page = Math.max(0, page - 1); orders(); });
  $('nextPg').addEventListener('click', () => { page++; orders(); });
  $('refreshBtn').addEventListener('click', refresh);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('drawer').hidden = true; });

  // primeiro acesso: o e-mail está em ADMIN_EMAILS, falta confirmar com o ADMIN_TOKEN
  $('claimForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'), msg = $('claimMsg');
    btn.disabled = true; msg.textContent = ''; msg.className = 'msg';
    try { await Site.api('/api/admin/claim', { method: 'POST', body: { token: $('claimToken').value.trim() } }); location.reload(); }
    catch (err) { msg.textContent = err.message; msg.className = 'msg err'; btn.disabled = false; }
  });

  Site.loadMe().then((u) => {
    if (u && u.adminPending) { $('claim').hidden = false; $('claimToken').focus(); return; }
    if (!u || !u.admin) { $('denied').hidden = false; return; }
    $('admin').hidden = false; refresh();
    setInterval(() => { if (!document.hidden) summary().catch(() => {}); }, 30000);
  });
})();
