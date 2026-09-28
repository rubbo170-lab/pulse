// Pedidos (1 pedido = 1 vídeo): criação, pagamento (Mercado Pago em reais, Stripe em dólar), estado para a tela e arquivos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config, paymentsReady, priceFor, currencyFor, providerFor, DURATIONS, LANGS } from './config.js';
import { q, tx, now, logEvent } from './db.js';
import { fail } from './http.js';
import { PATHS } from './paths.js';
import * as MP from './mercadopago.js';
import * as ST from './stripe.js';

export const UPLOADS = path.join(config.dataDir, 'uploads');
export const VIDEOS = path.join(config.dataDir, 'videos');
fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });

const MAX_OPEN_UNPAID = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024, MAX_IMAGE_SIDE = 3000;
const MIN_FREE_BYTES = 400 * 1024 * 1024;

const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newOrderId() {
  const b = crypto.randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
}
const validId = (id) => /^[a-z0-9]{16}$/.test(String(id || ''));

// largura/altura lidas do cabeçalho do arquivo, sem decodificar a imagem
function imageSize(buf, png) {
  if (png) return buf.length > 24 ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

// imagens chegam como data URL (o navegador já reduz para no máx. 1400 px); aceitamos só PNG e JPEG de verdade
export function decodeImage(dataUrl) {
  if (dataUrl == null || dataUrl === '') return null;
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) fail(400, 'Imagem inválida. Use PNG ou JPG.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) fail(413, 'Imagem grande demais (máx. 3 MB).');
  const isPng = buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
  const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!(isPng || isJpg)) fail(400, 'Imagem inválida. Use PNG ou JPG.');
  const size = imageSize(buf, isPng);
  if (!size || !size.w || !size.h || size.w > MAX_IMAGE_SIDE || size.h > MAX_IMAGE_SIDE) fail(400, 'Imagem inválida. Use PNG ou JPG.');
  return { buf, ext: isPng ? 'png' : 'jpg' };
}

export function imagePath(orderId, kind) {
  for (const ext of ['png', 'jpg']) { const p = path.join(UPLOADS, orderId, `${kind}.${ext}`); if (fs.existsSync(p)) return p; }
  return null;
}
const imagesPresent = (o) => (!o.has_logo || !!imagePath(o.id, 'logo')) && (!o.has_photo || !!imagePath(o.id, 'photo'));

function storeImages(orderId, images) {
  const dir = path.join(UPLOADS, orderId);
  fs.mkdirSync(dir, { recursive: true });
  for (const kind of ['logo', 'photo']) {
    const img = images[kind];
    if (img) fs.writeFileSync(path.join(dir, `${kind}.${img.ext}`), img.buf);
  }
}

export function freeBytes() {
  try { const s = fs.statfsSync(config.dataDir); return s.bavail * s.bsize; } catch { return Infinity; }
}

export const videoPath = (order, v = order.version) => path.join(VIDEOS, `${order.id}-v${v}.mp4`);
export const posterPath = (order, v = order.version) => path.join(VIDEOS, `${order.id}-v${v}.jpg`);
export const coverPath = (order, v = order.version) => path.join(VIDEOS, `${order.id}-v${v}-cover.jpg`);
export const orderUrl = (order) => `${config.appUrl}${(PATHS[order.lang] || PATHS.pt).order}/${order.id}`;

