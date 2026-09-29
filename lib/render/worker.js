// Fila de renderização: pega pedidos pagos, desenha no Chrome sem tela e monta o MP4 (H.264 + AAC) com o ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config, ROOT } from '../config.js';
import { q, tx, now, logEvent } from '../db.js';
import { sendFile, safeJoin } from '../http.js';
import { imagePath, videoPath, posterPath, coverPath, deleteOrderFiles, galleryCount, UPLOADS } from '../orders.js';
import { launchChrome } from './chrome.js';

const W = 1080, H = 1920, FRAME_BYTES = W * H * 4, MAX_ATTEMPTS = 3, AHEAD = 6;
const PAGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'page');
const PUBLIC = path.join(ROOT, 'public');
const TMP = path.join(config.dataDir, 'tmp');

export const progress = new Map(); // orderId -> { p, eta, stage }
const jobs = new Map(); // token -> job
let browser = null, browserIdleTimer = null, running = 0, loopback = null, base = '';

// ── servidor interno (só 127.0.0.1): entrega a página de render e recebe os quadros
function startLoopback() {
  return new Promise((resolve) => {
    loopback = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://x');
        const p = url.pathname;
        if (req.method === 'GET') {
          if (p === '/render.html' || p === '/render.js') return sendFile(req, res, path.join(PAGE_DIR, p.slice(1)), { cache: 'no-store' }) || notFound(res);
          if (p.startsWith('/js/') || p.startsWith('/fonts/')) { const f = safeJoin(PUBLIC, p); return (f && sendFile(req, res, f, { cache: 'no-store' })) || notFound(res); }
          const m = /^\/job\/([\w-]+)\/image\/(logo|photo|gallery[0-2])$/.exec(p);
          if (m && jobs.has(m[1])) { const f = imagePath(jobs.get(m[1]).order.id, m[2]); return (f && sendFile(req, res, f, { cache: 'no-store' })) || notFound(res); }
          return notFound(res);
        }
        if (req.method === 'POST') {
          const m = /^\/job\/([\w-]+)\/(frame\/(\d+)|audio|poster|cover)$/.exec(p);
          const job = m && jobs.get(m[1]);
          if (!job) return notFound(res);
          const body = await readAll(req, m[3] != null ? FRAME_BYTES : 32 * 1024 * 1024);
          if (m[3] != null) {
            const i = Number(m[3]);
            if (body.length !== FRAME_BYTES || i < 0 || i >= job.total) { res.writeHead(400); return res.end(); }
            job.onFrame(i, body);
          } else if (m[2] === 'audio') job.audio = body;
          else if (m[2] === 'cover') job.cover = body;
          else job.poster = body;
          res.writeHead(200); return res.end('ok');
        }
        notFound(res);
      } catch (e) { res.writeHead(500); res.end(String(e.message)); }
    });
    loopback.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${loopback.address().port}`; resolve(); });
  });
}
const notFound = (res) => { res.writeHead(404); res.end(); return true; };
function readAll(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('corpo grande demais')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function getBrowser() {
  clearTimeout(browserIdleTimer);
  if (browser && browser.alive) return browser;
  browser = await launchChrome(config.render.chrome);
  return browser;
}
function scheduleBrowserClose() {
  clearTimeout(browserIdleTimer);
  browserIdleTimer = setTimeout(() => { if (running === 0 && browser) { browser.close(); browser = null; } }, 90_000);
  browserIdleTimer.unref();
}

function ffmpegArgs(wavPath, outPath, fps, title) {
  const a = ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(fps), '-i', 'pipe:0',
    '-i', wavPath, '-map', '0:v:0', '-map', '1:a:0',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', config.render.preset, '-crf', String(config.render.crf), '-maxrate', '12M', '-bufsize', '24M',
    '-profile:v', 'high', '-level:v', '4.2', '-g', String(fps * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart',
    '-metadata', `title=${title}`, '-metadata', `comment=Feito com ${config.brandName}`];
  if (config.render.threads > 0) a.push('-threads', String(config.render.threads));
  a.push('-f', 'mp4', outPath);
  return a;
}

// confere o arquivo final antes de entregar: duração, vídeo H.264 1080×1920 e áudio AAC
// undefined = não deu para conferir (ffprobe ausente, travado ou com erro próprio): o vídeo é entregue assim mesmo
let probeWarned = false;
function probe(file) {
  return new Promise((resolve) => {
    let p;
    try { p = spawn(config.render.ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', file], { stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { resolve(undefined); return; }
    let out = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); }, 20_000);
    p.stdout.on('data', (d) => { out += d; });
    p.on('error', () => { clearTimeout(timer); resolve(undefined); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) { resolve(undefined); return; }
      try { resolve(JSON.parse(out)); } catch { resolve(undefined); }
    });
  });
}
// confere as cores e a ordem dos quadros: o quadro `index` decodificado do MP4 tem que bater com o que o navegador desenhou.
// Pega erro de faixa de cor (preto virando cinza), de matriz de cor e de quadro fora de ordem. null = não deu para decodificar.
function decodeFrame(file, index, fps) {
  return new Promise((resolve) => {
    let p;
    const args = ['-v', 'error', '-ss', ((index - 0.5) / fps).toFixed(4), '-i', file, '-an', '-frames:v', '1',
      '-vf', 'scale=in_color_matrix=bt709:in_range=tv:out_range=full,format=rgb24', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'];
    try { p = spawn(config.render.ffmpeg, args, { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { resolve(null); return; }
    const chunks = [];
    const timer = setTimeout(() => { p.kill('SIGKILL'); }, 30_000);
    p.stdout.on('data', (d) => chunks.push(d));
    p.on('error', () => { clearTimeout(timer); resolve(null); });
    p.on('close', () => { clearTimeout(timer); const b = Buffer.concat(chunks); resolve(b.length === W * H * 3 ? b : null); });
  });
}
export function frameDiff(rgba, rgb, step = 3) {
  let sum = 0, bias = 0, n = 0;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const a = (y * W + x) * 4, b = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) { const d = rgb[b + c] - rgba[a + c]; sum += Math.abs(d); bias += d; n++; }
    }
  }
  return { mae: sum / n, bias: bias / n };
}
async function verifyPixels(file, index, fps, expected) {
  if (!expected) return null;
  const got = await decodeFrame(file, index, fps);
  if (!got) return null;
  const d = frameDiff(expected, got);
  // medido: ~1,8–2,2 de erro médio e ~-1,2 de desvio (compressão H.264, croma 4:2:0 e granulação);
  // faixa ou matriz de cor errada dá ~12, quadro trocado bem mais que 6
  if (d.mae > 6 || Math.abs(d.bias) > 3.5) throw new Error(`as cores do MP4 não batem com a prévia (erro médio ${d.mae.toFixed(1)}, desvio ${d.bias.toFixed(1)})`);
  return d;
}

async function verifyVideo(file, dur) {
  const info = await probe(file);
  if (info === undefined) { if (!probeWarned) { probeWarned = true; console.log(`[pulso] não consegui usar o ffprobe (${config.render.ffprobe}): pulei a conferência do MP4`); } return; }
  const v = info && (info.streams || []).find((x) => x.codec_type === 'video'), a = info && (info.streams || []).find((x) => x.codec_type === 'audio');
  const d = info && info.format ? Number(info.format.duration) : NaN;
  const problems = [];
  if (!v || v.codec_name !== 'h264' || v.width !== W || v.height !== H) problems.push('vídeo');
  if (!a || a.codec_name !== 'aac') problems.push('áudio');
  if (!(Math.abs(d - dur) < 0.25)) problems.push(`duração ${d}`);
  if (problems.length) throw new Error(`arquivo final reprovado na conferência (${problems.join(', ')})`);
}

async function renderOrder(order) {
  const t0 = now();
  const dur = [20, 30].includes(order.duration) ? order.duration : 15, fps = config.render.fps, total = Math.round(dur * fps), P = config.render.pages;
  // 20 s = a animação de 15 s mais lenta (k = 4/3); 30 s tem cenas próprias e anda no tempo normal (k = 1)
  const k = dur === 20 ? 20 / 15 : 1;
  const token = crypto.randomBytes(16).toString('hex');
  const dir = path.join(TMP, `${order.id}-${token.slice(0, 6)}`);
  fs.mkdirSync(dir, { recursive: true });
  const version = order.version + 1;
  const outPart = path.join(dir, 'out.mp4'), wavPath = path.join(dir, 'audio.wav');
  const spec = JSON.parse(order.spec);
  let ff = null, ffErr = '', pages = [], failed = null;
  // quadro de conferência: a revelação do produto (~6,9 s do motor), cheia de cor e detalhe
  const job = { token, order, total, next: 0, pending: new Map(), audio: null, poster: null, cover: null, flushing: Promise.resolve(), checkIndex: Math.round(total * 0.46), checkFrame: null };
  jobs.set(token, job);
  progress.set(order.id, { p: 0, eta: null, stage: 'preparando' });
  const deadline = setTimeout(() => { failed = failed || new Error('tempo máximo de render excedido'); if (ff) ff.kill('SIGKILL'); }, config.render.timeoutMs * (dur / 15));

  try {
    const b = await getBrowser();
    pages = await Promise.all(Array.from({ length: P }, () => b.newPage()));
    const setup = { token, spec, fps, k, baseSamples: fps >= 50 ? 6 : 5, logo: !!imagePath(order.id, 'logo'), photo: !!imagePath(order.id, 'photo'),
      gallery: Array.from({ length: galleryCount(order) }, (_, i) => !!imagePath(order.id, `gallery${i}`)).filter(Boolean).length };
    const infos = await Promise.all(pages.map(async (pg) => {
      await pg.navigate(`${base}/render.html`);
      await pg.waitFor("window.PulsoRender && window.PulsoRender.ready && typeof Pulso !== 'undefined' && typeof PulsoAudio !== 'undefined'", 30_000);
      return pg.evaluate(`PulsoRender.setup(${JSON.stringify(setup)})`, 60_000);
    }));
    const info = (infos && infos[0]) || {};

    progress.set(order.id, { p: 0.02, eta: null, stage: 'trilha' });
    await pages[0].evaluate('PulsoRender.audio()', 120_000);
    if (!job.audio || job.audio.length < 1000) throw new Error('a trilha não foi gerada');
    fs.writeFileSync(wavPath, job.audio); job.audio = null;

    ff = spawn(config.render.ffmpeg, ffmpegArgs(wavPath, outPart, fps, `${order.brand} · ${config.brandName}`), { stdio: ['pipe', 'ignore', 'pipe'] });
    ff.stderr.on('data', (d) => { ffErr = (ffErr + d).slice(-2000); });
    ff.stdin.on('error', () => {});
    let inputDone = false;
    const ffDone = new Promise((resolve) => ff.on('close', (code) => {
      if (!inputDone) failed = failed || new Error(`o ffmpeg parou no meio (código ${code}): ${ffErr.trim().slice(-400)}`);
      resolve(code);
    }));
    ff.on('error', (e) => { failed = failed || new Error(`ffmpeg não iniciou: ${e.message}`); });
    const write = (buf) => new Promise((resolve) => {
      if (failed || ff.exitCode !== null) return resolve();
      if (ff.stdin.write(buf)) return resolve();
      const done = () => { ff.stdin.off('drain', done); ff.off('close', done); resolve(); };
      ff.stdin.on('drain', done); ff.on('close', done);
    });
    const tFrames = Date.now();
    job.onFrame = (i, buf) => {
      if (i === job.checkIndex) job.checkFrame = buf;
      job.pending.set(i, buf);
      job.flushing = job.flushing.then(async () => {
        while (job.pending.has(job.next) && !failed) {
          const f = job.pending.get(job.next); job.pending.delete(job.next);
          await write(f); job.next++;
          if (job.next % 15 === 0 || job.next === total) {
            const p = job.next / total, el = (Date.now() - tFrames) / 1000;
            progress.set(order.id, { p: 0.04 + 0.92 * p, eta: p > 0.05 ? Math.round((el / p) * (1 - p) + 4) : null, stage: 'quadros' });
          }
        }
      });
    };

    await Promise.all(pages.map(async (pg, w) => {
      try {
        for (let i = w; i < total; i += P) {
          if (failed) throw failed;
          while (i - job.next > AHEAD) { if (failed) throw failed; await new Promise((r) => setTimeout(r, 4)); }
          await pg.evaluate(`PulsoRender.frame(${i})`, 60_000);
        }
      } catch (e) { failed = failed || e; throw e; }
    }));
    await job.flushing;
    if (failed) throw failed;
    if (job.next !== total) throw new Error(`faltaram quadros (${job.next}/${total})`);
    inputDone = true;
    ff.stdin.end();
    const code = await ffDone;
    if (failed) throw failed;
    if (code !== 0) throw new Error(`ffmpeg saiu com código ${code}: ${ffErr.trim().slice(-600)}`);

    progress.set(order.id, { p: 0.98, eta: 2, stage: 'finalizando' });
    const size = fs.statSync(outPart).size;
    if (size < 100_000) throw new Error('arquivo final pequeno demais');
    await verifyVideo(outPart, dur);
    const pix = await verifyPixels(outPart, job.checkIndex, fps, job.checkFrame);
    job.checkFrame = null;
    const posterT = Number.isFinite(info.posterT) ? info.posterT : dur === 30 ? 29.3 : 14.3, coverT = Number.isFinite(info.coverT) ? info.coverT : 6.9;
    await pages[0].evaluate(`PulsoRender.poster(${posterT.toFixed(3)})`, 30_000).catch(() => null);
    await pages[0].evaluate(`PulsoRender.cover(${coverT.toFixed(3)})`, 60_000).catch(() => null);
    fs.renameSync(outPart, videoPath(order, version));
    if (job.poster && job.poster.length > 1000) fs.writeFileSync(posterPath(order, version), job.poster);
    if (job.cover && job.cover.length > 1000) fs.writeFileSync(coverPath(order, version), job.cover);
    const ms = now() - t0;
    const ok = tx(() => q(`UPDATE orders SET status = 'ready', version = ?, ready_at = ?, file_size = ?, render_ms = ?, render_error = NULL, updated_at = ? WHERE id = ? AND status = 'rendering'`)
      .run(version, now(), size, ms, now(), order.id).changes);
    if (ok) { deleteOrderFiles(order, { keepVersion: version }); logEvent('render.ok', { orderId: order.id, detail: `v${version} ${(size / 1e6).toFixed(1)} MB em ${(ms / 1000).toFixed(0)} s${pix ? ` · cor Δ${pix.mae.toFixed(1)}` : ''}` }); }
    // o pedido mudou durante o render (ex.: reembolso): os arquivos desta versão não ficam
    else { for (const f of [videoPath(order, version), posterPath(order, version), coverPath(order, version)]) fs.rmSync(f, { force: true }); }
    if (pix) console.log(`[pulso] render ${order.id} v${version}: conferência de cor erro médio ${pix.mae.toFixed(2)}, desvio ${pix.bias.toFixed(2)}`);
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 900);
    const attempts = order.render_attempts;
    const final = attempts >= MAX_ATTEMPTS;
    q(`UPDATE orders SET status = ?, render_error = ?, render_after = ?, updated_at = ? WHERE id = ? AND status = 'rendering'`)
      .run(final ? 'failed' : 'paid', msg, now() + 20_000 * attempts, now(), order.id);
    logEvent(final ? 'render.failed' : 'render.retry', { orderId: order.id, detail: msg });
    console.error(`[pulso] render ${order.id} falhou (tentativa ${attempts}):`, msg);
    if (ff) ff.kill('SIGKILL');
    if (browser && /Chrome fechou|travou|tempo esgotado/.test(msg)) { try { await browser.close(); } catch { /* ignora */ } browser = null; }
  } finally {
    clearTimeout(deadline);
    jobs.delete(token);
    progress.delete(order.id);
    for (const pg of pages) await pg.close().catch(() => {});
    fs.rm(dir, { recursive: true, force: true }, () => {});
  }
}

function claimNext() {
  const t = now();
  return q(`UPDATE orders SET status = 'rendering', render_started_at = ?, render_attempts = render_attempts + 1, updated_at = ?
            WHERE id = (SELECT id FROM orders WHERE status = 'paid' AND render_after <= ? ORDER BY paid_at, created_at LIMIT 1) AND status = 'paid'
            RETURNING *`).get(t, t, t) || null;
}

async function tick() {
  try {
    while (running < config.render.concurrency) {
      const order = claimNext();
      if (!order) break;
      running++;
      renderOrder(order).catch((e) => console.error('[pulso] render', order.id, e && e.message)).finally(() => { running--; if (running === 0) scheduleBrowserClose(); setImmediate(tick); });
    }
  } catch (e) { console.error('[pulso] fila de render:', e && e.message); }
}

export function queueInfo(order) {
  if (order.status === 'rendering') return { position: 0, ...(progress.get(order.id) || { p: 0, eta: null, stage: 'preparando' }) };
  if (order.status !== 'paid') return null;
  const ahead = q(`SELECT COUNT(*) AS n FROM orders WHERE status = 'paid' AND (paid_at < ? OR (paid_at = ? AND created_at < ?))`).get(order.paid_at, order.paid_at, order.created_at).n;
  const renderingNow = q(`SELECT COUNT(*) AS n FROM orders WHERE status = 'rendering'`).get().n;
  return { position: ahead + 1, rendering: renderingNow };
}

export const nudge = () => setImmediate(tick);

export async function startWorker() {
  if (config.render.disabled) { console.log('[pulso] render desativado (RENDER_DISABLED=1)'); return; }
  fs.mkdirSync(TMP, { recursive: true });
  for (const d of fs.readdirSync(TMP)) fs.rmSync(path.join(TMP, d), { recursive: true, force: true });
  // quem estava renderizando quando o servidor caiu volta para a fila
  q(`UPDATE orders SET status = CASE WHEN render_attempts >= ? THEN 'failed' ELSE 'paid' END, render_error = COALESCE(render_error, 'servidor reiniciou durante o render'), updated_at = ? WHERE status = 'rendering'`).run(MAX_ATTEMPTS, now());
  await startLoopback();
  setInterval(tick, 2000);
  tick();
}

// limpeza periódica: vídeos vencidos, pedidos reembolsados e pedidos não pagos antigos
export function cleanupFiles() {
  const t = now();
  for (const o of q(`SELECT * FROM orders WHERE (status = 'ready' AND ready_at < ?) OR (status = 'refunded' AND updated_at < ?)`).all(t - config.retentionDays * 864e5, t - 864e5)) {
    if (fs.existsSync(videoPath(o)) || fs.existsSync(path.join(UPLOADS, o.id))) { deleteOrderFiles(o, { keepVersion: -1 }); logEvent('video.expired', { orderId: o.id, detail: o.status }); }
    fs.rmSync(path.join(UPLOADS, o.id), { recursive: true, force: true });
  }
  // pedido sem pagamento expira em 3 dias; as imagens dele somem depois de 7
  q(`UPDATE orders SET status = 'expired', expired_at = ?, updated_at = ? WHERE status = 'awaiting_payment' AND created_at < ?`).run(t, t, t - 3 * 864e5);
  for (const o of q(`SELECT id FROM orders WHERE status = 'expired' AND created_at < ?`).all(t - 7 * 864e5)) fs.rmSync(path.join(UPLOADS, o.id), { recursive: true, force: true });
}
