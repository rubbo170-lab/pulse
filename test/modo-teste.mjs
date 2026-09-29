// Loja em modo de teste (chave de teste do Stripe em produção): o público vê "o pagamento abre em breve" e não
// consegue pagar com cartão de teste; só os pedidos do dono pagam. Reais (token de produção) seguem abertos.
// Uso: node test/modo-teste.mjs
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { startMocks } from './mocks.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 3941, BASE = `http://127.0.0.1:${PORT}`, DATA = '/tmp/pulso-modo-teste';
const ADMIN = 'dono@pulso.test', ADMIN_TOKEN = 'codigo-do-dono-teste';
fs.rmSync(DATA, { recursive: true, force: true });

let ok = 0, bad = 0;
const check = (name, cond, extra = '') => { if (cond) { ok++; console.log('  OK   ', name); } else { bad++; console.log('  FALHA', name, extra); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mocks = await startMocks();
mocks.setStripeWebhook(`${BASE}/api/webhooks/stripe`);
const env = { ...process.env, PORT: String(PORT), APP_URL: BASE, DATA_DIR: DATA, ADMIN_EMAILS: ADMIN, ADMIN_TOKEN, RENDER_DISABLED: '1', TEST_PAYMENTS: 'owner',
  MP_ACCESS_TOKEN: 'APP_USR-producao', MP_API_BASE: mocks.url, MP_WEBHOOK_SECRET: mocks.webhookSecret,
  STRIPE_SECRET_KEY: 'rk_test_loja', STRIPE_WEBHOOK_SECRET: mocks.stripeWebhookSecret, STRIPE_API_BASE: mocks.url, ANTHROPIC_API_KEY: '' };
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
const log = [];
srv.stdout.on('data', (d) => log.push(String(d))); srv.stderr.on('data', (d) => log.push(String(d)));
for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch { /* subindo */ } await sleep(100); }

function client(lang = 'pt') {
  let cookie = '';
  return async (method, p, body) => {
    const r = await fetch(BASE + p, { method, headers: { 'content-type': 'application/json', 'x-lang': lang, cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let json = null; try { json = await r.json(); } catch { /* vazio */ }
    return { status: r.status, json };
  };
}
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/examples/confeitaria.json'), 'utf8'));
spec.brand.name = 'Doce Teste Ltda';
const order = (c, lang) => c('POST', '/api/orders', { spec, lang, duration: 15 });

try {
  const anon = client();
  check('público: reais abertos (token de produção)', (await anon('GET', '/api/config?lang=pt')).json.paymentsEnabled === true);
  check('público: dólar fechado (chave de teste do Stripe)', (await anon('GET', '/api/config?lang=en')).json.paymentsEnabled === false);

  const bob = client('en');
  await bob('POST', '/api/auth/signup', { name: 'Bob', email: 'bob@cliente.test', password: 'senha-do-bob-1', accept: true, lang: 'en' });
  const b1 = await order(bob, 'en');
  const bobEn = b1.json.order;
  check('cliente em dólar: pedido salvo, sem página de pagamento', b1.status === 201 && !b1.json.checkoutUrl && bobEn.paymentsOpen === false, JSON.stringify(b1.json).slice(0, 200));
  check('aviso traduzido: "Checkout opens soon"', /^Checkout opens soon/.test(b1.json.checkoutError || ''), b1.json.checkoutError);
  const b2 = await bob('POST', `/api/orders/${bobEn.id}/checkout`, {});
  check('botão de pagar recusado para o cliente (503)', b2.status === 503, `${b2.status}`);
  check('lista de pedidos marca o pagamento como fechado', (await bob('GET', '/api/orders')).json.orders.find((o) => o.id === bobEn.id).paymentsOpen === false);

  const bobPt = client('pt');
  await bobPt('POST', '/api/auth/login', { email: 'bob@cliente.test', password: 'senha-do-bob-1' });
  const b3 = await order(bobPt, 'pt');
  check('cliente em reais: checkout do Mercado Pago abre normalmente', b3.status === 201 && /^http/.test(b3.json.checkoutUrl || '') && b3.json.order.paymentsOpen === true, JSON.stringify(b3.json).slice(0, 160));

  // cartão de teste usado mesmo assim (sessão criada antes da trava): o pedido do cliente não é liberado
  const sn = { id: 'cs_test_' + crypto.randomBytes(12).toString('hex'), object: 'checkout.session', mode: 'payment', status: 'complete', payment_status: 'paid', livemode: false, currency: 'usd', amount_total: bobEn.priceCents,
    client_reference_id: bobEn.id, metadata: { order_id: bobEn.id }, payment_intent: 'pi_' + crypto.randomBytes(10).toString('hex'), customer_details: { email: 'bob@cliente.test' } };
  mocks.sessions.set(sn.id, sn);
  const wh = await mocks.stripeEvent('checkout.session.completed', sn);
  await sleep(300);
  check('pagamento de teste não libera pedido de cliente', wh === 200 && (await bob('GET', `/api/orders/${bobEn.id}`)).json.order.status === 'awaiting_payment');

  // dono: paga em teste pelo site no ar
  const dono = client('en');
  await dono('POST', '/api/auth/signup', { name: 'Dono', email: ADMIN, password: 'senha-do-dono-1', accept: true, lang: 'en' });
  check('antes de confirmar o código, o dono ainda é público', (await dono('GET', '/api/config?lang=en')).json.paymentsEnabled === false);
  await dono('POST', '/api/admin/claim', { token: ADMIN_TOKEN });
  check('dono confirmado: dólar aberto para ele', (await dono('GET', '/api/config?lang=en')).json.paymentsEnabled === true);
  const d1 = await order(dono, 'en');
  check('dono: checkout do Stripe (teste) abre', d1.status === 201 && /^http/.test(d1.json.checkoutUrl || '') && d1.json.order.paymentsOpen === true, JSON.stringify(d1.json).slice(0, 160));
  const dsn = [...mocks.sessions.values()].find((s) => s.client_reference_id === d1.json.order.id);
  mocks.payStripe(dsn);
  await mocks.stripeEvent('checkout.session.completed', dsn);
  await sleep(300);
  const dst = (await dono('GET', `/api/orders/${d1.json.order.id}`)).json.order.status;
  check('dono: pagamento de teste libera o pedido dele', ['paid', 'rendering'].includes(dst), dst);

  const sum = (await dono('GET', '/api/admin/summary')).json;
  check('painel: alerta do cartão de teste em pedido de cliente', sum.alerts.some((a) => a.kind === 'payment.mismatch' && a.order_id === bobEn.id && /pedido de cliente/.test(a.detail)), JSON.stringify(sum.alerts));
  check('painel: modo de teste fechado ao público', sum.config.stripeTest === true && sum.config.testOpen === false);
  check('log de início avisa do modo de teste', log.join('').includes('USD: chave de teste em produção'));
} catch (e) {
  check('execução sem erro', false, e.stack || e.message);
} finally {
  srv.kill('SIGTERM'); mocks.close();
}
console.log(`\nModo de teste: ${ok} OK, ${bad} com falha`);
process.exit(bad ? 1 : 0);
