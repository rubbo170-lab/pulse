// Configuração lida do ambiente (.env em desenvolvimento, variáveis do Railway em produção).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env simples: CHAVE=valor, # comentários, aspas opcionais. Nunca sobrescreve o que já veio do ambiente.
function loadDotEnv(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv(path.join(ROOT, '.env'));

const env = process.env;
const num = (v, d) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : d; };

function findChrome() {
  if (env.CHROME_PATH) return env.CHROME_PATH;
  const candidates = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/pw-browsers/chromium'];
  try {
    for (const d of fs.readdirSync('/opt/pw-browsers')) if (d.startsWith('chromium_headless_shell-')) candidates.unshift(`/opt/pw-browsers/${d}/chrome-linux/headless_shell`);
  } catch { /* sem Playwright local */ }
  return candidates.find((p) => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } }) || 'chromium';
}

const port = num(env.PORT, 3000);
// normaliza para a forma que o navegador envia (domínio com ç vira xn--...; sem barra no fim)
function originOf(u) { try { return new URL(u).origin; } catch { return String(u).trim().replace(/\/+$/, ''); } }
const appUrl = originOf((env.APP_URL || `http://localhost:${port}`).trim());
const mpToken = (env.MP_ACCESS_TOKEN || '').trim();

export const config = {
  port,
  appUrl,
  secure: appUrl.startsWith('https://'),
  isProd: env.NODE_ENV === 'production',
  trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY === '1' : env.NODE_ENV === 'production',
  dataDir: path.resolve(ROOT, env.DATA_DIR || 'data'),
  brandName: env.BRAND_NAME || 'Pulso',
  // preço por moeda e duração (centavos)
  prices: {
    BRL: { 15: Math.round(num(env.PRICE_BRL, 29.9) * 100), 20: Math.round(num(env.PRICE_BRL_20, 34.9) * 100), 30: Math.round(num(env.PRICE_BRL_30, 44.9) * 100) },
    USD: { 15: Math.round(num(env.PRICE_USD, 9.9) * 100), 20: Math.round(num(env.PRICE_USD_20, 12.9) * 100), 30: Math.round(num(env.PRICE_USD_30, 16.9) * 100) },
  },
  editsIncluded: Math.max(0, Math.round(num(env.FREE_EDITS, 1))),
  retentionDays: Math.max(1, Math.round(num(env.VIDEO_RETENTION_DAYS, 30))),
  admins: (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  // código que o dono digita uma vez em /admin para confirmar que é ele (evita alguém criar antes a conta com o e-mail de admin)
  adminToken: (env.ADMIN_TOKEN || '').trim(),
  mp: {
    token: mpToken,
    webhookSecret: (env.MP_WEBHOOK_SECRET || '').trim(),
    apiBase: (env.MP_API_BASE || 'https://api.mercadopago.com').replace(/\/+$/, ''),
    sandbox: env.MP_SANDBOX === '1' || mpToken.startsWith('TEST-'),
    statement: (env.MP_STATEMENT_DESCRIPTOR || 'PULSOVIDEOS').slice(0, 13),
    requireSignature: env.MP_WEBHOOK_REQUIRE_SIGNATURE === '1',
  },
  stripe: {
    // de preferência uma chave restrita (rk_live_…) só com as permissões que o Pulso usa; a secreta (sk_live_…) também funciona
    key: (env.STRIPE_SECRET_KEY || '').trim(),
    webhookSecret: (env.STRIPE_WEBHOOK_SECRET || '').trim(),
    apiBase: (env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/+$/, ''),
    // fatura (PDF) enviada ao cliente depois do pagamento: ligada por padrão (STRIPE_INVOICES=0 desliga)
    invoices: env.STRIPE_INVOICES !== '0',
    // imposto automático (Stripe Tax): não atende contas do Brasil; se o Stripe recusar, lib/stripe.js segue sem ele
    tax: env.STRIPE_TAX === '1',
    taxCode: /^txcd_\d{8}$/.test(env.STRIPE_TAX_CODE || '') ? env.STRIPE_TAX_CODE : '',
    taxBehavior: env.STRIPE_TAX_BEHAVIOR === 'exclusive' ? 'exclusive' : 'inclusive',
  },
  ai: {
    key: (env.ANTHROPIC_API_KEY || '').trim(),
    model: env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    base: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, ''),
    dailyCap: Math.round(num(env.AI_DAILY_CAP, 400)),
    perUserDay: Math.round(num(env.AI_PER_USER_DAY, 25)),
    perIpDay: Math.round(num(env.AI_PER_IP_DAY, 6)),
  },
  render: {
    chrome: findChrome(),
    ffmpeg: env.FFMPEG_PATH || 'ffmpeg',
    // ffprobe ao lado do ffmpeg só quando o nome do arquivo é exatamente "ffmpeg"; senão, o ffprobe do sistema
    ffprobe: env.FFPROBE_PATH || (env.FFMPEG_PATH && /(^|[\\/])ffmpeg(\.exe)?$/i.test(env.FFMPEG_PATH) ? env.FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/i, (m, e) => `ffprobe${e || ''}`) : 'ffprobe'),
    fps: Math.round(num(env.RENDER_FPS, 60)),
    pages: Math.max(1, Math.min(8, Math.round(num(env.RENDER_PAGES, Math.min(4, os.cpus().length || 1))))),
    concurrency: Math.max(1, Math.round(num(env.RENDER_CONCURRENCY, 1))),
    crf: Math.round(num(env.RENDER_CRF, 20)),
    preset: env.RENDER_PRESET || 'faster',
    threads: Math.round(num(env.FFMPEG_THREADS, 0)),
    timeoutMs: Math.round(num(env.RENDER_TIMEOUT_S, 900)) * 1000,
    disabled: env.RENDER_DISABLED === '1',
  },
  company: {
    name: env.COMPANY_NAME || '',
    doc: env.COMPANY_DOC || '',
    email: env.SUPPORT_EMAIL || '',
    whatsapp: (env.SUPPORT_WHATSAPP || '').replace(/\D/g, ''),
    city: env.COMPANY_CITY || '',
  },
};

export const LANGS = ['pt', 'en', 'es'];
export const DURATIONS = [15, 20, 30];
// português cobra em reais pelo Mercado Pago (Pix); inglês e espanhol cobram em dólar pelo Stripe
export const currencyFor = (lang) => (lang === 'pt' ? 'BRL' : 'USD');
export const providerFor = (currency) => (currency === 'BRL' ? 'mercadopago' : 'stripe');
export const priceFor = (currency, duration) => config.prices[currency][DURATIONS.includes(duration) ? duration : 15];
export const paymentsReady = (currency = 'BRL') => (currency === 'BRL' ? !!config.mp.token : !!config.stripe.key);
export const aiReady = () => !!config.ai.key;
