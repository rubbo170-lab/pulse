// Tradução das páginas: o HTML em português é o modelo; inglês e espanhol saem de dicionários (i18n/en.json, i18n/es.json)
// que mapeiam cada texto em português para o texto traduzido. Também troca os links para os caminhos do idioma.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config } from './config.js';
import { PATHS } from './paths.js';

const VIEWS = path.join(ROOT, 'views');
const DICT_DIR = path.join(ROOT, 'i18n');
const HTML_LANG = { pt: 'pt-BR', en: 'en', es: 'es' };
const LANG_NAME = { pt: 'Português', en: 'English', es: 'Español' };

let dicts = null, dictsMtime = 0;
function loadDicts() {
  const files = ['en', 'es'].map((l) => path.join(DICT_DIR, `${l}.json`));
  const m = Math.max(...files.map((f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } }));
  if (dicts && m === dictsMtime) return dicts;
  dicts = { pt: { pages: {}, js: {}, api: {} } };
  for (const l of ['en', 'es']) {
    try { dicts[l] = JSON.parse(fs.readFileSync(path.join(DICT_DIR, `${l}.json`), 'utf8')); }
    catch (e) { console.error(`[pulso] dicionário ${l} com erro:`, e.message); dicts[l] = { pages: {}, js: {}, api: {} }; }
  }
  dictsMtime = m;
  return dicts;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const encText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
const encAttr = (s) => encText(s).replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
const hasWords = (s) => /\p{L}/u.test(s);

// "/criar?volta=/meus-videos#x" no idioma de destino
const PT_ROUTES = Object.fromEntries(Object.entries(PATHS.pt).map(([k, v]) => [v, k]));
export function localizeUrl(u, lang) {
  if (lang === 'pt' || !u || !u.startsWith('/') || u.startsWith('//')) return u;
  if (u.startsWith('/media/pt/')) return `/media/${lang}/` + u.slice(10);
  if (u === '/i18n/pt.js') return `/i18n/${lang}.js`;
  const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(u);
  let [, p, qs = '', hash = ''] = m;
  let out;
  if (PT_ROUTES[p]) out = PATHS[lang][PT_ROUTES[p]];
  else if (p.startsWith('/pedido/')) out = PATHS[lang].order + p.slice(7);
  else return u;
  if (qs) qs = qs.replace(/([?&]volta=)([^&]*)/, (_, a, v) => a + encodeURIComponent(localizeUrl(decodeURIComponent(v), lang)));
  return out + qs + hash;
}

function translateAttrs(tag, lang, t, missing) {
  const name = (/^<\s*([a-zA-Z0-9-]+)/.exec(tag) || [])[1] || '';
  const isMetaText = name === 'meta' && /(name="description"|property="og:(title|description)")/.test(tag);
  return tag.replace(/(\s)([a-zA-Z-:]+)="([^"]*)"/g, (all, sp, attr, val) => {
    if (attr === 'href' || attr === 'src' || attr === 'poster' || attr === 'data-src') { const nv = localizeUrl(decode(val), lang); return `${sp}${attr}="${encAttr(nv)}"`; }
    if (attr === 'lang' && name === 'html') return `${sp}lang="${HTML_LANG[lang]}"`;
    if (['placeholder', 'aria-label', 'title', 'alt'].includes(attr) || (attr === 'content' && isMetaText)) {
      const plain = decode(val), key = norm(plain);
      if (!key || !hasWords(key)) return all;
      const tr = t[key];
      if (tr == null) { missing.add(key); return all; }
      return `${sp}${attr}="${encAttr(tr)}"`;
    }
    return all;
  });
}

