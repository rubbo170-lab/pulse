// Banco SQLite embutido no Node (node:sqlite) — um arquivo em DATA_DIR/pulso.db, sem dependências.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new DatabaseSync(path.join(config.dataDir, 'pulso.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');

const MIGRATIONS = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     email TEXT NOT NULL UNIQUE COLLATE NOCASE,
     name TEXT NOT NULL,
     phone TEXT NOT NULL DEFAULT '',
     pass_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE reset_tokens (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL,
     used_at INTEGER
   );
   CREATE TABLE orders (
     id TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id),
     status TEXT NOT NULL,
     brand TEXT NOT NULL,
     spec TEXT NOT NULL,
     has_logo INTEGER NOT NULL DEFAULT 0,
     has_photo INTEGER NOT NULL DEFAULT 0,
     price_cents INTEGER NOT NULL,
     mp_preference_id TEXT,
     checkout_url TEXT,
     checkout_created_at INTEGER,
     mp_payment_id TEXT,
     pay_method TEXT,
     paid_at INTEGER,
     last_check_at INTEGER,
     render_after INTEGER NOT NULL DEFAULT 0,
     render_started_at INTEGER,
     render_attempts INTEGER NOT NULL DEFAULT 0,
     render_ms INTEGER,
     render_error TEXT,
     ready_at INTEGER,
     file_size INTEGER,
     version INTEGER NOT NULL DEFAULT 0,
     edits_left INTEGER NOT NULL DEFAULT 1,
     expired_at INTEGER,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE INDEX orders_user ON orders(user_id, created_at DESC);
   CREATE INDEX orders_status ON orders(status, paid_at);
   CREATE TABLE payments (
     mp_payment_id TEXT PRIMARY KEY,
     order_id TEXT NOT NULL,
     status TEXT NOT NULL,
     status_detail TEXT,
     amount_cents INTEGER,
     method TEXT,
     payer_email TEXT,
     updated_at INTEGER NOT NULL
   );
   CREATE INDEX payments_order ON payments(order_id);
   CREATE TABLE events (
     id INTEGER PRIMARY KEY,
     at INTEGER NOT NULL,
     kind TEXT NOT NULL,
     order_id TEXT,
     user_id INTEGER,
     detail TEXT
   );
   CREATE INDEX events_order ON events(order_id);
   CREATE TABLE ai_calls (
     id INTEGER PRIMARY KEY,
     at INTEGER NOT NULL,
     user_id INTEGER,
     ip TEXT,
     ok INTEGER NOT NULL,
     in_tokens INTEGER,
     out_tokens INTEGER
   );
   CREATE INDEX ai_calls_at ON ai_calls(at);`,
  // 2: idiomas, dólar (Stripe), duração, admin confirmado por código
  `ALTER TABLE orders ADD COLUMN lang TEXT NOT NULL DEFAULT 'pt';
   ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'BRL';
   ALTER TABLE orders ADD COLUMN provider TEXT NOT NULL DEFAULT 'mercadopago';
   ALTER TABLE orders ADD COLUMN duration INTEGER NOT NULL DEFAULT 15;
   ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'mercadopago';
   ALTER TABLE payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'BRL';
   ALTER TABLE payments ADD COLUMN refunded_at INTEGER;
   ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'pt';
   ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
   CREATE INDEX orders_checkout ON orders(mp_preference_id);
   CREATE INDEX orders_payment ON orders(mp_payment_id);`,
  // 3: "minha marca" — identidade da última compra (nome, cores, estilo, contatos, logo) para o próximo vídeo
  `CREATE TABLE brands (
     user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     data TEXT NOT NULL,
     logo_ext TEXT,
     updated_at INTEGER NOT NULL
   );`,
];

(function migrate() {
  const v = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = v; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try { db.exec(MIGRATIONS[i]); db.exec(`PRAGMA user_version = ${i + 1}`); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
})();

const cache = new Map();
// statement preparado e reaproveitado
export function q(sql) {
  let st = cache.get(sql);
  if (!st) { st = db.prepare(sql); cache.set(sql, st); }
  return st;
}

// transação curta (BEGIN IMMEDIATE evita corrida entre webhook, retorno do checkout e o worker)
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch { /* já encerrada */ } throw e; }
}

export const now = () => Date.now();

export function logEvent(kind, { orderId = null, userId = null, detail = null } = {}) {
  try { q('INSERT INTO events (at, kind, order_id, user_id, detail) VALUES (?, ?, ?, ?, ?)').run(now(), kind, orderId, userId, detail == null ? null : String(detail).slice(0, 2000)); }
  catch (e) { console.error('[pulso] falha ao registrar evento', e.message); }
}
