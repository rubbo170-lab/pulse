// Mercado Pago (Checkout Pro): Pix e cartão. Nada aqui confia no navegador nem no corpo do webhook:
// todo pagamento é conferido direto na API do Mercado Pago com o token do dono.
import crypto from 'node:crypto';
import { config } from './config.js';

async function mp(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${config.mp.apiBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${config.mp.token}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`Mercado Pago HTTP ${res.status}: ${(data && (data.message || data.error)) || 'erro'}`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export async function createPreference({ order, user, title, backUrl }) {
  const https = config.appUrl.startsWith('https://');
  const back = backUrl;
  const body = {
    items: [{ id: `video-${order.duration}s`, title, description: `Vídeo animado vertical de ${order.duration} s (1080x1920, MP4) com trilha`, quantity: 1, currency_id: 'BRL', unit_price: order.price_cents / 100 }],
    payer: { email: user.email, name: user.name },
    external_reference: order.id,
    metadata: { order_id: order.id },
    back_urls: { success: back, pending: back, failure: back },
    statement_descriptor: config.mp.statement,
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }], installments: 1 },
    expires: true,
    expiration_date_to: new Date(Date.now() + 3 * 864e5).toISOString(),
  };
  // o Mercado Pago só aceita retorno automático e aviso de pagamento em endereço https público
  if (https) { body.auto_return = 'approved'; body.notification_url = `${config.appUrl}/api/webhooks/mercadopago`; }
  const pref = await mp('POST', '/checkout/preferences', body, { 'X-Idempotency-Key': `pref-${order.id}-${Date.now()}` });
  return { id: pref.id, url: (config.mp.sandbox && pref.sandbox_init_point) || pref.init_point };
}

export const getPayment = (id) => mp('GET', `/v1/payments/${encodeURIComponent(id)}`);

export async function searchPayments(externalReference) {
  const r = await mp('GET', `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=20`);
  return (r && r.results) || [];
}

export const refundPayment = (id) => mp('POST', `/v1/payments/${encodeURIComponent(id)}/refunds`, {}, { 'X-Idempotency-Key': `refund-${id}` });

// Assinatura do aviso (x-signature): HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com a chave secreta do webhook.
export function verifySignature({ signature, requestId, dataId, secret = config.mp.webhookSecret, maxAgeMs = 0 }) {
  if (!secret) return { ok: false, reason: 'sem segredo configurado' };
  const parts = Object.fromEntries(String(signature || '').split(',').map((kv) => kv.split('=').map((s) => s.trim())).filter((p) => p.length === 2));
  const ts = parts.ts, v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return { ok: false, reason: 'cabeçalho ausente ou malformado' };
  let manifest = '';
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1.toLowerCase(), 'hex'));
  if (ok && maxAgeMs) {
    const tsMs = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
    if (Math.abs(Date.now() - tsMs) > maxAgeMs) return { ok: false, reason: 'aviso antigo' };
  }
  return { ok, reason: ok ? '' : 'assinatura não confere' };
}
