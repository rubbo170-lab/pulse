// Teste de ponta a ponta: navegador de verdade + Mercado Pago, Stripe e Anthropic falsos + render real.
// Uso: node --disable-warning=ExperimentalWarning test/e2e.mjs   (precisa do Playwright global e de ffmpeg)
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { startMocks } from './mocks.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 3931, BASE = `http://127.0.0.1:${PORT}`, DATA = '/tmp/pulso-e2e', SHOTS = path.join(DATA, 'shots');
const ADMIN = 'admin@pulso.test', ADMIN_TOKEN = 'codigo-do-dono-e2e';
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok, extra }); console.log(`${ok ? 'OK  ' : 'FALHOU'} ${name}${extra ? ' — ' + extra : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nb = (x) => String(x || '').replace(/\u00a0/g, ' '); // o Intl separa "R$" do número com espaço fixo

const mocks = await startMocks();
mocks.setStripeWebhook(`${BASE}/api/webhooks/stripe`);
const env = { ...process.env, PORT: String(PORT), APP_URL: BASE, DATA_DIR: DATA, ADMIN_EMAILS: ADMIN, ADMIN_TOKEN, RENDER_FPS: process.env.FPS || '30',
  MP_ACCESS_TOKEN: 'APP_USR-teste', MP_API_BASE: mocks.url, MP_WEBHOOK_SECRET: mocks.webhookSecret, ANTHROPIC_API_KEY: 'sk-ant-teste', ANTHROPIC_BASE_URL: mocks.url,
  STRIPE_SECRET_KEY: 'sk_test_e2e', STRIPE_WEBHOOK_SECRET: mocks.stripeWebhookSecret, STRIPE_API_BASE: mocks.url,
  COMPANY_NAME: 'MGR Serviços Digitais', COMPANY_DOC: '00.000.000/0001-00', SUPPORT_EMAIL: 'suporte@exemplo.com', SUPPORT_WHATSAPP: '5511900000000' };
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
const srvLog = [];
srv.stdout.on('data', (d) => srvLog.push(String(d))); srv.stderr.on('data', (d) => srvLog.push(String(d)));
for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch { /* subindo */ } await sleep(100); }

// cliente HTTP com cookie próprio (para testes de API)
function client() {
  let cookie = '';
  const c = async (method, p, body, headers = {}) => {
    const r = await fetch(BASE + p, { method, redirect: 'manual', headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), cookie, ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* não é json */ }
    return { status: r.status, headers: r.headers, json, text, setCookie: sc };
  };
  c.cookie = () => cookie;
  return c;
}
const probe = (file) => {
  const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration,size', '-of', 'json', file]));
  return { v: pr.streams.find((s) => s.codec_name === 'h264'), a: pr.streams.find((s) => s.codec_name === 'aac'), dur: Number(pr.format.duration), size: Number(pr.format.size) };
};
// volume médio (dB) de um trecho do áudio
const loudness = (file, ss, t) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(ss), '-t', String(t), '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }); const m = /mean_volume: (-?[\d.]+) dB/.exec(r.stderr || ''); return m ? Number(m[1]) : -99; };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium', args: ['--disable-gpu'] });
const pageErrors = [];
const watch = (page, tag) => { page.on('pageerror', (e) => pageErrors.push(`${tag}: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|401|403|429|409/.test(m.text())) pageErrors.push(`${tag} console: ${m.text()}`); }); };
let orderId = null, enOrder = null, esOrder = null;

