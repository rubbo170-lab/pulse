// Pulso — servidor. Sem dependências: node server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT, paymentsReady, aiReady, currencyFor, priceFor, LANGS, DURATIONS } from './lib/config.js';
import { db, q, tx, now, logEvent } from './lib/db.js';
import { createRouter, json, readJson, readBody, fail, HttpError, sendFile, safeJoin, securityHeaders, clientIp, redirect } from './lib/http.js';
import * as Auth from './lib/auth.js';
import { limit, hit } from './lib/ratelimit.js';
import { cleanSpec, specProblems, sameBrand, cleanBrief, line, isExampleBrand, stripExampleContact } from './lib/spec.js';
import { writeScript } from './lib/ai.js';
import * as Orders from './lib/orders.js';
import { verifySignature } from './lib/mercadopago.js';
import * as ST from './lib/stripe.js';
import { renderPage, apiText, clientScript } from './lib/i18n.js';
import { saveBrand, getBrand, forgetBrand, brandLogoPath } from './lib/brand.js';
import { PATHS, PAGE_FILES, resolvePage, langOfPath } from './lib/paths.js';
import { startWorker, queueInfo, nudge, cleanupFiles } from './lib/render/worker.js';

const PUBLIC = path.join(ROOT, 'public');
const api = createRouter();
const DAY = 864e5;
const langOf = (req, fallback = 'pt') => { const l = String(req.headers['x-lang'] || '').slice(0, 2); return LANGS.includes(l) ? l : fallback; };

// ── configuração pública (o site lê preço, contato e o que está ligado)
api.get('/api/health', (req, res) => json(res, 200, { ok: true }));
api.get('/api/config', (req, res, { query }) => {
  const lang = LANGS.includes(query.get('lang')) ? query.get('lang') : 'pt', currency = currencyFor(lang);
  json(res, 200, {
    brand: config.brandName, lang, currency, prices: Object.fromEntries(DURATIONS.map((d) => [d, priceFor(currency, d)])), durations: DURATIONS,
    editsIncluded: config.editsIncluded, retentionDays: config.retentionDays, paymentsEnabled: paymentsReady(currency), aiEnabled: aiReady(),
    company: { name: config.company.name, doc: config.company.doc, email: config.company.email, whatsapp: config.company.whatsapp, city: config.company.city },
  });
});

// ── contas
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
api.get('/api/me', (req, res) => json(res, 200, { user: Auth.publicUser(Auth.currentUser(req)) }));

