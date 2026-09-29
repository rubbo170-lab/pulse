// Validação no servidor de tudo que vira vídeo: o navegador pode ser adulterado, então os limites valem aqui também.
export const SEGMENTS = ['Confeitaria', 'Restaurante', 'Pizzaria', 'Lanchonete', 'Cafeteria', 'Moda', 'Beleza', 'Saúde', 'Odontologia', 'Fitness', 'Educação', 'Pet', 'Imobiliária', 'Serviços', 'Tecnologia', 'Loja', 'Outro'];
export const ICONS = ['check', 'clock', 'truck', 'chat', 'star', 'heart', 'shield', 'bolt', 'tag', 'gift', 'leaf', 'pin', 'phone', 'card', 'calendar', 'people', 'sparkle', 'flame', 'home', 'cart', 'globe', 'percent', 'trophy', 'smile', 'tool', 'bag', 'paw', 'book', 'dumbbell', 'scissors', 'coffee'];
const FONTS = ['moderno', 'impacto', 'elegante'];
const MOODS = ['energia', 'suave', 'nenhuma'];
export const MOTIONS = ['dinamico', 'premium'];
// motor criativo: visuais e histórias que o plano de cada vídeo pode usar
export const LOOKS = ['pop', 'bold', 'editorial', 'neon', 'clean', 'retro', 'grid', 'organic'];
export const ARCS = ['classic', 'direct', 'question', 'search', 'offer', 'proof', 'list', 'story'];

// texto de uma linha: sem caracteres de controle, espaços normalizados, tamanho máximo
export function line(v, max) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}
export function multiline(v, max) {
  return String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).join('\n').trim().slice(0, max);
}
const color = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : d);
const pick = (v, list, d) => (list.includes(v) ? v : d);

// direção criativa do vídeo (v2): semente do plano, visual e história escolhidos (ou 'auto') e as palavras de destaque
export function cleanCreative(c) {
  if (!c || typeof c !== 'object' || Number(c.v) !== 2) return null;
  const n = Number(c.seed), seed = Number.isFinite(n) ? Math.floor(Math.abs(n)) % 4294967296 : 1;
  const kx = c.keys && typeof c.keys === 'object' ? c.keys : {}, keys = {};
  for (const k of ['hook', 'pain', 'product', 'tagline']) { const v = line(kx[k], 24); if (v) keys[k] = v; }
  const out = { v: 2, seed, look: pick(c.look, LOOKS, 'auto'), arc: pick(c.arc, ARCS, 'auto'), keys };
  if (LOOKS.includes(c.pref)) out.pref = c.pref;
  const plan = cleanPlan(c.plan);
  if (plan) out.plan = plan;
  return out;
}
// plano congelado na compra (o que o cliente viu): só a forma é conferida aqui; o motor confere o conteúdo e,
// se alguma peça não existir mais, monta o plano de novo a partir da semente
function cleanPlan(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.scenes) || !Array.isArray(p.trans)) return null;
  const id = (v) => (typeof v === 'string' && /^[a-zA-Z0-9]{1,24}$/.test(v) ? v : null);
  const int = (v, a, b) => (Number.isInteger(v) && v >= a && v <= b ? v : null);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
  if (p.scenes.length < 2 || p.scenes.length > 16 || p.trans.length !== p.scenes.length - 1) return null;
  const scenes = p.scenes.map((s) => (Array.isArray(s) ? [id(s[0]), s[1] == null ? null : int(s[1], 0, 3), id(s[2]), int(s[3], 1, 96), id(s[4]), id(s[5]), id(s[6])] : null));
  if (scenes.some((s) => !s || s.some((v, i) => v == null && i !== 1))) return null;
  const trans = p.trans.map((t) => (Array.isArray(t) ? [id(t[0]), t[1] < 0 ? -1 : 1, t[2] ? 1 : 0, num(t[3]), num(t[4]), int(t[5], 0, 100000) ?? 0] : null));
  if (trans.some((t) => !t || !t[0])) return null;
  const out = { scenes, trans, bpm: int(p.bpm, 60, 200) };
  for (const k of ['look', 'arc', 'typeId', 'frame', 'fx1', 'fx2', 'em', 'deco', 'scheme', 'bg1', 'bgA', 'genre']) out[k] = id(p[k]) || '';
  return out.bpm ? out : null;
}