export function translateHtml(html, lang, missing = new Set()) {
  if (lang === 'pt') return html;
  const t = loadDicts()[lang].pages || {};
  const out = [];
  const re = /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>|<[^>]+>|[^<]+/g;
  let m;
  while ((m = re.exec(html))) {
    const tok = m[0];
    if (tok.startsWith('<!--')) { out.push(tok); continue; }
    if (m[1]) { out.push(tok.replace(/^<[^>]+>/, (open) => translateAttrs(open, lang, t, missing))); continue; }
    if (tok.startsWith('<')) { out.push(translateAttrs(tok, lang, t, missing)); continue; }
    const plain = decode(tok), key = norm(plain);
    if (!key || !hasWords(key) || /^\{\{.*\}\}$/.test(key)) { out.push(tok); continue; }
    const tr = t[key];
    if (tr == null) { missing.add(key); out.push(tok); continue; }
    const lead = /^\s*/.exec(plain)[0], trail = /\s*$/.exec(plain)[0];
    out.push(encText(lead + tr + trail));
  }
  return out.join('');
}

// links para as outras línguas + <link rel=alternate>
function langLinks(page, lang, id) {
  const href = (l) => (page === 'order' && id ? `${PATHS[l].order}/${id}` : PATHS[l][page] || PATHS[l].home);
  const nav = ['pt', 'en', 'es'].map((l) => (l === lang ? `<span aria-current="true">${LANG_NAME[l]}</span>` : `<a href="${href(l)}" hreflang="${HTML_LANG[l]}" lang="${HTML_LANG[l]}">${LANG_NAME[l]}</a>`)).join('');
  const alt = page === 'order' ? '' : ['pt', 'en', 'es'].map((l) => `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${config.appUrl}${href(l)}">`).join('') + `<link rel="alternate" hreflang="x-default" href="${config.appUrl}${href('pt')}">`;
  return { nav, alt };
}

const cache = new Map();
export function renderPage(file, lang, { page = null, id = null } = {}) {
  // página própria do idioma (ex.: termos.en.html) quando existe; senão, tradução do modelo em português
  const own = path.join(VIEWS, file.replace(/\.html$/, `.${lang}.html`));
  const src = lang !== 'pt' && fs.existsSync(own) ? own : path.join(VIEWS, file);
  const st = fs.statSync(src);
  loadDicts();
  const key = `${src}:${st.mtimeMs}:${lang}:${dictsMtime}:${page}:${id || ''}`;
  let html = cache.get(key);
  if (!html) {
    const raw = fs.readFileSync(src, 'utf8');
    html = src === own ? translateUrlsOnly(raw, lang) : translateHtml(raw, lang);
    const { nav, alt } = langLinks(page, lang, id);
    html = html.replace('<!--LANGS-->', nav).replace('<!--HREFLANG-->', alt);
    if (cache.size > 200) cache.clear();
    cache.set(key, html);
  }
  return html;
}

function translateUrlsOnly(html, lang) {
  return html.replace(/<[^>]+>/g, (tag) => tag.replace(/(\s)(href|src|poster|data-src)="([^"]*)"/g, (all, sp, a, v) => `${sp}${a}="${encAttr(localizeUrl(decode(v), lang))}"`).replace(/(<html[^>]*\s)lang="[^"]*"/, `$1lang="${HTML_LANG[lang]}"`));
}

// dicionário das mensagens da API e script com os textos do navegador
export function apiText(msg, lang) {
  if (!msg || lang === 'pt' || !['en', 'es'].includes(lang)) return msg;
  const d = loadDicts()[lang].api || {};
  return d[msg] || msg;
}
export function clientScript(lang) {
  const d = loadDicts()[lang] || { js: {} };
  return `window.LANG=${JSON.stringify(lang)};window.PATHS=${JSON.stringify(PATHS[lang])};window.I18N=${JSON.stringify(lang === 'pt' ? {} : d.js || {})};`;
}

// para o teste: textos das páginas que ainda não têm tradução
export function auditTemplates() {
  const report = {};
  for (const lang of ['en', 'es']) {
    for (const f of fs.readdirSync(VIEWS).filter((x) => /^[a-z0-9-]+\.html$/.test(x) && x !== 'admin.html')) {
      if (fs.existsSync(path.join(VIEWS, f.replace(/\.html$/, `.${lang}.html`)))) continue;
      const missing = new Set();
      translateHtml(fs.readFileSync(path.join(VIEWS, f), 'utf8'), lang, missing);
      if (missing.size) report[`${lang}/${f}`] = [...missing];
    }
  }
  return report;
}
