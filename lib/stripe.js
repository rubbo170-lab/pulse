// Stripe (dólar): Checkout Session por vídeo, consulta, reembolso e assinatura do webhook. Sem SDK.
import crypto from 'node:crypto';
import { config } from './config.js';

// transforma objetos aninhados no formato de formulário da API do Stripe: a[b][0][c]=v
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? form(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(method, path, params, idempotencyKey) {
  const headers = { Authorization: `Bearer ${config.stripe.key}`, 'Stripe-Version': '2024-06-20' };
  let body;
  if (params && method !== 'GET') { body = form(params).toString(); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const qs = params && method === 'GET' ? `?${form(params)}` : '';
  const res = await fetch(`${config.stripe.apiBase}${path}${qs}`, { method, headers, body, signal: AbortSignal.timeout(20_000) });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`Stripe HTTP ${res.status}: ${(data && data.error && data.error.message) || 'erro'}`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export async function createCheckout({ order, user, title, successUrl, cancelUrl, locale }) {
  const s = await stripe('POST', '/v1/checkout/sessions', {
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: order.price_cents, product_data: { name: title } } }],
    customer_email: user.email,
    client_reference_id: order.id,
    metadata: { order_id: order.id },
    payment_intent_data: { metadata: { order_id: order.id } },
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${cancelUrl}?canceled=1`,
    locale,
    expires_at: Math.floor(Date.now() / 1000) + 23 * 3600,
  }, `cs-${order.id}-${Date.now()}`);
  return { id: s.id, url: s.url };
}

export const getSession = (id) => stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(id)}`);
export const refundPayment = (paymentIntentId) => stripe('POST', '/v1/refunds', { payment_intent: paymentIntentId }, `refund-${paymentIntentId}`);

// Stripe-Signature: t=<unix>,v1=<hex>[,v1=...]; assina "<t>.<corpo bruto>" com o segredo do endpoint
export function verifyWebhook(raw, header, secret = config.stripe.webhookSecret, toleranceS = 300) {
  if (!secret) return false;
  let t = null; const sigs = [];
  for (const part of String(header || '').split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') t = v; else if (k === 'v1' && /^[0-9a-f]{64}$/i.test(v || '')) sigs.push(v.toLowerCase());
  }
  if (!t || !sigs.length || !/^\d+$/.test(t) || Math.abs(Date.now() / 1000 - Number(t)) > toleranceS) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw.toString('utf8')}`).digest();
  return sigs.some((s) => crypto.timingSafeEqual(expected, Buffer.from(s, 'hex')));
}