export function cleanSpec(input) {
  const s = input && typeof input === 'object' ? input : {};
  const brand = s.brand || {}, colors = s.colors || {}, style = s.style || {}, sc = s.script || {}, proof = s.proof || {}, contact = s.contact || {};
  const hook = (Array.isArray(sc.hook) ? sc.hook : [sc.hook]).slice(0, 2);
  const benefits = (Array.isArray(sc.benefits) ? sc.benefits : []).slice(0, 4)
    .map((b) => ({ text: line(b && b.text, 30), icon: pick(b && b.icon, ICONS, 'check') }))
    .filter((b) => b.text);
  const out = {
    lang: pick(s.lang, ['pt', 'en', 'es'], 'pt'), duration: [15, 20, 30].includes(Number(s.duration)) ? Number(s.duration) : 15,
    brand: { name: line(brand.name, 32), segment: pick(brand.segment, SEGMENTS, 'Outro') },
    colors: { primary: color(colors.primary, '#7c5cff'), secondary: color(colors.secondary, '#ffb547') },
    style: { font: pick(style.font, FONTS, 'moderno'), mood: pick(style.mood, MOODS, 'energia'), motion: pick(style.motion, MOTIONS, 'dinamico'), watermark: false },
    script: {
      hook: [line(hook[0], 14), line(hook[1], 18)].filter(Boolean),
      pain: line(sc.pain, 40), search: line(sc.search, 40), product: line(sc.product, 40), offer: line(sc.offer, 26),
      benefitsTitle: line(sc.benefitsTitle, 30), benefits, tagline: line(sc.tagline, 44), cta: line(sc.cta, 24),
      // só no vídeo de 30 s
      showcaseTitle: line(sc.showcaseTitle, 30), stepsTitle: line(sc.stepsTitle, 30),
      steps: (Array.isArray(sc.steps) ? sc.steps : []).slice(0, 3).map((b) => ({ text: line(b && b.text, 26), icon: pick(b && b.icon, ICONS, 'check') })).filter((b) => b.text),
    },
    // depoimento: só de cliente real (o editor avisa); vai no vídeo de 30 s
    proof: { rating: line(proof.rating, 4), ratingSource: line(proof.ratingSource, 18), customers: line(proof.customers, 12), customersLabel: line(proof.customersLabel, 24), quote: line(proof.quote, 90), author: line(proof.author, 28) },
    contact: { whatsapp: line(contact.whatsapp, 24), instagram: line(contact.instagram, 32), site: line(contact.site, 48), address: line(contact.address, 70) },
  };
  const creative = cleanCreative(s.creative);
  if (creative) out.creative = creative;
  return out;
}

// o que falta para um vídeo fazer sentido (mensagens para o cliente)
export function specProblems(spec) {
  const p = [];
  if (!spec.brand.name) p.push('Preencha o nome da empresa.');
  if (!spec.script.hook.length) p.push('Preencha o gancho (a primeira frase do vídeo).');
  if (!spec.script.product) p.push('Preencha o produto ou serviço em destaque.');
  if (!spec.script.benefits.length) p.push('Preencha pelo menos uma vantagem.');
  if (!spec.script.cta) p.push('Preencha a chamada para ação.');
  return p;
}

export const sameBrand = (a, b) => line(a, 32).toLocaleLowerCase('pt-BR') === line(b, 32).toLocaleLowerCase('pt-BR');

// dados da empresa fictícia do exemplo do editor (pt/en/es): nunca vão para o vídeo de um cliente
const EXAMPLE_NAMES = ['doce aurora', 'golden crumb', 'dulce aurora'];
const EXAMPLE_CONTACT = new Set(['(11) 90000-0000', '+1 555 010 0000', '+52 55 0000 0000', '@doceaurora.exemplo', '@goldencrumb.example', '@dulceaurora.ejemplo',
  'Rua das Flores, 120, Centro', '120 Flower St, Downtown', 'Calle de las Flores 120, Centro']);
export const isExampleBrand = (name) => EXAMPLE_NAMES.includes(line(name, 32).toLocaleLowerCase('pt-BR'));
const EXAMPLE_QUOTES = new Set(['Melhor bolo de pote que já comi!', 'Best cupcakes in town!', '¡El mejor pastel que he probado!']);
export function stripExampleContact(spec) {
  for (const k of ['whatsapp', 'instagram', 'site', 'address']) if (EXAMPLE_CONTACT.has(spec.contact[k])) spec.contact[k] = '';
  // o depoimento fictício do exemplo nunca vai para o vídeo de uma empresa real
  if (EXAMPLE_QUOTES.has(spec.proof.quote)) { spec.proof.quote = ''; spec.proof.author = ''; }
  return spec;
}

export function cleanBrief(b) {
  const x = b && typeof b === 'object' ? b : {};
  return {
    name: line(x.name, 32), segment: pick(x.segment, SEGMENTS, 'Outro'), sells: multiline(x.sells, 280), diffs: multiline(x.diffs, 280),
    offer: line(x.offer, 26), channel: pick(x.channel, ['WhatsApp', 'Instagram', 'site', 'não informado'], 'não informado'), style: pick(x.style, FONTS, 'moderno'),
    lang: pick(x.lang, ['pt', 'en', 'es'], 'pt'),
  };
}
