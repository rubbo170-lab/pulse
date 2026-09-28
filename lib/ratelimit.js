// Limites de tentativas em memória (janela fixa). Suficiente para um servidor único.
import { fail } from './http.js';

const buckets = new Map();

export function hit(key, limit, windowMs) {
  const t = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= t) { b = { n: 0, reset: t + windowMs }; buckets.set(key, b); }
  b.n++;
  return { ok: b.n <= limit, retryAfter: Math.ceil((b.reset - t) / 1000) };
}

export function limit(key, max, windowMs, message = 'Muitas tentativas seguidas. Espere um pouco e tente de novo.') {
  const r = hit(key, max, windowMs);
  if (!r.ok) fail(429, message, { retryAfter: r.retryAfter });
}

setInterval(() => {
  const t = Date.now();
  for (const [k, b] of buckets) if (b.reset <= t) buckets.delete(k);
}, 60_000).unref();
