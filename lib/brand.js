// "Minha marca": guarda a identidade usada no último pedido (nome, cores, estilo, contatos, prova social e logo),
// para o próximo vídeo começar com a mesma cara. Vídeo após vídeo, a marca fica consistente.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { q, now } from './db.js';
import { multiline, sameBrand } from './spec.js';

const DIR = path.join(config.dataDir, 'brands');
fs.mkdirSync(DIR, { recursive: true });

const dirOf = (userId) => path.join(DIR, String(Number(userId)));

export function brandLogoPath(userId) {
  const row = q('SELECT logo_ext FROM brands WHERE user_id = ?').get(userId);
  if (!row || !row.logo_ext) return null;
  const f = path.join(dirOf(userId), `logo.${row.logo_ext}`);
  return fs.existsSync(f) ? f : null;
}

// spec já validado (cleanSpec). brief = { sells, diffs } ou null (mantém os anteriores).
// logo = { buf, ext } de decodeImage; sem logo, o anterior só fica se for a mesma empresa (nunca mistura marcas).
export function saveBrand(userId, spec, brief = null, logo = null) {
  const prevRow = q('SELECT data, logo_ext FROM brands WHERE user_id = ?').get(userId);
  let prev = {};
  try { prev = prevRow ? JSON.parse(prevRow.data) : {}; } catch { prev = {}; }
  const same = !!(prev.brand && sameBrand(prev.brand.name, spec.brand.name));
  const data = {
    brand: spec.brand, colors: spec.colors,
    style: { font: spec.style.font, mood: spec.style.mood, motion: spec.style.motion },
    contact: spec.contact, proof: spec.proof,
    sells: brief ? multiline(brief.sells, 280) : same ? prev.sells || '' : '',
    diffs: brief ? multiline(brief.diffs, 280) : same ? prev.diffs || '' : '',
  };
  const dir = dirOf(userId);
  let ext = prevRow && same ? prevRow.logo_ext : null;
  if (logo) {
    fs.mkdirSync(dir, { recursive: true });
    ext = logo.ext;
    fs.writeFileSync(path.join(dir, `logo.${logo.ext}`), logo.buf);
  }
  // apaga o que não é o logo atual (outra extensão, ou logo de outra empresa)
  for (const e of ['png', 'jpg']) if (e !== ext) fs.rmSync(path.join(dir, `logo.${e}`), { force: true });
  q(`INSERT INTO brands (user_id, data, logo_ext, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, logo_ext = excluded.logo_ext, updated_at = excluded.updated_at`).run(userId, JSON.stringify(data), ext, now());
}

export function getBrand(userId) {
  const row = q('SELECT data, updated_at FROM brands WHERE user_id = ?').get(userId);
  if (!row) return null;
  try { return { ...JSON.parse(row.data), updatedAt: row.updated_at, hasLogo: !!brandLogoPath(userId) }; } catch { return null; }
}

export function forgetBrand(userId) {
  q('DELETE FROM brands WHERE user_id = ?').run(userId);
  fs.rmSync(dirOf(userId), { recursive: true, force: true });
}