export function createOrder(user, spec, images, { lang = 'pt', duration = 15 } = {}) {
  if (!LANGS.includes(lang)) lang = 'pt';
  if (!DURATIONS.includes(duration)) duration = 15;
  if (freeBytes() < MIN_FREE_BYTES) { logEvent('disk.low', { detail: `${Math.round(freeBytes() / 1e6)} MB livres` }); fail(503, 'Estamos com muita demanda agora. Tente de novo em alguns minutos.'); }
  const currency = currencyFor(lang), id = newOrderId(), t = now();
  spec.lang = lang; spec.duration = duration;
  tx(() => {
    q(`INSERT INTO orders (id, user_id, status, brand, spec, has_logo, has_photo, price_cents, edits_left, lang, currency, provider, duration, created_at, updated_at)
       VALUES (?, ?, 'awaiting_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, user.id, spec.brand.name, JSON.stringify(spec), images.logo ? 1 : 0, images.photo ? 1 : 0, priceFor(currency, duration), config.editsIncluded, lang, currency, providerFor(currency), duration, t, t);
  });
  storeImages(id, images);
  // cada conta mantém no máximo alguns pedidos abertos sem pagamento; os mais antigos expiram e liberam espaço
  const stale = q(`SELECT id FROM orders WHERE user_id = ? AND status = 'awaiting_payment' ORDER BY created_at DESC LIMIT -1 OFFSET ?`).all(user.id, MAX_OPEN_UNPAID);
  for (const s of stale) expireUnpaid(s.id);
  logEvent('order.created', { orderId: id, userId: user.id, detail: `${lang} ${currency} ${duration}s` });
  return getOrder(id);
}

function expireUnpaid(id) {
  const changed = q(`UPDATE orders SET status = 'expired', expired_at = ?, updated_at = ? WHERE id = ? AND status = 'awaiting_payment'`).run(now(), now(), id).changes;
  if (changed) fs.rmSync(path.join(UPLOADS, id), { recursive: true, force: true });
}

export function getOrder(id) { return validId(id) ? q('SELECT * FROM orders WHERE id = ?').get(id) || null : null; }

// dono (ou admin) — para qualquer outra pessoa o pedido "não existe"
export function orderFor(id, user, admin = false) {
  const o = getOrder(id);
  if (!o || (!admin && o.user_id !== user.id)) fail(404, 'Pedido não encontrado.');
  return o;
}

export const STATUS_LABEL = { awaiting_payment: 'Aguardando pagamento', paid: 'Na fila', rendering: 'Gerando o vídeo', ready: 'Pronto', failed: 'Falhou', refunded: 'Reembolsado', expired: 'Expirado' };

export function publicOrder(o, extra = {}) {
  const hasVideo = o.status === 'ready' && fs.existsSync(videoPath(o));
  return {
    id: o.id, status: o.status, statusLabel: STATUS_LABEL[o.status] || o.status, brand: o.brand, priceCents: o.price_cents, currency: o.currency, lang: o.lang, duration: o.duration,
    createdAt: o.created_at, paidAt: o.paid_at, readyAt: o.ready_at, payMethod: o.pay_method, editsLeft: o.edits_left, version: o.version,
    fileSize: hasVideo ? o.file_size : null, hasVideo, hasPoster: o.version > 0 && fs.existsSync(posterPath(o)), hasCover: hasVideo && fs.existsSync(coverPath(o)),
    canRevise: o.status === 'ready' && hasVideo && o.edits_left > 0 && imagesPresent(o),
    expiresAt: o.ready_at ? o.ready_at + config.retentionDays * 864e5 : null,
    ...extra,
  };
}

const TITLE = { pt: (o) => `Vídeo animado ${o.duration} s · ${o.brand}`, en: (o) => `Animated video ${o.duration}s · ${o.brand}`, es: (o) => `Video animado ${o.duration} s · ${o.brand}` };

export async function startCheckout(order, user) {
  if (!paymentsReady(order.currency)) fail(503, 'Pagamentos ainda não configurados. Fale com o suporte.');
  if (order.status !== 'awaiting_payment') fail(409, 'Este pedido já foi pago.');
  if (!imagesPresent(order)) fail(410, 'Este pedido expirou. Crie o vídeo de novo.');
  // o preço vale o da hora do pagamento (se mudou, a página de pagamento antiga não serve mais)
  const price = priceFor(order.currency, order.duration);
  if (price !== order.price_cents) { q('UPDATE orders SET price_cents = ?, checkout_url = NULL, updated_at = ? WHERE id = ?').run(price, now(), order.id); order = getOrder(order.id); }
  const maxAge = order.provider === 'stripe' ? 20 * 3600e3 : 2 * 864e5;
  if (order.checkout_url && order.checkout_created_at > now() - maxAge) return order.checkout_url;
  const title = (TITLE[order.lang] || TITLE.pt)(order).slice(0, 120);
  let ref;
  if (order.provider === 'stripe') {
    const url = orderUrl(order);
    ref = await ST.createCheckout({ order, user, title, successUrl: url, cancelUrl: url, locale: order.lang === 'es' ? 'es' : 'en' });
  } else {
    ref = await MP.createPreference({ order, user, title, backUrl: orderUrl(order) });
  }
  q('UPDATE orders SET mp_preference_id = ?, checkout_url = ?, checkout_created_at = ?, updated_at = ? WHERE id = ?').run(ref.id, ref.url, now(), now(), order.id);
  logEvent('checkout.created', { orderId: order.id, userId: user.id, detail: `${order.provider} ${ref.id}` });
  return ref.url;
}

function recordPayment({ provider, id, orderId, status, detail, amount, currency, method, email }) {
  q(`INSERT INTO payments (mp_payment_id, order_id, status, status_detail, amount_cents, method, payer_email, provider, currency, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(mp_payment_id) DO UPDATE SET status = excluded.status, status_detail = excluded.status_detail, amount_cents = excluded.amount_cents, updated_at = excluded.updated_at
     WHERE payments.refunded_at IS NULL`)
    .run(String(id), orderId, String(status || ''), String(detail || ''), amount, method, String(email || ''), provider, currency, now());
}

// alerta registrado uma vez só por pagamento (o mesmo pagamento é conferido pelo aviso, pelo retorno e pela rotina)
function logOnce(kind, order, key, detail) {
  if (q('SELECT 1 FROM events WHERE kind = ? AND order_id = ? AND detail LIKE ?').get(kind, order.id, `%${key}%`)) return;
  logEvent(kind, { orderId: order.id, userId: order.user_id, detail });
}

// marca o pedido como pago (idempotente; só sai de "aguardando" ou "expirado")
function markPaid(order, { paymentId, method, source, amount }) {
  const changed = tx(() => q(`UPDATE orders SET status = 'paid', mp_payment_id = ?, pay_method = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status IN ('awaiting_payment', 'expired')`)
    .run(String(paymentId), method, now(), now(), order.id).changes);
  if (changed) { logEvent('order.paid', { orderId: order.id, userId: order.user_id, detail: `${source} pay=${paymentId} ${method} ${amount}` }); return changed; }
  const cur = getOrder(order.id);
  if ((cur.mp_payment_id && String(cur.mp_payment_id) !== String(paymentId)) || (!cur.mp_payment_id && cur.pay_method === 'manual')) {
    // o cliente pagou duas vezes (ou pagou um pedido liberado à mão): fica registrado para o admin devolver
    const seen = q(`SELECT 1 FROM events WHERE kind = 'payment.duplicate' AND order_id = ? AND detail LIKE ?`).get(order.id, `%pay=${paymentId} %`);
    if (!seen) logEvent('payment.duplicate', { orderId: order.id, userId: order.user_id, detail: `${source} pay=${paymentId} ${method} ${amount}` });
  }
  return changed;
}

function markRefunded(order, paymentId, source, what) {
  if (String(order.mp_payment_id) !== String(paymentId)) return;
  const changed = q(`UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ? AND status != 'refunded'`).run(now(), order.id).changes;
  if (changed) logEvent('order.refunded', { orderId: order.id, detail: `${source} ${what}` });
}

// ── Mercado Pago: pagamento lido da API (webhook, retorno do checkout e conferência periódica)
export function applyMpPayment(p, source) {
  const order = getOrder(String(p && p.external_reference || ''));
  if (!order || order.provider !== 'mercadopago') { logEvent('payment.unknown_order', { detail: `${source} mp=${p && p.id} ref=${p && p.external_reference}` }); return null; }
  const amount = Math.round(Number(p.transaction_amount || 0) * 100);
  const method = p.payment_method_id === 'pix' ? 'pix' : p.payment_type_id || p.payment_method_id || '';
  recordPayment({ provider: 'mercadopago', id: p.id, orderId: order.id, status: p.status, detail: p.status_detail, amount, currency: p.currency_id, method, email: p.payer && p.payer.email });
  if (p.status === 'approved') {
    if (p.live_mode === false && !config.mp.sandbox) { logOnce('payment.mismatch', order, `mp=${p.id} `, `${source} mp=${p.id} pagamento de teste em produção`); return getOrder(order.id); }
    if (p.currency_id !== 'BRL' || amount < order.price_cents) { logOnce('payment.mismatch', order, `mp=${p.id} `, `${source} mp=${p.id} ${p.currency_id} ${amount} < ${order.price_cents}`); return getOrder(order.id); }
    markPaid(order, { paymentId: p.id, method, source, amount });
  } else if (p.status === 'refunded' || p.status === 'charged_back') markRefunded(order, p.id, source, p.status);
  return getOrder(order.id);
}

export async function confirmMpPaymentId(paymentId, source) {
  if (!/^\d{1,20}$/.test(String(paymentId || ''))) return null;
  const known = q('SELECT status FROM payments WHERE mp_payment_id = ?').get(String(paymentId));
  if (known && ['refunded', 'charged_back'].includes(known.status)) return null; // já final
  return applyMpPayment(await MP.getPayment(paymentId), source);
}

// ── Stripe: sessão de checkout lida da API
export function applyStripeSession(sn, source) {
  const order = getOrder(String((sn && (sn.client_reference_id || (sn.metadata && sn.metadata.order_id))) || ''));
  if (!order || order.provider !== 'stripe') { logEvent('payment.unknown_order', { detail: `${source} stripe=${sn && sn.id}` }); return null; }
  const pi = typeof sn.payment_intent === 'string' ? sn.payment_intent : sn.payment_intent && sn.payment_intent.id;
  const amount = Number(sn.amount_total || 0);
  if (pi) recordPayment({ provider: 'stripe', id: pi, orderId: order.id, status: sn.payment_status, detail: sn.status, amount, currency: String(sn.currency || '').toUpperCase(), method: 'card', email: sn.customer_details && sn.customer_details.email });
  if (sn.payment_status === 'paid' && pi) {
    if (sn.livemode === false && !config.stripe.key.startsWith('sk_test_')) { logOnce('payment.mismatch', order, ` ${sn.id} `, `${source} ${sn.id} pagamento de teste em produção`); return getOrder(order.id); }
    if (String(sn.currency).toLowerCase() !== 'usd' || amount < order.price_cents) { logOnce('payment.mismatch', order, ` ${sn.id} `, `${source} ${sn.id} ${sn.currency} ${amount} < ${order.price_cents}`); return getOrder(order.id); }
    markPaid(order, { paymentId: pi, method: 'card', source, amount });
  }
  return getOrder(order.id);
}

export function applyStripeRefund(charge, source) {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent && charge.payment_intent.id;
  if (!pi || !charge.refunded) return;
  q(`UPDATE payments SET status = 'refunded', refunded_at = ?, updated_at = ? WHERE mp_payment_id = ?`).run(now(), now(), pi);
  const order = q('SELECT * FROM orders WHERE mp_payment_id = ?').get(pi);
  if (order) markRefunded(order, pi, source, 'charge.refunded');
}

// retorno do cliente vindo do checkout (?payment_id=… do Mercado Pago ou ?session_id=… do Stripe)
export async function confirmReturn(order, { paymentId, sessionId }) {
  if (order.provider === 'stripe' && sessionId && /^cs_[\w]{8,200}$/.test(sessionId)) {
    const sn = await ST.getSession(sessionId);
    if (sn.client_reference_id === order.id) applyStripeSession(sn, 'retorno');
  } else if (order.provider === 'mercadopago' && paymentId) {
    const p = await MP.getPayment(String(paymentId)).catch(() => null);
    if (p && String(p.external_reference) === order.id) applyMpPayment(p, 'retorno');
  }
  return getOrder(order.id);
}

// conferência ativa (cobre aviso perdido ou atrasado)
export async function reconcile(order, source = 'consulta') {
  if (!['awaiting_payment', 'expired'].includes(order.status) || !order.mp_preference_id || !paymentsReady(order.currency)) return order;
  q('UPDATE orders SET last_check_at = ? WHERE id = ?').run(now(), order.id);
  if (order.provider === 'stripe') {
    const sn = await ST.getSession(order.mp_preference_id);
    if (sn.client_reference_id === order.id) applyStripeSession(sn, source);
  } else {
    const list = await MP.searchPayments(order.id);
    for (const p of list.filter((x) => String(x.external_reference) === order.id)) applyMpPayment(p, source);
  }
  return getOrder(order.id);
}

// devolve um pagamento específico (o do pedido, ou uma cobrança em dobro)
export async function refund(order, paymentId) {
  const pay = q('SELECT * FROM payments WHERE mp_payment_id = ? AND order_id = ?').get(String(paymentId), order.id);
  const provider = pay ? pay.provider : order.provider;
  if (provider === 'stripe') await ST.refundPayment(String(paymentId)); else await MP.refundPayment(String(paymentId));
  q(`UPDATE payments SET status = 'refunded', refunded_at = ?, updated_at = ? WHERE mp_payment_id = ?`).run(now(), now(), String(paymentId));
  if (String(order.mp_payment_id) === String(paymentId)) q(`UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?`).run(now(), order.id);
}

export function deleteOrderFiles(order, { keepVersion = null } = {}) {
  for (const f of fs.readdirSync(VIDEOS)) {
    if (!f.startsWith(order.id + '-v')) continue;
    if (keepVersion != null && [`${order.id}-v${keepVersion}.mp4`, `${order.id}-v${keepVersion}.jpg`, `${order.id}-v${keepVersion}-cover.jpg`].includes(f)) continue;
    try { fs.unlinkSync(path.join(VIDEOS, f)); } catch { /* já apagado */ }
  }
}
