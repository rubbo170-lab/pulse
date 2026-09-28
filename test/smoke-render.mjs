// smoke: sobe o servidor, cria conta admin, cria pedido, marca pago e espera o MP4
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = 3911, BASE = `http://127.0.0.1:${PORT}`, DATA = '/tmp/pulso-smoke';
fs.rmSync(DATA, { recursive: true, force: true });
const env = { ...process.env, PORT: String(PORT), APP_URL: BASE, DATA_DIR: DATA, ADMIN_EMAILS: 'dono@exemplo.com', RENDER_FPS: process.env.FPS || '30' };
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
srv.stdout.on('data', (d) => process.stdout.write('[srv] ' + d)); srv.stderr.on('data', (d) => process.stdout.write('[srv!] ' + d));
let cookie = '';
async function call(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await sleep(100); }
  console.log('signup', (await call('POST', '/api/auth/signup', { name: 'Dono', email: 'dono@exemplo.com', password: 'senha-forte-1', accept: true })).status);
  const spec = JSON.parse(fs.readFileSync('/home/claude/pulso/t/spec_burger.json', 'utf8'));
  const logo = 'data:image/png;base64,' + fs.readFileSync('/home/claude/pulso/t/logo.png').toString('base64');
  const photo = 'data:image/jpeg;base64,' + fs.readFileSync('/home/claude/pulso/t/product.jpg').toString('base64');
  const c = await call('POST', '/api/orders', { spec, logo, photo });
  console.log('order', c.status, c.body.order && c.body.order.id, c.body.checkoutError);
  const id = c.body.order.id;
  console.log('mark-paid', (await call('POST', `/api/admin/orders/${id}/mark-paid`)).status);
  const t0 = Date.now(); let last = '';
  for (;;) {
    const o = (await call('GET', `/api/orders/${id}`)).body.order;
    const s = `${o.status} ${o.queue ? JSON.stringify(o.queue) : ''}`;
    if (s !== last) { console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', s); last = s; }
    if (o.status === 'ready' || o.status === 'failed') { console.log(JSON.stringify(o)); break; }
    if (Date.now() - t0 > 600e3) { console.log('timeout'); break; }
    await sleep(2000);
  }
  const v = await fetch(`${BASE}/api/orders/${id}/video?download=1`, { headers: { cookie } });
  console.log('video', v.status, v.headers.get('content-type'), v.headers.get('content-disposition'));
  fs.writeFileSync('/tmp/pulso-smoke/out.mp4', Buffer.from(await v.arrayBuffer()));
} finally { srv.kill('SIGTERM'); }