api.post('/api/auth/signup', async (req, res) => {
  const ip = clientIp(req);
  limit(`signup:${ip}`, 8, 3600e3, 'Muitos cadastros seguidos deste endereço. Tente mais tarde.');
  const b = await readJson(req);
  const name = line(b.name, 60), email = line(b.email, 254).toLowerCase(), phone = line(b.phone, 24), password = String(b.password || '');
  const lang = LANGS.includes(b.lang) ? b.lang : langOf(req);
  if (name.length < 2) fail(400, 'Digite seu nome.');
  if (!EMAIL_RE.test(email)) fail(400, 'Digite um e-mail válido.');
  if (password.length < 8) fail(400, 'A senha precisa ter pelo menos 8 caracteres.');
  if (password.length > 200) fail(400, 'Senha longa demais.');
  if (b.accept !== true) fail(400, 'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.');
  if (q('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'Já existe uma conta com esse e-mail. Entre com sua senha.');
  const hash = await Auth.hashPassword(password);
  let id;
  try { id = Number(q('INSERT INTO users (email, name, phone, pass_hash, created_at, lang) VALUES (?, ?, ?, ?, ?, ?)').run(email, name, phone, hash, now(), lang).lastInsertRowid); }
  catch (e) { if (/UNIQUE/.test(e.message)) fail(409, 'Já existe uma conta com esse e-mail. Entre com sua senha.'); throw e; }
  Auth.startSession(res, id);
  logEvent('user.signup', { userId: id, detail: lang });
  json(res, 201, { user: Auth.publicUser(q('SELECT * FROM users WHERE id = ?').get(id)) });
});

api.post('/api/auth/login', async (req, res) => {
  const ip = clientIp(req);
  const b = await readJson(req);
  const email = line(b.email, 254).toLowerCase(), password = String(b.password || '');
  limit(`login-ip:${ip}`, 30, 15 * 60e3);
  limit(`login-email:${email}`, 8, 15 * 60e3, 'Muitas tentativas para este e-mail. Espere 15 minutos.');
  const u = email && q('SELECT * FROM users WHERE email = ?').get(email);
  if (!u) { await Auth.burnPasswordTime(password); fail(401, 'E-mail ou senha incorretos.'); }
  if (!(await Auth.verifyPassword(password, u.pass_hash))) fail(401, 'E-mail ou senha incorretos.');
  Auth.startSession(res, u.id);
  json(res, 200, { user: Auth.publicUser(u) });
});

api.post('/api/auth/logout', async (req, res) => { Auth.endSession(req, res); json(res, 200, { ok: true }); });

api.post('/api/auth/reset', async (req, res) => {
  limit(`reset:${clientIp(req)}`, 10, 15 * 60e3);
  const b = await readJson(req);
  const token = String(b.token || ''), password = String(b.password || '');
  if (password.length < 8 || password.length > 200) fail(400, 'A senha precisa ter pelo menos 8 caracteres.');
  const row = token.length < 100 && q('SELECT * FROM reset_tokens WHERE token_hash = ?').get(Auth.sha256(token));
  if (!row || row.used_at || row.expires_at < now()) fail(400, 'Este link não vale mais. Peça um novo ao suporte.');
  const hash = await Auth.hashPassword(password);
  const ok = tx(() => {
    // só um uso, mesmo com dois envios ao mesmo tempo
    if (!q('UPDATE reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').run(now(), row.token_hash).changes) return false;
    q('UPDATE users SET pass_hash = ? WHERE id = ?').run(hash, row.user_id);
    q('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    return true;
  });
  if (!ok) fail(400, 'Este link não vale mais. Peça um novo ao suporte.');
  Auth.startSession(res, row.user_id);
  logEvent('user.password_reset', { userId: row.user_id });
  json(res, 200, { user: Auth.publicUser(q('SELECT * FROM users WHERE id = ?').get(row.user_id)) });
});

// ── roteiro com IA (chave do dono, com limites por pessoa e por dia)
api.post('/api/ai/script', async (req, res) => {
  if (!aiReady()) fail(503, 'A IA não está configurada.');
  const user = Auth.currentUser(req), ip = clientIp(req);
  const b = await readJson(req, 8 * 1024);
  const brief = cleanBrief(b.brief);
  if (!brief.name) fail(400, 'Preencha pelo menos o nome da empresa.');
  limit(`ai:${user ? 'u' + user.id : ip}`, 4, 60e3, 'Espere alguns segundos antes de pedir outro roteiro.');
  const dayAgo = now() - DAY;
  // reserva a vaga antes de chamar a IA (pedidos simultâneos não furam o limite)
  const callId = tx(() => {
    if (q('SELECT COUNT(*) AS n FROM ai_calls WHERE at > ?').get(dayAgo).n >= config.ai.dailyCap) fail(429, 'A IA atingiu o limite do dia. Use o roteiro automático ou tente amanhã.');
    if (user) { if (q('SELECT COUNT(*) AS n FROM ai_calls WHERE user_id = ? AND at > ?').get(user.id, dayAgo).n >= config.ai.perUserDay) fail(429, 'Você usou a IA muitas vezes hoje. Ajuste os textos à mão ou tente amanhã.'); }
    else if (q('SELECT COUNT(*) AS n FROM ai_calls WHERE ip = ? AND user_id IS NULL AND at > ?').get(ip, dayAgo).n >= config.ai.perIpDay) fail(429, 'Crie sua conta para usar mais a IA hoje.', { needLogin: true });
    return Number(q('INSERT INTO ai_calls (at, user_id, ip, ok) VALUES (?, ?, ?, 0)').run(now(), user ? user.id : null, ip).lastInsertRowid);
  });
  try {
    const { script, usage } = await writeScript(brief);
    q('UPDATE ai_calls SET ok = 1, in_tokens = ?, out_tokens = ? WHERE id = ?').run(usage.input_tokens || null, usage.output_tokens || null, callId);
    json(res, 200, { script });
  } catch (e) {
    console.error('[pulso] IA falhou:', e.message);
    fail(502, 'A IA não respondeu agora. Apliquei o roteiro automático.');
  }
});

// ── minha marca
api.get('/api/brand', (req, res) => {
  const user = Auth.requireUser(req);
  json(res, 200, { brand: getBrand(user.id) });
});
api.get('/api/brand/logo', (req, res) => {
  const user = Auth.requireUser(req);
  const f = brandLogoPath(user.id);
  if (!f || !sendFile(req, res, f, { cache: 'private, no-cache' })) fail(404, 'Imagem não encontrada.');
});
api.del('/api/brand', (req, res) => {
  const user = Auth.requireUser(req);
  forgetBrand(user.id);
  json(res, 200, { ok: true });
});

// ── pedidos
function orderView(o) {
  return Orders.publicOrder(o, { queue: queueInfo(o), checkoutReady: o.status === 'awaiting_payment' && paymentsReady(o.currency) });
}

api.post('/api/orders', async (req, res) => {
  const user = Auth.requireUser(req);
  limit(`order:${user.id}`, 30, DAY, 'Você criou muitos pedidos hoje. Fale com o suporte se precisar de mais.');
  const b = await readJson(req, 16 * 1024 * 1024);
  const lang = LANGS.includes(b.lang) ? b.lang : langOf(req);
  const duration = DURATIONS.includes(Number(b.duration)) ? Number(b.duration) : 15;
  // os dados da empresa fictícia do exemplo nunca vão para o vídeo de um cliente; só o dono pode usá-los (vídeos de demonstração)
  const demo = Auth.isAdmin(user);
  const spec = demo ? cleanSpec(b.spec) : stripExampleContact(cleanSpec(b.spec));
  const problems = specProblems(spec);
  if (problems.length) fail(400, problems[0]);
  if (!demo && isExampleBrand(spec.brand.name)) fail(400, 'Troque o exemplo pelos dados da sua empresa antes de comprar.');
  const images = { logo: Orders.decodeImage(b.logo), photo: Orders.decodeImage(b.photo), gallery: (Array.isArray(b.gallery) ? b.gallery : []).slice(0, 3).map(Orders.decodeImage).filter(Boolean) };
  const order = Orders.createOrder(user, spec, images, { lang, duration });
  // a identidade deste pedido vira a "minha marca" do cliente (próximo vídeo começa igual)
  if (!isExampleBrand(spec.brand.name)) {
    try { saveBrand(user.id, spec, b.brief && typeof b.brief === 'object' ? b.brief : {}, images.logo); } catch (e) { console.error('[pulso] não salvei a marca:', e.message); }
  }
  let checkoutUrl = null, checkoutError = null;
  try { checkoutUrl = await Orders.startCheckout(order, user); }
  catch (e) { checkoutError = apiText(e instanceof HttpError ? e.message : 'Não consegui abrir o pagamento agora. Tente de novo em instantes.', langOf(req)); console.error('[pulso] checkout falhou:', e.message); }
  json(res, 201, { order: orderView(Orders.getOrder(order.id)), checkoutUrl, checkoutError });
});

api.get('/api/orders', async (req, res) => {
  const user = Auth.requireUser(req);
  const rows = q(`SELECT * FROM orders WHERE user_id = ? AND NOT (status IN ('awaiting_payment', 'expired') AND created_at < ?) ORDER BY created_at DESC LIMIT 100`).all(user.id, now() - 30 * DAY);
  json(res, 200, { orders: rows.map(orderView) });
});

api.get('/api/orders/:id', async (req, res, { params, query }) => {
  const user = Auth.requireUser(req);
  let o = Orders.orderFor(params.id, user, Auth.isAdmin(user));
  if (o.status === 'awaiting_payment' || o.status === 'expired') {
    try {
      const paymentId = query.get('payment_id') || query.get('collection_id'), sessionId = query.get('session_id');
      if ((paymentId || sessionId) && hit(`confirm:${o.id}`, 6, 60e3).ok) o = await Orders.confirmReturn(o, { paymentId, sessionId });
      const recent = o.checkout_created_at && o.checkout_created_at > now() - 8 * DAY;
      if (['awaiting_payment', 'expired'].includes(o.status) && recent && (!o.last_check_at || o.last_check_at < now() - 12e3)) o = await Orders.reconcile(o, 'consulta');
    } catch (e) { console.error('[pulso] conferência de pagamento falhou:', e.message); }
    if (o.status === 'paid') nudge();
  }
  json(res, 200, { order: orderView(o) });
});

api.get('/api/orders/:id/spec', async (req, res, { params }) => {
  const user = Auth.requireUser(req);
  const o = Orders.orderFor(params.id, user, Auth.isAdmin(user));
  json(res, 200, { spec: JSON.parse(o.spec), hasLogo: !!Orders.imagePath(o.id, 'logo'), hasPhoto: !!Orders.imagePath(o.id, 'photo'), galleryCount: Orders.galleryCount(o), order: orderView(o) });
});

api.get('/api/orders/:id/image/:kind', async (req, res, { params }) => {
  const user = Auth.requireUser(req);
  const o = Orders.orderFor(params.id, user, Auth.isAdmin(user));
  const f = Orders.imagePath(o.id, params.kind);
  if (!f || !sendFile(req, res, f, { cache: 'private, max-age=600' })) fail(404, 'Imagem não encontrada.');
});

api.post('/api/orders/:id/checkout', async (req, res, { params }) => {
  const user = Auth.requireUser(req);
  let o = Orders.orderFor(params.id, user);
  if (o.status === 'expired') {
    if (o.created_at < now() - 7 * DAY) fail(410, 'Este pedido expirou. Crie o vídeo de novo.');
    q(`UPDATE orders SET status = 'awaiting_payment', checkout_url = NULL, updated_at = ? WHERE id = ? AND status = 'expired'`).run(now(), o.id);
    o = Orders.getOrder(o.id);
  }
  const url = await Orders.startCheckout(o, user);
  json(res, 200, { url });
});

api.post('/api/orders/:id/revise', async (req, res, { params }) => {
  const user = Auth.requireUser(req);
  const o = Orders.orderFor(params.id, user);
  if (o.status !== 'ready') fail(409, 'Só dá para corrigir um vídeo que já está pronto.');
  if (o.edits_left <= 0) fail(409, 'A correção grátis deste vídeo já foi usada.');
  if (!Orders.publicOrder(o).canRevise) fail(410, 'Este vídeo expirou e não pode mais ser corrigido.');
  const b = await readJson(req, 64 * 1024);
  const spec = Auth.isAdmin(user) ? cleanSpec(b.spec) : stripExampleContact(cleanSpec(b.spec));
  const problems = specProblems(spec);
  if (problems.length) fail(400, problems[0]);
  if (!sameBrand(spec.brand.name, o.brand)) fail(400, 'Na correção, o nome da empresa continua “{brand}”.', { vars: { brand: o.brand } });
  // nome, idioma, duração e as fotos guardadas ficam os do pedido pago
  spec.brand.name = o.brand; spec.lang = o.lang; spec.duration = o.duration; spec.media = { gallery: Orders.galleryCount(o) };
  const changed = tx(() => q(`UPDATE orders SET spec = ?, edits_left = edits_left - 1, status = 'paid', render_attempts = 0, render_after = 0, render_error = NULL, updated_at = ?
                              WHERE id = ? AND status = 'ready' AND edits_left > 0`).run(JSON.stringify(spec), now(), o.id).changes);
  if (!changed) fail(409, 'Não deu para aplicar a correção. Atualize a página.');
  logEvent('order.revised', { orderId: o.id, userId: user.id });
  // a correção (ex.: um WhatsApp digitado errado) também vale para a marca salva
  if (!isExampleBrand(spec.brand.name)) { try { saveBrand(user.id, spec, null, null); } catch (e) { console.error('[pulso] não atualizei a marca:', e.message); } }
  nudge();
  json(res, 200, { order: orderView(Orders.getOrder(o.id)) });
});

const slug = (s) => String(s || 'video').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'video';
api.get('/api/orders/:id/video', async (req, res, { params, query }) => {
  const user = Auth.requireUser(req);
  const o = Orders.orderFor(params.id, user, Auth.isAdmin(user));
  if (o.status !== 'ready') fail(404, 'O vídeo ainda não está pronto.');
  const name = `${slug(config.brandName)}-${slug(o.brand)}${o.version > 1 ? `-v${o.version}` : ''}.mp4`;
  if (!sendFile(req, res, Orders.videoPath(o), { cache: 'private, max-age=3600', download: query.get('download') ? name : null })) fail(410, 'Este arquivo expirou. Fale com o suporte.');
  if (query.get('download') && req.method === 'GET' && !req.headers.range) logEvent('video.download', { orderId: o.id, userId: user.id });
});

const COVER_NAME = { pt: 'capa', en: 'cover', es: 'portada' };
api.get('/api/orders/:id/cover', async (req, res, { params, query }) => {
  const user = Auth.requireUser(req);
  const o = Orders.orderFor(params.id, user, Auth.isAdmin(user));
  if (o.status !== 'ready') fail(404, 'O vídeo ainda não está pronto.');
  const name = `${slug(config.brandName)}-${slug(o.brand)}-${COVER_NAME[o.lang] || 'capa'}.jpg`;
  if (!sendFile(req, res, Orders.coverPath(o), { cache: 'private, max-age=3600', download: query.get('download') ? name : null })) fail(404, 'Sem imagem.');
});

api.get('/api/orders/:id/poster', async (req, res, { params }) => {
  const user = Auth.requireUser(req);
  const o = Orders.orderFor(params.id, user, Auth.isAdmin(user));
  if (!sendFile(req, res, Orders.posterPath(o), { cache: 'private, max-age=3600' })) fail(404, 'Sem imagem.');
});

// ── avisos de pagamento
let badSigs = 0;
setInterval(() => { if (badSigs) { logEvent('webhook.bad_signature', { detail: `${badSigs} avisos recusados no último minuto` }); badSigs = 0; } }, 60e3).unref();

api.post('/api/webhooks/mercadopago', async (req, res, { query }) => {
  const ip = clientIp(req);
  if (!hit(`wh-ip:${ip}`, 120, 60e3).ok || !hit('wh-all', 600, 60e3).ok) return json(res, 429, { ok: false });
  const raw = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0));
  let body = {};
  try { body = JSON.parse(raw.toString('utf8') || '{}'); } catch { /* corpo vazio no formato antigo */ }
  const type = query.get('type') || query.get('topic') || body.type || body.topic || '';
  const dataId = String(query.get('data.id') || query.get('id') || (body.data && body.data.id) || '');
  const sig = req.headers['x-signature'];
  if (config.mp.webhookSecret && (sig || config.mp.requireSignature)) {
    const v = verifySignature({ signature: sig, requestId: req.headers['x-request-id'], dataId });
    if (!v.ok) { badSigs++; return json(res, 401, { ok: false }); }
  }
  json(res, 200, { ok: true });
  if (!/payment/.test(String(type)) || !/^\d{1,20}$/.test(dataId)) return;
  if (!hit(`wh:${dataId}`, 20, 60e3).ok) return;
  try { const o = await Orders.confirmMpPaymentId(dataId, 'webhook'); if (o && o.status === 'paid') nudge(); }
  catch (e) { console.error('[pulso] webhook MP: falha ao consultar pagamento', dataId, e.message); }
});

api.post('/api/webhooks/stripe', async (req, res) => {
  if (!hit(`wh-ip:${clientIp(req)}`, 120, 60e3).ok) return json(res, 429, { ok: false });
  const raw = await readBody(req, 512 * 1024);
  if (!ST.verifyWebhook(raw, req.headers['stripe-signature'])) { badSigs++; return json(res, 400, { error: 'assinatura inválida' }); }
  let ev;
  try { ev = JSON.parse(raw.toString('utf8')); } catch { return json(res, 400, { error: 'json' }); }
  json(res, 200, { received: true });
  const obj = ev.data && ev.data.object;
  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(ev.type) && obj && obj.id) {
      // relê a sessão direto na API do Stripe antes de liberar
      const o = Orders.applyStripeSession(await ST.getSession(obj.id), 'webhook');
      if (o && o.status === 'paid') nudge();
    } else if (ev.type === 'checkout.session.async_payment_failed' && obj && obj.id) {
      // pagamento que confirma depois (ex.: débito em conta nos EUA) e falhou: o pedido continua aguardando pagamento
      Orders.applyStripeSession(await ST.getSession(obj.id), 'webhook');
      logEvent('payment.failed', { orderId: obj.client_reference_id || null, detail: `stripe ${obj.id} async_payment_failed` });
    } else if (ev.type === 'charge.refunded' && obj) Orders.applyStripeRefund(obj, 'webhook');
  } catch (e) { console.error('[pulso] webhook Stripe:', ev.type, e.message); }
});