try {
  // ── 1. página inicial
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, locale: 'pt-BR' });
  const page = await ctx.newPage(); watch(page, 'cliente');
  await page.goto(BASE + '/');
  await page.waitForTimeout(800);
  const priceCard = nb(await page.textContent('.price-card'));
  check('página inicial carrega com os preços de 15, 20 e 30 s', priceCard.includes('R$ 29,90') && priceCard.includes('R$ 34,90') && priceCard.includes('R$ 44,90'), priceCard.replace(/\s+/g, ' ').slice(0, 90));
  await page.screenshot({ path: path.join(SHOTS, '01-inicio.png'), fullPage: true });

  // ── 2. editor: dados reais, exemplo apagado, roteiro com IA, logo
  await page.click('.hero-cta a.btn.primary');
  await page.waitForURL('**/criar');
  await page.waitForFunction(() => window.PulsoEditor && PulsoEditor.state.engine, null, { timeout: 30000 });
  await page.fill('#f_name', 'Café Ponto Doce');
  check('dados fictícios do exemplo são apagados ao trocar o nome', (await page.inputValue('#f_insta')) === '' && (await page.inputValue('#f_rating')) === '' && (await page.inputValue('#f_whats')) === '');
  await page.selectOption('#f_segment', 'Cafeteria');
  await page.fill('#f_sells', 'Cafés especiais, pão de queijo e bolos caseiros para o café da manhã');
  await page.fill('#f_diffs', 'Grãos torrados na semana\nPão de queijo quentinho\nPedido pelo WhatsApp');
  await page.fill('#f_whats', '(11) 90000-1234');
  await page.click('#aiBtn');
  await page.waitForFunction(() => document.getElementById('f_hook1').value === 'CAFÉ', null, { timeout: 15000 });
  check('roteiro com IA (servidor) preenche os campos', (await page.inputValue('#f_product')) === 'Cappuccino da casa');
  const aiDir = await page.evaluate(() => ({ cr: PulsoEditor.state.creative, look: PulsoEditor.state.engine.plan.look }));
  check('IA sugere o visual (com "Surpresa" marcado) e as palavras de destaque', aiDir.cr.look === 'auto' && aiDir.cr.pref === 'editorial' && aiDir.look === 'editorial' && aiDir.cr.keys.hook === 'ABRAÇA' && aiDir.cr.keys.product === 'Cappuccino', JSON.stringify(aiDir.cr));
  const c1Before = await page.inputValue('#f_c1');
  await page.setInputFiles('#f_logo', path.join(ROOT, 'test/examples/burger-logo.png'));
  await page.waitForTimeout(1200);
  const c1After = await page.inputValue('#f_c1');
  check('cores da marca tiradas do logo automaticamente', c1After !== c1Before && /cores do seu logo/.test(await page.textContent('#status')), `${c1Before} → ${c1After}`);
  await page.screenshot({ path: path.join(SHOTS, '02-editor.png'), fullPage: false });
  const wm = await page.evaluate(() => { const c = document.getElementById('pv'); const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, Math.round(c.height * 0.06)).data; let bright = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) bright++; return bright; });
  check('prévia mostra a marca PRÉVIA', wm > 50, `${wm} px claros no topo`);

  // ── 2b. vídeo de 30 s: preço, cenas extras, textos da IA e storyboard (depois volta para 15 s)
  const plan15 = await page.evaluate(() => ({ creative: PulsoEditor.state.creative, look: PulsoEditor.state.engine.plan && PulsoEditor.state.engine.plan.look, native: !!PulsoEditor.state.engine.native }));
  check('vídeo novo usa o motor criativo (direção de arte própria, com semente)', plan15.native && plan15.creative && plan15.creative.v === 2 && Number.isInteger(plan15.creative.seed) && (await page.isVisible('#direction')) && (await page.isVisible('#looks')), `${plan15.look} · semente ${plan15.creative && plan15.creative.seed}`);
  const shuffled = [];
  for (let i = 0; i < 4; i++) { await page.click('#shuffleBtn'); await page.waitForTimeout(250); shuffled.push(await page.evaluate(() => [PulsoEditor.state.creative.seed, PulsoEditor.state.engine.plan.look, PulsoEditor.state.engine.plan.arc, PulsoEditor.state.engine.scenes.map((s) => s.key).join('-')].join(' '))); }
  check('"Outro visual" sorteia outro vídeo (semente, visual, história ou cenas mudam)', new Set(shuffled).size === 4 && new Set(shuffled.map((x) => x.split(' ').slice(1).join(' '))).size >= 2, shuffled.join(' | '));
  await page.click('label:has(input[name=dur][value="30"])');
  await page.waitForFunction(() => PulsoEditor.state.engine.DUR === 30 && document.querySelectorAll('#board .shot').length === PulsoEditor.state.engine.scenes.length, null, { timeout: 8000 }).catch(() => {});
  const now30 = await page.evaluate(() => [...document.querySelectorAll('[data-price-now]')].map((e) => e.textContent.trim()));
  check('30 s: preço de R$ 44,90 e painel de cenas extras', now30.length > 0 && now30.every((t) => nb(t) === 'R$ 44,90') && (await page.isVisible('#panel30')) && (await page.textContent('#specPill')).startsWith('30 s'), now30.map(nb).join(' | '));
  check('30 s: IA escreveu o título das fotos e o passo a passo', (await page.inputValue('#f_showTitle')) === 'Nosso cardápio' && (await page.inputValue('#f_stepsTitle')) === 'Como pedir' && (await page.inputValue('#f_s1')) === 'Escolha seu café' && (await page.inputValue('#f_si2')) === 'chat');
  const board30 = await page.evaluate(() => [...document.querySelectorAll('#board .shot small')].map((e) => e.textContent));
  const n30 = await page.evaluate(() => PulsoEditor.state.engine.scenes.length);
  // sem fotos enviadas, o vídeo de 30 s não inventa a cena "Em detalhes" (ela aparece quando há foto ou prints)
  check('30 s: storyboard com uma miniatura por cena e o passo a passo', board30.length === n30 && n30 >= 8 && board30.includes('Como funciona') && !board30.includes('Em detalhes'), board30.join(', '));
  const iSteps = board30.indexOf('Como funciona');
  await page.click(`#board .shot[data-i="${iSteps}"]`);
  await page.waitForTimeout(300);
  const [tAt, sc30] = await page.evaluate((i) => [PulsoEditor.state.t, PulsoEditor.state.engine.scenes[i]], iSteps);
  check('30 s: tocar numa cena do storyboard leva até ela', tAt >= sc30.t0 && tAt < sc30.t1, `t = ${tAt.toFixed(2)} s (cena ${sc30.t0.toFixed(2)}–${sc30.t1.toFixed(2)})`);
  await page.screenshot({ path: path.join(SHOTS, '02b-editor-30s.png'), fullPage: true });
  await page.click('label:has(input[name=dur][value="15"])');
  await page.waitForFunction(() => PulsoEditor.state.engine.DUR === 15 && document.querySelectorAll('#board .shot').length === PulsoEditor.state.engine.scenes.length, null, { timeout: 8000 }).catch(() => {});
  const n15 = await page.evaluate(() => [document.querySelectorAll('#board .shot').length, PulsoEditor.state.engine.scenes.length, PulsoEditor.state.engine.DUR]);
  check('volta para 15 s: painel escondido e cenas do vídeo curto', (await page.isHidden('#panel30')) && n15[0] === n15[1] && n15[1] >= 4 && n15[1] <= 8 && n15[2] === 15 && nb(await page.textContent('[data-price-now]')) === 'R$ 29,90', `${n15[1]} cenas`);

  // ── 3. compra: cadastro na janela, checkout, Pix aprovado, volta ao pedido
  await page.click('#buyBtn');
  await page.waitForSelector('.modal form');
  await page.fill('.modal input[name=name]', 'Maria Cliente');
  await page.fill('.modal input[name=email]', 'maria@cliente.test');
  await page.fill('.modal input[name=password]', 'senha-da-maria-1');
  await page.check('.modal input[name=accept]');
  await page.screenshot({ path: path.join(SHOTS, '03-cadastro.png') });
  await page.click('.modal button[type=submit]');
  await page.waitForURL(/\/mp\/checkout\//, { timeout: 30000 });
  check('vai para o checkout do Mercado Pago', true, new URL(page.url()).pathname);
  const pref = [...mocks.prefs.values()].pop();
  orderId = pref.external_reference;
  check('preferência com valor e referência certos', pref.items[0].unit_price === 29.9 && pref.items[0].currency_id === 'BRL' && /^[a-z0-9]{16}$/.test(orderId), `${pref.items[0].title}`);
  check('Pix e cartão, sem boleto', JSON.stringify(pref.payment_methods.excluded_payment_types) === JSON.stringify([{ id: 'ticket' }, { id: 'atm' }]));
  await page.click('#approve');
  await page.waitForURL(/\/pedido\/[a-z0-9]{16}/, { timeout: 30000 });
  await page.waitForFunction(() => /Pagamento confirmado|Gerando|pronto/.test(document.getElementById('oTitle').textContent), null, { timeout: 30000 });
  check('pagamento confirmado pelo retorno do checkout', true, await page.textContent('#oTitle'));

  // ── 3b. inglês: 20 s pago em dólar pelo Stripe (entra na fila enquanto o vídeo da Maria é gerado)
  const ectx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, locale: 'en-US' });
  const ep = await ectx.newPage(); watch(ep, 'english');
  await ep.goto(BASE + '/en');
  await ep.waitForTimeout(800);
  const enCard = nb(await ep.textContent('.price-card'));
  check('EN: landing em inglês com preço em dólar', (await ep.getAttribute('html', 'lang')) === 'en' && enCard.includes('US$ 9.90') && enCard.includes('US$ 12.90') && enCard.includes('US$ 16.90') && !/vídeo|você/i.test(await ep.textContent('main')), enCard.replace(/\s+/g, ' ').slice(0, 80));
  await ep.screenshot({ path: path.join(SHOTS, '20-en-inicio.png'), fullPage: true });
  await ep.click('.hero-cta a.btn.primary');
  await ep.waitForURL('**/en/create');
  await ep.waitForFunction(() => window.PulsoEditor && PulsoEditor.state.engine, null, { timeout: 30000 });
  await ep.fill('#f_name', 'Bean There Café');
  await ep.selectOption('#f_segment', 'Cafeteria');
  await ep.fill('#f_sells', 'Specialty coffee, pastries and breakfast to go');
  await ep.fill('#f_diffs', 'Beans roasted weekly\nFresh pastries daily\nOrder by text');
  await ep.fill('#f_whats', '(555) 010-0100');
  await ep.click('#aiBtn');
  await ep.waitForFunction(() => document.getElementById('f_hook1').value === 'COFFEE', null, { timeout: 15000 });
  check('EN: roteiro com IA pedido em inglês', mocks.log.includes('ai:en') && (await ep.inputValue('#f_product')) === 'House cappuccino');
  await ep.click('label:has(input[name=look][value="neon"])');
  await ep.click('label:has(input[name=dur][value="20"])');
  await ep.waitForTimeout(400);
  const enLook = await ep.evaluate(() => [PulsoEditor.state.engine.plan.look, PulsoEditor.state.engine.DUR, PulsoEditor.state.engine.native, document.getElementById('dirName').textContent]);
  check('EN: visual Neon escolhido na prévia (20 s no tempo real)', enLook[0] === 'neon' && enLook[1] === 20 && enLook[2] && /Neon night/.test(enLook[3]) && /Look:/.test(enLook[3]), enLook[3]);
  const enNow = await ep.evaluate(() => [...document.querySelectorAll('[data-price-now]')].map((e) => e.textContent.trim()));
  check('EN: escolher 20 s muda o preço e a prévia', (await ep.evaluate(() => PulsoEditor.state.dur)) === 20 && enNow.every((t) => t === 'US$ 12.90') && (await ep.textContent('#specPill')).startsWith('20 s'), enNow.join(' | '));
  await ep.screenshot({ path: path.join(SHOTS, '21-en-editor-20s.png') });
  const enPreview = await ep.evaluate(() => PulsoEditor.state.engine.plan.scenes.map((s) => `${s.kind}:${s.variant}:${s.beats}`).join(' '));
  await ep.click('#buyBtn');
  await ep.waitForSelector('.modal form');
  check('EN: janela de cadastro em inglês', /Sign in|account/i.test(await ep.textContent('.modal')) && !/Criar conta|Senha/.test(await ep.textContent('.modal')));
  await ep.fill('.modal input[name=name]', 'John Buyer');
  await ep.fill('.modal input[name=email]', 'john@buyer.test');
  await ep.fill('.modal input[name=password]', 'johns-password-1');
  await ep.check('.modal input[name=accept]');
  await ep.click('.modal button[type=submit]');
  await ep.waitForURL(/\/stripe\/checkout\//, { timeout: 30000 });
  const sn = [...mocks.sessions.values()].pop();
  enOrder = sn.client_reference_id;
  check('EN: sessão do Stripe em dólar com valor de 20 s', sn.amount_total === 1290 && sn.currency === 'usd' && sn.locale === 'en' && /^[a-z0-9]{16}$/.test(enOrder) && sn.success_url === `${BASE}/en/order/${enOrder}?session_id={CHECKOUT_SESSION_ID}` && /20s/.test(sn.product_name) && sn.stripe_version === '2026-08-26.dahlia', `${sn.product_name}`);
  check('EN: checkout com fatura, rótulo da integração e meios de pagamento dinâmicos', sn.invoice_creation && sn.invoice_creation.enabled === 'true' && sn.invoice_creation.invoice_data && sn.invoice_creation.invoice_data.metadata.order_id === enOrder && /^pulso_video_checkout_[a-z]{8}$/.test(sn.integration_identifier || '') && !sn.payment_method_types && !sn.automatic_tax, JSON.stringify(sn.invoice_creation && sn.invoice_creation.invoice_data).slice(0, 120));
  check('EN: checkout hospedado com o nome e as cores do Pulso, número fiscal opcional', sn.origin_context === 'web' && sn.branding_settings && sn.branding_settings.display_name === 'Pulso' && sn.branding_settings.button_color === '#7C5CFF' && sn.tax_id_collection && sn.tax_id_collection.enabled === 'true', JSON.stringify(sn.branding_settings));
  await ep.click('#stripePay');
  await ep.waitForURL(/\/en\/order\/[a-z0-9]{16}\?session_id=cs_test_/, { timeout: 30000 });
  await ep.waitForFunction(() => /Payment confirmed|Rendering|ready/.test(document.getElementById('oTitle').textContent), null, { timeout: 30000 });
  check('EN: pagamento confirmado (retorno + aviso assinado do Stripe)', true, await ep.textContent('#oTitle'));

  // ── 3c. espanhol: vídeo de 30 s com 2 fotos e depoimento, pago em dólar pelo Stripe
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, locale: 'es-MX' });
  const sp = await sctx.newPage(); watch(sp, 'espanol');
  await sp.goto(BASE + '/es/crear');
  await sp.waitForFunction(() => window.PulsoEditor && PulsoEditor.state.engine, null, { timeout: 30000 });
  await sp.fill('#f_name', 'Café La Esquina');
  await sp.fill('#f_sells', 'Café de especialidad y pan dulce');
  await sp.fill('#f_whats', '55 1234 5678');
  await sp.click('#aiBtn');
  await sp.waitForFunction(() => document.getElementById('f_hook2').value === 'QUE ABRAZA', null, { timeout: 15000 });
  await sp.click('label:has(input[name=dur][value="30"])');
  await sp.setInputFiles('#f_g0', path.join(ROOT, 'test/examples/gallery/app-cardapio.jpg'));
  await sp.setInputFiles('#f_g1', path.join(ROOT, 'test/examples/gallery/fotos.jpg'));
  await sp.fill('#f_quote', '¡El mejor café del barrio!');
  await sp.fill('#f_author', 'Lucía R., clienta');
  await sp.waitForFunction(() => PulsoEditor.state.gallery.filter(Boolean).length === 2, null, { timeout: 10000 });
  await sp.waitForFunction(() => [...document.querySelectorAll('#board .shot small')].some((e) => e.textContent === 'Testimonio'), null, { timeout: 8000 }).catch(() => {});
  const esNow = await sp.evaluate(() => [...document.querySelectorAll('[data-price-now]')].map((e) => e.textContent.trim()));
  check('ES: editor e IA em espanhol, 30 s a US$ 16.90', (await sp.getAttribute('html', 'lang')) === 'es' && mocks.log.includes('ai:es') && esNow.length > 0 && esNow.every((t) => t === 'US$ 16.90') && (await sp.inputValue('#f_s1')) === 'Elige tu café', esNow.join(' | '));
  const esBoard = await sp.evaluate(() => [...document.querySelectorAll('#board .shot small')].map((e) => e.textContent));
  const esPanel = await sp.textContent('#panel30');
  const esScenes = await sp.evaluate(() => PulsoEditor.state.engine.scenes.map((s) => ({ key: s.key, t0: s.t0, t1: s.t1 })));
  check('ES: cenas extras e storyboard em espanhol, com depoimento', esBoard.length === esScenes.length && esBoard.includes('En detalle') && esBoard.includes('Testimonio') && /Escenas del video de 30 s/.test(esPanel) && !/Depoimento|Imagem|Enviar/.test(esPanel), esBoard.join(', '));
  await sp.screenshot({ path: path.join(SHOTS, '22-es-editor-30s.png'), fullPage: true });
  await sp.click('#buyBtn');
  await sp.waitForSelector('.modal form');
  await sp.fill('.modal input[name=name]', 'Carlos Comprador');
  await sp.fill('.modal input[name=email]', 'carlos@comprador.test');
  await sp.fill('.modal input[name=password]', 'contrasena-carlos-1');
  await sp.check('.modal input[name=accept]');
  const esReq = []; const t0es = Date.now();
  sp.on('request', (r) => { if (r.url().startsWith(BASE + '/api/')) esReq.push(`${Date.now() - t0es}ms → ${r.method()} ${r.url().slice(BASE.length)}`); });
  sp.on('response', (r) => { if (r.url().startsWith(BASE + '/api/')) esReq.push(`${Date.now() - t0es}ms ← ${r.status()} ${r.url().slice(BASE.length)}`); });
  await sp.click('.modal button[type=submit]');
  try { await sp.waitForURL(/\/stripe\/checkout\//, { timeout: 90000 }); }
  catch (e) { await sp.screenshot({ path: path.join(SHOTS, '22b-es-compra-travou.png') }).catch(() => {}); console.log('ES compra:', esReq.join(' | '), '| status:', await sp.textContent('#status').catch(() => '?')); throw e; }
  check('ES: pedido de 30 s com fotos abre o checkout', true, esReq.filter((x) => /orders/.test(x)).join(' | '));
  const sn30 = [...mocks.sessions.values()].pop();
  esOrder = sn30.client_reference_id;
  check('ES: sessão do Stripe em dólar com valor de 30 s', sn30.amount_total === 1690 && sn30.currency === 'usd' && sn30.locale === 'es' && /30 s/.test(sn30.product_name) && sn30.success_url === `${BASE}/es/pedido/${esOrder}?session_id={CHECKOUT_SESSION_ID}`, `${sn30.product_name}`);
  await sp.click('#stripePay');
  await sp.waitForURL(/\/es\/pedido\/[a-z0-9]{16}\?session_id=cs_test_/, { timeout: 30000 });
  const esSaved = await sp.evaluate(async (id) => (await fetch(`/api/orders/${id}/spec`)).json(), esOrder);
  check('ES: pedido guardou 30 s, 2 fotos, passo a passo e depoimento', esSaved.spec.duration === 30 && esSaved.galleryCount === 2 && esSaved.spec.proof.quote === '¡El mejor café del barrio!' && esSaved.spec.proof.author === 'Lucía R., clienta' && esSaved.spec.script.steps.length === 3 && esSaved.spec.script.showcaseTitle === 'Nuestro menú', JSON.stringify(esSaved.spec.script.steps).slice(0, 120));
  const g0 = await sp.evaluate(async (id) => { const r = await fetch(`/api/orders/${id}/image/gallery0`); return { s: r.status, type: r.headers.get('content-type') }; }, esOrder);
  const g2 = await sp.evaluate(async (id) => (await fetch(`/api/orders/${id}/image/gallery2`)).status, esOrder);
  check('ES: fotos do pedido guardadas (e só as enviadas)', g0.s === 200 && /image\/(jpeg|png)/.test(g0.type) && g2 === 404, `${g0.s} ${g0.type} · gallery2 ${g2}`);

  // ── 3d. volta para a Maria: espera o vídeo de 15 s
  await page.waitForFunction(() => /Gerando/.test(document.getElementById('oTitle').textContent), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(SHOTS, '04-gerando.png') });
  const t0 = Date.now();
  await page.waitForFunction(() => document.getElementById('oTitle').textContent.includes('pronto'), null, { timeout: 15 * 60e3, polling: 2000 });
  check('vídeo gerado no servidor', true, `${((Date.now() - t0) / 1000).toFixed(0)} s depois do início do render`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '05-pronto.png') });

  // ── 4. download e conferência do MP4
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#oActions a.btn.primary')]);
  const mp4 = path.join(DATA, 'baixado.mp4');
  await dl.saveAs(mp4);
  check('nome do arquivo baixado', dl.suggestedFilename() === 'pulso-cafe-ponto-doce.mp4', dl.suggestedFilename());
  const p15 = probe(mp4);
  check('MP4 H.264 1080x1920 + AAC, 15 s', p15.v && p15.v.width === 1080 && p15.v.height === 1920 && p15.a && p15.a.channels === 2 && Math.abs(p15.dur - 15) < 0.1, `${p15.v && p15.v.r_frame_rate} · ${p15.dur.toFixed(2)} s · ${(p15.size / 1e6).toFixed(1)} MB`);
  const [dlc] = await Promise.all([page.waitForEvent('download'), page.click('#oActions a[href*="/cover"]')]);
  const cover = path.join(DATA, 'capa.jpg'); await dlc.saveAs(cover);
  const cp = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', cover])).streams[0];
  check('capa do Reels em 1080x1920', dlc.suggestedFilename() === 'pulso-cafe-ponto-doce-capa.jpg' && cp.width === 1080 && cp.height === 1920 && cp.codec_name === 'mjpeg', `${dlc.suggestedFilename()} ${cp.width}x${cp.height}`);

  // ── 4b. vídeo de 20 s em inglês
  await ep.waitForFunction(() => document.getElementById('oTitle').textContent.includes('ready'), null, { timeout: 15 * 60e3, polling: 2000 });
  await ep.waitForTimeout(1200);
  await ep.screenshot({ path: path.join(SHOTS, '23-en-pronto.png') });
  check('EN: página do pedido em inglês', /Your video is ready/.test(await ep.textContent('#oTitle')) && /US\$ 12\.90/.test(await ep.textContent('main')) && !/Pedido|Baixar|vídeo/.test(await ep.textContent('main')));
  const [dl2] = await Promise.all([ep.waitForEvent('download'), ep.click('#oActions a.btn.primary')]);
  const mp20 = path.join(DATA, 'baixado-20s.mp4');
  await dl2.saveAs(mp20);
  const p20 = probe(mp20);
  check('EN: MP4 de 20 s, 1080x1920 + AAC', dl2.suggestedFilename() === 'pulso-bean-there-cafe.mp4' && p20.v && p20.v.width === 1080 && p20.a && Math.abs(p20.dur - 20) < 0.1, `${dl2.suggestedFilename()} · ${p20.dur.toFixed(2)} s · ${(p20.size / 1e6).toFixed(1)} MB`);
  const enSpec = await ep.evaluate(async (id) => (await (await fetch(`/api/orders/${id}/spec`)).json()).spec, enOrder);
  check('EN: pedido guardou a direção criativa (visual Neon e semente da prévia)', enSpec.creative && enSpec.creative.v === 2 && enSpec.creative.look === 'neon' && Number.isInteger(enSpec.creative.seed) && enSpec.duration === 20 && enSpec.lang === 'en', JSON.stringify({ ...enSpec.creative, plan: undefined }));
  const enFrozen = enSpec.creative && enSpec.creative.plan ? enSpec.creative.plan.scenes.map((s) => `${s[0]}:${s[2]}:${s[3]}`).join(' ') : '';
  check('EN: o plano da prévia foi congelado no pedido (render e correções repetem a mesma estrutura)', enFrozen && enFrozen === enPreview && enSpec.creative.plan.look === 'neon', enFrozen);

  // ── 4c. vídeo de 30 s em espanhol: duração, trilha nas cenas novas e quadros das cenas novas
  const t30 = Date.now();
  await sp.waitForFunction(() => document.getElementById('oTitle').textContent.includes('listo'), null, { timeout: 20 * 60e3, polling: 2000 });
  await sp.waitForTimeout(1200);
  await sp.screenshot({ path: path.join(SHOTS, '29-es-pronto-30s.png') });
  const [dl3] = await Promise.all([sp.waitForEvent('download'), sp.click('#oActions a.btn.primary')]);
  const mp30 = path.join(DATA, 'baixado-30s.mp4');
  await dl3.saveAs(mp30);
  const p30 = probe(mp30);
  check('ES: MP4 de 30 s, 1080x1920 + AAC', dl3.suggestedFilename() === 'pulso-cafe-la-esquina.mp4' && p30.v && p30.v.width === 1080 && p30.v.height === 1920 && p30.a && Math.abs(p30.dur - 30) < 0.1, `${dl3.suggestedFilename()} · ${p30.dur.toFixed(2)} s · ${(p30.size / 1e6).toFixed(1)} MB · ${((Date.now() - t30) / 1000).toFixed(0)} s de espera`);
  const vols = [[0.5, 6], [8, 3], [12, 2.5], [19.5, 2.5], [23, 3], [27, 2.5]].map(([s, d]) => loudness(mp30, s, d));
  // a música recua no depoimento e volta na cena seguinte (tempos das cenas vêm do plano da prévia, que é o mesmo do render)
  const qi = esScenes.findIndex((s) => s.key === 'quote'), q = esScenes[qi], qn = esScenes[qi + 1];
  const vq = q ? loudness(mp30, q.t0 + 0.25, q.t1 - q.t0 - 0.5) : 0, vn = qn ? loudness(mp30, qn.t0 + 0.25, qn.t1 - qn.t0 - 0.5) : -99;
  check('ES: trilha tocando em todas as partes, com respiro no depoimento', vols.every((v) => v > -32) && q && qn && vq < vn, vols.map((v) => v.toFixed(1)).join(' / ') + ` dB · depoimento ${vq.toFixed(1)} dB, seguinte ${vn.toFixed(1)} dB`);
  const frames = [9.5, 13.9, 20.5, 24.5].map((s) => { const f = path.join(SHOTS, `30-es-quadro-${String(s).replace('.', '_')}.jpg`); execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(s), '-i', mp30, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '3', f]); return fs.statSync(f).size; });
  check('ES: cenas novas com conteúdo (fotos, passos, depoimento, frase final)', frames.every((n) => n > 14000), frames.map((n) => `${Math.round(n / 1000)} KB`).join(' / '));

  // ── 5. correção grátis
  await page.click('#oActions a[href*="revisar"]');
  await page.waitForURL(/\/criar\?revisar=/);
  await page.waitForFunction(() => window.PulsoEditor && PulsoEditor.state.revise && PulsoEditor.state.engine, null, { timeout: 30000 });
  check('correção abre com o nome e a duração travados', (await page.isDisabled('#f_name')) && (await page.isDisabled('input[name=dur][value="20"]')));
  await page.fill('#f_tagline', 'Café fresquinho, todo dia.');
  await page.screenshot({ path: path.join(SHOTS, '06-correcao.png') });
  await page.click('#reviseBtn');
  await page.waitForURL(/\/pedido\//);
  await page.waitForFunction(() => document.getElementById('oTitle').textContent.includes('pronto') && !document.querySelector('#oActions a[href*="revisar"]'), null, { timeout: 15 * 60e3, polling: 2000 });
  // reaproveita a sessão do navegador
  const sess = (await ctx.cookies()).find((c) => c.name === 'pulso_sid');
  const asMaria = async (p) => (await fetch(BASE + p, { headers: { cookie: `pulso_sid=${sess.value}` } }));
  const o2 = await (await asMaria(`/api/orders/${orderId}`)).json();
  check('correção gerou a versão 2 e zerou as correções', o2.order.version === 2 && o2.order.editsLeft === 0, `v${o2.order.version}`);
  const rng = await fetch(`${BASE}/api/orders/${orderId}/video`, { headers: { cookie: `pulso_sid=${sess.value}`, range: 'bytes=0-1023' } });
  check('vídeo aceita Range (Safari/iPhone)', rng.status === 206 && (await rng.arrayBuffer()).byteLength === 1024);
  const rev2 = await (await fetch(`${BASE}/api/orders/${orderId}/revise`, { method: 'POST', headers: { cookie: `pulso_sid=${sess.value}`, 'content-type': 'application/json' }, body: JSON.stringify({ spec: o2.spec || {} }) })).json();
  check('segunda correção é recusada', /já foi usada|pronto/.test(rev2.error || ''), rev2.error);

  // ── 6. meus vídeos
  await page.goto(BASE + '/meus-videos');
  await page.waitForSelector('.vcard');
  await page.screenshot({ path: path.join(SHOTS, '07-meus-videos.png') });
  check('meus vídeos lista o pedido', (await page.textContent('.vgrid')).includes('Café Ponto Doce'));
  await ep.goto(BASE + '/en/my-videos');
  await ep.waitForSelector('.vcard');
  const enCards = await ep.textContent('.vgrid');
  check('EN: my videos em inglês com 20 s e dólar', enCards.includes('Bean There Café') && /20 s/.test(enCards) && enCards.includes('US$ 12.90'), enCards.replace(/\s+/g, ' ').slice(0, 100));
  await ep.screenshot({ path: path.join(SHOTS, '24-en-my-videos.png') });

  // ── 6b. minha marca: o próximo vídeo começa com a identidade do último
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* ok */ } });
  await page.goto(BASE + '/criar');
  await page.waitForFunction(() => window.PulsoEditor && PulsoEditor.state.engine, null, { timeout: 30000 });
  await page.waitForSelector('#brandNote:not([hidden])', { timeout: 10000 });
  check('editor oferece a marca salva', (await page.textContent('#brandName')) === 'Café Ponto Doce');
  await page.click('#brandUse');
  await page.waitForFunction(() => document.getElementById('f_name').value === 'Café Ponto Doce' && PulsoEditor.state.images.logo, null, { timeout: 10000 });
  check('marca aplicada: nome, contato, cores e logo', (await page.inputValue('#f_whats')) === '(11) 90000-1234' && (await page.inputValue('#f_c1')) === c1After && (await page.inputValue('#f_sells')).startsWith('Cafés especiais'));
  await page.screenshot({ path: path.join(SHOTS, '07b-minha-marca.png') });

  // ── 7. celular
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage(); watch(mp, 'celular');
  await mp.goto(BASE + '/'); await mp.waitForTimeout(700);
  await mp.screenshot({ path: path.join(SHOTS, '08-celular-inicio.png') });
  for (const [p, shot] of [['/criar', '09-celular-editor.png'], ['/en/create', '25-celular-en-editor.png'], ['/es/crear', '26-celular-es-editor.png']]) {
    await mp.goto(BASE + p); await mp.waitForFunction(() => window.PulsoEditor && PulsoEditor.state.engine, null, { timeout: 30000 }); await mp.waitForTimeout(900);
    await mp.screenshot({ path: path.join(SHOTS, shot) });
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`editor sem rolagem lateral no celular (${p})`, overflow <= 1, `${overflow}px`);
  }
  await mp.goto(BASE + '/criar'); await mp.waitForFunction(() => window.PulsoEditor && PulsoEditor.state.engine, null, { timeout: 30000 });
  await mp.click('label:has(input[name=dur][value="30"])'); await mp.waitForTimeout(1200);
  await mp.screenshot({ path: path.join(SHOTS, '09b-celular-editor-30s.png'), fullPage: true });
  const ov30 = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('editor de 30 s sem rolagem lateral no celular', ov30 <= 1 && (await mp.isVisible('#panel30')), `${ov30}px`);
  for (const [p, shot] of [['/en', '27-celular-en-inicio.png'], ['/es', '28-celular-es-inicio.png']]) {
    await mp.goto(BASE + p); await mp.waitForTimeout(700);
    await mp.screenshot({ path: path.join(SHOTS, shot), fullPage: true });
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`página inicial sem rolagem lateral no celular (${p})`, overflow <= 1, `${overflow}px`);
  }
  await mctx.close();

  // ── 8. segurança e regras pela API
  const bob = client();
  const s1 = await bob('POST', '/api/auth/signup', { name: 'Bob', email: 'bob@teste.test', password: 'senha-do-bob-1', accept: true });
  check('cookie de sessão HttpOnly e SameSite', /HttpOnly/.test(s1.setCookie) && /SameSite=Lax/.test(s1.setCookie));
  check('outra conta não vê o pedido da Maria', (await bob('GET', `/api/orders/${orderId}`)).status === 404);
  check('outra conta não baixa o vídeo da Maria', (await bob('GET', `/api/orders/${orderId}/video`)).status === 404);
  check('pedido de outro site é bloqueado (origem)', (await bob('POST', '/api/auth/logout', {}, { origin: 'https://site-malicioso.test' })).status === 403);
  const big = await bob('POST', '/api/orders', JSON.stringify({ x: 'a'.repeat(17 * 1024 * 1024) }));
  check('envio gigante é recusado', big.status === 413, String(big.status));
  for (const p of ['/..%2fserver.js', '/%2e%2e/server.js', '/js/..%2f..%2fserver.js', '/.env', '/../.env', '/i18n/en.json', '/views/index.html']) {
    let r = await bob('GET', p);
    if (r.status === 301 || r.status === 302) r = await bob('GET', new URL(r.headers.get('location'), BASE).pathname); // ".html" vira endereço limpo
    check(`arquivo interno protegido: ${p}`, r.status === 404 && !r.text.includes('createServer') && !r.text.includes('"pages"') && !r.text.includes('<!--HREFLANG-->'), String(r.status));
  }
  const bad = client(); let got429 = false;
  for (let i = 0; i < 10; i++) { const r = await bad('POST', '/api/auth/login', { email: 'maria@cliente.test', password: 'errada-' + i }); if (r.status === 429) { got429 = true; break; } }
  check('tentativas de senha são limitadas', got429);
  const enErr = await client()('POST', '/api/auth/login', { email: 'ninguem@teste.test', password: 'qualquer-coisa' }, { 'x-lang': 'en' });
  const esErr = await client()('POST', '/api/auth/login', { email: 'ninguem@teste.test', password: 'qualquer-coisa' }, { 'x-lang': 'es' });
  check('mensagens de erro da API no idioma da página', enErr.json.error === 'Wrong email or password.' && /correo|contraseña/i.test(esErr.json.error), `${enErr.json.error} | ${esErr.json.error}`);
  const headers = (await bob('GET', '/')).headers;
  check('cabeçalhos de segurança', /default-src 'self'/.test(headers.get('content-security-policy') || '') && headers.get('x-frame-options') === 'DENY');
  const bad2 = await bob('POST', '/api/orders', { spec: { brand: { name: '' } } });
  check('pedido sem dados mínimos é recusado', bad2.status === 400, bad2.json && bad2.json.error);
  const evil = await bob('POST', '/api/orders', { spec: JSON.parse(fs.readFileSync(path.join(ROOT, 'test/examples/petshop.json'))), logo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' });
  check('imagem que não é PNG/JPG é recusada', evil.status === 400);
  check('admin não pode ser confirmado por outra conta', (await bob('POST', '/api/admin/claim', { token: ADMIN_TOKEN })).status === 403);
  // a empresa fictícia do exemplo do editor nunca vira pedido de cliente
  const exOrder = await bob('POST', '/api/orders', { spec: JSON.parse(fs.readFileSync(path.join(ROOT, 'test/examples/confeitaria.json'))) });
  check('pedido com a empresa do exemplo é recusado', exOrder.status === 400 && /exemplo/i.test((exOrder.json && exOrder.json.error) || ''), exOrder.json && exOrder.json.error);

  // webhook do Mercado Pago: assinatura inválida, valor errado, e pagamento válido
  const ob = await bob('POST', '/api/orders', { spec: JSON.parse(fs.readFileSync(path.join(ROOT, 'test/examples/petshop.json'))) });
  const bobOrder = ob.json.order.id;
  check('checkout criado para o pedido novo', !!ob.json.checkoutUrl);
  const bobPref = [...mocks.prefs.values()].find((x) => x.external_reference === bobOrder);
  const cheap = mocks.makePayment(bobPref, { amount: 1.0 });
  const hook = (id, sig) => fetch(`${BASE}/api/webhooks/mercadopago?data.id=${id}&type=payment`, { method: 'POST', headers: { 'content-type': 'application/json', ...sig }, body: JSON.stringify({ type: 'payment', data: { id: String(id) } }) });
  const w1 = await hook(cheap.id, { 'x-signature': 'ts=1,v1=' + 'a'.repeat(64), 'x-request-id': 'x' });
  check('aviso com assinatura falsa é recusado', w1.status === 401);
  const signed = (id) => { const ts = String(Date.now()), rid = 'req-' + id; return { 'x-signature': `ts=${ts},v1=${crypto.createHmac('sha256', mocks.webhookSecret).update(`id:${id};request-id:${rid};ts:${ts};`).digest('hex')}`, 'x-request-id': rid }; };
  await hook(cheap.id, signed(cheap.id)); await sleep(700);
  check('pagamento com valor menor não libera o vídeo', (await bob('GET', `/api/orders/${bobOrder}`)).json.order.status === 'awaiting_payment');
  const good = mocks.makePayment(bobPref, {});
  const w3 = await hook(good.id, signed(good.id)); await sleep(900);
  const afterGood = (await bob('GET', `/api/orders/${bobOrder}`)).json.order.status;
  check('aviso válido do Mercado Pago libera o vídeo', w3.status === 200 && ['paid', 'rendering'].includes(afterGood), afterGood);
  // a Maria paga de novo o mesmo pedido (cobrança em dobro): fica registrada para devolver
  const dup = mocks.makePayment(pref, {});
  await hook(dup.id, signed(dup.id)); await sleep(700);

  // webhook do Stripe: assinatura falsa, evento repetido e sessão de outro pedido
  const stripeHook = (body, sigHeader) => fetch(`${BASE}/api/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sigHeader }, body });
  const fakeBody = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: sn.id } } });
  const sBad = await stripeHook(fakeBody, `t=${Math.floor(Date.now() / 1000)},v1=${'b'.repeat(64)}`);
  const sOld = await stripeHook(fakeBody, `t=${Math.floor(Date.now() / 1000) - 3600},v1=${crypto.createHmac('sha256', mocks.stripeWebhookSecret).update(`${Math.floor(Date.now() / 1000) - 3600}.${fakeBody}`).digest('hex')}`);
  check('aviso do Stripe com assinatura falsa ou antiga é recusado', sBad.status === 400 && sOld.status === 400, `${sBad.status}/${sOld.status}`);
  const again = await mocks.stripeEvent('checkout.session.completed', sn); await sleep(500);
  const enAfter = await (await fetch(`${BASE}/api/orders/${enOrder}`, { headers: { cookie: (await ectx.cookies()).filter((c) => c.name === 'pulso_sid').map((c) => `pulso_sid=${c.value}`).join('') } })).json();
  check('aviso repetido do Stripe não muda nada', again === 200 && enAfter.order.status === 'ready', enAfter.order.status);

  // ── 9. admin: confirmação com ADMIN_TOKEN, vendas por moeda, cobrança em dobro, reembolsos
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await actx.newPage(); watch(ap, 'admin');
  ap.on('dialog', (d) => d.accept());
  await ap.goto(BASE + '/entrar?modo=cadastro&volta=/admin');
  await ap.fill('input[name=name]', 'Dono'); await ap.fill('input[name=email]', ADMIN); await ap.fill('input[name=password]', 'senha-do-dono-1'); await ap.check('input[name=accept]');
  await ap.click('button[type=submit]');
  await ap.waitForURL('**/admin'); await ap.waitForSelector('#claim:not([hidden])');
  check('e-mail de admin precisa confirmar o código', await ap.isHidden('#admin'));
  await ap.fill('#claimToken', 'codigo-errado'); await ap.click('#claimForm button');
  await ap.waitForFunction(() => document.getElementById('claimMsg').textContent.length > 0);
  check('código errado é recusado', (await ap.textContent('#claimMsg')).includes('incorreto'), await ap.textContent('#claimMsg'));
  await ap.fill('#claimToken', ADMIN_TOKEN); await ap.click('#claimForm button');
  await ap.waitForSelector('#kpis .kpi');
  await ap.waitForTimeout(800);
  await ap.screenshot({ path: path.join(SHOTS, '10-admin.png'), fullPage: true });
  const kpi = nb(await ap.textContent('#kpis'));
  check('painel mostra as vendas em reais e em dólar', kpi.includes('R$ 59,80') && kpi.includes('US$ 29.80'), kpi.replace(/\s+/g, ' ').slice(0, 120));
  const alerts = await ap.textContent('#alerts');
  check('painel alerta valor errado e cobrança em dobro', alerts.includes('Pagamento diferente') && alerts.includes('Cobrança em dobro'));
  check('painel mostra Stripe e Mercado Pago ligados', (await ap.textContent('#cfg')).includes('Stripe ligado') && (await ap.textContent('#cfg')).includes('Mercado Pago ligado'));
  check('conta comum não acessa o admin', (await bob('GET', '/api/admin/summary')).status === 404);
  // devolve só a cobrança extra da Maria (o pedido continua pronto)
  await ap.click(`tr[data-open="${orderId}"]`);
  await ap.waitForSelector(`#drawer [data-refund-pay="${dup.id}"]`);
  await ap.screenshot({ path: path.join(SHOTS, '11-admin-pedido.png') });
  await ap.click(`#drawer [data-refund-pay="${dup.id}"]`);
  await ap.waitForTimeout(1200);
  const mariaNow = (await (await asMaria(`/api/orders/${orderId}`)).json()).order.status;
  const mariaFirst = [...mocks.payments.values()].find((x) => x.external_reference === orderId && x.id !== dup.id);
  check('devolve a cobrança em dobro e o pedido continua pronto', mocks.payments.get(String(dup.id)).status === 'refunded' && mariaFirst.status === 'approved' && mariaNow === 'ready', mariaNow);
  // reembolso do pedido do Bob (Mercado Pago)
  await ap.keyboard.press('Escape');
  await ap.click(`tr[data-open="${bobOrder}"]`);
  await ap.waitForSelector('#drawer [data-act="refund"]');
  await ap.click('#drawer [data-act="refund"]');
  await ap.waitForTimeout(1200);
  check('reembolso pelo painel (Mercado Pago)', (await bob('GET', `/api/orders/${bobOrder}`)).json.order.status === 'refunded' && mocks.payments.get(String(good.id)).status === 'refunded');
  // reembolso do pedido em dólar (Stripe)
  await ap.keyboard.press('Escape');
  await ap.click(`tr[data-open="${enOrder}"]`);
  await ap.waitForSelector('#drawer [data-act="refund"]');
  await ap.click('#drawer [data-act="refund"]');
  await ap.waitForTimeout(1200);
  const enRef = await (await fetch(`${BASE}/api/admin/orders/${enOrder}`, { headers: { cookie: (await actx.cookies()).filter((c) => c.name === 'pulso_sid').map((c) => `pulso_sid=${c.value}`).join('') } })).json();
  check('reembolso pelo painel (Stripe)', enRef.order.status === 'refunded' && mocks.refunds.length === 1 && mocks.refunds[0].payment_intent === sn.payment_intent, `${enRef.order.status} · ${mocks.refunds.length} reembolso(s)`);
  await ep.goto(`${BASE}/en/order/${enOrder}`); await ep.waitForTimeout(1500);
  check('EN: página do pedido mostra o reembolso em inglês', /refunded/i.test(await ep.textContent('#oTitle')), await ep.textContent('#oTitle'));
  const reset = await ap.evaluate(async () => { const u = (await (await fetch('/api/admin/users?q=john')).json()).users[0]; return (await (await fetch(`/api/admin/users/${u.id}/reset-link`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json()).url; });
  check('link de nova senha no idioma do cliente', reset.startsWith(`${BASE}/en/new-password#`), reset.split('#')[0]);
  const token = reset.split('#')[1];
  const rr = await client()('POST', '/api/auth/reset', { token, password: 'johns-new-password' });
  const relog = await client()('POST', '/api/auth/login', { email: 'john@buyer.test', password: 'johns-new-password' });
  check('link de nova senha funciona uma vez', rr.status === 200 && relog.status === 200 && (await client()('POST', '/api/auth/reset', { token, password: 'outra-senha-123' })).status === 400);
  const backup = await ap.evaluate(async () => { const r = await fetch('/api/admin/backup'); const b = await r.arrayBuffer(); return { s: r.status, n: b.byteLength, head: String.fromCharCode(...new Uint8Array(b.slice(0, 15))) }; });
  check('backup do banco', backup.s === 200 && backup.head === 'SQLite format 3', `${backup.n} bytes`);
  await actx.close();
  await ectx.close();
  await sctx.close();
  await ctx.close();
} catch (e) {
  check('execução sem erro', false, e.stack || e.message);
} finally {
  check('páginas sem erro de JavaScript', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));
  await browser.close();
  srv.kill('SIGTERM'); mocks.close();
  fs.writeFileSync(path.join(DATA, 'server.log'), srvLog.join(''));
  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} verificações OK${fails.length ? ` — falharam: ${fails.map((f) => f.name).join('; ')}` : ''}`);
  process.exitCode = fails.length ? 1 : 0;
}
