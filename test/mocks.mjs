// Serviços falsos para teste local: Mercado Pago (preferência, checkout, pagamentos, reembolso, aviso assinado),
// Stripe (Checkout Session, página de pagamento, reembolso, webhook assinado) e Anthropic.
import http from 'node:http';
import crypto from 'node:crypto';

// "a[b][0][c]=v" (formulário da API do Stripe) → objeto aninhado
function unform(text) {
  const out = {};
  for (const [key, val] of new URLSearchParams(text)) {
    const parts = key.replace(/\]/g, '').split('[');
    let o = out;
    parts.forEach((k, i) => {
      if (i === parts.length - 1) { o[k] = val; return; }
      if (o[k] == null) o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      o = o[k];
    });
  }
  return out;
}

// stripeTaxSupported=false imita a conta do Pulso (Brasil): o Stripe recusa automatic_tax
export function startMocks({ port = 0, webhookSecret = 'segredo-teste', stripeWebhookSecret = 'whsec_teste', stripeTaxSupported = false, aiReply } = {}) {
  const prefs = new Map(), payments = new Map(), sessions = new Map(), refunds = [];
  let seq = 1000, stripeWebhookUrl = null;
  const log = [];
  const read = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c).toString('utf8'))); });
  const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

  async function notify(pref, pay) {
    if (!pref.notification_url) return;
    const requestId = crypto.randomUUID(), ts = String(Date.now());
    const manifest = `id:${pay.id};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
    const url = `${pref.notification_url}${pref.notification_url.includes('?') ? '&' : '?'}data.id=${pay.id}&type=payment`;
    try { await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId }, body: JSON.stringify({ action: 'payment.updated', type: 'payment', data: { id: String(pay.id) } }) }); } catch { /* servidor fora */ }
  }

  function makePayment(pref, { status = 'approved', amount, method = 'pix' } = {}) {
    const id = ++seq;
    const pay = { id, status, status_detail: status === 'approved' ? 'accredited' : 'pending_waiting_transfer', external_reference: pref.external_reference, transaction_amount: amount ?? pref.items[0].unit_price, currency_id: 'BRL', payment_method_id: method, payment_type_id: method === 'pix' ? 'bank_transfer' : 'credit_card', payer: { email: (pref.payer && pref.payer.email) || 'comprador@teste.com' }, date_created: new Date().toISOString(), live_mode: true };
    payments.set(String(id), pay);
    return pay;
  }

  // Stripe: evento assinado como o Stripe faz (t=…,v1=HMAC("t.corpo"))
  async function stripeEvent(type, object, { secret = stripeWebhookSecret, url = stripeWebhookUrl } = {}) {
    if (!url) return null;
    const body = JSON.stringify({ id: 'evt_' + crypto.randomBytes(8).toString('hex'), object: 'event', type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object } });
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` }, body }); return r.status; } catch { return 0; }
  }
  function payStripe(sn, { amount } = {}) {
    sn.payment_status = 'paid'; sn.status = 'complete';
    sn.payment_intent = 'pi_' + crypto.randomBytes(10).toString('hex');
    if (amount != null) sn.amount_total = amount;
    sn.customer_details = { email: sn.customer_email || 'buyer@test.com' };
    return sn;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    log.push(`${req.method} ${p}`);
    // ── Anthropic
    if (req.method === 'POST' && p === '/v1/messages') {
      const body = JSON.parse(await read(req) || '{}');
      if (!req.headers['x-api-key'] || req.headers['anthropic-version'] !== '2023-06-01') return send(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'bad key' } });
      if (!body.model || !Array.isArray(body.messages)) return send(res, 400, { type: 'error', error: { message: 'bad request' } });
      const sys = String(body.system || '');
      const lang = /US English/.test(sys) ? 'en' : /Español/.test(sys) ? 'es' : 'pt';
      const SCRIPTS = {
        pt: { hook: ['CAFÉ', 'QUE ABRAÇA'], pain: 'Café ruim estraga seu dia?', search: 'cafeteria perto de mim', product: 'Cappuccino da casa', benefitsTitle: 'Por que a gente?', benefits: [{ text: 'Grãos torrados na semana', icon: 'coffee' }, { text: 'Pão de queijo quentinho', icon: 'heart' }, { text: 'Pedido pelo WhatsApp', icon: 'chat' }], showcaseTitle: 'Nosso cardápio', stepsTitle: 'Como pedir', steps: [{ text: 'Escolha seu café', icon: 'coffee' }, { text: 'Chame no WhatsApp', icon: 'chat' }, { text: 'Retire quentinho', icon: 'heart' }], tagline: 'Seu café, do jeito certo.', cta: 'Peça pelo WhatsApp' },
        en: { hook: ['COFFEE', 'THAT HUGS'], pain: 'Bad coffee ruining your day?', search: 'coffee shop near me', product: 'House cappuccino', benefitsTitle: 'Why us?', benefits: [{ text: 'Beans roasted weekly', icon: 'coffee' }, { text: 'Fresh pastries daily', icon: 'heart' }, { text: 'Order by text', icon: 'chat' }], showcaseTitle: 'Our menu', stepsTitle: 'How to order', steps: [{ text: 'Pick your coffee', icon: 'coffee' }, { text: 'Send us a text', icon: 'chat' }, { text: 'Grab it hot', icon: 'heart' }], tagline: 'Your coffee, done right.', cta: 'Order by text' },
        es: { hook: ['CAFÉ', 'QUE ABRAZA'], pain: '¿Un mal café arruina tu día?', search: 'cafetería cerca de mí', product: 'Capuchino de la casa', benefitsTitle: '¿Por qué nosotros?', benefits: [{ text: 'Granos tostados cada semana', icon: 'coffee' }, { text: 'Pan dulce recién hecho', icon: 'heart' }, { text: 'Pide por WhatsApp', icon: 'chat' }], showcaseTitle: 'Nuestro menú', stepsTitle: 'Cómo pedir', steps: [{ text: 'Elige tu café', icon: 'coffee' }, { text: 'Pide por WhatsApp', icon: 'chat' }, { text: 'Retíralo calentito', icon: 'heart' }], tagline: 'Tu café, como debe ser.', cta: 'Pide por WhatsApp' },
      };
      log.push(`ai:${lang}`);
      const txt = aiReply ? aiReply(body) : JSON.stringify(SCRIPTS[lang]);
      return send(res, 200, { id: 'msg_test', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: 'Aqui está:\n' + txt }], stop_reason: 'end_turn', usage: { input_tokens: 420, output_tokens: 180 } });
    }
    let m;
    // ── Stripe API (form-urlencoded, chave sk_test_)
    if (p.startsWith('/v1/checkout/') || p === '/v1/refunds') {
      if (!/^Bearer (sk|rk)_test_\w+/.test(req.headers.authorization || '')) return send(res, 401, { error: { type: 'invalid_request_error', message: 'Invalid API Key provided' } });
      if (req.method === 'POST' && p === '/v1/checkout/sessions') {
        if (!/application\/x-www-form-urlencoded/.test(req.headers['content-type'] || '')) return send(res, 400, { error: { message: 'form expected' } });
        const b = unform(await read(req));
        const li = b.line_items && b.line_items[0];
        if (b.mode !== 'payment' || !li || !li.price_data || !(Number(li.price_data.unit_amount) > 0) || !b.success_url || !b.client_reference_id) return send(res, 400, { error: { message: 'invalid session params' } });
        if (b.automatic_tax && b.automatic_tax.enabled === 'true' && !stripeTaxSupported) { log.push('stripe:tax-refused'); return send(res, 400, { error: { type: 'invalid_request_error', message: 'Stripe Tax is not supported for your account country. See the full list of countries supported in: https://stripe.com/docs/tax/supported-countries' } }); }
        const id = 'cs_test_' + crypto.randomBytes(12).toString('hex');
        const base = `http://127.0.0.1:${server.address().port}`;
        const sn = { id, object: 'checkout.session', mode: 'payment', status: 'open', payment_status: 'unpaid', livemode: false, currency: li.price_data.currency, amount_total: Number(li.price_data.unit_amount) * Number(li.quantity || 1),
          client_reference_id: b.client_reference_id, metadata: b.metadata || {}, customer_email: b.customer_email, locale: b.locale, success_url: b.success_url, cancel_url: b.cancel_url, expires_at: Number(b.expires_at), url: `${base}/stripe/checkout/${id}`,
          product_name: li.price_data.product_data && li.price_data.product_data.name, payment_intent: null, idempotency: req.headers['idempotency-key'] || null, stripe_version: req.headers['stripe-version'] || null,
          integration_identifier: b.integration_identifier || null, invoice_creation: b.invoice_creation || null, automatic_tax: b.automatic_tax || null, payment_method_types: b.payment_method_types || null,
          origin_context: b.origin_context || null, branding_settings: b.branding_settings || null, tax_id_collection: b.tax_id_collection || null, tax_behavior: li.price_data.tax_behavior || null, tax_code: (li.price_data.product_data && li.price_data.product_data.tax_code) || null };
        sessions.set(id, sn);
        return send(res, 200, sn);
      }
      if (req.method === 'GET' && (m = /^\/v1\/checkout\/sessions\/([\w]+)$/.exec(p))) { const sn = sessions.get(m[1]); return sn ? send(res, 200, sn) : send(res, 404, { error: { message: 'No such checkout.session' } }); }
      if (req.method === 'POST' && p === '/v1/refunds') {
        const b = unform(await read(req));
        const sn = [...sessions.values()].find((x) => x.payment_intent && x.payment_intent === b.payment_intent);
        if (!sn) return send(res, 404, { error: { message: 'No such payment_intent' } });
        if (sn.refunded) return send(res, 400, { error: { message: 'Charge has already been refunded.' } });
        sn.refunded = true;
        const rf = { id: 're_' + crypto.randomBytes(8).toString('hex'), object: 'refund', payment_intent: b.payment_intent, amount: sn.amount_total, status: 'succeeded' };
        refunds.push(rf);
        return send(res, 200, rf);
      }
      return send(res, 404, { error: { message: 'not found' } });
    }
    // ── página de pagamento falsa do Stripe
    if (req.method === 'GET' && (m = /^\/stripe\/checkout\/(\w+)$/.exec(p))) {
      const sn = sessions.get(m[1]);
      if (!sn) { res.writeHead(404); return res.end('session not found'); }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta charset=utf-8><title>Stripe (test)</title><body style="font-family:sans-serif;padding:30px"><h1>Stripe Checkout · TEST</h1><p id="line">${sn.product_name} — ${(sn.amount_total / 100).toFixed(2)} ${String(sn.currency).toUpperCase()} · locale ${sn.locale}</p>
        <form method="post" action="/stripe/pay/${sn.id}"><button id="stripePay">Pay</button></form><p><a id="stripeCancel" href="${sn.cancel_url}">Back</a></p></body>`);
    }
    if (req.method === 'POST' && (m = /^\/stripe\/pay\/(\w+)$/.exec(p))) {
      const sn = sessions.get(m[1]);
      if (!sn) { res.writeHead(404); return res.end(); }
      payStripe(sn);
      await stripeEvent('checkout.session.completed', sn);
      res.writeHead(303, { location: sn.success_url.replace('{CHECKOUT_SESSION_ID}', sn.id) }); return res.end();
    }
    // ── Mercado Pago API
    if (req.headers.authorization !== undefined && !/^Bearer .+/.test(req.headers.authorization)) return send(res, 401, { message: 'unauthorized' });
    if (req.method === 'POST' && p === '/checkout/preferences') {
      const body = JSON.parse(await read(req) || '{}');
      if (!body.external_reference || !body.items || !body.items[0] || !(body.items[0].unit_price > 0)) return send(res, 400, { message: 'invalid preference' });
      const id = `pref-${++seq}`;
      prefs.set(id, body);
      const base = `http://127.0.0.1:${server.address().port}`;
      return send(res, 201, { id, init_point: `${base}/mp/checkout/${id}`, sandbox_init_point: `${base}/mp/checkout/${id}?sandbox=1` });
    }
    if (req.method === 'GET' && (m = /^\/v1\/payments\/(\d+)$/.exec(p))) { const pay = payments.get(m[1]); return pay ? send(res, 200, pay) : send(res, 404, { message: 'Payment not found' }); }
    if (req.method === 'GET' && p === '/v1/payments/search') { const ref = url.searchParams.get('external_reference'); return send(res, 200, { results: [...payments.values()].filter((x) => x.external_reference === ref).reverse(), paging: {} }); }
    if (req.method === 'POST' && (m = /^\/v1\/payments\/(\d+)\/refunds$/.exec(p))) { const pay = payments.get(m[1]); if (!pay) return send(res, 404, { message: 'not found' }); pay.status = 'refunded'; return send(res, 201, { id: ++seq, payment_id: pay.id, status: 'approved' }); }
    // ── página de checkout falsa (o que o cliente veria no Mercado Pago)
    if (req.method === 'GET' && (m = /^\/mp\/checkout\/([\w-]+)$/.exec(p))) {
      const pref = prefs.get(m[1]);
      if (!pref) { res.writeHead(404); return res.end('preferência não encontrada'); }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta charset=utf-8><title>Mercado Pago (teste)</title><body style="font-family:sans-serif;padding:30px"><h1>Mercado Pago · TESTE</h1><p>${pref.items[0].title} — R$ ${pref.items[0].unit_price.toFixed(2)}</p>
        <form method="post" action="/mp/pay/${m[1]}"><button id="approve" name="r" value="approved">Pagar com Pix (aprovar)</button> <button id="pending" name="r" value="pending">Gerar Pix e não pagar</button></form></body>`);
    }
    if (req.method === 'POST' && (m = /^\/mp\/pay\/([\w-]+)$/.exec(p))) {
      const pref = prefs.get(m[1]); const r = new URLSearchParams(await read(req)).get('r') || 'approved';
      const pay = makePayment(pref, { status: r });
      await notify(pref, pay);
      const back = r === 'approved' ? pref.back_urls.success : pref.back_urls.pending;
      const q = new URLSearchParams({ collection_id: pay.id, collection_status: pay.status, payment_id: pay.id, status: pay.status, external_reference: pref.external_reference, payment_type: pay.payment_type_id, merchant_order_id: String(pay.id + 7), preference_id: m[1], site_id: 'MLB' });
      res.writeHead(302, { location: `${back}?${q}` }); return res.end();
    }
    send(res, 404, { message: 'not found' });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}`, server, prefs, payments, log, makePayment, notify, webhookSecret,
    sessions, refunds, stripeWebhookSecret, stripeEvent, payStripe, setStripeWebhook: (u) => { stripeWebhookUrl = u; },
    close: () => server.close(),
  })));
}