// ── administração (e-mail em ADMIN_EMAILS + confirmação com ADMIN_TOKEN)
api.post('/api/admin/claim', async (req, res) => {
  const user = Auth.requireUser(req);
  limit(`claim:${user.id}`, 5, 15 * 60e3);
  const b = await readJson(req);
  if (!Auth.claimAdmin(user, b.token)) fail(403, 'Código incorreto.');
  logEvent('admin.claimed', { userId: user.id });
  json(res, 200, { user: Auth.publicUser(user) });
});

api.get('/api/admin/summary', async (req, res) => {
  Auth.requireAdmin(req);
  const t = now(), since = (d) => t - d * DAY;
  const sales = (from) => {
    const rows = q(`SELECT currency, COUNT(*) AS n, COALESCE(SUM(price_cents), 0) AS cents FROM orders WHERE paid_at IS NOT NULL AND status != 'refunded' AND COALESCE(pay_method, '') != 'manual' AND paid_at > ? GROUP BY currency`).all(from);
    const out = { n: 0, BRL: 0, USD: 0 };
    for (const r of rows) { out.n += r.n; out[r.currency] = r.cents; }
    return out;
  };
  const byStatus = Object.fromEntries(q('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all().map((r) => [r.status, r.n]));
  const render = q(`SELECT COUNT(*) AS n, AVG(render_ms) AS avg FROM orders WHERE render_ms IS NOT NULL AND ready_at > ?`).get(since(30));
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  json(res, 200, {
    today: sales(midnight.getTime()), d7: sales(since(7)), d30: sales(since(30)), all: sales(0), byStatus,
    byLang: Object.fromEntries(q(`SELECT lang, COUNT(*) AS n FROM orders WHERE paid_at IS NOT NULL GROUP BY lang`).all().map((r) => [r.lang, r.n])),
    users: q('SELECT COUNT(*) AS n FROM users').get().n, usersD7: q('SELECT COUNT(*) AS n FROM users WHERE created_at > ?').get(since(7)).n,
    renderAvgMs: render.avg ? Math.round(render.avg) : null, aiToday: q('SELECT COUNT(*) AS n FROM ai_calls WHERE at > ?').get(since(1)).n,
    freeMB: Math.round(Math.min(Orders.freeBytes(), 1e15) / 1e6),
    alerts: q(`SELECT kind, order_id, detail, at FROM events WHERE kind IN ('payment.duplicate', 'payment.mismatch', 'render.failed', 'webhook.bad_signature', 'disk.low') AND at > ? ORDER BY at DESC LIMIT 20`).all(since(14)),
    config: { paymentsBRL: paymentsReady('BRL'), paymentsUSD: paymentsReady('USD'), stripeWebhook: !!config.stripe.webhookSecret, stripeTest: ST.isTestKey(), stripeInvoices: config.stripe.invoices, stripeTax: ST.taxStatus(),aiEnabled: aiReady(), webhookSecret: !!config.mp.webhookSecret, sandbox: config.mp.sandbox, prices: config.prices, appUrl: config.appUrl, fps: config.render.fps },
  });
});

api.get('/api/admin/orders', async (req, res, { query }) => {
  Auth.requireAdmin(req);
  const status = query.get('status') || '', term = line(query.get('q'), 80), page = Math.max(0, Number(query.get('page')) || 0);
  const where = [], args = [];
  if (status) { where.push('o.status = ?'); args.push(status); }
  if (term) { where.push('(o.id = ? OR o.brand LIKE ? OR u.email LIKE ? OR o.mp_payment_id = ?)'); args.push(term, `%${term}%`, `%${term}%`, term); }
  const rows = db.prepare(`SELECT o.*, u.email AS user_email, u.name AS user_name, u.phone AS user_phone FROM orders o JOIN users u ON u.id = o.user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.created_at DESC LIMIT 50 OFFSET ?`).all(...args, page * 50);
  json(res, 200, { orders: rows.map((o) => ({ ...orderView(o), userEmail: o.user_email, userName: o.user_name, userPhone: o.user_phone, mpPaymentId: o.mp_payment_id, provider: o.provider, renderMs: o.render_ms, renderError: o.render_error, attempts: o.render_attempts })) });
});

api.get('/api/admin/orders/:id', async (req, res, { params }) => {
  Auth.requireAdmin(req);
  const o = Orders.getOrder(params.id);
  if (!o) fail(404, 'Pedido não encontrado.');
  json(res, 200, {
    order: { ...orderView(o), spec: JSON.parse(o.spec), mpPaymentId: o.mp_payment_id, provider: o.provider, renderError: o.render_error, attempts: o.render_attempts, renderMs: o.render_ms },
    user: Auth.publicUser(q('SELECT * FROM users WHERE id = ?').get(o.user_id)),
    payments: q('SELECT * FROM payments WHERE order_id = ? ORDER BY updated_at DESC').all(o.id),
    events: q('SELECT at, kind, detail FROM events WHERE order_id = ? ORDER BY at DESC LIMIT 60').all(o.id),
  });
});

api.post('/api/admin/orders/:id/rerender', async (req, res, { params }) => {
  const admin = Auth.requireAdmin(req);
  const o = Orders.getOrder(params.id);
  if (!o) fail(404, 'Pedido não encontrado.');
  if (!['ready', 'failed'].includes(o.status)) fail(409, 'Só dá para refazer vídeos prontos ou que falharam.');
  q(`UPDATE orders SET status = 'paid', render_attempts = 0, render_after = 0, render_error = NULL, updated_at = ? WHERE id = ?`).run(now(), o.id);
  logEvent('admin.rerender', { orderId: o.id, userId: admin.id });
  nudge();
  json(res, 200, { ok: true });
});

api.post('/api/admin/orders/:id/mark-paid', async (req, res, { params }) => {
  const admin = Auth.requireAdmin(req);
  const o = Orders.getOrder(params.id);
  if (!o) fail(404, 'Pedido não encontrado.');
  const changed = q(`UPDATE orders SET status = 'paid', pay_method = 'manual', paid_at = ?, updated_at = ? WHERE id = ? AND status IN ('awaiting_payment', 'expired')`).run(now(), now(), o.id).changes;
  if (!changed) fail(409, 'Este pedido não está aguardando pagamento.');
  logEvent('admin.mark_paid', { orderId: o.id, userId: admin.id });
  nudge();
  json(res, 200, { ok: true });
});

// devolve o pagamento do pedido (o cliente perde o vídeo) ou uma cobrança específica em dobro (o pedido continua)
api.post('/api/admin/orders/:id/refund', async (req, res, { params }) => {
  const admin = Auth.requireAdmin(req);
  const o = Orders.getOrder(params.id);
  if (!o) fail(404, 'Pedido não encontrado.');
  const b = await readJson(req).catch(() => ({}));
  const paymentId = String(b.paymentId || o.mp_payment_id || '');
  if (!paymentId) {
    if (o.status === 'refunded') fail(409, 'Este pedido já foi reembolsado.');
    q(`UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?`).run(now(), o.id);
    logEvent('admin.refund', { orderId: o.id, userId: admin.id, detail: 'sem pagamento registrado' });
    return json(res, 200, { ok: true });
  }
  const pay = q('SELECT * FROM payments WHERE mp_payment_id = ? AND order_id = ?').get(paymentId, o.id);
  if (!pay && paymentId !== String(o.mp_payment_id)) fail(404, 'Pagamento não encontrado neste pedido.');
  if (pay && pay.refunded_at) fail(409, 'Este pagamento já foi devolvido.');
  try { await Orders.refund(o, paymentId); }
  catch (e) { fail(502, `O provedor de pagamento recusou o reembolso: ${e.message}`); }
  logEvent('admin.refund', { orderId: o.id, userId: admin.id, detail: `${o.provider} ${paymentId}${paymentId === String(o.mp_payment_id) ? '' : ' (cobrança extra)'}` });
  json(res, 200, { ok: true });
});

api.get('/api/admin/users', async (req, res, { query }) => {
  Auth.requireAdmin(req);
  const term = line(query.get('q'), 80);
  const rows = q(`SELECT u.id, u.name, u.email, u.phone, u.lang, u.created_at, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL) AS paid
                  FROM users u WHERE (? = '' OR u.email LIKE ? OR u.name LIKE ?) ORDER BY u.created_at DESC LIMIT 100`).all(term, `%${term}%`, `%${term}%`);
  json(res, 200, { users: rows });
});

api.post('/api/admin/users/:id/reset-link', async (req, res, { params }) => {
  const admin = Auth.requireAdmin(req);
  const u = q('SELECT * FROM users WHERE id = ?').get(Number(params.id));
  if (!u) fail(404, 'Conta não encontrada.');
  const token = Auth.createResetToken(u.id);
  logEvent('admin.reset_link', { userId: admin.id, detail: `para ${u.id}` });
  json(res, 200, { url: `${config.appUrl}${(PATHS[u.lang] || PATHS.pt).reset}#${token}`, expiresInHours: 24 });
});

api.get('/api/admin/backup', async (req, res) => {
  Auth.requireAdmin(req);
  const file = path.join(config.dataDir, 'tmp', `backup-${Date.now()}.db`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  res.on('close', () => fs.rm(file, { force: true }, () => {}));
  sendFile(req, res, file, { cache: 'no-store', download: `pulso-backup-${new Date().toISOString().slice(0, 10)}.db` });
});

// ── páginas
function servePage(req, res, file, lang, opts = {}, status = 200) {
  const html = renderPage(file, lang, opts);
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Language': { pt: 'pt-BR', en: 'en', es: 'es' }[lang] });
  res.end(req.method === 'HEAD' ? undefined : html);
}
const canonicalHost = (() => { try { return new URL(config.appUrl).host; } catch { return ''; } })();

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  const p = url.pathname;
  try {
    // endereço provisório (ex.: …up.railway.app) redireciona para o domínio oficial, para o login e o pagamento funcionarem
    if (config.isProd && canonicalHost && req.headers.host && req.headers.host !== canonicalHost && (req.method === 'GET' || req.method === 'HEAD') && !p.startsWith('/api/')) {
      return redirect(res, config.appUrl + req.url, 301);
    }
    if (p.startsWith('/api/')) {
      // pedidos que mudam estado só do próprio site (os avisos de pagamento vêm do Mercado Pago e do Stripe)
      if (req.method !== 'GET' && req.method !== 'HEAD' && !p.startsWith('/api/webhooks/')) {
        const origin = req.headers.origin;
        if (origin && origin !== config.appUrl && !(!config.isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) fail(403, 'Origem não permitida.');
      }
      const m = api.match(req.method, p);
      if (!m) fail(404, 'Não encontrado.');
      if (m.notAllowed) fail(405, 'Método não permitido.');
      await m.handler(req, res, { params: m.params, query: url.searchParams });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const i18nJs = /^\/i18n\/(pt|en|es)\.js$/.exec(p);
    if (i18nJs) { const body = clientScript(i18nJs[1]); res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(req.method === 'HEAD' ? undefined : body); }
    if (p === '/admin') return servePage(req, res, 'admin.html', 'pt');
    const page = resolvePage(p);
    if (page) return servePage(req, res, PAGE_FILES[page.page], page.lang, { page: page.page, id: page.id });
    if (p.endsWith('.html')) return redirect(res, p.replace(/(index)?\.html$/, '') || '/', 301);
    const f = safeJoin(PUBLIC, p);
    if (f && !path.basename(f).startsWith('.') && sendFile(req, res, f, { cache: /\/(fonts|media)\//.test(p) ? 'public, max-age=604800' : 'public, max-age=600' })) return;
    servePage(req, res, '404.html', langOfPath(p), {}, 404);
  } catch (e) {
    if (res.headersSent) { res.destroy(); return; }
    if (e instanceof HttpError) {
      const extra = { ...(e.extra || {}) }, vars = extra.vars || {};
      delete extra.vars;
      const msg = apiText(e.message, langOf(req)).replace(/\{(\w+)\}/g, (m0, k) => (vars[k] != null ? vars[k] : m0));
      return json(res, e.status, { error: msg, ...extra }, extra.retryAfter ? { 'Retry-After': String(extra.retryAfter) } : {});
    }
    console.error('[pulso] erro inesperado', req.method, p, e);
    json(res, 500, { error: apiText('Algo deu errado aqui. Tente de novo em instantes.', langOf(req)) });
  }
});
server.requestTimeout = 120_000;
// atrás do proxy do Railway: manter conexões ociosas por mais tempo que o proxy evita erros 502 intermitentes
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(config.port, async () => {
  console.log(`[pulso] no ar em ${config.appUrl} (porta ${config.port})`);
  const missing = [];
  if (!paymentsReady('BRL')) missing.push('MP_ACCESS_TOKEN (pagamentos em reais)');
  if (!paymentsReady('USD')) missing.push('STRIPE_SECRET_KEY (pagamentos em dólar)');
  if (paymentsReady('USD') && !config.stripe.webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET (aviso do Stripe)');
  if (!aiReady()) missing.push('ANTHROPIC_API_KEY (roteiro com IA; o site usa o roteiro automático)');
  if (!config.admins.length || !config.adminToken) missing.push('ADMIN_EMAILS e ADMIN_TOKEN (painel /admin)');
  if (missing.length) console.log('[pulso] faltando: ' + missing.join('; '));
  if (config.mp.sandbox) console.log('[pulso] Mercado Pago em modo de TESTE');
  await startWorker();
  const housekeeping = () => { try { Auth.cleanupSessions(); cleanupFiles(); } catch (e) { console.error('[pulso] limpeza falhou', e.message); } };
  housekeeping();
  setInterval(housekeeping, 3600e3);
  // conferência periódica de pagamentos recentes (caso algum aviso se perca)
  setInterval(async () => {
    const rows = q(`SELECT * FROM orders WHERE status IN ('awaiting_payment', 'expired') AND mp_preference_id IS NOT NULL AND checkout_created_at > ? AND (last_check_at IS NULL OR last_check_at < ?) ORDER BY checkout_created_at DESC LIMIT 20`).all(now() - 2 * DAY, now() - 5 * 60e3);
    for (const o of rows) {
      if (!paymentsReady(o.currency)) continue;
      try { const r = await Orders.reconcile(o, 'rotina'); if (r.status === 'paid') nudge(); } catch (e) { console.error('[pulso] rotina de pagamento', o.id, e.message); }
    }
  }, 3 * 60e3);
});

process.on('unhandledRejection', (e) => console.error('[pulso] promessa rejeitada sem tratamento:', e && e.message ? e.message : e));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { console.log(`[pulso] ${sig}: encerrando`); server.close(); setTimeout(() => process.exit(0), 1500).unref(); });
