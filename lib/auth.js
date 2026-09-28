// Contas: senha com scrypt, sessão em cookie HttpOnly (token aleatório; no banco só o hash).
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { q, now } from './db.js';
import { parseCookies, setCookie, fail } from './http.js';

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'pulso_sid';
const SESSION_DAYS = 60;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(pw.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// hash de uma senha qualquer, usado para gastar o mesmo tempo quando o e-mail não existe
let dummyHash = null;
export async function burnPasswordTime(pw) {
  if (!dummyHash) dummyHash = await hashPassword('senha-que-nao-existe');
  await verifyPassword(pw, dummyHash);
}

export function startSession(res, userId) {
  const token = randomToken(32);
  const t = now();
  q('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), userId, t, t + SESSION_DAYS * 864e5);
  setCookie(res, COOKIE, token, { maxAge: SESSION_DAYS * 86400 });
}

export function endSession(req, res) {
  const token = parseCookies(req)[COOKIE];
  if (token) q('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  setCookie(res, COOKIE, '', { maxAge: 0 });
}

export function currentUser(req) {
  if (req._user !== undefined) return req._user;
  const token = parseCookies(req)[COOKIE];
  let user = null;
  if (token && token.length < 200) {
    user = q(`SELECT u.id, u.email, u.name, u.phone, u.created_at, u.is_admin, u.lang FROM sessions s JOIN users u ON u.id = s.user_id
              WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), now()) || null;
  }
  req._user = user;
  return user;
}

// admin = e-mail listado em ADMIN_EMAILS **e** conta confirmada uma vez com o ADMIN_TOKEN (em /admin).
// Assim ninguém vira admin só por criar antes a conta com aquele e-mail.
const listed = (user) => !!user && config.admins.includes(String(user.email).toLowerCase());
export const isAdmin = (user) => listed(user) && user.is_admin === 1;
export const canClaimAdmin = (user) => listed(user) && user.is_admin !== 1 && !!config.adminToken;
export function claimAdmin(user, token) {
  const a = Buffer.from(String(token || '')), b = Buffer.from(config.adminToken);
  if (!canClaimAdmin(user) || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  q('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
  user.is_admin = 1;
  return true;
}

export function requireUser(req) {
  const u = currentUser(req);
  if (!u) fail(401, 'Entre na sua conta para continuar.');
  return u;
}
export function requireAdmin(req) {
  const u = requireUser(req);
  if (!isAdmin(u)) fail(404, 'Página não encontrada.');
  return u;
}

export const publicUser = (u) => (u ? { id: u.id, name: u.name, email: u.email, phone: u.phone, admin: isAdmin(u), adminPending: canClaimAdmin(u) } : null);

export function cleanupSessions() {
  q('DELETE FROM sessions WHERE expires_at < ?').run(now());
  q('DELETE FROM reset_tokens WHERE expires_at < ?').run(now() - 7 * 864e5);
}

// links de nova senha gerados pelo admin (enquanto o site não envia e-mail)
export function createResetToken(userId, hours = 24) {
  const token = randomToken(24);
  q('INSERT INTO reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, now() + hours * 3600e3);
  return token;
}
