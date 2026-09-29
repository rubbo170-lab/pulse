'use strict';
// ─── Pulso Studio: motor criativo ───
// Cada vídeo nasce de um plano próprio (visual, história, cenas, transições e andamento), tirado de uma semente.
// A mesma semente + os mesmos dados = o mesmo vídeo (prévia e render iguais). Outra semente = outro vídeo.
const PulsoStudio = (() => {
  const U = PU, K = SK, SV = SS.VARIANTS;
  const { W, H, clamp, lerp, inv, EO, hash, rng, strSeed, mk } = U;

  // ══════════════════════════════ visuais (direções de arte)
  // cada lista é [valor, peso]; o plano sorteia dentro dela
  const LOOKS = {
    pop: {
      name: { pt: 'Colagem pop', en: 'Pop collage', es: 'Collage pop' },
      schemes: [['pastel', 3], ['light', 2], ['pastel2', 2]], accent: 'vivid', accentKinds: ['offer', 'statement', 'cta'],
      types: [['round', 3], ['soft', 2], ['grotesk', 2], ['retro', 1]], frames: [['polaroid', 3], ['circle', 2], ['blob', 2]],
      fx: [['pop', 3], ['drop', 2], ['wave', 2], ['flip', 1]], em: [['marker', 3], ['circle', 2], ['underline', 2]],
      trans: [['iris', 3], ['blob', 3], ['slideover', 1], ['zoom', 1], ['push', 1]], bgs: [['paper', 3], ['dots', 2], ['rays', 1]], bgAccent: [['rays', 2], ['dots', 1]],
      deco: [['sparkle', 2], ['confetti', 2], ['squiggle', 2]], back: 'blob', badge: 'circle', radius: 40, shadow: 'hard', stroke: 5, hand: true, energy: 0.8,
      textShadow: 'drop', post: { grain: 0.1, vignette: 0.1 }, genre: [['pop', 3], ['funk', 2]], bpm: [112, 144],
    },
    bold: {
      name: { pt: 'Impacto', en: 'Bold impact', es: 'Impacto' },
      schemes: [['dark', 3], ['night', 1]], alt: ['base', 'vivid', 'base', 'vivid2'],
      types: [['condensed', 3], ['shoulders', 2], ['heavy', 2]], frames: [['card', 2], ['offset', 2]],
      fx: [['stamp', 3], ['rise', 2], ['zoom', 2], ['skew', 1]], em: [['box', 3], ['color', 2], ['marker', 1]],
      trans: [['whip', 3], ['cut', 3], ['zoom', 2], ['wipe', 2], ['glitch', 1]], bgs: [['glow', 2], ['stripes', 2]], bgAccent: [['stripes', 1], ['rays', 1]],
      deco: [['burst', 1], ['ticker', 1], ['marks', 1]], back: null, badge: 'square', radius: 12, shadow: 'none', stroke: 0, flashWords: true, energy: 1,
      textShadow: null, post: { grain: 0.2, vignette: 0.45 }, genre: [['house', 3], ['trap', 2]], bpm: [124, 144],
    },
    editorial: {
      name: { pt: 'Editorial', en: 'Editorial', es: 'Editorial' },
      schemes: [['cream', 3], ['light', 2], ['dark', 1]], accent: 'deep', accentKinds: ['statement', 'quote'],
      types: [['serif', 3], ['gloock', 2], ['classic', 2]], frames: [['arch', 3], ['card', 2]],
      fx: [['fade', 3], ['rise', 3]], em: [['underline', 2], ['color', 2], ['none', 1]],
      trans: [['dissolve', 2], ['push', 2], ['slideover', 2], ['wipe', 1]], bgs: [['paper', 3], ['frame', 1]], bgAccent: [['paper', 1]],
      deco: [['rules', 1]], back: null, badge: 'ring', radius: 6, shadow: 'soft', stroke: 0, energy: 0.35,
      textShadow: null, post: { grain: 0.12, vignette: 0.1 }, genre: [['lofi', 2], ['cinematic', 2]], bpm: [92, 112],
    },
    neon: {
      name: { pt: 'Neon', en: 'Neon night', es: 'Neón' },
      schemes: [['night', 1]], accent: 'night', accentKinds: [],
      types: [['wide', 3], ['syne', 1], ['retro', 2], ['grotesk', 2]], frames: [['glow', 3], ['circle', 1]],
      fx: [['glitch', 2], ['rise', 2], ['fade', 1], ['zoom', 1]], em: [['color', 3], ['underline', 1]],
      trans: [['glitch', 3], ['zoom', 2], ['cut', 2], ['iris', 1]], bgs: [['neongrid', 3], ['glow', 2]], bgAccent: [['glow', 1]],
      deco: [['neon', 1]], back: 'ring', badge: 'glow', radius: 30, shadow: 'none', stroke: 0, glowCards: true, energy: 0.8,
      textShadow: 'glow', post: { grain: 0.14, vignette: 0.55, scan: 0.1 }, genre: [['synth', 3], ['house', 2]], bpm: [112, 128],
    },
    clean: {
      name: { pt: 'Minimalista', en: 'Minimal', es: 'Minimalista' },
      schemes: [['light', 3], ['dark', 2]], accent: 'vivid', accentKinds: ['cta', 'offer'],
      types: [['grotesk', 4], ['wide', 1]], frames: [['card', 3], ['circle', 1]],
      fx: [['rise', 3], ['fade', 2], ['pop', 1]], em: [['marker', 2], ['color', 2], ['underline', 1]],
      trans: [['push', 3], ['slideover', 2], ['iris', 1], ['dissolve', 1]], bgs: [['glow', 2], ['mesh', 2], ['grid', 1]], bgAccent: [['glow', 1]],
      deco: [['plus', 1]], back: 'circle', badge: 'square', radius: 36, shadow: 'soft', stroke: 0, energy: 0.5,
      textShadow: null, post: { grain: 0.06, vignette: 0.1 }, genre: [['minimal', 3], ['pop', 1]], bpm: [104, 124],
    },
    retro: {
      name: { pt: 'Retrô', en: 'Retro', es: 'Retro' },
      schemes: [['cream', 3], ['pastel2', 1]], accent: 'vivid', accentKinds: ['offer', 'statement', 'outro'],
      types: [['retro', 3], ['sign', 2], ['soft', 2]], frames: [['offset', 3], ['polaroid', 1], ['circle', 1]],
      fx: [['drop', 2], ['pop', 2], ['flip', 2], ['wave', 1]], em: [['box', 2], ['circle', 2]],
      trans: [['stripes', 3], ['wipe', 2], ['iris', 1]], bgs: [['sunset', 3], ['halftone', 2], ['rays', 2]], bgAccent: [['rays', 2], ['halftone', 1]],
      deco: [['burst', 1]], back: 'burst', badge: 'circle', radius: 24, shadow: 'hard', stroke: 5, energy: 0.75,
      textShadow: 'offset', post: { grain: 0.22, vignette: 0.25 }, genre: [['funk', 3], ['disco', 2]], bpm: [108, 128],
    },
    grid: {
      name: { pt: 'Tipográfico', en: 'Type grid', es: 'Tipográfico' },
      schemes: [['light', 2], ['dark', 2]], alt: ['base', 'inverse', 'vivid'],
      types: [['heavy', 3], ['condensed', 2], ['syne', 1]], frames: [['card', 2], ['offset', 1]],
      fx: [['rise', 3], ['slideL', 2], ['stamp', 1]], em: [['box', 3], ['underline', 1]],
      trans: [['blocks', 3], ['push', 2], ['shutter', 2], ['cut', 1]], bgs: [['grid', 4]], bgAccent: [['grid', 1]],
      deco: [['ticker', 1], ['marks', 2]], back: 'box', badge: 'square', radius: 0, shadow: 'none', stroke: 4, energy: 0.8,
      textShadow: null, post: { grain: 0.08, vignette: 0.08 }, genre: [['techno', 3], ['house', 2]], bpm: [120, 136],
    },
    organic: {
      name: { pt: 'Orgânico', en: 'Organic', es: 'Orgánico' },
      schemes: [['pastel', 3], ['cream', 2], ['pastel2', 2]], accent: 'pastel2', accentKinds: ['benefits', 'steps'],
      types: [['soft', 3], ['round', 2], ['serif', 1]], frames: [['blob', 3], ['arch', 2], ['circle', 2]],
      fx: [['fade', 2], ['rise', 2], ['pop', 1], ['wave', 1]], em: [['circle', 2], ['underline', 2], ['color', 1]],
      trans: [['blob', 3], ['dissolve', 2], ['iris', 1]], bgs: [['blobs', 3], ['mesh', 2], ['paper', 1]], bgAccent: [['blobs', 1]],
      deco: [['blobs', 1]], back: 'blob', badge: 'circle', radius: 48, shadow: 'soft', stroke: 0, hand: true, energy: 0.4,
      textShadow: null, post: { grain: 0.1, vignette: 0.1 }, genre: [['lofi', 3], ['acoustic', 2]], bpm: [92, 112],
    },
  };
  Object.entries(LOOKS).forEach(([id, l]) => { l.id = id; });
  const LOOK_IDS = Object.keys(LOOKS);

  // que visuais combinam com cada segmento (peso) — usado quando a IA ou o cliente não escolheram
  const SEG_FIT = {
    Confeitaria: { pop: 3, organic: 3, retro: 2, editorial: 2, clean: 1, bold: 1 }, Restaurante: { bold: 3, editorial: 2, retro: 2, organic: 2, pop: 1, clean: 1, neon: 1, grid: 1 },
    Pizzaria: { bold: 3, retro: 3, pop: 2, neon: 1, grid: 1, editorial: 1 }, Lanchonete: { bold: 3, retro: 3, pop: 2, neon: 2, grid: 1 },
    Cafeteria: { editorial: 3, organic: 3, retro: 2, clean: 2, pop: 1, grid: 1 }, Moda: { editorial: 3, grid: 3, bold: 2, clean: 2, neon: 1, pop: 1, retro: 1, organic: 1 },
    Beleza: { editorial: 3, organic: 3, clean: 2, pop: 1, neon: 1, grid: 1 }, 'Saúde': { clean: 3, organic: 3, editorial: 2, grid: 1 },
    Odontologia: { clean: 3, organic: 2, editorial: 2, pop: 1, grid: 1 }, Fitness: { bold: 3, neon: 3, grid: 2, clean: 1, pop: 1, retro: 1 },
    'Educação': { clean: 3, pop: 2, grid: 2, editorial: 1, organic: 1, retro: 1 }, Pet: { pop: 3, organic: 3, retro: 2, clean: 1 },
    'Imobiliária': { editorial: 3, clean: 3, grid: 2, organic: 1 }, 'Serviços': { clean: 3, grid: 2, bold: 2, editorial: 1, neon: 1 },
    Tecnologia: { neon: 3, grid: 3, clean: 3, bold: 2 }, Loja: { pop: 3, bold: 2, retro: 2, grid: 2, clean: 1, neon: 1 },
  };
  const FONT_BIAS = { impacto: { bold: 2, retro: 1.5, grid: 1.5, pop: 1.2 }, elegante: { editorial: 2.2, organic: 1.8, clean: 1.3 }, moderno: { clean: 1.5, grid: 1.3, neon: 1.3, pop: 1.2 } };

  // ══════════════════════════════ histórias (ordem das cenas)
  const ARCS = {
    classic: { w: 3, seq: ['hook', 'pain', 'product', 'benefits', 'cta', 'outro'] },
    direct: { w: 2, seq: ['hook', 'product', 'benefits', 'statement', 'outro'], need: 'tagline' },
    question: { w: 2, seq: ['pain', 'product', 'benefits', 'cta', 'outro'] },
    search: { w: 2, seq: ['hook', 'search', 'product', 'benefits', 'outro'] },
    offer: { w: 4, seq: ['offer', 'product', 'benefits', 'cta', 'outro'], need: 'offer' },
    proof: { w: 3, seq: ['hook', 'proof', 'product', 'benefits', 'outro'], need: 'proof' },
    list: { w: 2, seq: ['hook', 'benefit1', 'product', 'outro'] },
    story: { w: 2, seq: ['hook', 'product', 'benefits', 'statement', 'outro'], need: 'tagline' },
  };
  const ARC_NAMES = {
    classic: { pt: 'Problema e solução', en: 'Problem and solution', es: 'Problema y solución' }, direct: { pt: 'Direto ao ponto', en: 'Straight to the point', es: 'Directo al punto' },
    question: { pt: 'Pergunta e resposta', en: 'Question and answer', es: 'Pregunta y respuesta' }, search: { pt: 'A busca', en: 'The search', es: 'La búsqueda' },
    offer: { pt: 'Oferta primeiro', en: 'Offer first', es: 'Oferta primero' }, proof: { pt: 'Prova primeiro', en: 'Proof first', es: 'Prueba primero' },
    list: { pt: 'Lista de motivos', en: 'List of reasons', es: 'Lista de motivos' }, story: { pt: 'Marca e slogan', en: 'Brand and slogan', es: 'Marca y eslogan' },
  };
  // tempo desejado de cada cena (segundos) e mínimo em tempos musicais
  const BASE = { hook: 2.0, pain: 2.2, search: 2.8, product: 2.8, benefits: 1.4, benefit1: 1.5, proof: 2.4, offer: 2.2, quote: 3.9, showcase: 3.8, steps: 3.4, statement: 2.0, cta: 2.4, outro: 2.7 };
  const MINB = { hook: 3, pain: 4, search: 5, product: 4, benefits: 4, benefit1: 3, proof: 4, offer: 4, quote: 7, showcase: 6, steps: 6, statement: 3, cta: 4, outro: 4 };
  // andamentos em que a duração fecha um número inteiro de compassos (o vídeo e a música terminam juntos no tempo 1)
  const BPMS = { 15: [96, 112, 128, 144], 20: [96, 108, 120, 132, 144], 30: [96, 104, 112, 120, 128, 136, 144] };
  const TRANS_BEATS = { cut: 0.4, whip: 0.75, push: 0.9, slideover: 1, iris: 1, blob: 1, wipe: 1, stripes: 1.25, shutter: 1, blocks: 1, zoom: 1, dissolve: 1, flip: 0.9, spin: 1, glitch: 0.6 };
  // quando o conteúdo da cena seguinte começa a entrar, em relação ao meio da transição (negativo = já entra durante ela)
  const IN_AT = { cut: 0.02, push: -0.2, whip: -0.1, slideover: -0.22, iris: -0.06, blob: -0.06, wipe: -0.05, stripes: 0.02, shutter: 0.02, blocks: -0.05, zoom: 0, dissolve: -0.1, flip: 0.02, spin: 0.02, glitch: 0 };
  const FASTK = { whip: 10, push: 6, zoom: 7, spin: 8, flip: 6, glitch: 3, slideover: 6, wipe: 6, blob: 3, iris: 3, stripes: 4, shutter: 4, blocks: 3, cut: 1, dissolve: 1 };

  // textos que o motor desenha
  const L10N = {
    pt: { loc: 'pt-BR', offer: 'Oferta', solved: 'resolvido!', rating: (src) => (src ? `Nota no ${src}` : 'Nota dos clientes') },
    en: { loc: 'en-US', offer: 'Offer', solved: 'solved!', rating: (src) => (src ? `Rated on ${src}` : 'Customer rating') },
    es: { loc: 'es', offer: 'Oferta', solved: '¡resuelto!', rating: (src) => (src ? `Nota en ${src}` : 'Calificación') },
  };

  const wpick = (list, r) => { const tot = list.reduce((a, [, w]) => a + w, 0); let x = r() * tot; for (const [v, w] of list) { x -= w; if (x <= 0) return v; } return list[list.length - 1][0]; };

  // ══════════════════════════════ direção criativa guardada no pedido
  function cleanCreative(c) {
    const x = c && typeof c === 'object' ? c : {};
    const seed = Number.isFinite(Number(x.seed)) ? Number(x.seed) >>> 0 : 1;
    const look = LOOKS[x.look] ? x.look : 'auto';
    const arc = ARCS[x.arc] ? x.arc : 'auto';
    const keys = {};
    const kx = x.keys && typeof x.keys === 'object' ? x.keys : {};
    for (const k of ['hook', 'pain', 'product', 'tagline']) if (typeof kx[k] === 'string' && kx[k].trim()) keys[k] = kx[k].trim().slice(0, 24);
    const out = { v: 2, seed, look, arc, keys };
    if (LOOKS[x.pref]) out.pref = x.pref; // visual sugerido pela IA (vale enquanto o cliente não sortear outro)
    if (x.plan && typeof x.plan === 'object') out.plan = x.plan; // plano congelado na compra (conferido em makePlan)
    return out;
  }
  // plano congelado: o que o cliente viu na prévia e comprou. Guardado no pedido, faz o render (e uma correção
  // semanas depois, com o motor já ajustado) repetir exatamente a mesma estrutura, mesmo que as tabelas mudem.
  function freezePlan(p) {
    const r = (x) => Math.round(x * 1000) / 1000;
    return { look: p.look, arc: p.arc, bpm: p.bpm, typeId: p.typeId, frame: p.frame, fx1: p.fx1, fx2: p.fx2, em: p.em, deco: p.deco, scheme: p.scheme, bg1: p.bg1, bgA: p.bgA, genre: p.genre,
      scenes: p.scenes.map((s) => [s.kind, s.item ?? null, s.variant, s.beats, s.surf, s.fx, s.bgKind]),
      trans: p.trans.map((t) => [t.kind, t.dir, t.vert ? 1 : 0, r(t.ox), r(t.oy), t.seed]) };
  }
  const FXS = ['rise', 'pop', 'slide', 'slideL', 'drop', 'fade', 'flip', 'stamp', 'zoom', 'skew', 'wave', 'glitch', 'type', 'none'];
  const SURFS = ['dark', 'night', 'light', 'cream', 'pastel', 'pastel2', 'vivid', 'vivid2', 'deep'];
  // volta o plano congelado para o formato do motor; qualquer peça que esta versão não conheça invalida (e o plano sai da semente)
  function thawPlan(spec, cr) {
    const f = cr.plan, dur = spec.duration;
    try {
      if (!LOOKS[f.look] || !ARCS[f.arc] || !(BPMS[dur] || []).includes(f.bpm) || !K.TYPES[f.typeId] || !Array.isArray(f.scenes) || !Array.isArray(f.trans)) return null;
      if (f.trans.length !== f.scenes.length - 1 || f.scenes.length < 2) return null;
      const beat = 60 / f.bpm, total = Math.round((dur * f.bpm) / 60);
      if (f.scenes.reduce((a, s) => a + (Number(s[3]) || 0), 0) !== total) return null;
      let t = 0;
      const scenes = f.scenes.map(([kind, item, variant, beats, surf, fx, bgKind], i) => {
        const v = SV[variant];
        if (!v || !v.kinds.includes(kind) || !SURFS.includes(surf) || !FXS.includes(fx) || typeof bgKind !== 'string') throw new Error('cena');
        const d = beats * beat, sc = { i, kind, item: item ?? undefined, variant, t0: t, t1: t + d, d, beats, beat, surf, fx, em: f.em, bgKind, seed: (cr.seed + i * 7919) >>> 0 };
        t += d; return sc;
      });
      scenes[scenes.length - 1].t1 = dur;
      const trans = f.trans.map(([kind, dir, vert, ox, oy, seed], i) => {
        if (!(kind in TRANS_BEATS)) throw new Error('transição');
        return { i, kind, t: scenes[i].t1, d: clamp(TRANS_BEATS[kind] * beat, kind === 'cut' ? 0.16 : 0.3, 0.7), dir: dir < 0 ? -1 : 1, vert: !!vert, ox: clamp(+ox || 0.5), oy: clamp(+oy || 0.5), seed: seed | 0 };
      });
      scenes.forEach((sc, i) => { const tin = i ? trans[i - 1] : null; sc.in = tin ? (IN_AT[tin.kind] ?? 0) : -0.14; });
      return { v: 2, seed: cr.seed, look: f.look, arc: f.arc, dur, bpm: f.bpm, beat, total, typeId: f.typeId, frame: f.frame, fx1: f.fx1, fx2: f.fx2, em: f.em, deco: f.deco, scheme: f.scheme, bg1: f.bg1, bgA: f.bgA,
        genre: f.genre, mood: spec.style.mood, scenes, trans, keys: cr.keys, energy: LOOKS[f.look].energy, frozen: true };
    } catch (e) { return null; }
  }
  function newCreative(prev = {}, o = {}) {
    const seed = (o.seed ?? Math.floor(Math.random() * 4294967295)) >>> 0;
    const { pref, plan, ...rest } = prev || {}; void plan;
    return cleanCreative({ ...rest, ...(o.keepPref && pref ? { pref } : {}), seed, look: o.keepLook && prev.look ? prev.look : o.look || 'auto', arc: o.keepArc && prev.arc ? prev.arc : o.arc || 'auto' });
  }
  const isStudio = (spec) => !!(spec && spec.creative && Number(spec.creative.v) === 2);

  // ══════════════════════════════ o plano
  function pickLook(spec, R) {
    const fit = SEG_FIT[spec.brand.segment] || {}, bias = FONT_BIAS[spec.style.font] || {}, soft = spec.style.mood === 'suave';
    const list = LOOK_IDS.map((id) => { let w = (fit[id] ?? 1) * (bias[id] ?? 1); if (soft && (id === 'bold' || id === 'neon')) w *= 0.45; if (soft && (id === 'organic' || id === 'editorial' || id === 'clean')) w *= 1.4; return [id, w]; });
    return wpick(list, R);
  }
  function content(spec, avail) {
    const sc = spec.script, p = spec.proof;
    return { offer: !!String(sc.offer || '').trim(), proof: !!(String(p.rating || '').trim() || String(p.customers || '').trim()), customers: !!String(p.customers || '').trim(), quote: !!String(p.quote || '').trim(),
      tagline: !!String(sc.tagline || '').trim(), photo: !!avail.photo, gallery: avail.gallery || 0, whatsapp: !!String(spec.contact.whatsapp || '').trim(),
      contact: ['whatsapp', 'instagram', 'site', 'address'].some((k) => String(spec.contact[k] || '').trim()), pain: !!String(sc.pain || '').trim(), search: !!String(sc.search || '').trim(), benefits: (sc.benefits || []).length };
  }
  function buildSeq(arcId, dur, has, R) {
    let seq = ARCS[arcId].seq.slice();
    if (!has.contact) seq = seq.filter((k) => k !== 'cta' || has.whatsapp);
    const ins = (k, after) => { if (seq.includes(k)) return; const i = after ? seq.lastIndexOf(after) : -1; if (i >= 0) seq.splice(i + 1, 0, k); else seq.splice(seq.length - 1, 0, k); };
    if (dur >= 20) {
      if (!seq.includes('cta') && has.contact) ins('cta');
      else if (!seq.includes('statement') && has.tagline) ins('statement');
      else if (!seq.includes('pain')) seq.splice(seq[0] === 'hook' ? 1 : 0, 0, 'pain');
      else ins('search', 'hook');
    }
    if (dur >= 30) {
      if (has.photo || has.gallery) ins('showcase', 'product');
      ins('steps', seq.includes('benefits') ? 'benefits' : 'product');
      const extra = has.quote ? 'quote' : has.proof && !seq.includes('proof') ? 'proof' : has.offer && !seq.includes('offer') ? 'offer' : null;
      if (extra) ins(extra, 'steps');
      if (has.tagline && !seq.includes('statement')) ins('statement');
      if (has.contact && !seq.includes('cta')) ins('cta');
      if (!seq.includes('hook') && seq[0] !== 'offer') seq.unshift('hook');
      if (seq.length < 10 && !seq.includes('pain') && seq[0] === 'hook') seq.splice(1, 0, 'pain');
    }
    // lista: uma cena por vantagem
    const out = [];
    seq.forEach((k) => { if (k === 'benefit1') { for (let i = 0; i < Math.min(4, Math.max(1, has.benefits)); i++) out.push({ kind: 'benefit1', item: i }); } else out.push({ kind: k }); });
    return out;
  }
  function allocBeats(seq, total, beat, has) {
    const want = seq.map((s) => (s.kind === 'benefits' ? BASE.benefits + 0.75 * Math.max(1, has.benefits) : s.kind === 'cta' ? BASE.cta + 0.2 * (has.contact ? 2 : 0) : BASE[s.kind] || 2));
    const S = want.reduce((a, b) => a + b, 0), f = (total * beat) / S;
    const ideal = want.map((w) => (w * f) / beat);
    const minb = seq.map((s) => (s.kind === 'benefits' ? Math.max(MINB.benefits, 2 + Math.ceil(Math.max(1, has.benefits) * 1.2)) : MINB[s.kind] || 3));
    const b = ideal.map((x, i) => Math.max(minb[i], Math.round(x)));
    let diff = total - b.reduce((a, c) => a + c, 0), guard = 200;
    while (diff !== 0 && guard-- > 0) {
      if (diff > 0) { let best = 0, bv = -Infinity; ideal.forEach((x, i) => { const v = x - b[i]; if (v > bv) { bv = v; best = i; } }); b[best]++; diff--; }
      else { let best = -1, bv = -Infinity; ideal.forEach((x, i) => { if (b[i] <= Math.max(2, minb[i] - (guard < 60 ? 1 : 0))) return; const v = b[i] - x; if (v > bv) { bv = v; best = i; } }); if (best < 0) { best = b.indexOf(Math.max(...b)); } b[best]--; diff++; }
    }
    return b;
  }
  function pickVariant(kind, lookId, has, used, R, prev, spec) {
    const cands = Object.entries(SV).filter(([, v]) => v.kinds.includes(kind) && (v.looks === 'any' || v.looks.includes(lookId)) && (!v.need || has[v.need]) && (!v.ok || v.ok(spec, kind)));
    if (!cands.length) return null;
    const list = cands.map(([id, v]) => [id, v.w * (v.looks === 'any' ? 1 : 1.5) * (used.has(id) ? 0.2 : 1) * (id === prev ? 0.05 : 1)]);
    return wpick(list, R);
  }

  function makePlan(spec, crIn, avail = {}) {
    const cr = cleanCreative(crIn);
    if (cr.plan) { const p = thawPlan(spec, cr); if (p) return p; }
    const R = rng((cr.seed ^ 0x9e3779b9) >>> 0), has = content(spec, avail);
    const lookId = cr.look !== 'auto' ? cr.look : cr.pref && LOOKS[cr.pref] ? cr.pref : pickLook(spec, R);
    const L = LOOKS[lookId], dur = spec.duration, mood = spec.style.mood;
    // andamento dentro da faixa do visual; trilha suave puxa para baixo
    const valid = BPMS[dur] || BPMS[15];
    let opts = valid.filter((b) => b >= L.bpm[0] && b <= L.bpm[1]); if (!opts.length) opts = valid;
    if (mood === 'suave') opts = opts.slice(0, Math.max(1, Math.ceil(opts.length / 2)));
    else if (mood === 'energia' && opts.length > 2) opts = opts.slice(Math.floor(opts.length / 3));
    const bpm = opts[Math.floor(R() * opts.length)], beat = 60 / bpm, total = Math.round((dur * bpm) / 60);
    // estilo do vídeo
    const typeId = wpick(L.types, R), frame = wpick(L.frames, R), fx1 = wpick(L.fx, R), fx2 = wpick(L.fx, R), em = wpick(L.em, R), deco = wpick(L.deco, R);
    const scheme = wpick(L.schemes, R), bg1 = wpick(L.bgs, R), bgA = wpick(L.bgAccent || L.bgs, R), genre = wpick(L.genre, R);
    // história
    const arcList = Object.entries(ARCS).filter(([, a]) => !a.need || has[a.need]).map(([id, a]) => [id, a.w * (id === 'offer' && has.offer ? 1.5 : 1) * (id === 'search' && !has.search ? 0 : 1)]);
    const arcId = cr.arc !== 'auto' && ARCS[cr.arc] && (!ARCS[cr.arc].need || has[ARCS[cr.arc].need]) ? cr.arc : wpick(arcList, R);
    const seq = buildSeq(arcId, dur, has, R);
    const beats = allocBeats(seq, total, beat, has);
    // cenas
    const used = new Set(); let prev = null, t = 0;
    const inverse = scheme === 'dark' || scheme === 'night' ? 'light' : 'dark';
    const scenes = seq.map((s, i) => {
      const d = beats[i] * beat, variant = pickVariant(s.kind, lookId, has, used, R, prev, spec) || 'hookStack';
      used.add(variant); prev = variant;
      let surf = scheme;
      if (L.alt) { const a = L.alt[i % L.alt.length]; surf = a === 'base' ? scheme : a === 'inverse' ? inverse : a; }
      else if (L.accentKinds && L.accentKinds.includes(s.kind)) surf = L.accent;
      const fx = i % 3 === 2 ? fx2 : fx1;
      const sc = { i, kind: s.kind, item: s.item, variant, t0: t, t1: t + d, d, beats: beats[i], beat, surf, fx, em, bgKind: surf === scheme ? bg1 : bgA, seed: (cr.seed + i * 7919) >>> 0 };
      t += d;
      return sc;
    });
    scenes[scenes.length - 1].t1 = dur;
    // transições entre cenas
    const trans = [];
    for (let i = 0; i < scenes.length - 1; i++) {
      let kind = wpick(L.trans, R);
      if (i > 0 && trans[i - 1].kind === kind && L.trans.length > 1) kind = wpick(L.trans, R);
      const d = clamp(TRANS_BEATS[kind] * beat, kind === 'cut' ? 0.16 : 0.3, 0.7);
      trans.push({ i, kind, t: scenes[i].t1, d, dir: R() < 0.5 ? 1 : -1, vert: R() < 0.3, ox: 0.3 + 0.4 * R(), oy: 0.35 + 0.3 * R(), seed: Math.floor(R() * 1000) });
    }
    // a primeira cena já começa em movimento (o primeiro quadro nunca fica vazio)
    scenes.forEach((sc, i) => { const tin = i ? trans[i - 1] : null; sc.in = tin ? (IN_AT[tin.kind] ?? 0) : -0.14; });
    return { v: 2, seed: cr.seed, look: lookId, arc: arcId, dur, bpm, beat, total, typeId, frame, fx1, fx2, em, deco, scheme, bg1, bgA, genre, mood, scenes, trans, keys: cr.keys, energy: L.energy };
  }

  // ══════════════════════════════ o motor
  function parseNum(str) {
    const lastDot = str.lastIndexOf('.'), lastCom = str.lastIndexOf(','), seps = (str.match(/[.,]/g) || []);
    let decSep = '', group = '';
    if (lastDot >= 0 && lastCom >= 0) { decSep = lastDot > lastCom ? '.' : ','; group = decSep === '.' ? ',' : '.'; }
    else if (seps.length) { const sep = seps[0], tail = str.length - str.lastIndexOf(sep) - 1; if (seps.length > 1 || tail === 3) group = sep; else decSep = sep; }
    const v = parseFloat(str.split(group || '\u0000').join('').replace(decSep || '\u0000', '.'));
    if (!isFinite(v)) return null;
    return { v, group, decSep: decSep || '.', dec: decSep ? Math.min(2, str.length - str.lastIndexOf(decSep) - 1) : 0 };
  }
  const SCENE_KEY = { product: 'reveal', cta: 'contact', outro: 'logo', benefit1: 'benefits' };

  function create(specIn, images = {}) {
    const spec = Pulso.normalize(specIn), cr = cleanCreative(specIn && specIn.creative);
    const gallery = (images.gallery || []).filter(Boolean);
    const plan = makePlan(spec, cr, { photo: !!images.product, gallery: gallery.length });
    const L = LOOKS[plan.look], lang = L10N[spec.lang] ? spec.lang : 'pt', LT = L10N[lang], loc = LT.loc;
    const pal = K.palette(spec.colors.primary, spec.colors.secondary);
    const SC = spec.script, BR = spec.brand, c = spec.contact;
    // nome curto da marca não quebra no meio da frase
    const nm = String(BR.name || '').trim();
    if (nm.includes(' ') && nm.length <= 18) { const re = new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); ['pain', 'product', 'benefitsTitle', 'tagline', 'cta', 'offer'].forEach((k) => { SC[k] = String(SC[k] || '').replace(re, (m) => m.replace(/ /g, '\u00A0')); }); }
    const rowsC = [];
    if (String(c.whatsapp).trim()) rowsC.push({ icon: 'chat', text: String(c.whatsapp).trim(), mono: true });
    if (String(c.instagram).trim()) rowsC.push({ icon: 'at', text: c.instagram.trim().startsWith('@') ? c.instagram.trim() : '@' + c.instagram.trim(), mono: true });
    if (String(c.site).trim() && rowsC.length < 3) rowsC.push({ icon: 'globe', text: String(c.site).trim().replace(/^https?:\/\//, ''), mono: true });
    if (String(c.address).trim() && rowsC.length < 3) rowsC.push({ icon: 'pin', text: String(c.address).trim(), mono: false });
    const D = {
      brand: BR.name, segIcon: (Pulso.SEGMENT_ICON || {})[BR.segment] || 'sparkle',
      hook: SC.hook.length ? SC.hook : [BR.name], pain: SC.pain, search: SC.search, product: SC.product, offer: SC.offer,
      benefitsTitle: SC.benefitsTitle, benefits: SC.benefits, tagline: SC.tagline || '', cta: SC.cta,
      showcaseTitle: SC.showcaseTitle, stepsTitle: SC.stepsTitle, steps: SC.steps,
      proof: { rating: String(spec.proof.rating || '').trim(), src: String(spec.proof.ratingSource || '').trim(), cust: String(spec.proof.customers || '').trim(), custLabel: String(spec.proof.customersLabel || '').trim() },
      quote: String(spec.proof.quote || '').trim(), author: String(spec.proof.author || '').trim(), contact: rowsC,
      handle: rowsC.find((r) => r.icon === 'at') ? rowsC.find((r) => r.icon === 'at').text : '', site: String(c.site || '').trim().replace(/^https?:\/\//, ''),
      hookKey: plan.keys.hook, painKey: plan.keys.pain, productKey: plan.keys.product, tagKey: plan.keys.tagline,
    };
    const shadowFor = (s) => {
      if (L.textShadow === 'drop') return { x: 0, y: 7, color: rgbaHex(s.light ? '#000000' : '#000000', s.light ? 0.13 : 0.35) };
      if (L.textShadow === 'offset') return { x: 7, y: 7, color: s.acc2 === s.fg ? s.acc : s.acc2 };
      if (L.textShadow === 'glow') return { x: 0, y: 0, blur: 28, color: s.acc };
      return null;
    };
    const C = { D, look: L, ty: K.TYPES[plan.typeId] || K.TYPES.grotesk, pal, loc, L: LT, images: { product: images.product || null }, logo: images.logo ? K.scaled(images.logo, 600) : null,
      gallery, frame: plan.frame, n: plan.scenes.length, shadowFor, parseNum, plan };
    C.look = { ...L, deco: plan.deco };

    // cenas prontas para desenhar
    const m = mk(10, 10).getContext('2d');
    const scenes = plan.scenes.map((p) => {
      const s = K.surface(pal, p.surf);
      const sc = { ...p, s, bg: { kind: p.bgKind, s, seed: p.seed, cy: 900 } };
      const v = SV[p.variant];
      try { v.prep(m, C, sc); } catch (e) { console.error('[studio] prep', p.variant, e); sc.broken = true; }
      try { sc.hits = sc.broken ? [] : (SS.HITS[p.variant] || (() => []))(C, sc); sc.typing = !sc.broken && SS.TYPING[p.variant] ? SS.TYPING[p.variant](C, sc) : null; } catch (e) { sc.hits = []; sc.typing = null; }
      return sc;
    });

    function drawScene(ctx, i, t) {
      const sc = scenes[i], lt = t - sc.t0;
      ctx.save();
      // o fundo fica parado (textura fina que se mexe custa caro no vídeo e treme); só o conteúdo tem a câmera
      K.drawBG(ctx, sc.bg, t);
      // câmera da cena: aproximação lenta (mais viva nos visuais de energia)
      const z = 1 + (0.012 + 0.03 * L.energy) * clamp((lt + 0.3) / (sc.d + 0.6));
      ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
      if (!sc.broken) { try { SV[sc.variant].draw(ctx, C, sc, lt); } catch (e) { if (!sc.warned) { console.error('[studio] draw', sc.variant, e); sc.warned = true; } } }
      ctx.restore();
    }
    let bufs = [];
    function buf(n, w, h, k) {
      let b = bufs[n];
      if (!b || b.c.width !== w || b.c.height !== h) { const cv = mk(w, h); b = bufs[n] = { c: cv, ctx: cv.getContext('2d') }; }
      b.clear = () => { b.ctx.setTransform(1, 0, 0, 1, 0, 0); b.ctx.clearRect(0, 0, w, h); b.ctx.setTransform(k, 0, 0, k, 0, 0); b.ctx.globalAlpha = 1; b.ctx.globalCompositeOperation = 'source-over'; };
      return b;
    }
    function sceneAt(t) { for (let i = 0; i < scenes.length; i++) if (t < scenes[i].t1) return i; return scenes.length - 1; }
    function drawWorld(ctx, t) {
      t = clamp(t, 0, plan.dur - 1e-4);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
      for (const tr of plan.trans) {
        const a = tr.t - tr.d / 2, b = tr.t + tr.d / 2;
        if (t >= a && t < b) {
          const p = (t - a) / tr.d, nxt = scenes[tr.i + 1], w = ctx.canvas.width, h = ctx.canvas.height, k = w / W;
          K.transition(ctx, tr.kind, p, (c2) => drawScene(c2, tr.i, t), (c2) => drawScene(c2, tr.i + 1, t), {
            color: nxt.s.acc, color2: nxt.s.acc2, ring: nxt.s.acc, flash: nxt.s.fg, dir: tr.dir, vert: tr.vert, x: W * tr.ox, y: H * tr.oy, seed: tr.seed, buf: (n) => buf(n, w, h, k),
          });
          return;
        }
      }
      drawScene(ctx, sceneAt(t), t);
    }
    function samplesFor(t, base = 1) {
      let n = base;
      for (const tr of plan.trans) if (t >= tr.t - tr.d / 2 - 0.02 && t <= tr.t + tr.d / 2 + 0.02) n = Math.max(n, FASTK[tr.kind] || 1);
      if (L.energy > 0.7) for (const sc of scenes) { const a = sc.t0 + sc.in; if (t >= a && t <= a + 0.22 && (sc.fx === 'stamp' || sc.variant === 'hookWords' || sc.variant === 'outroStamp')) n = Math.max(n, 4); }
      return n;
    }
    let acc = null;
    function renderFrame(target, t, o = {}) {
      const w = target.width, h = target.height, k = w / W, out = target.getContext('2d');
      const N = o.samples ?? samplesFor(t, o.baseSamples ? Math.min(2, o.baseSamples) : 1), fps = o.fps || 60;
      out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1; out.globalCompositeOperation = 'source-over'; out.filter = 'none';
      if (N <= 1) { out.setTransform(k, 0, 0, k, 0, 0); drawWorld(out, t); out.setTransform(1, 0, 0, 1, 0, 0); }
      else {
        if (!acc || acc.w !== w || acc.h !== h) { const sc = mk(w, h), ac = mk(w, h); acc = { w, h, sc, sx: sc.getContext('2d'), ac, ax: ac.getContext('2d') }; }
        for (let i = 0; i < N; i++) {
          const ts = t + ((i + 0.5) / N - 0.5) * (0.5 / fps);
          acc.sx.setTransform(k, 0, 0, k, 0, 0); drawWorld(acc.sx, ts);
          acc.ax.globalAlpha = 1 / (i + 1); acc.ax.drawImage(acc.sc, 0, 0);
        }
        acc.ax.globalAlpha = 1; out.drawImage(acc.ac, 0, 0);
      }
      out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
      if (o.post !== false) K.post(out, t, w, h, L.post);
    }

    // eventos para a trilha (tempos no vídeo)
    const events = {
      v: 2, dur: plan.dur, bpm: plan.bpm, beat: plan.beat, total: plan.total, genre: plan.genre, mood: spec.style.mood, energy: L.energy, look: plan.look, seed: plan.seed,
      style: 'studio', variant: plan.arc,
      scenes: scenes.map((sc) => ({ kind: sc.kind, variant: sc.variant, t0: sc.t0, t1: sc.t1, in: Math.max(0, sc.t0 + sc.in), fx: sc.fx, n: sc.b ? sc.b.count : sc.items ? sc.items.length : 1, items: sc.items ? sc.items.length : sc.tiles ? sc.tiles.length : 0,
        hits: (sc.hits || []).map(([t, type, n]) => [+(sc.t0 + t).toFixed(4), type, n || 0]), typing: sc.typing ? { ...sc.typing, t: sc.t0 + sc.typing.t } : null })),
      trans: plan.trans.map((tr) => ({ t: tr.t, kind: tr.kind, d: tr.d })),
    };
    const find = (k) => scenes.find((s) => s.kind === k);
    const prod = find('product') || scenes[1] || scenes[0], outro = find('outro') || scenes[scenes.length - 1];
    return {
      spec, plan, theme: { pri: pal.pri, sec: pal.sec }, events, renderFrame, drawWorld, samplesFor, W, H, DUR: plan.dur, native: true,
      scenes: scenes.map((sc) => ({ key: SCENE_KEY[sc.kind] || sc.kind, t0: sc.t0, t1: sc.t1, thumb: Math.min((plan.trans[sc.i] ? plan.trans[sc.i].t - plan.trans[sc.i].d / 2 : sc.t1) - 0.05, sc.t0 + (sc.thumbT ?? Math.max(sc.in + 0.5, sc.d * 0.84))) })),
      coverT: Math.min(prod.t1 - 0.1, prod.t0 + prod.d * 0.75), posterT: Math.min(outro.t1 - 0.05, outro.t0 + outro.d * 0.8),
      lookName: (L.name[lang] || L.name.pt), arcName: (ARC_NAMES[plan.arc] || {})[lang] || plan.arc,
    };
  }
  function rgbaHex(c, a) { return U.rgba(c, a); }

  const lookList = (lang = 'pt') => LOOK_IDS.map((id) => ({ id, name: LOOKS[id].name[lang] || LOOKS[id].name.pt }));
  return { create, makePlan, freezePlan, cleanCreative, newCreative, isStudio, ready: (base) => K.loadFonts(base), LOOKS, LOOK_IDS, ARCS, lookList, FACES: K.FACES };
})();
if (typeof module !== 'undefined') module.exports = PulsoStudio;
