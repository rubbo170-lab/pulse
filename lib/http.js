// Mini framework HTTP sem dependências: rotas, JSON, cookies, arquivos estáticos (com Range e gzip) e cabeçalhos de segurança.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import net from 'node:net';
import { config } from './config.js';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json',
};
export const mimeOf = (file) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
const COMPRESSIBLE = /^(text\/|application\/(json|manifest)|image\/svg)/;

export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  if (config.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
}

// IP do cliente atrás do proxy do Railway: X-Real-IP ou o último item de X-Forwarded-For (o que o proxy acrescentou);
// o primeiro item pode ser inventado por quem faz a requisição.
export function clientIp(req) {
  if (config.trustProxy) {
    const real = String(req.headers['x-real-ip'] || '').trim().slice(0, 64);
    if (net.isIP(real)) return real;
    const parts = String(req.headers['x-forwarded-for'] || '').slice(0, 512).split(',').map((x) => x.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && net.isIP(last)) return last;
  }
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie malformado */ }
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, httpOnly = true, sameSite = 'Lax', path: p = '/' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${p}; SameSite=${sameSite}`;
  if (httpOnly) c += '; HttpOnly';
  if (config.secure) c += '; Secure';
  if (maxAge != null) c += `; Max-Age=${Math.floor(maxAge)}`;
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : c);
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const len = Number(req.headers['content-length'] || 0);
    if (len > limit) { req.resume(); reject(new HttpError(413, 'Envio grande demais.')); return; }
    const chunks = []; let size = 0, done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; req.resume(); reject(new HttpError(413, 'Envio grande demais.')); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

export async function readJson(req, limit = 64 * 1024) {
  const type = String(req.headers['content-type'] || '');
  if (!type.startsWith('application/json')) fail(415, 'Formato inválido.');
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { const v = JSON.parse(buf.toString('utf8')); return v && typeof v === 'object' ? v : {}; }
  catch { fail(400, 'JSON inválido.'); }
}

export function json(res, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': data.length, ...headers });
  res.end(data);
}
export function redirect(res, location, status = 302) { res.writeHead(status, { Location: location, 'Cache-Control': 'no-store' }); res.end(); }

// ── router
export function createRouter() {
  const routes = [];
  const add = (method) => (pattern, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    routes.push({ method, re, keys, handler });
  };
  return {
    get: add('GET'), post: add('POST'), put: add('PUT'), del: add('DELETE'),
    match(method, pathname) {
      let allowed = false;
      for (const r of routes) {
        const m = r.re.exec(pathname);
        if (!m) continue;
        if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) { allowed = true; continue; }
        const params = {};
        r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; } });
        return { handler: r.handler, params };
      }
      return allowed ? { notAllowed: true } : null;
    },
  };
}

// ── estáticos com cache em memória do gzip para texto
const gzCache = new Map();
export function sendFile(req, res, file, { cache = 'public, max-age=300', download = null, extraHeaders = {} } = {}) {
  let st;
  try { st = fs.statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const type = mimeOf(file);
  const headers = { 'Content-Type': type, 'Cache-Control': cache, 'Last-Modified': st.mtime.toUTCString(), 'Accept-Ranges': 'bytes', ...extraHeaders };
  if (download) headers['Content-Disposition'] = `attachment; filename="${download.replace(/[^\w.-]/g, '_')}"`;
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  headers.ETag = etag;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return true; }

  const range = req.headers.range;
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    let [a, b] = range.slice(6).split('-');
    let start = a === '' ? Math.max(0, st.size - Number(b)) : Number(a);
    let end = a === '' ? st.size - 1 : (b === '' ? st.size - 1 : Math.min(Number(b), st.size - 1));
    if (!(start <= end) || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return true; }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(file, { start, end }).pipe(res);
    return true;
  }

  const wantsGz = COMPRESSIBLE.test(type) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) && st.size > 1024 && st.size < 4 * 1024 * 1024;
  if (wantsGz) {
    const key = `${file}:${st.mtimeMs}`;
    let gz = gzCache.get(key);
    if (!gz) { gz = zlib.gzipSync(fs.readFileSync(file), { level: 9 }); gzCache.set(key, gz); }
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length, Vary: 'Accept-Encoding' });
    res.end(req.method === 'HEAD' ? undefined : gz);
    return true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(file).pipe(res);
  return true;
}

// resolve um caminho público dentro de uma pasta, sem permitir escapar dela
export function safeJoin(dir, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { return null; }
  if (rel.includes('\0')) return null;
  const full = path.resolve(dir, '.' + path.posix.normalize('/' + rel));
  return full === dir || full.startsWith(dir + path.sep) ? full : null;
}
