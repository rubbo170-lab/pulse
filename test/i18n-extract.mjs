// lista os textos que precisam de tradução: páginas (auditoria do tradutor), T('…') do navegador e mensagens da API
import fs from 'node:fs';
import path from 'node:path';
import { auditTemplates } from '../lib/i18n.js';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = { pages: new Set(), js: new Set(), api: new Set() };
for (const [, list] of Object.entries(auditTemplates())) list.forEach((s) => out.pages.add(s));
const jsFiles = ['common.js', 'editor.js', 'pedido.js', 'meus-videos.js', 'entrar.js', 'nova-senha.js', 'landing.js'].map((f) => path.join(ROOT, 'public/js', f));
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bT\(\s*'((?:[^'\\]|\\.)*)'/g)) out.js.add(m[1].replace(/\\'/g, "'"));
}
// strings indiretas usadas com T(variável)
const editor = fs.readFileSync(path.join(ROOT, 'public/js/editor.js'), 'utf8');
for (const k of ['SEGMENTS', 'SCENES']) { const m = new RegExp(`const ${k} = \\[([^\\]]*)\\]`).exec(editor); m[1].match(/'([^']+)'/g).forEach((s) => out.js.add(s.slice(1, -1))); }
const icons = /const ICON_LABELS = \{([^}]*)\}/.exec(editor)[1]; for (const m of icons.matchAll(/:\s*'([^']+)'/g)) out.js.add(m[1]);
['Prova', 'Oferta', 'Frase', 'PNG ou JPG, opcional', 'Opcional. Foto vertical fica melhor'].forEach((s) => out.js.add(s));
['Aguardando pagamento', 'Na fila', 'Gerando o vídeo', 'Pronto', 'Falhou', 'Reembolsado', 'Expirado'].forEach((s) => out.js.add(s));
for (const f of ['server.js', ...fs.readdirSync(path.join(ROOT, 'lib')).filter((x) => x.endsWith('.js')).map((x) => 'lib/' + x)]) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/\b(?:fail|limit)\([^'`\n]*?'((?:[^'\\]|\\.)*)'/g)) if (/[a-zà-ú]/i.test(m[1]) && !/^(signup|login|ai|order|reset|claim|wh)/.test(m[1])) out.api.add(m[1]);
  for (const m of src.matchAll(/apiText\('((?:[^'\\]|\\.)*)'/g)) out.api.add(m[1]);
}
const lang = process.argv[2];
const dict = lang ? JSON.parse(fs.readFileSync(path.join(ROOT, `i18n/${lang}.json`), 'utf8')) : null;
for (const sec of ['pages', 'js', 'api']) {
  const all = [...out[sec]];
  const missing = dict ? all.filter((s) => dict[sec][s] == null) : all;
  console.log(`## ${sec} (${missing.length}${dict ? ' faltando' : ''})`);
  if (process.argv.includes('--list')) missing.forEach((s) => console.log(JSON.stringify(s)));
}
