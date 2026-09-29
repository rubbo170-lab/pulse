// Checkout do Stripe (lib/stripe.js) contra o Stripe falso: os parâmetros do plano recomendado pelo Stripe
// (checkout hospedado, visual do site, fatura, número fiscal do cliente) e a conta sem Stripe Tax (Brasil).
// Uso: node test/stripe-unit.mjs
import { startMocks } from './mocks.mjs';

const mocks = await startMocks();
Object.assign(process.env, {
  STRIPE_SECRET_KEY: 'rk_test_unit', STRIPE_API_BASE: mocks.url, STRIPE_INVOICES: '1',
  STRIPE_TAX: '1', STRIPE_TAX_CODE: 'txcd_10402100', STRIPE_TAX_BEHAVIOR: 'exclusive',
  COMPANY_NAME: 'MGR Serviços Digitais', COMPANY_DOC: '69.334.872/0001-92', BRAND_NAME: 'Pulso',
});
const { config } = await import('../lib/config.js');
const ST = await import('../lib/stripe.js');

let ok = 0, bad = 0;
const check = (name, cond, extra = '') => { if (cond) { ok++; console.log('  OK   ', name); } else { bad++; console.log('  FALHA', name, extra); } };
const refused = () => mocks.log.filter((l) => l === 'stripe:tax-refused').length;
const user = { email: 'cliente@example.com' };
const buy = (S, id, price = 1690) => S.createCheckout({ order: { id, price_cents: price }, user, title: `Animated video 30s · Café ${id}`, successUrl: 'https://pulso.test/en/order/x', cancelUrl: 'https://pulso.test/en/order/x', locale: 'en' });

const warn = console.warn, warns = [];
console.warn = (...a) => warns.push(a.join(' '));
let mocks2;
try {
  check('imposto começa ligado (STRIPE_TAX=1)', ST.taxStatus() === 'on');

  // conta do Brasil: o Stripe recusa automatic_tax; a venda não pode travar
  const r1 = await buy(ST, 'ordunit000000001');
  const s1 = mocks.sessions.get(r1.id);
  check('conta sem Stripe Tax: sessão criada mesmo assim, sem imposto', !!s1 && !s1.automatic_tax && !s1.tax_behavior && !s1.tax_code && refused() === 1 && /^http/.test(r1.url), JSON.stringify(s1 && s1.automatic_tax));
  check('nova tentativa com outra chave de idempotência', /-sem-imposto$/.test(s1.idempotency || ''), s1.idempotency);
  check('painel e log avisam: imposto recusado, deixe STRIPE_TAX=0', ST.taxStatus() === 'blocked' && warns.some((w) => /STRIPE_TAX=0/.test(w)));
  check('checkout hospedado no navegador, com nome e cores do site', s1.origin_context === 'web' && s1.branding_settings && s1.branding_settings.display_name === 'Pulso' && s1.branding_settings.button_color === '#7C5CFF' && s1.branding_settings.background_color === '#121016' && s1.branding_settings.font_family === 'inter' && s1.branding_settings.border_style === 'rounded', JSON.stringify(s1.branding_settings));
  check('fatura com o número do pedido e o CNPJ; número fiscal do cliente opcional', s1.invoice_creation && s1.invoice_creation.enabled === 'true' && s1.invoice_creation.invoice_data.metadata.order_id === 'ordunit000000001' && s1.invoice_creation.invoice_data.footer === 'MGR Serviços Digitais · CNPJ 69.334.872/0001-92' && s1.tax_id_collection && s1.tax_id_collection.enabled === 'true', JSON.stringify(s1.invoice_creation));
  check('dólar, valor do pedido, meios dinâmicos, versão fixa da API', s1.currency === 'usd' && s1.amount_total === 1690 && !s1.payment_method_types && s1.stripe_version === '2026-08-26.dahlia' && s1.integration_identifier === 'pulso_video_checkout_qhzrkmvt');

  const r2 = await buy(ST, 'ordunit000000002');
  check('depois da recusa, as próximas vendas nem tentam o imposto', mocks.sessions.has(r2.id) && refused() === 1);

  // erro que não é de imposto continua aparecendo (não é engolido)
  let err = null;
  try { await buy(ST, 'ordunit000000003', 0); } catch (e) { err = e; }
  check('outros erros do Stripe continuam aparecendo', err && err.status === 400 && /Stripe HTTP 400/.test(err.message), err && err.message);

  // conta com Stripe Tax (fora do Brasil): o imposto vai junto
  mocks2 = await startMocks({ stripeTaxSupported: true });
  config.stripe.apiBase = mocks2.url;
  const ST2 = await import('../lib/stripe.js?conta-com-stripe-tax');
  const r3 = await buy(ST2, 'ordunit000000004');
  const s3 = mocks2.sessions.get(r3.id);
  check('conta com Stripe Tax: imposto automático, código do produto e preço sem imposto embutido', !!s3 && s3.automatic_tax && s3.automatic_tax.enabled === 'true' && s3.tax_code === 'txcd_10402100' && s3.tax_behavior === 'exclusive' && s3.tax_id_collection.enabled === 'true' && ST2.taxStatus() === 'on', JSON.stringify(s3 && s3.automatic_tax));
} finally {
  console.warn = warn;
  mocks.close();
  if (mocks2) mocks2.close();
}

console.log(`\nStripe: ${ok} OK, ${bad} com falha`);
process.exit(bad ? 1 : 0);
