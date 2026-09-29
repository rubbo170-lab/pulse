// Gera os vídeos de exemplo da página inicial com o mesmo pipeline do servidor (empresas fictícias).
// Uso: LANG_EX=pt|en|es [ONLY=hamburgueria,salao] [POSTER_salao=7.2] node --disable-warning=ExperimentalWarning test/render-examples.mjs
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LANG = ['pt', 'en', 'es'].includes(process.env.LANG_EX) ? process.env.LANG_EX : 'pt';
const PORT = 3921, BASE = `http://127.0.0.1:${PORT}`, DATA = `/tmp/pulso-examples-${LANG}`;
const EX = path.join(ROOT, 'test/examples'), SPECS = LANG === 'pt' ? EX : path.join(EX, LANG), OUT = path.join(ROOT, 'public/media', LANG);
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const TOKEN = 'token-dos-exemplos';
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), APP_URL: BASE, DATA_DIR: DATA, ADMIN_EMAILS: 'ex@exemplo.com', ADMIN_TOKEN: TOKEN, RENDER_FPS: process.env.FPS || '60' }, stdio: ['ignore', 'inherit', 'inherit'] });
let cookie = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, p, body, tries = 3) => {
  let r;
  try { r = await fetch(BASE + p, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { if (tries > 1) { await sleep(500); return call(method, p, body, tries - 1); } throw e; }
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => null) };
};
const img = (f, type) => (fs.existsSync(path.join(EX, f)) ? `data:${type};base64,` + fs.readFileSync(path.join(EX, f)).toString('base64') : null);
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await sleep(100); }
  await call('POST', '/api/auth/signup', { name: 'Exemplos', email: 'ex@exemplo.com', password: 'exemplos-123', accept: true, lang: LANG });
  const claim = await call('POST', '/api/admin/claim', { token: TOKEN });
  if (claim.status !== 200) throw new Error('não confirmou o admin: ' + JSON.stringify(claim.body));
  const list = (process.env.ONLY || 'hamburgueria,confeitaria,petshop,salao').split(',');
  const ids = {};
  for (const name of list) {
    const spec = JSON.parse(fs.readFileSync(path.join(SPECS, `${name}.json`), 'utf8'));
    const base = name === 'hamburgueria' ? 'burger' : name;
    // logo próprio de cada idioma quando existe (a hamburgueria muda de nome: Burger do Zé, Big Joe's, Don Pepe)
    const logoFile = LANG !== 'pt' && fs.existsSync(path.join(EX, `${base}-logo-${LANG}.png`)) ? `${base}-logo-${LANG}.png` : `${base}-logo.png`;
    const r = await call('POST', '/api/orders', { spec, lang: LANG, duration: 15, logo: img(logoFile, 'image/png'), photo: img(`${base}-foto.jpg`, 'image/jpeg') });
    if (!r.body || !r.body.order) throw new Error(`pedido ${name}: ${JSON.stringify(r.body)}`);
    ids[name] = r.body.order.id;
    const mp = await call('POST', `/api/admin/orders/${ids[name]}/mark-paid`);
    if (mp.status !== 200) throw new Error(`mark-paid ${name}: ${JSON.stringify(mp.body)}`);
  }
  const t0 = Date.now();
  for (const name of list) {
    for (;;) {
      const o = (await call('GET', `/api/orders/${ids[name]}`)).body.order;
      if (o.status === 'ready' || o.status === 'failed') { console.log(LANG, name, o.status, ((Date.now() - t0) / 1000).toFixed(0) + 's', o.fileSize); break; }
      await sleep(3000);
    }
    const v = await fetch(`${BASE}/api/orders/${ids[name]}/video`, { headers: { cookie } });
    const full = path.join(DATA, `${name}.mp4`);
    fs.writeFileSync(full, Buffer.from(await v.arrayBuffer()));
    // versão leve para a web (720p, mesma fluidez)
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', full, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-maxrate', '3500k', '-bufsize', '7000k', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(OUT, `exemplo-${name}.mp4`)]);
    // pôster: a capa que o próprio render escolheu (motor criativo: o quadro do produto), ou um instante fixo (POSTER_nome=6.9)
    const cv = process.env[`POSTER_${name}`] ? null : await fetch(`${BASE}/api/orders/${ids[name]}/cover`, { headers: { cookie } });
    if (cv && cv.ok) { const cf = path.join(DATA, `${name}-capa.jpg`); fs.writeFileSync(cf, Buffer.from(await cv.arrayBuffer())); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', cf, '-vf', 'scale=720:1280:flags=lanczos', '-q:v', '3', path.join(OUT, `exemplo-${name}.jpg`)]); }
    else execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', process.env[`POSTER_${name}`] || '6.9', '-i', full, '-frames:v', '1', '-vf', 'scale=720:1280:flags=lanczos', '-q:v', '3', path.join(OUT, `exemplo-${name}.jpg`)]);
  }
} finally { srv.kill('SIGTERM'); }
