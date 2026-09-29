// Bancada do motor criativo: folhas de contato (uma linha por vídeo, um quadro por cena) e varredura de erros.
// Uso:
//   node test/studio-sheets.mjs                      → folhas de 4 vídeos para cada exemplo em /tmp/pulso-sheets
//   SPEC=petshop SEEDS=1,2,3 DUR=30 LOOK=neon node test/studio-sheets.mjs
//   SWEEP=300 node test/studio-sheets.mjs            → monta 300 vídeos por duração e desenha cada cena; falha se houver erro
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUB = path.join(ROOT, 'public'), EX = path.join(ROOT, 'test/examples');
const OUT = process.env.OUT || '/tmp/pulso-sheets';
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/BricolageGrotesque-Bold.ttf);font-weight:700 800}
@font-face{font-family:'Big Shoulders Display';src:url(/fonts/BigShoulders-Bold.ttf);font-weight:700 800}
@font-face{font-family:'Gloock';src:url(/fonts/Gloock-Regular.ttf);font-weight:400}
@font-face{font-family:'Instrument Sans';src:url(/fonts/InstrumentSans-Regular.ttf);font-weight:400 500}
@font-face{font-family:'Instrument Sans';src:url(/fonts/InstrumentSans-Bold.ttf);font-weight:600 700}
@font-face{font-family:'IBM Plex Mono';src:url(/fonts/IBMPlexMono-Regular.ttf);font-weight:400 500}
@font-face{font-family:'IBM Plex Mono';src:url(/fonts/IBMPlexMono-Bold.ttf);font-weight:700}
</style></head><body>
${['engine_util', 'engine', 'audio', 'studio_kit', 'studio_scenes', 'studio', 'studio_audio'].map((f) => `<script src="/js/${f}.js"></script>`).join('\n')}
</body></html>`;

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
  const [base, dir] = u.startsWith('/ex/') ? ['/ex/', EX] : ['/', PUB];
  const f = path.join(dir, u.slice(base.length));
  if (f.startsWith(dir) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(res); }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/');
await page.evaluate(async () => {
  await PulsoStudio.ready('/fonts/'); await document.fonts.ready;
  const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = u; });
  window.IMGS = { product: await load('/ex/burger-foto.jpg'), logo: await load('/ex/burger-logo.png'), gallery: [await load('/ex/gallery/fotos.jpg'), await load('/ex/gallery/site.jpg')] };
});

const specOf = (name) => JSON.parse(fs.readFileSync(path.join(EX, `${name}.json`), 'utf8'));
let failed = false;
try {
  if (process.env.SWEEP) {
    const n = Number(process.env.SWEEP) || 200;
    for (const name of ['confeitaria', 'hamburgueria', 'petshop', 'salao']) {
      for (const dur of [15, 20, 30]) {
        const r = await page.evaluate(([spec, n, dur]) => {
          const bad = [], looks = {}, arcs = {}, variants = new Set();
          for (let seed = 1; seed <= n; seed++) {
            const images = seed % 3 ? window.IMGS : { logo: null, product: null, gallery: [] };
            try {
              const E = PulsoStudio.create({ ...spec, duration: dur, creative: { v: 2, seed } }, images);
              const c = document.createElement('canvas'); c.width = 108; c.height = 192;
              E.scenes.forEach((s) => E.renderFrame(c, s.thumb, { samples: 1 }));
              E.plan.trans.forEach((t) => E.renderFrame(c, t.t, { samples: 1 }));
              if (Math.abs(E.plan.scenes.reduce((a, s) => a + s.d, 0) - dur) > 1e-6 && Math.abs(E.plan.scenes[E.plan.scenes.length - 1].t1 - dur) > 1e-6) bad.push(`${seed}: duração`);
              looks[E.plan.look] = (looks[E.plan.look] || 0) + 1; arcs[E.plan.arc] = (arcs[E.plan.arc] || 0) + 1; E.plan.scenes.forEach((s) => variants.add(s.variant));
            } catch (e) { bad.push(`${seed}: ${e.message}`); }
          }
          return { bad, looks, arcs, variants: variants.size };
        }, [specOf(name), n, dur]);
        console.log(`${name} ${dur}s: ${r.bad.length ? 'FALHOU ' + r.bad.slice(0, 5).join(' | ') : 'ok'} · visuais ${JSON.stringify(r.looks)} · histórias ${Object.keys(r.arcs).length} · composições ${r.variants}`);
        if (r.bad.length) failed = true;
      }
    }
  } else {
    const names = process.env.SPEC ? [process.env.SPEC] : ['confeitaria', 'hamburgueria', 'petshop', 'salao'];
    const seeds = (process.env.SEEDS || '1,2,3,4').split(',').map(Number), dur = Number(process.env.DUR || 15), look = process.env.LOOK || 'auto';
    for (const name of names) {
      const url = await page.evaluate(([spec, seeds, dur, look]) => {
        const sc = 0.2, fw = 216, fh = 384, pad = 8, lab = 34;
        // como nos vídeos de exemplo: só a hamburgueria tem foto e logo
        const imgs = spec.brand && /burger|joe|pepe/i.test(spec.brand.name) ? window.IMGS : { logo: null, product: null, gallery: [] };
        const Es = seeds.map((seed) => PulsoStudio.create({ ...spec, duration: dur, creative: { v: 2, seed, look } }, imgs));
        const cols = Math.max(...Es.map((E) => E.scenes.length));
        const out = document.createElement('canvas'); out.width = pad + cols * (fw + pad); out.height = Es.length * (fh + lab + pad) + pad;
        const g = out.getContext('2d'); g.fillStyle = '#1b1b1f'; g.fillRect(0, 0, out.width, out.height);
        const fr = document.createElement('canvas'); fr.width = fw; fr.height = fh;
        Es.forEach((E, r) => {
          const y = pad + r * (fh + lab + pad), P = E.plan;
          g.fillStyle = '#fff'; g.font = "700 15px 'IBM Plex Mono'";
          g.fillText(`semente ${P.seed} · ${E.lookName} · ${E.arcName} · ${P.typeId} · ${P.bpm} bpm ${P.genre}`, pad, y + 14);
          g.fillStyle = '#aaa'; g.font = "400 12px 'IBM Plex Mono'";
          g.fillText(P.scenes.map((s) => s.variant).join(' · ') + '  |  ' + P.trans.map((t) => t.kind).join(', '), pad, y + 29);
          E.scenes.forEach((s, c) => { E.renderFrame(fr, s.thumb, { samples: 1 }); g.drawImage(fr, pad + c * (fw + pad), y + lab); });
          void sc;
        });
        return out.toDataURL('image/png');
      }, [specOf(name), seeds, dur, look]);
      const file = path.join(OUT, `${name}-${dur}s-${look}.png`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(file);
    }
  }
  if (errors.length) { failed = true; console.log('ERROS NA PÁGINA:\n' + [...new Set(errors)].slice(0, 20).join('\n')); }
} finally {
  await browser.close(); server.close();
}
process.exit(failed ? 1 : 0);
