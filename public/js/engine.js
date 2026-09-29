'use strict';
// ─── Pulso engine: brief → 15 s beat-synced motion video (1080×1920) ───
const Pulso = (() => {
  const U = PU;
  const { W, H, BEAT, bt, clamp, lerp, inv, smooth, EO, EI, EIO, spring, hash, hash2, rng, noise1, rgba, mixs, mixc, setFont, tw, fit, layoutWords, drawWords, rr, glowStroke, pivot, checkPath, icon, mk } = U;
  const expoIn = U.expoIn, expoInOut = U.expoInOut, cubicOut = U.cubicOut, cubicIn = U.cubicIn, sineInOut = U.sineInOut;

  const FONTS = {
    moderno: { head: "'Bricolage Grotesque', 'Instrument Sans', sans-serif", hw: 800, hls: -0.035, cap: 0.7, upper: true },
    impacto: { head: "'Big Shoulders Display', 'Instrument Sans', sans-serif", hw: 800, hls: 0.005, cap: 0.73, upper: true },
    elegante: { head: "'Gloock', Georgia, serif", hw: 400, hls: -0.012, cap: 0.68, upper: false },
  };
  const BODY = "'Instrument Sans', system-ui, sans-serif", MONO = "'IBM Plex Mono', ui-monospace, monospace";
  const SHARED = {};
  const CAN_FILTER = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch (e) { return false; } })();

  function makeTheme(primary, secondary) {
    const P = U.rgb2hsl(U.hex(primary));
    const S2 = secondary ? U.rgb2hsl(U.hex(secondary)) : { h: (P.h + 38) % 360, s: P.s, l: P.l };
    const neutralP = P.s < 12, hb = neutralP ? (S2.s >= 12 ? S2.h : 215) : P.h, sb = neutralP && S2.s < 12 ? 6 : 22;
    const hsl = (h, s, l) => U.toHex(U.hsl2rgb(h, s, l));
    const pri = neutralP ? U.hsl2rgb(P.h, P.s, 88) : U.hsl2rgb(P.h, clamp(P.s, 55, 95), clamp(P.l, 54, 68));
    const sec = S2.s < 12 ? U.hsl2rgb(S2.h, S2.s, 88) : U.hsl2rgb(S2.h, clamp(S2.s, 55, 95), clamp(S2.l, 56, 72));
    const ink = U.hsl2rgb(hb, 30, 7);
    const on = (c) => (U.contrast(c, [255, 255, 255]) >= 3.1 ? '#FFFFFF' : U.toHex(ink));
    const T = {
      bg: hsl(hb, sb, 6.5), bgDeep: hsl(hb, sb, 4.5), panel: hsl(hb, sb * 0.8, 11), panel2: hsl(hb, sb * 0.8, 8.5), border: hsl(hb, sb * 0.6, 21), border2: hsl(hb, sb * 0.6, 15),
      text: hsl(hb, 28, 95), muted: hsl(hb, 10, 67), muted2: hsl(hb, 8, 50), pri: U.toHex(pri), sec: U.toHex(sec), onPri: on(pri), onSec: on(sec),
      priCore: U.toHex(U.mixc(pri, [255, 255, 255], 0.72)), g: [7, 10, 14, 19, 26, 37, 52, 70, 86].map((l) => hsl(hb, 5, l)), hue: hb,
    };
    return T;
  }

  // textos que o próprio motor desenha, por idioma do vídeo
  const L10N = {
    pt: { loc: 'pt-BR', brand: 'Sua Empresa', hook: ['SUA MARCA', 'EM MOVIMENTO'], pain: 'Cansou de passar despercebido?', why: (n) => `Por que a ${n}?`, cta: 'Fale com a gente',
      benefits: ['Atendimento próximo', 'Feito com cuidado', 'Fale com a gente'], custLabel: 'clientes atendidos', search: 'Pesquisar…', rating: (src) => (src ? `Nota no ${src}` : 'Nota'), made: 'Feito com Pulso',
      showcase: 'Veja de perto', stepsTitle: 'Como funciona', steps: [['Escolha o que quer', 'bag'], ['Fale com a gente', 'chat'], ['Aproveite', 'heart']], offer: 'OFERTA', url: 'suaempresa.com.br' },
    en: { loc: 'en-US', brand: 'Your Business', hook: ['YOUR BRAND', 'IN MOTION'], pain: 'Tired of being overlooked?', why: (n) => `Why ${n}?`, cta: 'Get in touch',
      benefits: ['Friendly service', 'Made with care', 'Message us'], custLabel: 'happy customers', search: 'Search…', rating: (src) => (src ? `Rated on ${src}` : 'Rating'), made: 'Made with Pulso',
      showcase: 'Take a closer look', stepsTitle: 'How it works', steps: [['Pick what you like', 'bag'], ['Message us', 'chat'], ['Enjoy', 'heart']], offer: 'OFFER', url: 'yourbusiness.com' },
    es: { loc: 'es', brand: 'Tu Empresa', hook: ['TU MARCA', 'EN MOVIMIENTO'], pain: '¿Cansado de pasar desapercibido?', why: (n) => `¿Por qué ${n}?`, cta: 'Escríbenos',
      benefits: ['Atención cercana', 'Hecho con cuidado', 'Escríbenos'], custLabel: 'clientes atendidos', search: 'Buscar…', rating: (src) => (src ? `Nota en ${src}` : 'Calificación'), made: 'Hecho con Pulso',
      showcase: 'Míralo de cerca', stepsTitle: 'Cómo funciona', steps: [['Elige lo que quieres', 'bag'], ['Escríbenos', 'chat'], ['Disfruta', 'heart']], offer: 'OFERTA', url: 'tuempresa.com' },
  };
  const SEGMENT_ICON = { Confeitaria: 'heart', Restaurante: 'flame', Lanchonete: 'flame', Pizzaria: 'flame', Cafeteria: 'coffee', Moda: 'bag', Beleza: 'scissors', 'Saúde': 'shield', Odontologia: 'smile',
    Fitness: 'dumbbell', 'Educação': 'book', Pet: 'paw', 'Imobiliária': 'home', 'Serviços': 'tool', Tecnologia: 'bolt', Loja: 'bag', Outro: 'sparkle' };

  function parseNum(str) {
    const lastDot = str.lastIndexOf('.'), lastCom = str.lastIndexOf(','), seps = (str.match(/[.,]/g) || []);
    let decSep = '', group = '';
    if (lastDot >= 0 && lastCom >= 0) { decSep = lastDot > lastCom ? '.' : ','; group = decSep === '.' ? ',' : '.'; }
    else if (seps.length) {
      const sep = seps[0], tail = str.length - str.lastIndexOf(sep) - 1;
      if (seps.length > 1 || tail === 3) group = sep; else decSep = sep;
    }
    const clean = str.split(group || '\u0000').join('').replace(decSep || '\u0000', '.');
    const v = parseFloat(clean);
    if (!isFinite(v)) return null;
    return { v, group, decSep: decSep || '.', dec: decSep ? Math.min(2, str.length - str.lastIndexOf(decSep) - 1) : 0 };
  }

  function normalize(spec) {
    const s = JSON.parse(JSON.stringify(spec || {}));
    s.lang = L10N[s.lang] ? s.lang : 'pt';
    const L = L10N[s.lang];
    s.brand = { name: L.brand, segment: 'Outro', ...(s.brand || {}) };
    s.colors = { primary: '#FF5C8A', secondary: '#FFC46B', ...(s.colors || {}) };
    s.style = { font: 'moderno', mood: 'energia', motion: 'dinamico', watermark: false, ...(s.style || {}) };
    if (s.style.motion !== 'premium') s.style.motion = 'dinamico';
    const sc = s.script || {};
    s.script = {
      hook: (Array.isArray(sc.hook) ? sc.hook : [sc.hook || L.hook[0], L.hook[1]]).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 2),
      pain: sc.pain || L.pain, search: sc.search || (s.brand.name || '').toLowerCase(), product: sc.product || s.brand.name,
      offer: sc.offer || '', benefitsTitle: sc.benefitsTitle || L.why(s.brand.name),
      benefits: (sc.benefits || []).filter((b) => b && String(b.text || '').trim()).slice(0, 4).map((b) => ({ text: String(b.text).trim(), icon: b.icon || U.iconFor(b.text) })),
      tagline: sc.tagline || '', cta: sc.cta || L.cta,
      // só no vídeo de 30 s: título das fotos, título e 3 passos do "como funciona"
      showcaseTitle: String(sc.showcaseTitle || '').trim() || L.showcase, stepsTitle: String(sc.stepsTitle || '').trim() || L.stepsTitle,
      steps: (Array.isArray(sc.steps) ? sc.steps : []).filter((b) => b && String(b.text || '').trim()).slice(0, 3).map((b) => ({ text: String(b.text).trim(), icon: b.icon || U.iconFor(b.text) })),
    };
    if (s.script.steps.length < 3) s.script.steps = L.steps.map(([text, icon], i) => s.script.steps[i] || { text, icon });
    if (!s.script.hook.length) s.script.hook = [L.hook[0]];
    if (!s.script.benefits.length) s.script.benefits = [{ text: L.benefits[0], icon: 'people' }, { text: L.benefits[1], icon: 'heart' }, { text: L.benefits[2], icon: 'chat' }];
    s.duration = [15, 20, 30].includes(Number(s.duration)) ? Number(s.duration) : 15;
    s.proof = { rating: '', ratingSource: '', customers: '', customersLabel: L.custLabel, quote: '', author: '', ...(s.proof || {}) };
    s.contact = { whatsapp: '', instagram: '', site: '', address: '', ...(s.contact || {}) };
    return s;
  }

  function create(specIn, images = {}) {
    // pedidos novos trazem a direção criativa (v2) e usam o motor criativo; os já pagos continuam neste motor
    if (typeof PulsoStudio !== 'undefined' && PulsoStudio.isStudio(specIn)) return PulsoStudio.create(specIn, images);
    const spec = normalize(specIn);
    const T = makeTheme(spec.colors.primary, spec.colors.secondary);
    const F = FONTS[spec.style.font] || FONTS.moderno;
    const SC = spec.script, BR = spec.brand, L = L10N[spec.lang], LOC = L.loc;
    const NB = (x) => { const nm = String(BR.name || '').trim(); if (!nm || !x) return x; const re = new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); return String(x).replace(re, (m) => m.replace(/ /g, '\u00A0')); };
    ['pain', 'product', 'benefitsTitle', 'tagline', 'cta', 'offer'].forEach((k) => { SC[k] = NB(SC[k]); });
    const S = {};
    const seed = U.strSeed(BR.name + SC.product + SC.hook.join(''));
    const upper = (x) => (F.upper ? x.toLocaleUpperCase(LOC) : x);
    // Premium: estilo limpo (palavras que pousam no tempo, molas, movimentos mágicos, cursor), sem brilho, tremor ou partículas
    const PREM = spec.style.motion === 'premium';
    const D30 = spec.duration === 30;

    // ── layout constants
    const PH = { cx: 540, cy: 758, w: 530, h: 940, r: 72 };
    PH.x = PH.cx - PH.w / 2; PH.y = PH.cy - PH.h / 2;
    const SCR = { x: PH.x + 12, y: PH.y + 12, w: PH.w - 24, h: PH.h - 24, r: 60 };
    const BARR = { cx: 540, cy: 1226, w: 860, h: 112 };
    const NODE_T = [7.73, 7.965, 8.2, 8.435];
    const CARD = { x: 110, y: 540, w: 860, h: 760 };

    function hasProof() { return !!(String(spec.proof.rating).trim() || String(spec.proof.customers).trim()); }
    const variant6 = hasProof() ? 'proof' : SC.offer ? 'offer' : 'statement';
    // vídeo de 30 s sem prova nem oferta: a cena "Frase" e a frase final nunca repetem o mesmo texto.
    // Com gancho afirmativo, a frase final retoma o gancho (o vídeo abre e fecha com a mesma ideia) e a cena "Frase" fica com o slogan;
    // com gancho em pergunta, a cena "Frase" mostra o produto e o slogan fecha o vídeo.
    const HOOK_UP = SC.hook.map(upper).filter(Boolean), HOOK_Q = /[?¿]/.test(HOOK_UP.join(' '));
    const CALLBACK = D30 && variant6 === 'statement' && HOOK_UP.length > 0 && !HOOK_Q;
    const STMT_TEXT = D30 && variant6 === 'statement' && !CALLBACK && SC.product ? SC.product : SC.tagline || SC.product;

    // ── prep: backgrounds, sprites, grain
    function prepBG() {
      const brand = mk(W, H), x = brand.getContext('2d');
      x.fillStyle = T.bg; x.fillRect(0, 0, W, H);
      let g = x.createRadialGradient(W * 0.95, -90, 0, W * 0.95, -90, 1380);
      g.addColorStop(0, rgba(T.pri, 0.2)); g.addColorStop(0.55, rgba(T.pri, 0.05)); g.addColorStop(1, rgba(T.pri, 0));
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      g = x.createRadialGradient(-40, H + 60, 0, -40, H + 60, 1300);
      g.addColorStop(0, rgba(T.sec, 0.13)); g.addColorStop(1, rgba(T.sec, 0));
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      S.bgBrand = brand;
      const grey = mk(W, H), y = grey.getContext('2d');
      y.fillStyle = T.g[0]; y.fillRect(0, 0, W, H);
      g = y.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, 1150);
      g.addColorStop(0, 'rgba(215,220,218,0.06)'); g.addColorStop(1, 'rgba(215,220,218,0)');
      y.fillStyle = g; y.fillRect(0, 0, W, H);
      S.bgGrey = grey;
      if (PREM) {
        // uma cor de fundo da marca, com luz suave; nada que dispute com o conteúdo
        const pb = mk(W, H), z = pb.getContext('2d');
        z.fillStyle = T.bg; z.fillRect(0, 0, W, H);
        let gp = z.createRadialGradient(W * 0.86, H * 0.08, 0, W * 0.86, H * 0.08, 1250);
        gp.addColorStop(0, rgba(T.pri, 0.13)); gp.addColorStop(0.6, rgba(T.pri, 0.03)); gp.addColorStop(1, rgba(T.pri, 0));
        z.fillStyle = gp; z.fillRect(0, 0, W, H);
        gp = z.createRadialGradient(W * 0.1, H * 0.95, 0, W * 0.1, H * 0.95, 1150);
        gp.addColorStop(0, rgba(T.sec, 0.07)); gp.addColorStop(1, rgba(T.sec, 0));
        z.fillStyle = gp; z.fillRect(0, 0, W, H);
        S.bgPrem = pb;
        S.glowPrem = U.sprite(T.pri, 128);
      }
      S.spr = { pri: U.sprite(T.pri, 32), sec: U.sprite(T.sec, 32), text: U.sprite(T.text, 32), grey: U.sprite('#D9DEDB', 32) };
      if (!SHARED.grain) {
        const d = mk(48, 48), z = d.getContext('2d'); z.fillStyle = '#fff'; z.beginPath(); z.arc(24, 24, 1.7, 0, Math.PI * 2); z.fill(); SHARED.dotTile = d;
        const v = mk(W, H), vx = v.getContext('2d'), vg = vx.createRadialGradient(W / 2, H * 0.46, H * 0.28, W / 2, H * 0.46, H * 0.78);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.48)'); vx.fillStyle = vg; vx.fillRect(0, 0, W, H); SHARED.vignette = v;
        SHARED.grain = [];
        for (let k = 0; k < 3; k++) {
          const c = mk(540, 960), cx = c.getContext('2d'), im = cx.createImageData(540, 960), r = rng(100 + k);
          for (let i = 0; i < im.data.length; i += 4) { const v2 = 128 + (r() + r() + r() - 1.5) * 90; im.data[i] = im.data[i + 1] = im.data[i + 2] = v2; im.data[i + 3] = 255; }
          cx.putImageData(im, 0, 0); SHARED.grain.push(c);
        }
      }
      S.dotTile = SHARED.dotTile; S.vignette = SHARED.vignette; S.grain = SHARED.grain;
      const r = rng(seed);
      S.dust = Array.from({ length: 50 }, () => ({ x: r() * W, y: r() * H, z: 0.25 + r() * 0.95, r: 2 + r() * 6, a: 0.06 + r() * 0.16, vy: -(10 + r() * 26), vx: (r() - 0.5) * 12, c: r() < 0.62 ? 'pri' : r() < 0.5 ? 'text' : 'sec' }));
    }

    // ── prep: hook text + shards
    function prepHook(ctx) {
      const lines = SC.hook.map(upper);
      const fitSize = (l) => { let s = 310; for (; s > 90; s -= 4) { setFont(ctx, F.head, s, F.hw, s * F.hls); if (tw(ctx, l) <= 830) break; } return s; };
      let sizes = lines.map(fitSize);
      const mn = Math.min(...sizes); sizes = sizes.map((v) => Math.min(v, mn * 1.75));
      const hk = { lines, sizes, lss: sizes.map((v) => v * F.hls) };
      hk.ws = lines.map((l, i) => { setFont(ctx, F.head, sizes[i], F.hw, hk.lss[i]); return tw(ctx, l); });
      hk.caps = sizes.map((v) => v * F.cap);
      const gap = Math.min(...sizes) * 0.26;
      const blockH = hk.caps.reduce((a, b) => a + b, 0) + gap * (lines.length - 1), yc = 948;
      let acc = yc - blockH / 2; hk.ys = hk.caps.map((c) => { acc += c; const y = acc; acc += gap; return y; });
      hk.xs = hk.ws.map((w, i) => 540 - w / 2 - hk.lss[i] / 2);
      hk.yc = yc; hk.size = Math.max(...sizes); hk.cap = Math.max(...hk.caps);
      S.hook = hk;
      S.slice = { x0: -160, y0: yc + 314, x1: 1240, y1: yc - 306 };
      const dx = S.slice.x1 - S.slice.x0, dy = S.slice.y1 - S.slice.y0, L = Math.hypot(dx, dy);
      S.slice.d = { x: dx / L, y: dy / L }; S.slice.n = { x: dy / L, y: -dx / L };
      const tc = mk(W, H), x = tc.getContext('2d');
      x.fillStyle = T.text;
      lines.forEach((l, i) => { setFont(x, F.head, sizes[i], F.hw, hk.lss[i]); x.fillText(l, hk.xs[i], hk.ys[i]); });
      S.hookTC = tc;
      const img = x.getImageData(0, 0, W, H).data, cell = 34; S.cell = cell; S.shards = [];
      const r = rng(seed + 1);
      const top = hk.ys[0] - hk.caps[0] - 70, bot = hk.ys[hk.ys.length - 1] + sizes[sizes.length - 1] * 0.25;
      for (let yy = Math.max(0, Math.floor(top)); yy < bot && yy < H - cell; yy += cell) {
        for (let xx = 20; xx < W - 20 - cell; xx += cell) {
          let on = 0, tot = 0;
          for (let sy = 1; sy < cell; sy += 3) for (let sx = 1; sx < cell; sx += 3) { tot++; if (img[((yy + sy) * W + (xx + sx)) * 4 + 3] > 120) on++; }
          if (on / tot > 0.1) {
            const cx = xx + cell / 2, cy = yy + cell / 2;
            const side = (cx - S.slice.x0) * S.slice.n.x + (cy - S.slice.y0) * S.slice.n.y > 0 ? 'up' : 'lo';
            S.shards.push({ sx: xx, sy: yy, cx, cy, side, delay: r() * 0.05, dur: 0.3 + r() * 0.16, spin: (r() - 0.5) * 7, burst: 120 + r() * 260, bang: (r() - 0.5) * 1.6 });
          }
        }
      }
    }

    // ── prep: chaos cards (pain)
    function prepPain(ctx) {
      const r = rng(seed + 2), kinds = ['q', 'x', 'clock', 'dots', 'spin', 'warn'];
      S.cards = [];
      const cols = 4, rows = 5, x0 = 90, y0 = 470, cw = 900 / cols, ch = 700 / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const w = 130 + r() * 90, h = 88 + r() * 40;
        S.cards.push({ x: x0 + i * cw + (cw - w) / 2 + (r() - 0.5) * 50, y: y0 + j * ch + (ch - h) / 2 + (r() - 0.5) * 30, w, h, rot: (r() - 0.5) * 0.14, kind: kinds[Math.floor(r() * kinds.length)], appear: 0, extra: false, lines: 1 + Math.floor(r() * 2) });
      }
      for (let k = 0; k < 10; k++) {
        const w = 120 + r() * 90, h = 86 + r() * 36;
        S.cards.push({ x: 90 + r() * (900 - w), y: 470 + r() * (700 - h), w, h, rot: (r() - 0.5) * 0.3, kind: kinds[Math.floor(r() * kinds.length)], appear: 2.1 + r() * 0.95, extra: true, lines: 1 + Math.floor(r() * 2) });
      }
      const base = S.cards.filter((c) => !c.extra);
      S.shards.forEach((s, j) => { const c = base[j % base.length]; s.target = c; s.tx = c.x + 10 + hash(j * 3.3) * Math.max(4, c.w - 20); s.ty = c.y + 8 + hash(j * 5.1) * (c.h - 16); });
      base.forEach((c, i) => { c.appear = 1.875 + 0.24 + hash(i * 2.7) * 0.14; });
      const pf = fit(ctx, SC.pain, F.head, F.hw, 860, 140, 60, 2, F.hls);
      S.pain = { size: pf.size, ls: pf.ls, lines: pf.lines.map((l) => { setFont(ctx, F.head, pf.size, F.hw, pf.ls); return layoutWords(ctx, l, 540, 'center'); }) };
      const lead = pf.size * 1.02; S.pain.ys = pf.lines.map((_, i) => 1432 - (pf.lines.length - 1 - i) * lead);
    }

    // ── prep: stage (product screen, color + grey)
    function drawCover(x, img, w, h) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.max(w / iw, h / ih);
      x.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
    }
    function drawContain(x, img, cx, cy, w, h) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(w / iw, h / ih);
      x.drawImage(img, cx - (iw * k) / 2, cy - (ih * k) / 2, iw * k, ih * k);
    }
    function drawMonogram(x, cx, cy, r, withRing = true) {
      if (withRing) { x.save(); x.globalAlpha *= 0.5; x.strokeStyle = T.pri; x.lineWidth = r * 0.22; x.beginPath(); x.arc(cx, cy, r * 1.53, 0, Math.PI * 2); x.stroke(); x.restore(); }
      x.fillStyle = T.pri; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      const ch = (BR.name.trim()[0] || 'P').toLocaleUpperCase(LOC);
      setFont(x, F.head, r * 1.15, F.hw, 0); x.textAlign = 'center'; x.fillStyle = T.onPri; x.fillText(ch, cx, cy + r * 1.15 * F.cap * 0.5); x.textAlign = 'left';
    }
    function drawAvatar(x, cx, cy, r) {
      if (images.logo) { x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = '#FFFFFF'; x.fill(); x.clip(); drawContain(x, images.logo, cx, cy, r * 1.5, r * 1.5); x.restore(); }
      else drawMonogram(x, cx, cy, r, false);
    }
    function prepStage(ctx) {
      const w = SCR.w, h = SCR.h, col = mk(w, h), x = col.getContext('2d');
      if (images.product) {
        drawCover(x, images.product, w, h);
      } else {
        const g = x.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, T.pri); g.addColorStop(1, U.toHex(U.mixc(U.hex(T.pri), U.hex(T.bg), 0.55)));
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = rgba('#FFFFFF', 0.08);
        for (let yy = 30; yy < h; yy += 44) for (let xx = 30 + ((yy / 44) % 2) * 22; xx < w; xx += 44) { x.beginPath(); x.arc(xx, yy, 3, 0, Math.PI * 2); x.fill(); }
        // no photo: a clean brand post (logo, or the segment icon); the product name is already the headline under the phone
        const cy = h * 0.44, R = 165;
        x.fillStyle = rgba(T.onPri === '#FFFFFF' ? '#FFFFFF' : '#000000', 0.12); x.beginPath(); x.arc(w / 2, cy, R * 1.3, 0, Math.PI * 2); x.fill();
        if (images.logo) { x.save(); x.shadowColor = 'rgba(0,0,0,0.25)'; x.shadowBlur = 30; x.shadowOffsetY = 10; x.beginPath(); x.arc(w / 2, cy, R, 0, Math.PI * 2); x.fillStyle = '#FFFFFF'; x.fill(); x.restore(); x.save(); x.beginPath(); x.arc(w / 2, cy, R, 0, Math.PI * 2); x.clip(); drawContain(x, images.logo, w / 2, cy, R * 1.42, R * 1.42); x.restore(); }
        else icon(x, SEGMENT_ICON[BR.segment] || (SC.benefits[0] && SC.benefits[0].icon) || 'sparkle', w / 2, cy, 240, U.contrast(U.hex(T.pri), [255, 255, 255]) >= 2.2 ? '#FFFFFF' : T.onPri, 1.7);
        x.textAlign = 'left';
      }
      // social-post chrome
      let g = x.createLinearGradient(0, 0, 0, 210); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, 210);
      g = x.createLinearGradient(0, h - 260, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); x.fillStyle = g; x.fillRect(0, h - 260, w, 260);
      drawAvatar(x, 50, 100, 24);
      const handle = spec.contact.instagram ? (spec.contact.instagram.startsWith('@') ? spec.contact.instagram : '@' + spec.contact.instagram) : '';
      setFont(x, BODY, 23, 700, 0); x.fillStyle = '#FFFFFF';
      let nm = BR.name; while (tw(x, nm) > w - 140 && nm.length > 3) nm = nm.slice(0, -2) + '…';
      x.fillText(nm, 86, handle ? 95 : 108);
      if (handle) { setFont(x, BODY, 18, 400, 0); x.fillStyle = 'rgba(255,255,255,0.82)'; x.fillText(handle, 86, 119); }
      for (let i = 0; i < 3; i++) { icon(x, ['heart', 'chat', 'arrow'][i], 44 + i * 58, h - 56, 34, 'rgba(255,255,255,0.92)', 2); }
      S.stageColor = col;
      const gr = mk(w, h), y = gr.getContext('2d');
      if (CAN_FILTER) { y.filter = 'grayscale(1) contrast(0.85) brightness(0.72) blur(1.5px)'; y.drawImage(col, 0, 0); y.filter = 'none'; }
      else { y.drawImage(col, 0, 0); const im = y.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const v = ((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) - 128) * 0.85 + 128; d[i] = d[i + 1] = d[i + 2] = Math.max(0, v * 0.72); } y.putImageData(im, 0, 0); }
      S.stageGrey = gr;
      if (PREM && CAN_FILTER) { const sb = mk(w, h), bx = sb.getContext('2d'); bx.filter = 'blur(14px)'; bx.drawImage(col, 0, 0); S.stageBlur = sb; }
      S.stageStars = Array.from({ length: 9 }, (_, i) => ({ x: 60 + hash(i * 3.7 + seed % 97) * (w - 120), y: 150 + hash(i * 5.3 + 11) * (h - 320), s: 14 + hash(i * 2.2) * 18, ph: hash(i * 9.1) * 6.28 }));
    }

    // ── prep: text layouts for later scenes
    function prepLayouts(ctx) {
      // query typing
      const q = String(SC.search || '').slice(0, 44);
      let qs = 33; setFont(ctx, MONO, qs, 400, 0);
      while (tw(ctx, q) > 640 && qs > 20) { qs -= 1; setFont(ctx, MONO, qs, 400, 0); }
      S.query = { text: q, size: qs };
      const r = rng(seed + 9), n = Math.max(1, q.length), span = Math.min(0.72, n * 0.034), step = span / n;
      S.typeT = []; let tt = 4.64;
      for (let i = 0; i < q.length; i++) { S.typeT.push(tt); tt += step * (0.6 + r() * 0.8); }
      if (S.typeT.length) { const end = S.typeT[S.typeT.length - 1]; if (end > 5.36) S.typeT = S.typeT.map((v) => 4.64 + ((v - 4.64) * 0.72) / (end - 4.64)); }
      // label under phone
      const pillText = upper(BR.name).toLocaleUpperCase(LOC);
      let ps = 28; setFont(ctx, MONO, ps, 700, 3); while (tw(ctx, pillText) > 700 && ps > 18) { ps -= 1; setFont(ctx, MONO, ps, 700, ps * 0.1); }
      const ptw = tw(ctx, pillText);
      const pf = fit(ctx, SC.product, F.head, F.hw, 900, 68, 40, 2, F.hls);
      S.lbl = { pillText, ps, ptw, pill: { cx: 540, cy: 1332, w: ptw + 58, h: 60 }, pf };
      setFont(ctx, F.head, pf.size, F.hw, pf.ls);
      S.lbl.lines = pf.lines.map((l) => layoutWords(ctx, l, 540, 'center'));
      S.lbl.ys = pf.lines.length > 1 ? [1418, 1418 + pf.size * 1.04] : [1430];
      // offer sticker
      if (SC.offer) { const of = fit(ctx, upper(SC.offer), F.head, F.hw, 150, 50, 22, 3, F.hls * 0.5); S.offer = of; }
      // benefits
      const bt_ = fit(ctx, SC.benefitsTitle, F.head, F.hw, 840, 108, 54, 2, F.hls);
      setFont(ctx, F.head, bt_.size, F.hw, bt_.ls);
      S.ben = { title: bt_, titleLines: bt_.lines.map((l) => layoutWords(ctx, l, 120)), items: [] };
      S.ben.titleYs = bt_.lines.length > 1 ? [450, 450 + bt_.size * 1.02] : [500];
      const n2 = SC.benefits.length, gap = n2 >= 4 ? 184 : 224, first = 960 - ((n2 - 1) * gap) / 2 + (bt_.lines.length > 1 ? 40 : 0);
      const bsz = Math.min(...SC.benefits.map((b) => fit(ctx, b.text, F.head, F.hw, 660, 76, 38, 2, F.hls * 0.6).size));
      S.ben.items = SC.benefits.map((b, i) => { const f2 = fit(ctx, b.text, F.head, F.hw, 660, bsz, 38, 2, F.hls * 0.6); setFont(ctx, F.head, f2.size, F.hw, f2.ls); return { ...b, cy: first + i * gap, f: f2, lines: f2.lines }; });
      S.ben.lineTop = S.ben.items[0].cy - 110; S.ben.lineBot = S.ben.items[n2 - 1].cy + 110;
      // proof / offer / statement
      if (variant6 === 'proof') {
        S.proof = { rating: String(spec.proof.rating).trim(), src: String(spec.proof.ratingSource || '').trim(), cust: String(spec.proof.customers).trim(), custLabel: String(spec.proof.customersLabel || '').trim() };
        const m = S.proof.cust.match(/\d[\d.,]*/), nf = m ? parseNum(m[0]) : null;
        S.proof.custNum = nf ? nf.v : null; S.proof.fmt = nf;
        S.proof.custPrefix = m ? S.proof.cust.slice(0, m.index) : ''; S.proof.custSuffix = m ? S.proof.cust.slice(m.index + m[0].length) : '';
      } else if (variant6 === 'offer') {
        S.offerBig = fit(ctx, upper(SC.offer), F.head, F.hw, 560, 170, 60, 3, F.hls);
      } else {
        S.stmt = fit(ctx, STMT_TEXT, F.head, F.hw, 860, 132, 60, 3, F.hls);
        setFont(ctx, F.head, S.stmt.size, F.hw, S.stmt.ls); S.stmtLines = S.stmt.lines.map((l) => layoutWords(ctx, l, 540, 'center'));
      }
      // contact
      const c = spec.contact, rows = [];
      if (String(c.whatsapp).trim()) rows.push({ icon: 'chat', text: String(c.whatsapp).trim(), mono: true });
      if (String(c.instagram).trim()) rows.push({ icon: 'at', text: c.instagram.trim().startsWith('@') ? c.instagram.trim() : '@' + c.instagram.trim(), mono: true });
      if (String(c.site).trim() && rows.length < 3) rows.push({ icon: 'globe', text: String(c.site).trim().replace(/^https?:\/\//, ''), mono: true });
      if (String(c.address).trim() && rows.length < 3) rows.push({ icon: 'pin', text: String(c.address).trim(), mono: false });
      rows.forEach((row) => { row.f = fit(ctx, row.text, row.mono ? MONO : BODY, row.mono ? 500 : 600, 610, row.mono ? 52 : 48, 24, row.mono ? 1 : 2, 0); });
      const ct = fit(ctx, SC.cta, F.head, F.hw, 860, rows.length ? 116 : 160, 54, 2, F.hls);
      setFont(ctx, F.head, ct.size, F.hw, ct.ls);
      S.contact = { rows, title: ct, titleLines: ct.lines.map((l) => layoutWords(ctx, l, 540, 'center')) };
      if (rows.length) S.contact.titleYs = ct.lines.length > 1 ? [520, 520 + ct.size * 1.02] : [580];
      else { const lh = ct.size * 1.02, y0 = 900 - ((ct.lines.length - 1) * lh) / 2 + ct.size * F.cap * 0.5; S.contact.titleYs = ct.lines.map((_, i) => y0 + i * lh); }
      const rgap = 184, rfirst = rows.length >= 3 ? 860 : rows.length === 2 ? 930 : 1000;
      rows.forEach((row, i) => { row.cy = rfirst + i * rgap; });
      // logo lockup
      const G = {};
      let fs = 184; setFont(ctx, F.head, fs, F.hw, fs * F.hls * 0.3);
      const box = (s) => s * 1.06;
      const lockW = (s) => { setFont(ctx, F.head, s, F.hw, s * F.hls * 0.3); return box(s) + box(s) * 0.36 + tw(ctx, BR.name); };
      while (fs > 110 && lockW(fs) > 900) fs -= 4;
      if (lockW(fs) <= 900) {
        G.mode = 'row'; G.fs = fs; setFont(ctx, F.head, fs, F.hw, fs * F.hls * 0.3); G.wordW = tw(ctx, BR.name); G.box = box(fs); G.gap = G.box * 0.36;
        G.total = G.box + G.gap + G.wordW; G.left = 540 - G.total / 2; G.cy = 800; G.markX = G.left + G.box / 2; G.wordX = G.left + G.box + G.gap; G.wordY = G.cy + fs * F.cap * 0.5;
        G.nameLines = [BR.name]; G.bottom = G.cy + G.box / 2;
      } else {
        G.mode = 'stack'; G.box = 230; G.markX = 540; G.cy = 640;
        const nf = fit(ctx, BR.name, F.head, F.hw, 900, 150, 70, 2, F.hls * 0.3); G.fs = nf.size; G.nameLines = nf.lines;
        setFont(ctx, F.head, nf.size, F.hw, nf.ls); G.nameWs = nf.lines.map((l) => tw(ctx, l));
        G.nameYs = nf.lines.map((_, i) => G.cy + G.box / 2 + 40 + nf.size * F.cap + i * nf.size * 1.0); G.bottom = G.nameYs[G.nameYs.length - 1] + nf.size * 0.25;
      }
      const tg = fit(ctx, SC.tagline || '', F.head, F.hw, 900, 78, 40, 2, F.hls * 0.7);
      setFont(ctx, F.head, tg.size, F.hw, tg.ls);
      G.tag = tg; G.tagLines = tg.lines.map((l) => layoutWords(ctx, l, 540, 'center'));
      let yy = G.bottom + 70 + tg.size * F.cap;
      G.tagYs = tg.lines.map((_, i) => yy + i * tg.size * 1.1);
      yy = (G.tagYs.length ? G.tagYs[G.tagYs.length - 1] + tg.size * 0.3 : G.bottom) + 96;
      let cs = 38; setFont(ctx, MONO, cs, 700, 1); while (tw(ctx, SC.cta) > 700 && cs > 24) { cs -= 1; setFont(ctx, MONO, cs, 700, 1); }
      G.ctaSize = cs; G.ctaTW = tw(ctx, SC.cta); G.ctaY = Math.min(yy + 20, 1440);
      // centre the whole group vertically around ~900
      const groupTop = G.cy - G.box / 2, groupBot = G.ctaY + 46, shift = Math.round(900 - (groupTop + groupBot) / 2);
      if (Math.abs(shift) > 4) {
        G.cy += shift; G.bottom += shift; G.ctaY += shift; G.tagYs = G.tagYs.map((v) => v + shift);
        if (G.mode === 'row') G.wordY += shift; else G.nameYs = G.nameYs.map((v) => v + shift);
      }
      S.logo = G;
      // watermark
      S.wm = spec.style.watermark;
    }

    function prep() {
      const m = mk(10, 10).getContext('2d');
      prepBG(); prepHook(m); prepPain(m); prepStage(m); prepLayouts(m);
      if (PREM) prepPremium(m);
      if (D30) { prep30(m); prep30Timeline(); }
      const sh = mk(PH.w + 240, PH.h + 240), sx = sh.getContext('2d');
      sx.shadowColor = 'rgba(0,0,0,0.75)'; sx.shadowBlur = 80; sx.fillStyle = 'rgba(0,0,0,0.75)'; sx.beginPath(); sx.roundRect(120, 120, PH.w, PH.h, PH.r); sx.fill();
      S.phoneShadow = sh;
      S.events = {
        typeT: S.typeT.slice(), typeChars: S.query.text, variant: variant6, benefitsN: SC.benefits.length, nodeT: NODE_T.slice(0, SC.benefits.length),
        contactRows: S.contact.rows.length, hasOffer: !!SC.offer, mood: spec.style.mood, cards: S.cards.filter((c) => c.extra).map((c) => c.appear),
        style: PREM ? 'premium' : 'dinamico', clicks: PREM ? [4.36, 5.625, 14.25] : [],
        dur: D30 ? 30 : 15, ch30: D30 ? events30() : null,
      };
    }

    // ══════════════════════════════ camera + shared
    let FT = 0;
    const whipA = (t) => EIO(inv(7.32, 7.68, t));
    const whipB = (t) => EIO(inv(11.07, 11.43, t));
    function camShot(t) {
      if (t < 1.875) return { s: 1 + 0.04 * (t / 1.875), px: 540, py: 948, r: 0, dx: 0, dy: 0 };
      if (t < 3.98) { const te = Math.min(t, 3.7499), k = inv(1.875, 3.75, te); return { s: 1.015 + 0.045 * k, px: 540, py: 880, r: -0.02 - 0.016 * k, dx: 0, dy: 0 }; }
      if (t < 7.5) return { s: 1 + 0.035 * smooth(inv(3.98, 7.5, t)), px: 540, py: 820, r: 0, dx: 0, dy: 0 };
      return { s: 1 + 0.032 * inv(7.5, 15, t), px: 540, py: 900, r: 0, dx: 6 * Math.sin(t * 0.8), dy: 8 * Math.sin(t * 0.6 + 1) };
    }
    function applyCam(c, x, y) { const dx = (x - c.px) * c.s, dy = (y - c.py) * c.s, cs = Math.cos(c.r || 0), sn = Math.sin(c.r || 0); return { x: c.px + (c.dx || 0) + dx * cs - dy * sn, y: c.py + (c.dy || 0) + dx * sn + dy * cs }; }
    function useCam(ctx, c, ox = 0, oy = 0) { pivot(ctx, c.px, c.py, c.s, c.r, (c.dx || 0) + ox, (c.dy || 0) + oy); }
    const IMPACTS = [[0.469, 11], [0.703, 9], [0.9375, 7], [1.875, 13], [3.75, 6], [5.625, 17], [9.2, 4], [13.125, 19]];
    function shake(t) { let x = 0, y = 0; for (const [ti, a] of IMPACTS) { const d = t - ti; if (d < 0 || d > 0.55) continue; const e = a * Math.exp(-d * 10); x += e * noise1(d * 34 + ti * 10); y += e * noise1(d * 34 + ti * 10 + 50); } return { x, y }; }
    const FLASHES = () => [[0.469, 0.09, T.text], [0.703, 0.07, T.text], [0.9375, 0.12, T.pri], [1.875, 0.13, T.text], [3.75, 0.08, T.text], [5.625, 0.15, T.pri], [13.125, 0.18, T.sec]];
    function drawFlashes(ctx, t) { for (const [ti, a, c] of FLASHES()) { const d = t - ti; if (d < 0 || d > 0.22) continue; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(c, a * Math.exp(-d * 20)); ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; } }
    function bgDots(ctx, ox, oy, alpha) {
      if (!ctx._pulsoDots || ctx._pulsoDotsSrc !== S.dotTile) { ctx._pulsoDots = ctx.createPattern(S.dotTile, 'repeat'); ctx._pulsoDotsSrc = S.dotTile; }
      const p = ctx._pulsoDots; p.setTransform(new DOMMatrix([1, 0, 0, 1, ((ox % 48) + 48) % 48, ((oy % 48) + 48) % 48]));
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = p; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    function floodOrigin() { return applyCam(camShot(5.625), BARR.cx + BARR.w / 2 - 62, BARR.cy); }
    function drawBG(ctx, t) {
      const px = -whipA(t) * 560, py = -whipB(t) * 700, dy = -t * 7;
      const grey = () => { ctx.drawImage(S.bgGrey, 0, 0); bgDots(ctx, 0, dy, 0.045); };
      const brand = () => { ctx.drawImage(S.bgBrand, 0, 0); bgDots(ctx, px, dy + py, 0.07); };
      if (t >= 1.875 && t < 5.625) grey();
      else if (t >= 5.625 && t < 6.2) {
        const R = 2450 * cubicOut(inv(5.625, 6.12, t)), o = floodOrigin();
        grey();
        ctx.save(); ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(1, R), 0, Math.PI * 2); ctx.clip(); brand();
        const a = 1 - inv(5.625, 6.15, t), wg = ctx.createRadialGradient(o.x, o.y, Math.max(0, R - 420), o.x, o.y, Math.max(1, R));
        wg.addColorStop(0, rgba(T.pri, 0)); wg.addColorStop(0.75, rgba(T.pri, 0.1 * a)); wg.addColorStop(1, rgba(T.pri, 0.32 * a));
        ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H); ctx.restore();
        const ring = new Path2D(); ring.arc(o.x, o.y, Math.max(1, R), 0, Math.PI * 2); glowStroke(ctx, ring, T.pri, 12, a, T.priCore);
      } else brand();
    }
    function drawDust(ctx, t) {
      const we = whipA(t), wb = whipB(t), old = t >= 1.875 && t < 5.7;
      for (const p of S.dust) {
        let x = (p.x + p.vx * t - we * 1180 * p.z) % W; if (x < 0) x += W;
        let y = (p.y + p.vy * t - wb * 900 * p.z) % H; if (y < 0) y += H;
        const s = p.r * (0.55 + p.z * 0.6);
        ctx.globalAlpha = p.a * (old ? 0.35 : 1);
        ctx.drawImage(old ? S.spr.grey : S.spr[p.c], x - s * 2, y - s * 2, s * 4, s * 4);
      }
      ctx.globalAlpha = 1;
    }
    function lightSweep(ctx, x, y, w, h, t, t0, dur, a = 0.16) {
      const p = inv(t0, t0 + dur, t); if (p <= 0 || p >= 1) return;
      const cx = lerp(x - 260, x + w + 260, U.cubicInOut(p)), g = ctx.createLinearGradient(cx - 110, y, cx + 110, y + h * 0.35);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    function backdropBlur(ctx, x, y, w, h, rad) {
      const m = ctx.getTransform(), a = m.transformPoint(new DOMPoint(x - rad * 2, y - rad * 2)), b = m.transformPoint(new DOMPoint(x + w + rad * 2, y + h + rad * 2));
      const cw = ctx.canvas.width, chh = ctx.canvas.height;
      const sx = Math.max(0, Math.floor(Math.min(a.x, b.x))), sy = Math.max(0, Math.floor(Math.min(a.y, b.y))), ex = Math.min(cw, Math.ceil(Math.max(a.x, b.x))), ey = Math.min(chh, Math.ceil(Math.max(a.y, b.y)));
      if (ex - sx < 4 || ey - sy < 4 || !CAN_FILTER) return;
      const k = Math.hypot(m.a, m.b);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${(rad * k).toFixed(1)}px)`;
      ctx.drawImage(ctx.canvas, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
      ctx.restore();
    }

    // ══════════════════════════════ 1 · HOOK
    function hookLine(ctx, tl) {
      if (tl < -0.27 || tl > 1.32) return;
      const X0 = -250, X1 = 1330, SL = S.slice, yc = S.hook.yc + 7;
      const head = lerp(X0, X1, expoInOut(inv(-0.25, 0.25, tl))), m = expoIn(inv(0.84, 0.9375, tl)), tailU = EI(inv(0.965, 1.3, tl)), env = clamp((tl + 0.27) * 3);
      const rip = (ti, A) => { const d = tl - ti; return d < 0 ? 0 : A * Math.exp(-d * 4.5) * Math.cos(d * 9); };
      const amp = 30 + rip(0.469, 70) + rip(0.703, 55), kinkFade = 1 - inv(0.16, 0.36, tl);
      const path = new Path2D(); let started = false;
      for (let i = 0; i <= 120; i++) {
        const u = i / 120; if (u < tailU) continue;
        const xw = lerp(X0, X1, u); if (m <= 0 && xw > head) break;
        let y = yc + env * (amp * Math.sin(xw * 0.0101 - tl * 5.2) + 0.32 * amp * Math.sin(xw * 0.0187 + tl * 7.1 + 1.2));
        const dxh = (xw - head) / 210; y += 150 * kinkFade * Math.exp(-dxh * dxh) * Math.sin((xw - head) / 64);
        const px = lerp(xw, lerp(SL.x0, SL.x1, u), m), py = lerp(y, lerp(SL.y0, SL.y1, u), m);
        if (!started) { path.moveTo(px, py); started = true; } else path.lineTo(px, py);
      }
      if (!started) return;
      glowStroke(ctx, path, T.pri, 10, 1 + (tl >= 0.9375 ? 2.2 * Math.exp(-(tl - 0.9375) * 12) : 0), T.priCore);
    }
    function slamState(t, ta) {
      const a0 = ta - 0.11; if (t < a0) return null;
      if (t < ta) return { a: inv(a0, a0 + 0.035, t), s: lerp(2.35, 1, cubicIn(inv(a0, ta, t))), d: -1 };
      const d = t - ta; return { a: 1, s: 1 - 0.045 * Math.exp(-d * 13) * Math.cos(d * 38), d };
    }
    function sliceOff(t) {
      const a = EO(inv(0.9375, 1.35, t)), b = EO(inv(1.40625, 1.8, t)), drift = Math.max(0, t - 0.9375) * 12;
      const s = 9 * a + 5 * b + drift * 0.25, g = 17 * a + 11 * b + drift * 0.55, r = 0.012 * b + 0.004 * a, { d, n } = S.slice;
      return { up: { x: -d.x * s + n.x * g, y: -d.y * s + n.y * g, r: -r }, lo: { x: d.x * s - n.x * g, y: d.y * s - n.y * g, r } };
    }
    function clipHalf(ctx, side) {
      const { x0, y0, x1, y1, d, n } = S.slice, f = side === 'up' ? 3000 : -3000;
      ctx.beginPath(); ctx.moveTo(x0 - d.x * 3000, y0 - d.y * 3000); ctx.lineTo(x1 + d.x * 3000, y1 + d.y * 3000);
      ctx.lineTo(x1 + d.x * 3000 + n.x * f, y1 + d.y * 3000 + n.y * f); ctx.lineTo(x0 - d.x * 3000 + n.x * f, y0 - d.y * 3000 + n.y * f); ctx.closePath(); ctx.clip();
    }
    function sceneHook(ctx, t) {
      if (t > 14.7) { hookLine(ctx, t - 15); return; }
      if (t >= 1.875) return;
      const hk = S.hook, cam = camShot(t), yc = hk.yc;
      ctx.save(); useCam(ctx, cam);
      if (t < 0.86) hookLine(ctx, t);
      if (t < 0.9375) {
        hk.lines.forEach((txt, i) => {
          const st = slamState(t, bt(1) + i * (BEAT / 2)); if (!st) return;
          const x = hk.xs[i], y = hk.ys[i];
          setFont(ctx, F.head, hk.sizes[i], F.hw, hk.lss[i]);
          ctx.save(); pivot(ctx, 540, y - hk.caps[i] / 2, st.s);
          if (st.d >= 0 && st.d < 0.22) { const k = Math.exp(-st.d * 16) * 0.6; ctx.globalAlpha = k; ctx.fillStyle = T.pri; ctx.fillText(txt, x - 10, y); ctx.fillStyle = T.sec; ctx.fillText(txt, x + 10, y); }
          ctx.globalAlpha = st.a; ctx.fillStyle = T.text; ctx.fillText(txt, x, y); ctx.restore();
        });
      } else {
        const o = sliceOff(t);
        for (const side of ['up', 'lo']) { const off = o[side]; ctx.save(); ctx.translate(540 + off.x, yc + off.y); ctx.rotate(off.r); ctx.translate(-540, -yc); clipHalf(ctx, side); ctx.drawImage(S.hookTC, 0, 0); ctx.restore(); }
        const a = 1 - inv(0.9375, 1.75, t);
        if (a > 0) { const p = new Path2D(); p.moveTo(S.slice.x0, S.slice.y0); p.lineTo(S.slice.x1, S.slice.y1); glowStroke(ctx, p, T.pri, 3.5, a * 0.9, T.priCore); }
      }
      if (t >= 0.86) hookLine(ctx, t);
      ctx.restore();
    }

    // ══════════════════════════════ 2 · PAIN (chaos) + shatter
    function shardStart(s) {
      const o = sliceOff(1.875)[s.side], cs = Math.cos(o.r), sn = Math.sin(o.r), dx = s.cx - 540, dy = s.cy - S.hook.yc;
      return { p: applyCam(camShot(1.8749), 540 + o.x + dx * cs - dy * sn, S.hook.yc + o.y + dx * sn + dy * cs), r: o.r };
    }
    function drawShards(ctx, t) {
      if (t < 1.875 || t > 2.45) return;
      const tc = camShot(1.875), cell = S.cell;
      for (let j = 0; j < S.shards.length; j++) {
        const s = S.shards[j]; if (!s._st) s._st = shardStart(s);
        const p = inv(1.875 + s.delay, 1.875 + s.delay + s.dur, t); if (p >= 1) continue;
        const e = EO(p), st = s._st.p, tg = applyCam(tc, s.tx, s.ty), ang = Math.atan2(st.y - S.hook.yc, st.x - 540) + s.bang;
        const c1 = { x: st.x + Math.cos(ang) * s.burst, y: st.y + Math.sin(ang) * s.burst };
        const x = (1 - e) * (1 - e) * st.x + 2 * (1 - e) * e * c1.x + e * e * tg.x, y = (1 - e) * (1 - e) * st.y + 2 * (1 - e) * e * c1.y + e * e * tg.y;
        const sz = cell * lerp(1.04, 0.62, e);
        ctx.save(); ctx.translate(x, y); ctx.rotate(s.spin * (1 - e) * e * 2 + lerp(s._st.r, tc.r, e));
        const ta = 1 - inv(0.3, 0.8, p), fa = inv(0.2, 0.75, p) * (1 - inv(0.85, 1, p));
        if (ta > 0) { ctx.globalAlpha = ta; ctx.drawImage(S.hookTC, s.sx, s.sy, cell, cell, -sz / 2, -sz / 2, sz, sz); }
        if (fa > 0) { ctx.globalAlpha = fa; ctx.fillStyle = T.g[5]; ctx.fillRect(-sz / 2, -sz / 2, sz, sz * 0.7); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    function drawCard(ctx, c, t, ft, i) {
      const x = c.x, y = c.y;
      rr(ctx, x, y, c.w, c.h, 18); ctx.fillStyle = T.g[2]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.g[3]; ctx.stroke();
      const gx = x + 44, gy = y + c.h / 2, col = T.g[6];
      ctx.fillStyle = T.g[3]; ctx.beginPath(); ctx.arc(gx, gy, 26, 0, Math.PI * 2); ctx.fill();
      if (c.kind === 'spin') { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); const sa = t * 9 + i; ctx.arc(gx, gy, 14, sa, sa + 4.2); ctx.stroke(); }
      else icon(ctx, c.kind, gx, gy, 30, col, 2.2);
      ctx.fillStyle = T.g[4];
      for (let l = 0; l < c.lines + 1; l++) { const lw = (c.w - 100) * (l === c.lines ? 0.5 : 0.85 - 0.2 * hash(i * 3 + l)); rr(ctx, x + 84, y + c.h / 2 - 14 + l * 16 - c.lines * 6, Math.max(20, lw), 8, 4); ctx.fill(); }
      if (hash2(i, Math.floor(ft * 8)) > 0.86) { rr(ctx, x, y, c.w, c.h, 18); ctx.lineWidth = 3; ctx.strokeStyle = T.g[8]; ctx.stroke(); }
    }
    function scenePain(ctx, t) {
      if (t < 1.875 || t > 4.1) return;
      const ft = Math.min(FT, 3.7499), jt = Math.floor(ft * 12), cam = camShot(t), col = EI(inv(3.84, 4.06, t));
      ctx.save(); useCam(ctx, cam);
      if (col > 0) { ctx.translate(540, 860); ctx.scale(1 + 0.04 * col, Math.max(0.003, 1 - col)); ctx.translate(-540, -860); }
      S.cards.forEach((c, i) => {
        let a, s = 1;
        if (c.extra) { s = spring(t - c.appear, 20, 0.5); if (s <= 0.01) return; a = 1; }
        else { a = inv(c.appear - 0.03, c.appear + 0.09, t); if (a <= 0) return; }
        const jx = (hash2(i, jt) - 0.5) * 8, jy = (hash2(i + 91, jt) - 0.5) * 5;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(c.x + c.w / 2 + jx, c.y + c.h / 2 + jy); ctx.rotate(c.rot + (hash2(i + 7, jt) - 0.5) * 0.03); ctx.scale(s, s); ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
        drawCard(ctx, c, Math.min(t, 3.7499), ft, i); ctx.restore();
      });
      ctx.globalAlpha = 1;
      setFont(ctx, F.head, S.pain.size, F.hw, S.pain.ls);
      S.pain.lines.forEach((ws, li) => drawWords(ctx, ws, S.pain.ys[li], S.pain.size, t, bt(6) + li * 0.12, { stagger: 0.07, dur: 0.5, color: T.g[8] }));
      ctx.restore();
      drawShards(ctx, t);
      if (col > 0.5) { const a = inv(0.5, 1, col), p = new Path2D(), l = applyCam(cam, 60, 860), r = applyCam(cam, 1020, 860); p.moveTo(l.x, l.y); p.lineTo(r.x, r.y); glowStroke(ctx, p, mixs(T.g[7], T.pri, a), 3, a, T.priCore); }
    }

    // ══════════════════════════════ 3+4 · SEARCH → REVEAL
    const waveY = (t) => lerp(-40, SCR.h + 120, sineInOut(inv(5.7, 6.36, t)));
    function drawLiquid(ctx, yb, t, wy) {
      const N = 48, band = new Path2D(), edge = new Path2D(), w = SCR.w;
      for (let i = 0; i <= N; i++) { const u = -10 + ((w + 20) * i) / N, y = yb(u) - 5; if (i === 0) { band.moveTo(u, y); edge.moveTo(u, y + 5); } else { band.lineTo(u, y); edge.lineTo(u, y + 5); } }
      for (let i = N; i >= 0; i--) { const u = -10 + ((w + 20) * i) / N; band.lineTo(u, yb(u) + 22 + 8 * Math.sin(u / 17 + t * 11)); }
      band.closePath();
      const g = ctx.createLinearGradient(0, wy - 30, 0, wy + 44);
      g.addColorStop(0, rgba(T.pri, 0)); g.addColorStop(0.35, rgba(T.priCore, 0.95)); g.addColorStop(1, rgba(T.pri, 0.3));
      ctx.fillStyle = g; ctx.fill(band);
      glowStroke(ctx, edge, T.pri, 6, 0.9, T.priCore);
      ctx.fillStyle = rgba(T.priCore, 0.85);
      for (let k = 0; k < 8; k++) { const u = 30 + k * 64 + 14 * Math.sin(k * 7.3), L = 14 + 34 * Math.abs(Math.sin(t * 5 + k * 1.7)), y0 = yb(u) + 16; ctx.beginPath(); ctx.moveTo(u - 7, y0); ctx.quadraticCurveTo(u - 6, y0 + L * 0.7, u, y0 + L); ctx.quadraticCurveTo(u + 6, y0 + L * 0.7, u + 7, y0); ctx.closePath(); ctx.fill(); }
      for (let k = 0; k < 16; k++) { const s0 = 5.8 + hash(k * 3.1) * 0.5, d = t - s0; if (d < 0 || d > 0.5) continue; const u = hash(k * 7.9) * w, y = waveY(s0) + 34 + 240 * d + 900 * d * d, x = u + (hash(k * 2.2) - 0.5) * 140 * d; ctx.globalAlpha = 1 - d / 0.5; ctx.fillStyle = T.priCore; ctx.beginPath(); ctx.arc(x, y, 3 + hash(k * 5.5) * 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    function sparkle4(ctx, x, y, s, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill(); }
    function drawStage(ctx, t) {
      if (PREM) {
        // premium: a foto entra nítida a partir do desfoque, com um leve assentamento de escala
        ctx.fillStyle = '#0B0D0E'; ctx.fillRect(0, 0, SCR.w, SCR.h);
        const r = inv(5.7, 6.3, t); if (r <= 0) return;
        const e = LAND(r), sc = lerp(1.08, 1, e);
        ctx.save(); ctx.globalAlpha *= Math.min(1, r * 1.6);
        ctx.translate(SCR.w / 2, SCR.h / 2); ctx.scale(sc, sc); ctx.translate(-SCR.w / 2, -SCR.h / 2);
        if (e < 0.985 && S.stageBlur) { const A = ctx.globalAlpha; ctx.drawImage(S.stageBlur, 0, 0); ctx.globalAlpha = A * e; }
        ctx.drawImage(S.stageColor, 0, 0); ctx.restore();
        return;
      }
      const wy = waveY(t);
      if (wy < SCR.h + 70) ctx.drawImage(S.stageGrey, 0, 0);
      if (t >= 5.69) {
        const yb = (u) => wy + 17 * Math.sin(u / 43 + t * 9) + 9 * Math.sin(u / 21 - t * 13 + 1.3);
        ctx.save();
        if (wy < SCR.h + 70) { ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(SCR.w + 10, -20); for (let u = SCR.w + 10; u >= -12; u -= 12) ctx.lineTo(u, yb(u)); ctx.closePath(); ctx.clip(); }
        ctx.drawImage(S.stageColor, 0, 0);
        const sp = inv(6.3, 6.6, t);
        if (sp > 0) S.stageStars.forEach((st, i) => { const tw_ = 0.5 + 0.5 * Math.sin(t * 6 + st.ph); const s = st.s * sp * (0.4 + 0.6 * tw_); if (s > 1) sparkle4(ctx, st.x, st.y, s, i % 3 ? 'rgba(255,255,255,0.9)' : T.sec); });
        ctx.restore();
        if (wy < SCR.h + 70) drawLiquid(ctx, yb, t, wy);
      }
    }
    function drawPhone(ctx, pr, t) {
      const x = pr.cx - pr.w / 2, y = pr.cy - pr.h / 2, A0 = ctx.globalAlpha;
      ctx.globalAlpha = A0 * (PREM ? inv(5.7, 6.1, t) * 0.75 : inv(4.0, 4.2, t) * 0.9); ctx.drawImage(S.phoneShadow, x - 120, y - 90, pr.w + 240, pr.h + 240); ctx.globalAlpha = A0;
      rr(ctx, x, y, pr.w, pr.h, pr.r); ctx.fillStyle = '#07090A'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = mixs(T.border, '#8A9A95', 0.35); ctx.stroke();
      if (pr.h > 200) { ctx.fillStyle = '#1C2322'; ctx.fillRect(x - 5, y + 210, 5, 70); ctx.fillRect(x - 5, y + 300, 5, 110); ctx.fillRect(x + pr.w, y + 250, 5, 130); }
      const ins = Math.min(12, pr.h / 2 - 1), sx = x + ins, sy = y + ins, sw = pr.w - 2 * ins, sh = pr.h - 2 * ins;
      if (sh > 2) {
        ctx.save(); rr(ctx, sx, sy, sw, sh, Math.max(0, pr.r - 11)); ctx.clip();
        ctx.save(); ctx.translate(SCR.x + (PREM ? pr.cx - PH.cx : 0), SCR.y + (PREM ? pr.cy - PH.cy : 0)); drawStage(ctx, t); ctx.restore();
        const g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh * 0.6); g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(0.4, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
        lightSweep(ctx, sx, sy, sw, sh, t, 6.55, 0.5, 0.14);
        ctx.restore();
      }
      if (pr.h > 120) { ctx.fillStyle = '#000'; rr(ctx, pr.cx - 62, y + 24, 124, 34, 17); ctx.fill(); }
    }
    function drawGlass(ctx, b, t, press) {
      const x = b.cx - b.w / 2, y = b.cy - b.h / 2, r = b.h / 2;
      ctx.save(); if (press !== 1) pivot(ctx, b.cx, b.cy, press);
      rr(ctx, x, y, b.w, b.h, r); ctx.lineWidth = 18; ctx.strokeStyle = rgba(T.pri, 0.06); ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = rgba(T.pri, 0.12); ctx.stroke();
      ctx.save(); rr(ctx, x, y, b.w, b.h, r); ctx.clip();
      if (b.h > 14) backdropBlur(ctx, x, y, b.w, b.h, 16);
      ctx.fillStyle = rgba(T.bg, 0.64); ctx.fillRect(x, y, b.w, b.h);
      const g = ctx.createLinearGradient(0, y, 0, y + b.h); g.addColorStop(0, 'rgba(255,255,255,0.09)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, b.w, b.h);
      lightSweep(ctx, x, y, b.w, b.h, t, 4.4, 0.55, 0.18); lightSweep(ctx, x, y, b.w, b.h, t, 6.3, 0.5, 0.14);
      ctx.restore();
      rr(ctx, x, y, b.w, b.h, r); ctx.lineWidth = 2.6; ctx.strokeStyle = rgba(T.pri, 0.95); ctx.stroke();
      ctx.restore();
    }
    const typedCount = () => { let n = 0; for (const v of S.typeT) if (FT >= v) n++; return n; };
    function drawBarContents(ctx, b, t) {
      const x = b.cx - b.w / 2, a = inv(4.3, 4.45, t) * (1 - inv(5.64, 5.74, t)); if (a <= 0) return;
      ctx.globalAlpha = a;
      icon(ctx, 'search', x + 58, b.cy, 38, T.pri, 2.4);
      const n = typedCount(), tx = x + 100;
      if (n === 0) { setFont(ctx, BODY, 31, 400, 0); ctx.fillStyle = T.muted2; ctx.fillText(L.search, tx, b.cy + 11); }
      setFont(ctx, MONO, S.query.size, 400, 0);
      const typed = FT < 5.625 ? S.query.text.slice(0, n) : '';
      ctx.fillStyle = T.text; if (typed) ctx.fillText(typed, tx, b.cy + S.query.size * 0.36);
      const end = S.typeT.length ? S.typeT[S.typeT.length - 1] : 4.64;
      let on = false;
      if (FT >= 4.36 && FT < 4.5) on = true; else if (FT >= 4.6 && FT < end + 0.12) on = true; else if (FT >= end + 0.12 && FT < 5.625) on = Math.floor((FT - end - 0.12) * 5.3) % 2 === 1;
      if (on) { ctx.fillStyle = T.sec; ctx.fillRect(tx + (n ? tw(ctx, typed) : 0) + 3, b.cy - 21, 3.5, 42); }
      const bx = x + b.w - 62, dE = t - 5.625; let bs = 1; if (dE >= 0) bs = 1 - 0.18 * Math.exp(-dE * 16) * Math.cos(dE * 30);
      for (const p0 of [5.36, 5.5]) { const p = inv(p0, p0 + 0.3, t); if (p > 0 && p < 1) { ctx.strokeStyle = rgba(T.pri, 0.55 * (1 - p)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, b.cy, 40 + 26 * p, 0, Math.PI * 2); ctx.stroke(); } }
      ctx.save(); pivot(ctx, bx, b.cy, bs); ctx.fillStyle = T.pri; ctx.beginPath(); ctx.arc(bx, b.cy, 40, 0, Math.PI * 2); ctx.fill(); icon(ctx, 'arrow', bx, b.cy, 34, T.onPri, 2.6); ctx.restore();
      ctx.globalAlpha = 1;
    }
    function drawFlyChars(ctx, t) {
      if (t < 5.625 || t > 5.9) return;
      setFont(ctx, MONO, S.query.size, 400, 0);
      let x = BARR.cx - BARR.w / 2 + 100; const y0 = BARR.cy + S.query.size * 0.36, q = S.query.text;
      for (let i = 0; i < q.length; i++) {
        const ch = q[i], w = tw(ctx, ch), s0 = 5.628 + i * 0.0036, p = inv(s0, s0 + 0.17, t);
        if (p < 1 && ch !== ' ') {
          const e = cubicIn(p), tx = SCR.x + 40 + (i / Math.max(1, q.length - 1)) * (SCR.w - 80), ty = SCR.y + 10;
          ctx.globalAlpha = 1 - inv(0.8, 1, p); ctx.fillStyle = mixs(T.text, T.pri, inv(0, 0.35, p));
          ctx.save(); ctx.translate(lerp(x, tx, e), lerp(y0, ty, e) - Math.sin(e * Math.PI) * 70); const s = 1 - 0.5 * e; ctx.scale(s, s); ctx.fillText(ch, 0, 0); ctx.restore();
        }
        x += w;
      }
      ctx.globalAlpha = 1;
    }
    function drawOffer(ctx, t) {
      if (!SC.offer || t < 6.3) return;
      const s = spring(t - 6.34, 14, 0.42); if (s <= 0.01) return;
      const cx = PH.x + PH.w - 36, cy = PH.y + 220, R = 104;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.2 + 0.25 * (1 - Math.min(1, s))); ctx.scale(s, s);
      ctx.fillStyle = rgba('#000', 0.3); ctx.beginPath(); for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, r = i % 2 ? R * 0.92 : R; ctx.lineTo(Math.cos(a) * r + 6, Math.sin(a) * r + 10); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = T.sec; ctx.beginPath(); for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, r = i % 2 ? R * 0.92 : R; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      const of = S.offer; setFont(ctx, F.head, of.size, F.hw, of.ls); ctx.fillStyle = T.onSec; ctx.textAlign = 'center';
      const lh = of.size * 1.0, y0 = -((of.lines.length - 1) * lh) / 2 + of.size * F.cap * 0.5;
      of.lines.forEach((l, i) => ctx.fillText(l, -of.ls / 2, y0 + i * lh));
      ctx.textAlign = 'left'; ctx.restore();
    }
    function sceneReveal(ctx, t) {
      if (t < 4.0 || t > 7.7) return;
      const cam = camShot(t), we = whipA(t);
      ctx.save(); useCam(ctx, cam, -we * 1180, 0);
      const po = EO(inv(4.02, 4.46, t));
      const pr = { cx: 540, cy: lerp(860, PH.cy, po), w: lerp(960, PH.w, po), h: lerp(4, PH.h, po), r: lerp(2, PH.r, po) };
      drawPhone(ctx, pr, t);
      drawOffer(ctx, t);
      if (t >= 4.06) {
        const bo = EO(inv(4.06, 4.5, t)), L = S.lbl, P = L.pill;
        let b = { cx: 540, cy: lerp(860, BARR.cy, bo), w: lerp(960, BARR.w, bo), h: lerp(3, BARR.h, bo) };
        const mo = EIO(inv(5.8, 6.16, t));
        if (mo > 0) b = { cx: lerp(b.cx, P.cx, mo), cy: lerp(b.cy, P.cy, mo), w: lerp(b.w, P.w, mo), h: lerp(b.h, P.h, mo) };
        const dE = t - 5.625, press = dE >= 0 && dE < 0.6 ? 1 - 0.028 * Math.exp(-dE * 12) * Math.cos(dE * 26) : 1;
        drawGlass(ctx, b, t, press);
        if (t < 5.76) drawBarContents(ctx, b, t);
        if (t >= 6.05) {
          setFont(ctx, MONO, L.ps, 700, L.ps * 0.1);
          drawWords(ctx, [{ text: L.pillText, x: P.cx - L.ptw / 2 - L.ps * 0.05, w: L.ptw }], P.cy + L.ps * 0.36, L.ps, t, bt(13), { dur: 0.45, color: T.pri });
          setFont(ctx, F.head, L.pf.size, F.hw, L.pf.ls);
          L.lines.forEach((ws, i) => drawWords(ctx, ws, L.ys[i], L.pf.size, t, bt(13) + 0.05 + i * 0.1, { stagger: 0.06, dur: 0.55, color: T.text }));
        }
      }
      if (t >= 5.625 && t < 5.95) { const p = inv(5.625, 5.95, t), ring = new Path2D(); ring.arc(BARR.cx + BARR.w / 2 - 62, BARR.cy, 40 + 190 * EO(p), 0, Math.PI * 2); glowStroke(ctx, ring, T.sec, 5, 1 - p, '#FFFFFF'); }
      drawFlyChars(ctx, t);
      ctx.restore();
    }

    // ══════════════════════════════ 5 · BENEFITS
    function benefitPath() {
      const B = S.ben, pts = []; let acc = 0, prev = null;
      const gap = B.items.length > 1 ? B.items[1].cy - B.items[0].cy : 186;
      for (let y = B.lineTop; y <= B.lineBot; y += 4) { const x = 190 + 34 * Math.sin((Math.PI * (y - B.items[0].cy)) / gap); if (prev) acc += Math.hypot(x - prev.x, y - prev.y); pts.push({ x, y, l: acc }); prev = { x, y }; }
      B.pts = pts; B.len = acc;
    }
    function benHeadY(t) {
      const B = S.ben, K = [[7.6, B.lineTop], ...B.items.map((it, i) => [NODE_T[i], it.cy]), [NODE_T[B.items.length - 1] + 0.22, B.lineBot]];
      if (t <= K[0][0]) return B.lineTop - 1;
      for (let i = 1; i < K.length; i++) if (t < K[i][0]) return lerp(K[i - 1][1], K[i][1], EO(inv(K[i - 1][0], K[i][0], t)));
      return B.lineBot;
    }
    function pathUpTo(pts, yHead) { const p = new Path2D(); let started = false; for (const q of pts) { if (q.y > yHead) break; if (!started) { p.moveTo(q.x, q.y); started = true; } else p.lineTo(q.x, q.y); } return started ? p : null; }
    function nodeBox(ctx, it, i, t, lit) {
      const d = t - NODE_T[i], pop = d > 0 ? 1 + 0.14 * Math.exp(-d * 10) * Math.sin(d * 26) : 1, ap = spring(t - (7.58 + i * 0.045), 16, 0.6);
      if (ap <= 0.01) return;
      const size = 144, s = pop * lerp(0.7, 1, clamp(ap)), x = 190 - size / 2, y = it.cy - size / 2;
      ctx.save(); ctx.globalAlpha *= clamp(ap * 1.5); pivot(ctx, 190, it.cy, s);
      if (lit > 0) { ctx.save(); ctx.shadowColor = rgba(T.pri, 0.55 * lit); ctx.shadowBlur = 34; rr(ctx, x, y, size, size, 32); ctx.fillStyle = mixs(T.panel2, T.panel, lit); ctx.fill(); ctx.restore(); }
      else { rr(ctx, x, y, size, size, 32); ctx.fillStyle = T.panel2; ctx.fill(); }
      rr(ctx, x, y, size, size, 38); ctx.lineWidth = 2.8; ctx.strokeStyle = mixs(T.border, T.pri, lit); ctx.stroke();
      const bob = lit > 0 ? 1 + 0.06 * Math.sin(Math.max(0, d) * 7) : 1;
      icon(ctx, it.icon, 190, it.cy, 72 * bob, mixs(T.muted2, T.pri, lit), 2);
      ctx.restore();
    }
    function sceneBenefits(ctx, t) {
      if (t < 7.3 || t > 9.62) return;
      if (!S.ben.pts) benefitPath();
      const B = S.ben, cam = camShot(t), we = whipA(t), ex = EI(inv(9.14, 9.38, t));
      ctx.save(); useCam(ctx, cam, (1 - we) * 1180, 0);
      setFont(ctx, F.head, B.title.size, F.hw, B.title.ls);
      B.titleLines.forEach((ws, i) => drawWords(ctx, ws, B.titleYs[i], B.title.size, t, 7.55 + i * 0.1, { stagger: 0.05, color: T.text, exitT: 9.1, exitDur: 0.22 }));
      ctx.save(); ctx.translate(0, -170 * ex); ctx.globalAlpha = 1 - ex;
      if (ex < 1) {
        const ga = inv(7.55, 7.75, t);
        if (ga > 0) { ctx.save(); ctx.setLineDash([2, 14]); ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = rgba(T.muted2, 0.5 * ga); const full = pathUpTo(B.pts, B.lineBot); if (full) ctx.stroke(full); ctx.restore(); }
        const lp = pathUpTo(B.pts, benHeadY(t)); if (lp) glowStroke(ctx, lp, T.pri, 7, 1 - ex, T.priCore);
        const last = B.items.length - 1;
        B.items.forEach((it, i) => {
          const lit = clamp((t - NODE_T[i]) / 0.08);
          if (i < last) nodeBox(ctx, it, i, t, lit);
          else if (t < 9.2) { ctx.save(); ctx.translate(0, 170 * ex); ctx.globalAlpha = 1; nodeBox(ctx, it, i, t, lit); ctx.restore(); }
          setFont(ctx, F.head, it.f.size, F.hw, it.f.ls);
          const lh = it.f.size * 1.04, y0 = it.cy + it.f.size * F.cap * 0.5 - ((it.lines.length - 1) * lh) / 2;
          it.lines.forEach((l, li) => drawWords(ctx, [{ text: l, x: 304, w: 670 }], y0 + li * lh, it.f.size, t, NODE_T[i] + 0.03 + li * 0.05, { dur: 0.5, color: T.text }));
        });
      }
      ctx.restore();
      ctx.restore();
    }

    // ══════════════════════════════ 6 · PROOF / OFFER / STATEMENT
    function star5(ctx, cx, cy, r, fillAmt, color, empty) {
      const path = new Path2D();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr_ = i % 2 ? r * 0.45 : r; i ? path.lineTo(cx + Math.cos(a) * rr_, cy + Math.sin(a) * rr_) : path.moveTo(cx + Math.cos(a) * rr_, cy + Math.sin(a) * rr_); }
      path.closePath(); ctx.fillStyle = empty; ctx.fill(path);
      if (fillAmt > 0) { ctx.save(); ctx.clip(path); ctx.fillStyle = color; ctx.fillRect(cx - r, cy - r, 2 * r * fillAmt, 2 * r); ctx.restore(); }
    }
    // lê "1.200", "1,200", "4,9", "12.5" do jeito que o cliente escreveu e anima no mesmo formato
    function fmtNum(v, f) {
      const dec = f.dec, fixed = v.toFixed(dec), [ip, fp] = fixed.split('.');
      const grouped = f.group ? ip.replace(/\B(?=(\d{3})+(?!\d))/g, f.group) : ip;
      return dec ? grouped + f.decSep + fp : grouped;
    }
    function sceneProof(ctx, t) {
      if (t < 9.18 || t > 11.45) return;
      const cam = camShot(t), wb = whipB(t), m = EIO(inv(9.2, 9.55, t)), B = S.ben, last = B.items[B.items.length - 1];
      ctx.save(); useCam(ctx, cam, 0, -wb * 1300);
      const src = { x: 118, y: last.cy - 72, w: 144, h: 144 };
      const bx = lerp(src.x, CARD.x, m), by = lerp(src.y, CARD.y, m), bw = lerp(src.w, CARD.w, m), bh = lerp(src.h, CARD.h, m);
      rr(ctx, bx, by, bw, bh, lerp(32, 44, m)); ctx.fillStyle = mixs(T.panel, T.panel2, m); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = mixs(T.pri, T.border, m); ctx.stroke();
      if (m < 1) { ctx.save(); ctx.globalAlpha = 1 - inv(0, 0.4, m); icon(ctx, last.icon, bx + bw / 2, by + bh / 2, 72, T.pri, 2); ctx.restore(); }
      const ca = inv(9.5, 9.62, t);
      if (ca > 0) {
        ctx.save(); rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 44); ctx.clip();
        if (variant6 === 'proof') drawProofBody(ctx, t);
        else if (variant6 === 'offer') drawOfferBody(ctx, t);
        else drawStatementBody(ctx, t);
        lightSweep(ctx, CARD.x, CARD.y, CARD.w, CARD.h, t, 10.55, 0.45, 0.09);
        ctx.restore();
      }
      ctx.restore();
    }
    function drawProofBody(ctx, t) {
      const P = S.proof, hasR = !!P.rating, hasC = !!P.cust, cx = 540;
      let yR = hasC ? 780 : 900, yC = hasR ? 1150 : 960;
      if (hasR) {
        if (P.src) { setFont(ctx, MONO, 26, 700, 3); const lab = L.rating(P.src).toLocaleUpperCase(LOC); const w = tw(ctx, lab); drawWords(ctx, [{ text: lab, x: cx - w / 2, w }], yR - 170, 26, t, 9.6, { dur: 0.4, color: T.muted }); }
        const f = fit(ctx, P.rating, F.head, F.hw, 600, 250, 120, 1, F.hls); setFont(ctx, F.head, f.size, F.hw, f.ls);
        const w = tw(ctx, P.rating); drawWords(ctx, [{ text: P.rating, x: cx - w / 2, w }], yR + f.size * F.cap * 0.35, f.size, t, 9.62, { dur: 0.5, color: T.text });
        for (let i = 0; i < 5; i++) { const s = spring(t - (9.72 + i * 0.07), 18, 0.45); if (s <= 0.01) continue; ctx.save(); pivot(ctx, cx - 180 + i * 90, yR + 120, s); star5(ctx, cx - 180 + i * 90, yR + 120, 34, inv(9.78 + i * 0.07, 9.9 + i * 0.07, t), T.sec, rgba(T.muted2, 0.35)); ctx.restore(); }
      }
      if (hasR && hasC) { const a = inv(9.9, 10.1, t); ctx.fillStyle = rgba(T.border, a); ctx.fillRect(CARD.x + 80, 1000, (CARD.w - 160) * EO(a), 2); }
      if (hasC) {
        let txt = P.cust;
        if (P.custNum != null) { const k = EO(inv(9.95, 10.75, t)); txt = P.custPrefix + fmtNum(P.custNum * k, P.fmt) + P.custSuffix; if (k >= 1) txt = P.cust; }
        const f = fit(ctx, P.cust, F.head, F.hw, 700, hasR ? 130 : 200, 70, 1, F.hls); setFont(ctx, F.head, f.size, F.hw, f.ls);
        const w = tw(ctx, txt); drawWords(ctx, [{ text: txt, x: cx - w / 2, w }], yC, f.size, t, 9.95, { dur: 0.45, color: T.pri });
        if (P.custLabel) { const lf = fit(ctx, P.custLabel, BODY, 600, 700, 42, 26, 1, 0); setFont(ctx, BODY, lf.size, 600, 0); const lw = tw(ctx, P.custLabel); drawWords(ctx, [{ text: P.custLabel, x: cx - lw / 2, w: lw }], yC + 64, lf.size, t, 10.05, { dur: 0.45, color: T.muted }); }
      }
    }
    function drawOfferBody(ctx, t) {
      const s = spring(t - 9.6, 13, 0.45), O = S.offerBig; if (s <= 0.01) return;
      ctx.save(); ctx.translate(540, 930); ctx.rotate(-0.06); ctx.scale(s, s);
      const w = 700, h = Math.max(300, O.lines.length * O.size * 1.02 + 140);
      ctx.fillStyle = T.pri; ctx.beginPath(); ctx.moveTo(-w / 2 + 90, -h / 2); ctx.lineTo(w / 2 - 30, -h / 2); ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 30); ctx.lineTo(w / 2, h / 2 - 30); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 30, h / 2); ctx.lineTo(-w / 2 + 90, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = T.panel2; ctx.beginPath(); ctx.arc(-w / 2 + 70, 0, 20, 0, Math.PI * 2); ctx.fill();
      setFont(ctx, F.head, O.size, F.hw, O.ls); ctx.fillStyle = T.onPri; ctx.textAlign = 'center';
      const lh = O.size * 1.02, y0 = -((O.lines.length - 1) * lh) / 2 + O.size * F.cap * 0.5;
      O.lines.forEach((l, i) => ctx.fillText(l, 40 - O.ls / 2, y0 + i * lh)); ctx.textAlign = 'left';
      ctx.restore();
      for (let k = 0; k < 40; k++) { const d = t - 9.62; if (d < 0 || d > 1.2) break; const a = hash(k * 1.3) * Math.PI * 2, v = 500 + hash(k * 2.9) * 700, x = 540 + Math.cos(a) * v * d, y = 930 + Math.sin(a) * v * d + 900 * d * d; ctx.globalAlpha = 1 - d / 1.2; ctx.fillStyle = [T.sec, T.pri, T.text][k % 3]; ctx.save(); ctx.translate(x, y); ctx.rotate(d * 10 + k); ctx.fillRect(-6, -3, 12, 6); ctx.restore(); }
      ctx.globalAlpha = 1;
    }
    function drawStatementBody(ctx, t) {
      const st = S.stmt; setFont(ctx, F.head, st.size, F.hw, st.ls);
      const lh = st.size * 1.04, y0 = 920 - ((st.lines.length - 1) * lh) / 2 + st.size * F.cap * 0.5;
      S.stmtLines.forEach((ws, i) => drawWords(ctx, ws, y0 + i * lh, st.size, t, 9.62 + i * 0.12, { stagger: 0.07, color: i === S.stmtLines.length - 1 ? T.pri : T.text }));
    }

    // ══════════════════════════════ 7 · CONTACT (+ pull)
    const pullP = (t) => cubicIn(inv(12.66, 13.125, t));
    function pullPt(x, y, P, swirl = 2.3) { const dx = x - 540, dy = y - 820, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), r2 = r * (1 - P), a2 = a + swirl * P; return { x: 540 + r2 * Math.cos(a2), y: 820 + r2 * Math.sin(a2), s: 1 - 0.92 * P, r: swirl * P }; }
    function sceneContact(ctx, t) {
      if (t < 11.05 || t > 13.13) return;
      const C = S.contact, cam = camShot(t), wb = whipB(t), P = pullP(t);
      ctx.save(); useCam(ctx, cam, 0, (1 - wb) * 1300);
      setFont(ctx, F.head, C.title.size, F.hw, C.title.ls);
      if (P > 0) C.titleLines.forEach((ws, li) => ws.forEach((wd) => { const q = pullPt(wd.x + wd.w / 2, C.titleYs[li] - 30, P); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.scale(q.s, q.s); ctx.fillStyle = T.text; ctx.fillText(wd.text, -wd.w / 2, 30); ctx.restore(); }));
      else C.titleLines.forEach((ws, li) => drawWords(ctx, ws, C.titleYs[li], C.title.size, t, 11.3 + li * 0.1, { stagger: 0.05, color: li === C.titleLines.length - 1 && C.titleLines.length > 1 ? T.pri : T.text }));
      C.rows.forEach((row, i) => {
        const s0 = 11.42 + i * 0.09, sp = spring(t - s0, 14, 0.55); if (sp <= 0.01) return;
        let cx = 540, cy = row.cy + 260 * (1 - sp), sc = 1, rot = 0;
        if (P > 0) { const q = pullPt(cx, cy, P); cx = q.x; cy = q.y; sc = q.s; rot = q.r; }
        if (P > 0.02) { const tr = new Path2D(); let first = true; for (let q = Math.max(0, P - 0.55); q <= P + 1e-6; q += 0.03) { const pt = pullPt(540, row.cy, q); if (first) { tr.moveTo(pt.x, pt.y); first = false; } else tr.lineTo(pt.x, pt.y); } glowStroke(ctx, tr, i % 2 ? T.sec : T.pri, 3, P * 0.9, null); }
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
        rr(ctx, -440, -74, 880, 148, 46); ctx.fillStyle = T.panel; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.border; ctx.stroke();
        const pr = inv(12.15 + i * 0.1, 12.6 + i * 0.1, t); if (pr > 0 && pr < 1) { ctx.strokeStyle = rgba(T.pri, 0.7 * (1 - pr)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-350, 0, 48 + 40 * EO(pr), 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = T.pri; ctx.beginPath(); ctx.arc(-350, 0, 48, 0, Math.PI * 2); ctx.fill(); icon(ctx, row.icon, -350, 0, 50, T.onPri, 2.3);
        setFont(ctx, row.mono ? MONO : BODY, row.f.size, row.mono ? 500 : 600, 0); ctx.fillStyle = T.text;
        const lh = row.f.size * 1.12, y0 = row.f.size * 0.36 - ((row.f.lines.length - 1) * lh) / 2;
        row.f.lines.forEach((l, li) => ctx.fillText(l, -272, y0 + li * lh));
        ctx.restore();
      });
      if (P > 0) { const s = 40 + 60 * P; ctx.globalAlpha = P; ctx.drawImage(S.spr.sec, 540 - s, 820 - s, s * 2, s * 2); ctx.drawImage(S.spr.pri, 540 - s * 0.6, 820 - s * 0.6, s * 1.2, s * 1.2); ctx.globalAlpha = 1; }
      ctx.restore();
    }

    // ══════════════════════════════ 8 · LOGO
    function drawLogoMark(ctx, cx, cy, box, dot, ring) {
      const R = box * 0.5;
      if (images.logo) {
        ctx.save(); ctx.globalAlpha *= 0.55; ctx.strokeStyle = T.pri; ctx.lineWidth = box * 0.045; ctx.beginPath(); ctx.arc(cx, cy, R * 1.02 * Math.max(0, ring), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        const r = R * 0.84 * Math.max(0, dot); if (r < 1) return;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.clip(); drawContain(ctx, images.logo, cx, cy, r * 1.46, r * 1.46); ctx.restore();
      } else {
        const r = R * 0.6 * Math.max(0, dot);
        ctx.save(); ctx.globalAlpha *= 0.5; ctx.strokeStyle = T.pri; ctx.lineWidth = box * 0.059; ctx.beginPath(); ctx.arc(cx, cy, R * 0.84 * Math.max(0, ring), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        if (r < 1) return;
        ctx.fillStyle = T.pri; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        const ch = (BR.name.trim()[0] || 'P').toLocaleUpperCase(LOC); setFont(ctx, F.head, r * 1.2, F.hw, 0); ctx.textAlign = 'center'; ctx.fillStyle = T.onPri; ctx.fillText(ch, cx, cy + r * 1.2 * F.cap * 0.5); ctx.textAlign = 'left';
      }
    }
    function sceneLogo(ctx, t) {
      if (t < 13.125 || t > 14.99) return;
      const G = S.logo, cam = camShot(t), d = t - 13.125, xo = EI(inv(14.72, 14.97, t));
      ctx.save(); useCam(ctx, cam);
      if (xo > 0) { ctx.translate(540, 955); ctx.scale(1 - 0.85 * xo, 1 - 0.85 * xo); ctx.translate(-540, -955 - 40 * xo); ctx.globalAlpha = 1 - xo; }
      const A = ctx.globalAlpha;
      for (const [t0, color, r0, r1, w0] of [[13.125, T.pri, 150, 1150, 16], [13.19, T.sec, 120, 950, 10], [13.3, T.text, 100, 700, 4]]) {
        const p = inv(t0, t0 + 0.75, t); if (p <= 0 || p >= 1) continue;
        const ring = new Path2D(); ring.arc(540, G.cy, lerp(r0, r1, EO(p)), 0, Math.PI * 2);
        ctx.save(); ctx.globalAlpha = A; glowStroke(ctx, ring, color, lerp(w0, 2, p), 1 - p, null); ctx.restore();
      }
      const m = EIO(inv(13.22, 13.6, t)), box = lerp(G.mode === 'row' ? 320 : 300, G.box, m);
      const mx = lerp(540, G.markX, m), my = lerp(820, G.cy, m);
      const dot = spring(d, 15, 0.42), ring = spring(d - 0.05, 12, 0.42), pulse = t > 13.7 ? 1 + 0.03 * Math.sin((t - 13.7) * 7) : 1;
      setFont(ctx, F.head, G.fs, F.hw, G.fs * F.hls * 0.3);
      const sw = inv(14.1, 14.55, t);
      const nameFill = (x0, x1) => { if (sw > 0 && sw < 1) { const sx = lerp(x0 - 200, x1 + 200, sw), g = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0); g.addColorStop(0, T.text); g.addColorStop(0.5, '#FFFFFF'); g.addColorStop(1, T.text); return g; } return T.text; };
      if (G.mode === 'row' && t > 13.22) {
        const wx = G.wordX - (1 - m) * (G.wordW * 0.55 + G.gap);
        ctx.save(); ctx.beginPath(); ctx.rect(mx + box * 0.3, 0, W, H); ctx.clip(); ctx.fillStyle = nameFill(G.wordX, G.wordX + G.wordW); ctx.fillText(BR.name, wx, G.wordY); ctx.restore();
      } else if (G.mode === 'stack') {
        G.nameLines.forEach((l, i) => { const w = G.nameWs[i]; ctx.save(); ctx.fillStyle = nameFill(540 - w / 2, 540 + w / 2); drawWords(ctx, [{ text: l, x: 540 - w / 2, w }], G.nameYs[i], G.fs, t, 13.3 + i * 0.08, { dur: 0.5, color: nameFill(540 - w / 2, 540 + w / 2) }); ctx.restore(); });
      }
      ctx.save(); ctx.globalAlpha = A; drawLogoMark(ctx, mx, my, box, dot * (G.mode === 'stack' ? 1 : 1), ring * pulse); ctx.restore();
      setFont(ctx, F.head, G.tag.size, F.hw, G.tag.ls);
      G.tagLines.forEach((ws, i) => drawWords(ctx, ws, G.tagYs[i], G.tag.size, t, 13.45 + i * 0.12, { stagger: 0.06, color: i === G.tagLines.length - 1 && G.tagLines.length > 1 ? T.pri : T.text }));
      const cs = spring(t - 13.8, 16, 0.5);
      if (cs > 0.01) {
        const cw = G.ctaTW + 136, ch = 90, cx = 540, cy = G.ctaY;
        ctx.save(); pivot(ctx, cx, cy, Math.max(0, cs));
        rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, ch / 2); ctx.fillStyle = T.pri; ctx.fill();
        setFont(ctx, MONO, G.ctaSize, 700, 1); ctx.fillStyle = T.onPri; ctx.fillText(SC.cta, cx - cw / 2 + 38, cy + G.ctaSize * 0.34);
        const ax = cx + cw / 2 - 52; ctx.fillStyle = T.onPri; ctx.beginPath(); ctx.arc(ax, cy, 25, 0, Math.PI * 2); ctx.fill();
        icon(ctx, 'arrow', ax, cy, 30, T.pri, 2.8);
        ctx.restore();
      }
      ctx.restore();
    }
    function drawWatermark(ctx) {
      if (!S.wm) return;
      setFont(ctx, MONO, 26, 700, 2); const txt = L.made.toLocaleUpperCase(LOC), w = tw(ctx, txt) + 74;
      ctx.save(); ctx.globalAlpha = 0.9; rr(ctx, 540 - w / 2, 1660, w, 56, 28); ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(540 - w / 2 + 30, 1688, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillText(txt, 540 - w / 2 + 50, 1697); ctx.restore();
    }

    // ══════════════════════════════ PREMIUM
    // Técnicas de filmes de produto: uma ideia por cena, objeto principal no centro, palavras que pousam no tempo da música
    // (desfoque 16 px → 0, sobem 36 px, 0,3 s em cubic-bezier(0.22,1,0.36,1)), cada palavra mantém seu lugar (a linha não
    // se recentraliza), molas em forma fechada, movimento mágico entre cenas, câmera pesada sem tremor, cursor que desliza
    // em arco e clica. Sem brilhos, partículas, flashes ou tremores.
    const EIGHTH = BEAT / 2;
    const LAND = U.cubicBezier(0.22, 1, 0.36, 1), GLIDE_E = U.cubicBezier(0.42, 0, 0.12, 1);
    const SPR = { glide: { k: 150, c: 20, m: 1 }, heavy: { k: 120, c: 30, m: 1.2 }, soft: { k: 6, c: 5, m: 1 }, snap: { k: 220, c: 30, m: 1 }, pop: { k: 200, c: 26, m: 1 }, lift: { k: 190, c: 30, m: 1 } };
    function sstep(t, { k, c, m = 1 }) {
      if (t <= 0) return 0;
      const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
      if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); }
      if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
      const wd = w0 * Math.sqrt(z * z - 1);
      return 1 - Math.exp(-z * w0 * t) * (Math.cosh(wd * t) + ((z * w0) / wd) * Math.sinh(wd * t));
    }
    // valor que muda de alvo em cada chave: soma de uma mola por mudança (continua pura função do tempo)
    function strack(t, keys, cfg) { let v = keys[0][1]; for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * sstep(t - keys[i][0], cfg); return v; }
    function ctxScale(ctx) { const m = ctx.getTransform(); return Math.hypot(m.a, m.b) || 1; }
    function blurIn(ctx, px) { if (CAN_FILTER && px > 0.35) ctx.filter = `blur(${(px * ctxScale(ctx)).toFixed(2)}px)`; }
    // Desfoque de um grupo inteiro (cartão, linha, botão): desenha nítido numa camada do tamanho do grupo e desfoca uma vez só.
    // Desfocar traço por traço custa dezenas de vezes mais no render do servidor.
    const LAYERS = []; let layerDepth = 0;
    function blurGroup(ctx, px, x0, y0, x1, y1, draw) {
      if (!(px > 0.35) || !CAN_FILTER) { draw(ctx); return; }
      const m = ctx.getTransform(), k = Math.hypot(m.a, m.b) || 1, pad = px * k * 2.4 + 2;
      const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
      const cw = ctx.canvas.width, chh = ctx.canvas.height;
      const sx = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x)) - pad)), sy = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y)) - pad));
      const ex = Math.min(cw, Math.ceil(Math.max(...pts.map((p) => p.x)) + pad)), ey = Math.min(chh, Math.ceil(Math.max(...pts.map((p) => p.y)) + pad));
      if (ex - sx < 2 || ey - sy < 2) return;
      let L = LAYERS[layerDepth];
      if (!L) L = LAYERS[layerDepth] = mk(ex - sx, ey - sy);
      if (L.width < ex - sx || L.height < ey - sy) { L.width = Math.max(L.width, ex - sx); L.height = Math.max(L.height, ey - sy); }
      const lx = L.getContext('2d');
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalAlpha = 1; lx.filter = 'none'; lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, ex - sx, ey - sy);
      lx.setTransform(m.a, m.b, m.c, m.d, m.e - sx, m.f - sy);
      layerDepth++;
      lx.save();
      try { draw(lx); } finally { lx.restore(); layerDepth--; }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${(px * k).toFixed(2)}px)`;
      ctx.drawImage(L, 0, 0, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
      ctx.restore();
    }
    function pText(ctx, text, x, y, t, at, o = {}) {
      const u = LAND(clamp((t - at) / (o.dur || 0.3)));
      if (u <= 0) return;
      const q = o.out != null ? clamp((t - o.out) / (o.outDur || 0.18)) : 0;
      if (q >= 1) return;
      const a = u * (1 - q);
      if (a <= 0.002) return;
      ctx.save(); ctx.globalAlpha *= a;
      blurIn(ctx, (1 - u) * (o.blur ?? 16) + q * 12);
      ctx.fillStyle = o.color || T.text; ctx.fillText(text, x, y + (1 - u) * (o.rise ?? 36) - q * 16);
      ctx.restore();
    }
    function pWords(ctx, words, y, t, t0, o = {}) {
      const st = o.stagger ?? 0.07;
      words.forEach((w, i) => pText(ctx, w.text, w.x, y, t, o.times ? o.times[i] : t0 + i * st, { ...o, color: (o.colors && o.colors[i]) || o.color }));
    }
    // ícone que se desenha sozinho (traço progressivo)
    function iconDraw(ctx, name, cx, cy, size, color, lw, p) {
      if (p <= 0) return;
      if (p >= 1) { icon(ctx, name, cx, cy, size, color, lw); return; }
      ctx.save(); ctx.setLineDash([Math.max(0.01, LAND(p) * 72), 400]); ctx.lineDashOffset = 0; icon(ctx, name, cx, cy, size, color, lw); ctx.restore();
    }
    // cursor do sistema: desliza em arco, chega exatamente no tempo marcado, "amassa" no clique
    const CURSOR = new Path2D('M5 2 L5 19 L9.5 15.5 L12.5 22 L15.5 20.5 L12.5 14 L18.5 14 Z');
    function cursorAt(t, keys) {
      let x = keys[0].x, y = keys[0].y;
      for (let i = 1; i < keys.length; i++) {
        const to = keys[i];
        if (t >= to.t) { x = to.x; y = to.y; continue; }
        const from = keys[i - 1], dur = Math.min(0.46, (to.t - from.t) * 0.82), u = clamp((t - (to.t - dur)) / dur), e = GLIDE_E(u);
        const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1, bulge = Math.sin(Math.PI * u) * Math.min(70, len * 0.09);
        x = from.x + dx * e - (dy / len) * bulge; y = from.y + dy * e + (dx / len) * bulge;
        break;
      }
      let sq = 1;
      for (const k of keys) if (k.click && t >= k.t && t - k.t < 0.16) sq = Math.min(sq, 1 - 0.2 * Math.sin((Math.PI * (t - k.t)) / 0.16));
      return { x, y, sq };
    }
    function drawCursor(ctx, x, y, sq, a) {
      if (a <= 0.01) return;
      const k = ctxScale(ctx);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(2.4 * sq, 2.4 * sq); ctx.translate(-5, -2);
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12 * k; ctx.shadowOffsetY = 5 * k;
      ctx.fillStyle = '#FFFFFF'; ctx.fill(CURSOR);
      ctx.shadowColor = 'transparent'; ctx.lineWidth = 1.15; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000000'; ctx.stroke(CURSOR);
      ctx.restore();
    }

    // câmera: mundo com as cenas lado a lado; mola pesada nos cortes e um respiro lento de zoom (sem tremor)
    const PCX = [[0, 0], [7.3, 1180]], PCY = [[0, 0], [11.02, 1300]];
    const PZ = [[0, 0], [0, Math.log(1.035)], [1.875, 0], [3.75, Math.log(1.025)], [5.625, Math.log(0.99)], [6.3, Math.log(1.03)], [7.3, 0], [9.2, Math.log(1.03)], [11.02, 0], [13.125, Math.log(1.04)]];
    function pCam(t) { return { x: strack(t, PCX, SPR.heavy), y: strack(t, PCY, SPR.heavy), z: Math.exp(strack(t, PZ, SPR.soft)) }; }
    const WO = { x: 0, y: 0 }; // no vídeo de 30 s, as cenas originais depois dos capítulos ficam mais adiante no mundo
    function pUse(ctx, cam, wx = 0, wy = 0) { ctx.translate(540, 960); ctx.scale(cam.z, cam.z); ctx.translate(-540 + wx + WO.x - cam.x, -960 + wy + WO.y - cam.y); }

    function prepPremium(m) {
      const ph = {};
      // 1 · gancho: palavras grandes, uma por colcheia, a 2ª linha na cor da marca
      const lines = SC.hook.map(upper);
      let size = 196;
      for (; size > 72; size -= 4) { setFont(m, F.head, size, F.hw, size * F.hls); if (lines.every((l) => tw(m, l) <= 900)) break; }
      setFont(m, F.head, size, F.hw, size * F.hls);
      const ls = size * F.hls, lh = size * 1.04, cap = size * F.cap;
      const y0 = 930 - (cap + lh * (lines.length - 1)) / 2 + cap;
      const hookLines = lines.map((l, i) => ({ words: layoutWords(m, l, 540 - ls / 2, 'center'), y: y0 + i * lh, accent: lines.length > 1 && i === lines.length - 1 }));
      // a 1ª palavra entra logo no início; as seguintes pousam nas batidas da trilha (2, 2 e meio, 3…), onde a música acentua
      const nH = hookLines.reduce((a, l) => a + l.words.length, 0), stepH = nH > 2 ? Math.min(EIGHTH, 0.95 / (nH - 2)) : EIGHTH;
      let j = 0; hookLines.forEach((l) => { l.times = l.words.map(() => { const i = j++; return i === 0 ? 0.04 : bt(1) - 0.08 + (i - 1) * stepH; }); });
      ph.hook = { size, ls, lines: hookLines };
      // 2 · dor: a pergunta, palavra por palavra
      const pf = fit(m, SC.pain, F.head, F.hw, 900, 128, 60, 3, F.hls);
      setFont(m, F.head, pf.size, F.hw, pf.ls);
      const plh = pf.size * 1.06, pcap = pf.size * F.cap, py0 = 960 - (pcap + plh * (pf.lines.length - 1)) / 2 + pcap;
      const painLines = pf.lines.map((l, i) => ({ words: layoutWords(m, l, 540 - pf.ls / 2, 'center'), y: py0 + i * plh }));
      const nP = painLines.reduce((a, l) => a + l.words.length, 0), stepP = nP > 1 ? Math.min(EIGHTH, 1.15 / (nP - 1)) : 0;
      let k = 0; painLines.forEach((l) => { l.times = l.words.map(() => 1.875 - 0.05 + (k++) * stepP); });
      ph.pain = { size: pf.size, ls: pf.ls, lines: painLines };
      S.ph = ph;
      // o "caos" vira profundidade: uma camada desfocada e discreta atrás da pergunta
      const cl = mk(W, H), cx2 = cl.getContext('2d');
      S.cards.forEach((c, i) => { if (c.extra) return; cx2.save(); cx2.translate(c.x + c.w / 2, c.y + c.h / 2); cx2.rotate(c.rot); cx2.translate(-(c.x + c.w / 2), -(c.y + c.h / 2)); drawCard(cx2, c, 2.2, 2.2, i); cx2.restore(); });
      const cb = mk(W, H), cbx = cb.getContext('2d');
      if (CAN_FILTER) cbx.filter = 'blur(9px)';
      cbx.drawImage(cl, 0, 0); S.cardsBlur = cb;
      cl.width = cl.height = 1; // só servia para montar a camada desfocada
    }

    // bar 1 · gancho
    // saída de um bloco inteiro: some com desfoque e sobe um pouco (um desfoque só para o bloco todo)
    function exitGroup(ctx, q, x0, y0, x1, y1, draw) {
      if (q <= 0) { draw(ctx); return; }
      if (q >= 1) return;
      ctx.save(); ctx.globalAlpha *= 1 - q; ctx.translate(0, -16 * q); blurGroup(ctx, q * 12, x0, y0, x1, y1, draw); ctx.restore();
    }
    function pHook(ctx, t, cam) {
      if (t > 1.9) return;
      const P = S.ph.hook;
      ctx.save(); pUse(ctx, cam);
      exitGroup(ctx, clamp((t - 1.62) / 0.18), 40, 420, 1040, 1460, (g) => {
        setFont(g, F.head, P.size, F.hw, P.ls);
        P.lines.forEach((l) => pWords(g, l.words, l.y, t, 0, { times: l.times, color: l.accent ? T.pri : T.text }));
      });
      ctx.restore();
    }
    // bar 2 · dor
    function pPain(ctx, t, cam) {
      if (t < 1.8 || t > 3.8) return;
      ctx.save(); pUse(ctx, cam);
      const da = inv(1.95, 2.55, t) * (1 - inv(3.35, 3.68, t));
      if (da > 0) { ctx.save(); ctx.globalAlpha *= 0.3 * da; ctx.drawImage(S.cardsBlur, 0, 30 - 36 * (t - 1.875)); ctx.restore(); }
      const P = S.ph.pain;
      exitGroup(ctx, clamp((t - 3.48) / 0.18), 40, 520, 1040, 1420, (g) => {
        setFont(g, F.head, P.size, F.hw, P.ls);
        P.lines.forEach((l) => pWords(g, l.words, l.y, t, 0, { times: l.times }));
      });
      ctx.restore();
    }
    // bar 3 · busca (campo da "própria interface", cursor, digitação) → bar 4 · o campo vira a etiqueta da marca
    const PF = { cx: 540, cy: 960, w: 880, h: 124 };
    const CK_SEARCH = [
      { t: 3.9, x: 1160, y: 1560 }, { t: 4.36, x: PF.cx - PF.w / 2 + 170, y: PF.cy + 12, click: true }, { t: 4.62, x: PF.cx - PF.w / 2 + 214, y: PF.cy + PF.h / 2 + 66 },
      { t: 5.625, x: PF.cx + PF.w / 2 - 60, y: PF.cy + 10, click: true }, { t: 6.05, x: 1170, y: 1640 },
    ];
    function pField(ctx, t) {
      const s = sstep(t - 3.75, SPR.glide); if (s <= 0.002) return;
      const mv = t >= 5.66 ? Math.min(1.02, sstep(t - 5.66, SPR.glide)) : 0, D = S.lbl.pill;
      const cx = lerp(PF.cx, D.cx, mv), cy = lerp(PF.cy, D.cy, mv) + (1 - Math.min(1, s)) * 70, w = lerp(PF.w, D.w, mv), h = lerp(PF.h, D.h, mv);
      const x = cx - w / 2, y = cy - h / 2, ea = clamp(s * 1.4), focus = clamp((t - 4.36) / 0.14);
      ctx.save(); ctx.globalAlpha *= ea; blurIn(ctx, (1 - clamp(s)) * 12);
      rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = mixs(T.panel, T.panel2, clamp(mv)); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = mixs(T.border, T.pri, Math.max(focus * (1 - clamp(mv)), clamp(mv))); ctx.stroke();
      ctx.restore();
      const ca = ea * (1 - clamp((t - 5.64) / 0.1));
      if (ca > 0.01) {
        ctx.save(); ctx.globalAlpha *= ca;
        icon(ctx, 'search', x + 64, cy, 40, mixs(T.muted2, T.pri, focus), 2.4);
        const n = typedCount(), tx = x + 114;
        if (n === 0) { setFont(ctx, BODY, 33, 400, 0); ctx.fillStyle = T.muted2; ctx.fillText(L.search, tx, cy + 11); }
        setFont(ctx, MONO, S.query.size, 400, 0);
        const typed = S.query.text.slice(0, n);
        if (typed) { ctx.fillStyle = T.text; ctx.fillText(typed, tx, cy + S.query.size * 0.36); }
        const end = S.typeT.length ? S.typeT[S.typeT.length - 1] : 4.64;
        const on = FT >= 4.4 && (FT < end + 0.12 || Math.floor((FT - end - 0.12) * 5.3) % 2 === 1) && FT < 5.625;
        if (on) { ctx.fillStyle = T.pri; ctx.fillRect(tx + (n ? tw(ctx, typed) : 0) + 3, cy - 21, 3.5, 42); }
        const bx = x + w - 66, dE = t - 5.625, press = dE >= 0 && dE < 0.22 ? 1 - 0.1 * Math.sin((Math.PI * dE) / 0.22) : 1;
        ctx.save(); pivot(ctx, bx, cy, press); ctx.fillStyle = T.pri; ctx.beginPath(); ctx.arc(bx, cy, 44, 0, Math.PI * 2); ctx.fill(); icon(ctx, 'arrow', bx, cy, 36, T.onPri, 2.6); ctx.restore();
        ctx.restore();
      }
      if (t >= 5.9) { const Lb = S.lbl; setFont(ctx, MONO, Lb.ps, 700, Lb.ps * 0.1); pText(ctx, Lb.pillText, D.cx - Lb.ptw / 2 - Lb.ps * 0.05, D.cy + Lb.ps * 0.36, t, 6.0, { color: T.pri, rise: 14, blur: 10 }); }
    }
    function pOfferBadge(ctx, t, pr) {
      if (!SC.offer || t < 6.3) return;
      const s = sstep(t - 6.34, SPR.snap); if (s <= 0.01) return;
      const cx = pr.cx + PH.w / 2 - 36, cy = pr.cy - PH.h / 2 + 220, R = 104;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(lerp(0.6, 1, Math.min(1, s)), lerp(0.6, 1, Math.min(1, s))); ctx.globalAlpha *= clamp(s * 1.5);
      blurGroup(ctx, (1 - clamp(s)) * 10, -R - 4, -R - 4, R + 10, R + 16, (g) => {
        g.fillStyle = rgba('#000', 0.28); g.beginPath(); g.arc(4, 9, R, 0, Math.PI * 2); g.fill();
        g.fillStyle = T.sec; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
        const of = S.offer; setFont(g, F.head, of.size, F.hw, of.ls); g.fillStyle = T.onSec; g.textAlign = 'center';
        const lh = of.size, y0 = -((of.lines.length - 1) * lh) / 2 + of.size * F.cap * 0.5;
        of.lines.forEach((l, i) => g.fillText(l, -of.ls / 2, y0 + i * lh));
        g.textAlign = 'left';
      });
      ctx.restore();
    }
    function pReveal(ctx, t, cam) {
      if (t < 3.7 || t > 8.4) return;
      ctx.save(); pUse(ctx, cam);
      // depois do clique o campo passa por trás do celular que sobe e reaparece embaixo dele, já como a etiqueta da marca
      if (t >= 5.625) pField(ctx, t);
      if (t >= 5.625) {
        const rise = sstep(t - 5.625, SPR.lift), pr = { cx: PH.cx, cy: lerp(PH.cy + 1720, PH.cy, rise), w: PH.w, h: PH.h, r: PH.r };
        // a "virada" da música: uma luz da marca se abre atrás do celular
        const hl = inv(5.625, 6.3, t) * (1 - inv(7.2, 7.6, t));
        if (hl > 0) { ctx.save(); ctx.globalAlpha *= 0.2 * LAND(hl); ctx.drawImage(S.glowPrem, PH.cx - 760, pr.cy - 860, 1520, 1720); ctx.restore(); }
        drawPhone(ctx, pr, t); pOfferBadge(ctx, t, pr);
      }
      if (t < 5.625) pField(ctx, t);
      if (t >= 6.0) { const Lb = S.lbl; setFont(ctx, F.head, Lb.pf.size, F.hw, Lb.pf.ls); Lb.lines.forEach((ws, i) => pWords(ctx, ws, Lb.ys[i], t, bt(13) + i * 0.12, { stagger: 0.07 })); }
      if (t < 6.1) { const c = cursorAt(t, CK_SEARCH); drawCursor(ctx, c.x, c.y, c.sq, inv(3.86, 3.98, t) * (1 - inv(5.85, 6.02, t))); }
      ctx.restore();
    }
    // bar 5 · vantagens: ícones que se desenham, linha fina que liga os itens
    function pNode(ctx, it, i, t) {
      const t0 = NODE_T[i], s = sstep(t - (t0 - 0.14), SPR.glide); if (s <= 0.003) return;
      const lit = clamp((t - t0) / 0.12), size = 144, x = 190 - size / 2, y = it.cy - size / 2;
      const a = clamp(s * 1.5); if (a <= 0.003) return;
      ctx.save(); ctx.globalAlpha *= a; pivot(ctx, 190, it.cy, lerp(0.86, 1, Math.min(1, s)));
      blurGroup(ctx, (1 - clamp(s)) * 10, x - 2, y - 2, x + size + 2, y + size + 2, (g) => {
        rr(g, x, y, size, size, 36); g.fillStyle = T.panel2; g.fill(); g.lineWidth = 2; g.strokeStyle = mixs(T.border, T.pri, lit * 0.85); g.stroke();
        iconDraw(g, it.icon, 190, it.cy, 72, mixs(T.muted2, T.pri, lit), 2, clamp((t - t0 + 0.05) / 0.45));
      });
      ctx.restore();
    }
    function pBenefits(ctx, t, cam) {
      if (t < 7.3 || t > 9.62) return;
      if (!S.ben.pts) benefitPath();
      const B = S.ben, ex = clamp((t - 9.1) / 0.2), last = B.items.length - 1;
      ctx.save(); pUse(ctx, cam, 1180, 0);
      exitGroup(ctx, ex, 60, 280, 1060, 1560, (g) => {
        setFont(g, F.head, B.title.size, F.hw, B.title.ls);
        B.titleLines.forEach((ws, i) => pWords(g, ws, B.titleYs[i], t, 7.55 + i * 0.1, { stagger: 0.06 }));
        const ga = inv(7.55, 7.75, t);
        if (ga > 0) {
          g.save(); g.lineCap = 'round';
          g.setLineDash([2, 14]); g.lineWidth = 3; g.strokeStyle = rgba(T.muted2, 0.4 * ga); const full = pathUpTo(B.pts, B.lineBot); if (full) g.stroke(full);
          g.setLineDash([]); g.lineWidth = 3.5; g.strokeStyle = rgba(T.pri, 0.85 * ga); const lp = pathUpTo(B.pts, benHeadY(t)); if (lp) g.stroke(lp);
          g.restore();
        }
        B.items.forEach((it, i) => {
          if (i !== last || ex <= 0) pNode(g, it, i, t);
          setFont(g, F.head, it.f.size, F.hw, it.f.ls);
          const lh = it.f.size * 1.04, y0 = it.cy + it.f.size * F.cap * 0.5 - ((it.lines.length - 1) * lh) / 2;
          it.lines.forEach((l, li) => pText(g, l, 304, y0 + li * lh, t, NODE_T[i] + 0.03 + li * 0.05));
        });
      });
      // o último ícone fica: ele cresce e vira o cartão da cena seguinte
      if (ex > 0 && t < 9.2) pNode(ctx, B.items[last], last, t);
      ctx.restore();
    }
    // bar 6 · prova / oferta / frase: o último ícone cresce e vira o cartão (movimento mágico)
    function pProofBody(ctx, t) {
      const P = S.proof, hasR = !!P.rating, hasC = !!P.cust, cx = 540, yR = hasC ? 780 : 900, yC = hasR ? 1150 : 960;
      if (hasR) {
        if (P.src) { setFont(ctx, MONO, 26, 700, 3); const lab = L.rating(P.src).toLocaleUpperCase(LOC), w = tw(ctx, lab); pText(ctx, lab, cx - w / 2, yR - 170, t, 9.6, { color: T.muted, rise: 16, blur: 8 }); }
        const f = fit(ctx, P.rating, F.head, F.hw, 600, 250, 120, 1, F.hls); setFont(ctx, F.head, f.size, F.hw, f.ls);
        pText(ctx, P.rating, cx - tw(ctx, P.rating) / 2, yR + f.size * F.cap * 0.35, t, 9.64);
        for (let i = 0; i < 5; i++) {
          const t0 = 9.76 + i * 0.07, s = LAND(clamp((t - t0) / 0.3)); if (s <= 0.01) continue;
          ctx.save(); ctx.globalAlpha *= s; pivot(ctx, cx - 180 + i * 90, yR + 120, lerp(0.6, 1, s)); star5(ctx, cx - 180 + i * 90, yR + 120, 34, inv(t0 + 0.05, t0 + 0.2, t), T.sec, rgba(T.muted2, 0.35)); ctx.restore();
        }
      }
      if (hasR && hasC) { const a = inv(9.9, 10.2, t); ctx.fillStyle = rgba(T.border, a); ctx.fillRect(CARD.x + 80, 1000, (CARD.w - 160) * LAND(a), 2); }
      if (hasC) {
        const f = fit(ctx, P.cust, F.head, F.hw, 700, hasR ? 130 : 200, 70, 1, F.hls); setFont(ctx, F.head, f.size, F.hw, f.ls);
        let txt = P.cust;
        if (P.custNum != null) { const k2 = EO(inv(9.95, 10.75, t)); txt = k2 >= 1 ? P.cust : P.custPrefix + fmtNum(P.custNum * k2, P.fmt) + P.custSuffix; }
        // a contagem cresce para a esquerda: o fim do número fica no lugar (nada se recentraliza)
        const right = cx + tw(ctx, P.cust) / 2;
        pText(ctx, txt, right - tw(ctx, txt), yC, t, 9.95, { color: T.pri });
        if (P.custLabel) { const lf = fit(ctx, P.custLabel, BODY, 600, 700, 42, 26, 1, 0); setFont(ctx, BODY, lf.size, 600, 0); pText(ctx, P.custLabel, cx - tw(ctx, P.custLabel) / 2, yC + 64, t, 10.05, { color: T.muted, rise: 18, blur: 8 }); }
      }
    }
    function pOfferBody(ctx, t) {
      const s = sstep(t - 9.6, SPR.snap), O = S.offerBig; if (s <= 0.01) return;
      const sc = lerp(0.85, 1, Math.min(1, s));
      ctx.save(); ctx.translate(540, 930); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(s * 1.4);
      const w = 700, h = Math.max(300, O.lines.length * O.size * 1.02 + 140);
      blurGroup(ctx, (1 - clamp(s)) * 12, -w / 2, -h / 2, w / 2, h / 2, (g) => {
        g.fillStyle = T.pri; g.beginPath(); g.moveTo(-w / 2 + 90, -h / 2); g.lineTo(w / 2 - 30, -h / 2); g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 30); g.lineTo(w / 2, h / 2 - 30); g.quadraticCurveTo(w / 2, h / 2, w / 2 - 30, h / 2); g.lineTo(-w / 2 + 90, h / 2); g.lineTo(-w / 2, 0); g.closePath(); g.fill();
        g.fillStyle = T.panel; g.beginPath(); g.arc(-w / 2 + 70, 0, 20, 0, Math.PI * 2); g.fill();
        setFont(g, F.head, O.size, F.hw, O.ls); g.fillStyle = T.onPri; g.textAlign = 'center';
        const lh = O.size * 1.02, y0 = -((O.lines.length - 1) * lh) / 2 + O.size * F.cap * 0.5;
        O.lines.forEach((l, i) => g.fillText(l, 40 - O.ls / 2, y0 + i * lh)); g.textAlign = 'left';
      });
      ctx.restore();
    }
    function pStatementBody(ctx, t) {
      const st = S.stmt; setFont(ctx, F.head, st.size, F.hw, st.ls);
      const lh = st.size * 1.04, y0 = 920 - ((st.lines.length - 1) * lh) / 2 + st.size * F.cap * 0.5;
      S.stmtLines.forEach((ws, i) => pWords(ctx, ws, y0 + i * lh, t, 9.62 + i * 0.12, { stagger: 0.07, color: i === S.stmtLines.length - 1 ? T.pri : T.text }));
    }
    function pProof(ctx, t, cam) {
      if (t < 9.18 || t > 12.4) return; // a panorâmica para baixo só tira o cartão da tela por volta de 12,1 s
      const B = S.ben, last = B.items[B.items.length - 1];
      ctx.save(); pUse(ctx, cam, 1180, 0);
      const m = Math.min(1.02, sstep(t - 9.2, SPR.glide)), mc = clamp(m);
      const src = { x: 118, y: last.cy - 72, w: 144, h: 144 };
      const bx = lerp(src.x, CARD.x, m), by = lerp(src.y, CARD.y, m), bw = lerp(src.w, CARD.w, m), bh = lerp(src.h, CARD.h, m);
      rr(ctx, bx, by, bw, bh, lerp(36, 44, mc)); ctx.fillStyle = mixs(T.panel2, T.panel, mc); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = mixs(T.pri, T.border, mc); ctx.stroke();
      if (mc < 1) { ctx.save(); ctx.globalAlpha *= 1 - inv(0, 0.35, mc); icon(ctx, last.icon, bx + bw / 2, by + bh / 2, 72, T.pri, 2); ctx.restore(); }
      if (t >= 9.45) {
        ctx.save(); rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 44); ctx.clip();
        if (variant6 === 'proof') pProofBody(ctx, t); else if (variant6 === 'offer') pOfferBody(ctx, t); else pStatementBody(ctx, t);
        lightSweep(ctx, CARD.x, CARD.y, CARD.w, CARD.h, t, 10.55, 0.45, 0.07);
        ctx.restore();
      }
      ctx.restore();
    }
    // bar 7 · contato; no fim tudo se recolhe para o ponto onde nasce o logo
    const pGather = (t) => EI(inv(12.66, 13.125, t));
    const gatherPt = (x, y, P) => ({ x: lerp(x, 540, P), y: lerp(y, 820, P), s: 1 - 0.85 * P });
    function pContact(ctx, t, cam) {
      if (t < 11.0 || t > 13.2) return;
      const G = pGather(t);
      ctx.save(); pUse(ctx, cam, 1180, 1300);
      if (G > 0) { ctx.globalAlpha *= 1 - G; blurGroup(ctx, G * 14, 40, 300, 1040, 1700, (g) => pContactScene(g, t, G)); }
      else pContactScene(ctx, t, 0);
      ctx.restore();
    }
    function pContactScene(ctx, t, G) {
      const C = S.contact;
      setFont(ctx, F.head, C.title.size, F.hw, C.title.ls);
      C.titleLines.forEach((ws, li) => {
        const col = li === C.titleLines.length - 1 && C.titleLines.length > 1 ? T.pri : T.text;
        if (G <= 0) { pWords(ctx, ws, C.titleYs[li], t, 11.3 + li * 0.1, { stagger: 0.06, color: col }); return; }
        ws.forEach((wd) => { const q = gatherPt(wd.x + wd.w / 2, C.titleYs[li] - C.title.size * 0.35, G); ctx.save(); ctx.translate(q.x, q.y); ctx.scale(q.s, q.s); ctx.fillStyle = col; ctx.fillText(wd.text, -wd.w / 2, C.title.size * 0.35); ctx.restore(); });
      });
      C.rows.forEach((row, i) => {
        const s = sstep(t - (11.42 + i * 0.09), SPR.glide); if (s <= 0.003) return;
        let cx = 540, cy = row.cy + 120 * (1 - Math.min(1, s)), sc = 1, a = clamp(s * 1.5), bl = (1 - clamp(s)) * 10;
        if (G > 0) { const q = gatherPt(cx, cy, G); cx = q.x; cy = q.y; sc = q.s; bl = 0; }
        ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.scale(sc, sc);
        blurGroup(ctx, bl, -442, -76, 442, 76, (g) => {
          rr(g, -440, -74, 880, 148, 46); g.fillStyle = T.panel; g.fill(); g.lineWidth = 2; g.strokeStyle = T.border; g.stroke();
          const tk = inv(12.15 + i * 0.1, 12.42 + i * 0.1, t);
          g.save(); pivot(g, -350, 0, 1 + 0.1 * Math.sin(Math.PI * tk)); g.fillStyle = T.pri; g.beginPath(); g.arc(-350, 0, 48, 0, Math.PI * 2); g.fill(); icon(g, row.icon, -350, 0, 50, T.onPri, 2.3); g.restore();
          setFont(g, row.mono ? MONO : BODY, row.f.size, row.mono ? 500 : 600, 0); g.fillStyle = T.text;
          const lh = row.f.size * 1.12, y0 = row.f.size * 0.36 - ((row.f.lines.length - 1) * lh) / 2;
          row.f.lines.forEach((l, li) => g.fillText(l, -272, y0 + li * lh));
        });
        ctx.restore();
      });
    }
    // bar 8 · assinatura: o anel se desenha, o logo nasce, o nome desliza de trás da marca, um toque no botão
    function pMark(ctx, cx, cy, box, dot, ring) {
      const R = box * 0.5;
      if (ring > 0) { ctx.save(); ctx.globalAlpha *= 0.55; ctx.strokeStyle = T.pri; ctx.lineWidth = box * 0.04; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, R * (images.logo ? 1.02 : 0.84), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ring)); ctx.stroke(); ctx.restore(); }
      if (images.logo) {
        const r = R * 0.84 * Math.max(0, dot); if (r < 1) return;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.clip(); drawContain(ctx, images.logo, cx, cy, r * 1.46, r * 1.46); ctx.restore();
      } else {
        const r = R * 0.6 * Math.max(0, dot); if (r < 1) return;
        ctx.fillStyle = T.pri; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        const ch = (BR.name.trim()[0] || 'P').toLocaleUpperCase(LOC); setFont(ctx, F.head, r * 1.2, F.hw, 0); ctx.textAlign = 'center'; ctx.fillStyle = T.onPri; ctx.fillText(ch, cx, cy + r * 1.2 * F.cap * 0.5); ctx.textAlign = 'left';
      }
    }
    function pLogo(ctx, t, cam) {
      if (t < 13.1 || t > 15) return;
      const xo = clamp((t - 14.72) / 0.25);
      ctx.save(); pUse(ctx, cam, 1180, 1300);
      if (xo > 0) { ctx.globalAlpha *= 1 - xo; pivot(ctx, 540, 900, 1 - 0.05 * xo); blurGroup(ctx, xo * 14, 0, 250, 1080, 1650, (g) => pLogoScene(g, t)); }
      else pLogoScene(ctx, t);
      ctx.restore();
    }
    function pLogoScene(ctx, t) {
      const G = S.logo, d = t - 13.125;
      const m = Math.min(1.01, sstep(t - 13.3, SPR.glide)), mc = clamp(m), box = lerp(G.mode === 'row' ? 320 : 300, G.box, m);
      const mx = lerp(540, G.markX, m), my = lerp(820, G.cy, m);
      setFont(ctx, F.head, G.fs, F.hw, G.fs * F.hls * 0.3);
      if (G.mode === 'row' && t > 13.3) {
        const wx = G.wordX - (1 - mc) * (G.wordW * 0.55 + G.gap);
        ctx.save(); ctx.globalAlpha *= inv(13.3, 13.45, t); ctx.beginPath(); ctx.rect(mx + box * 0.3, -H, W * 3, H * 3); ctx.clip(); ctx.fillStyle = T.text; ctx.fillText(BR.name, wx, G.wordY); ctx.restore();
      } else if (G.mode === 'stack') G.nameLines.forEach((l, i) => pText(ctx, l, 540 - G.nameWs[i] / 2, G.nameYs[i], t, 13.35 + i * 0.08));
      pMark(ctx, mx, my, box, sstep(d, SPR.pop), LAND(clamp(d / 0.7)));
      setFont(ctx, F.head, G.tag.size, F.hw, G.tag.ls);
      G.tagLines.forEach((ws, i) => pWords(ctx, ws, G.tagYs[i], t, 13.55 + i * 0.12, { stagger: 0.07, color: i === G.tagLines.length - 1 && G.tagLines.length > 1 ? T.pri : T.text }));
      const cs = sstep(t - 13.85, SPR.glide);
      if (cs > 0.003) {
        const cw = G.ctaTW + 136, ch = 90, cx = 540, cy = G.ctaY, dP = t - 14.25, press = dP >= 0 && dP < 0.24 ? 1 - 0.06 * Math.sin((Math.PI * dP) / 0.24) : 1;
        ctx.save(); ctx.globalAlpha *= clamp(cs * 1.5); pivot(ctx, cx, cy, lerp(0.9, 1, Math.min(1, cs)) * press);
        blurGroup(ctx, (1 - clamp(cs)) * 10, cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2, (g) => {
          rr(g, cx - cw / 2, cy - ch / 2, cw, ch, ch / 2); g.fillStyle = dP >= 0 && dP < 0.3 ? mixs(T.pri, '#FFFFFF', 0.16 * Math.sin((Math.PI * dP) / 0.3)) : T.pri; g.fill();
          setFont(g, MONO, G.ctaSize, 700, 1); g.fillStyle = T.onPri; g.fillText(SC.cta, cx - cw / 2 + 38, cy + G.ctaSize * 0.34);
          const ax = cx + cw / 2 - 52; g.fillStyle = T.onPri; g.beginPath(); g.arc(ax, cy, 25, 0, Math.PI * 2); g.fill(); icon(g, 'arrow', ax, cy, 30, T.pri, 2.8);
        });
        ctx.restore();
        // o cursor toca a seta do botão (nunca em cima do texto)
        const ck = [{ t: 13.9, x: 1160, y: G.ctaY + 430 }, { t: 14.25, x: cx + cw / 2 - 50, y: cy + 4, click: true }, { t: 14.75, x: cx + cw / 2 + 20, y: cy + 170 }];
        const c = cursorAt(t, ck); drawCursor(ctx, c.x, c.y, c.sq, inv(13.9, 14.0, t) * (1 - inv(14.6, 14.72, t)));
      }
    }
    function drawWorldPremium(ctx, t) {
      ctx.drawImage(S.bgPrem, 0, 0);
      // uma luz suave que passeia devagar (periódica em 15 s, para o loop fechar sem emenda)
      const w = (2 * Math.PI) / 15, lx = 540 + 260 * Math.sin(w * t + 0.6), ly = 760 + 180 * Math.cos(w * t);
      ctx.save(); ctx.globalAlpha = 0.07; ctx.drawImage(S.glowPrem, lx - 900, ly - 900, 1800, 1800); ctx.restore();
      const cam = pCam(t);
      pHook(ctx, t, cam); pPain(ctx, t, cam); pReveal(ctx, t, cam); pBenefits(ctx, t, cam); pProof(ctx, t, cam); pContact(ctx, t, cam); pLogo(ctx, t, cam);
    }

    // ══════════════════════════════ 30 s · CAPÍTULOS NOVOS
    // O vídeo de 30 s tem 16 compassos a 128 BPM. Os 8 compassos do vídeo de 15 s são cortados nas duas viradas
    // (7,5 s e 11,25 s do motor, bem no meio do movimento, onde o corte não aparece) e entram 4 capítulos de 2 compassos:
    //   7,5–11,25 em detalhes · 11,25–15 como funciona · 18,75–22,5 depoimento (ou oferta, ou destaque) · 22,5–26,25 frase final
    // Regras de filme de produto: uma ideia por cena, objeto principal no centro, algo acontece em toda batida, as cenas se
    // ligam por movimento (sem corte seco) e as fotos/prints viram peças que se montam em vez de aparecerem inteiras.
    const CHLEN = BEAT * 8; // 2 compassos
    const whipAt = (c, t) => EIO(inv(c - 0.18, c + 0.18, t));
    const WX30 = (t) => whipAt(7.5, t) + whipAt(11.25, t) + whipAt(15, t);
    const WY30 = (t) => whipAt(18.75, t) + whipAt(22.5, t) + whipAt(26.25, t);

    // ── quebra de imagem em peças: faixas separadas por linhas lisas (prints de app e site) e colunas dentro delas;
    // foto sem faixas vira mosaico. A peça com mais detalhe (e tamanho razoável) é a que ganha o destaque.
    function segment(src) {
      const W0 = src.width, H0 = src.height, aw = 240, ah = Math.max(24, Math.round((aw * H0) / W0)), k = W0 / aw;
      const c = mk(aw, ah), x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(src, 0, 0, aw, ah);
      let d = null; try { d = x.getImageData(0, 0, aw, ah).data; } catch (e) { d = null; }
      const Y = d ? new Float32Array(aw * ah) : null;
      if (d) for (let i = 0, j = 0; i < Y.length; i++, j += 4) Y[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
      const energy = ([x0, y0, x1, y1]) => { if (!Y) return 0; let e = 0, n = 0; for (let yy = Math.max(1, y0); yy < y1; yy++) for (let xx = Math.max(1, x0); xx < x1; xx++) { const o = yy * aw + xx; e += Math.abs(Y[o] - Y[o - 1]) + Math.abs(Y[o] - Y[o - aw]); n++; } return n ? e / n : 0; };
      const toPx = (cells) => cells.map(([x0, y0, x1, y1]) => { const a = Math.max(0, Math.floor(x0 * k)), b = Math.max(0, Math.floor(y0 * k)); return [a, b, Math.min(W0, Math.ceil(x1 * k)) - a, Math.min(H0, Math.ceil(y1 * k)) - b]; });
      const grid = () => {
        const ar = ah / aw, cols = ar < 0.8 ? 4 : 3, rows = ar > 1.25 ? 4 : 3, cells = [];
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) cells.push([Math.round((q * aw) / cols), Math.round((r * ah) / rows), Math.round(((q + 1) * aw) / cols), Math.round(((r + 1) * ah) / rows)]);
        let best = Math.floor(rows / 2) * cols + Math.floor(cols / 2), bs = -1;
        if (Y) cells.forEach((cl, i) => { const e = energy(cl) * (1 - 0.35 * Math.abs((cl[1] + cl[3]) / 2 / ah - 0.5)); if (e > bs) { bs = e; best = i; } });
        return { mode: 'photo', bg: '#0B0D0E', cells: toPx(cells), callout: best, second: (best + 1) % cells.length };
      };
      if (!Y) return grid();
      const rowE = new Float32Array(ah);
      for (let yy = 0; yy < ah; yy++) { let e = 0; const o = yy * aw; for (let xx = 1; xx < aw; xx++) e += Math.abs(Y[o + xx] - Y[o + xx - 1]); rowE[yy] = e / aw; }
      const FLAT = 1.6;
      let br = 0, bgc = 0, bb = 0, bn = 0;
      for (let yy = 0; yy < ah; yy++) if (rowE[yy] < FLAT) for (let xx = 0; xx < aw; xx += 3) { const j = (yy * aw + xx) * 4; br += d[j]; bgc += d[j + 1]; bb += d[j + 2]; bn++; }
      let bands = [], y0 = -1, gap = 0;
      for (let yy = 0; yy < ah; yy++) {
        if (rowE[yy] >= FLAT) { if (y0 < 0) y0 = yy; gap = 0; }
        else if (y0 >= 0 && ++gap >= 2) { bands.push([y0, yy - gap + 1]); y0 = -1; gap = 0; }
      }
      if (y0 >= 0) bands.push([y0, ah]);
      bands = bands.filter(([a, b]) => b - a >= 3);
      if (bands.length < 3 || bn < aw * 1.5) return grid();
      const mergeAt = (i) => { bands.splice(i, 2, [bands[i][0], bands[i + 1][1]]); };
      for (let guard = 0; bands.length > 2 && guard < 300; guard++) {
        const i = bands.findIndex(([a, b]) => b - a < ah * 0.035); if (i < 0) break;
        const gp = i > 0 ? bands[i][0] - bands[i - 1][1] : 1e9, gn = i < bands.length - 1 ? bands[i + 1][0] - bands[i][1] : 1e9;
        mergeAt(gp <= gn ? i - 1 : i);
      }
      while (bands.length > 8) { let bi = 0, bs = 1e9; for (let i = 0; i < bands.length - 1; i++) { const s2 = bands[i + 1][1] - bands[i][0]; if (s2 < bs) { bs = s2; bi = i; } } mergeAt(bi); }
      const splitCols = (a, b) => {
        const colE = new Float32Array(aw);
        for (let xx = 1; xx < aw; xx++) { let e = 0; for (let yy = Math.max(1, a); yy < b; yy++) { const o = yy * aw + xx; e += Math.abs(Y[o] - Y[o - 1]) + Math.abs(Y[o] - Y[o - aw]); } colE[xx] = e / Math.max(1, b - a); }
        colE[0] = colE[1];
        let runs = [], x0 = -1, g = 0;
        for (let xx = 0; xx < aw; xx++) { if (colE[xx] >= 1.2) { if (x0 < 0) x0 = xx; g = 0; } else if (x0 >= 0 && ++g >= 5) { runs.push([x0, xx - g + 1]); x0 = -1; g = 0; } }
        if (x0 >= 0) runs.push([x0, aw]);
        runs = runs.filter(([p, q]) => q - p >= 4);
        while (runs.length > 3) { let bi = 0, bgp = 1e9; for (let i = 0; i < runs.length - 1; i++) { const gg = runs[i + 1][0] - runs[i][1]; if (gg < bgp) { bgp = gg; bi = i; } } runs.splice(bi, 2, [runs[bi][0], runs[bi + 1][1]]); }
        return runs.length ? runs : [[0, aw]];
      };
      let cells = [];
      for (const [a, b] of bands) for (const [p, q] of splitCols(a, b)) cells.push([Math.max(0, p - 1), Math.max(0, a - 1), Math.min(aw, q + 1), Math.min(ah, b + 1)]);
      if (cells.length > 14) cells = bands.map(([a, b]) => { const r = splitCols(a, b); return [Math.max(0, r[0][0] - 1), Math.max(0, a - 1), Math.min(aw, r[r.length - 1][1] + 1), Math.min(ah, b + 1)]; });
      const area = aw * ah, scores = cells.map((cl) => { const ar_ = ((cl[2] - cl[0]) * (cl[3] - cl[1])) / area; return cl[1] < ah * 0.06 || ar_ < 0.025 || ar_ > 0.45 ? -1 : energy(cl) * Math.sqrt(ar_); });
      const rank = scores.map((s2, i) => [s2, i]).sort((a, b) => b[0] - a[0]);
      let best = rank[0][0] >= 0 ? rank[0][1] : cells.reduce((bi, cl, i, arr) => ((cl[2] - cl[0]) * (cl[3] - cl[1]) > (arr[bi][2] - arr[bi][0]) * (arr[bi][3] - arr[bi][1]) ? i : bi), 0);
      const second = rank.length > 1 && rank[1][0] >= 0 ? rank[1][1] : (best + 1) % cells.length;
      return { mode: 'ui', bg: U.toHex([br / bn, bgc / bn, bb / bn]), cells: toPx(cells), callout: best, second };
    }
    // a foto/print no tamanho da tela da moldura (celular, navegador ou cartão, conforme a proporção)
    function makeScreen(img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      let ar = ih / iw, sx = 0, sy = 0, sw = iw, sh = ih;
      if (ar > 2.25) { sh = iw * 2.2; ar = 2.2; } else if (ar < 0.5) { sw = ih / 0.5; sx = (iw - sw) / 2; ar = 0.5; }
      const kind = ar >= 1.45 ? 'phone' : ar <= 0.85 ? 'browser' : 'card';
      const maxW = kind === 'phone' ? 560 : kind === 'browser' ? 940 : 820, maxH = kind === 'phone' ? 1180 : kind === 'browser' ? 900 : 1080;
      let w = maxW, h = w * ar; if (h > maxH) { h = maxH; w = h / ar; }
      w = Math.round(w); h = Math.round(h);
      const scr = mk(w, h), x = scr.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      return { kind, w, h, scr };
    }
    // sem nenhuma foto: um "post" da marca montado com logo, nome, as vantagens e a chamada (as peças já nascem separadas)
    function makeBoard() {
      const w = 760, h = 950, scr = mk(w, h), x = scr.getContext('2d'), cells = [];
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, T.panel); g.addColorStop(1, T.bgDeep); x.fillStyle = g; x.fillRect(0, 0, w, h);
      const R = 96, cy0 = 170;
      if (images.logo) { x.save(); x.beginPath(); x.arc(w / 2, cy0, R, 0, Math.PI * 2); x.fillStyle = '#FFFFFF'; x.fill(); x.clip(); drawContain(x, images.logo, w / 2, cy0, R * 1.46, R * 1.46); x.restore(); }
      else drawMonogram(x, w / 2, cy0, R * 0.78, false);
      cells.push([w / 2 - R - 18, cy0 - R - 18, 2 * R + 36, 2 * R + 36]);
      const nf = fit(x, BR.name, F.head, F.hw, w - 120, 78, 40, 1, F.hls); setFont(x, F.head, nf.size, F.hw, nf.ls);
      const nw = tw(x, nf.lines[0] || ''); x.fillStyle = T.text; x.fillText(nf.lines[0] || '', w / 2 - nw / 2, 350 + nf.size * F.cap * 0.5);
      cells.push([w / 2 - nw / 2 - 20, 350 - nf.size * 0.62, nw + 40, nf.size * 1.24]);
      const pf = fit(x, SC.product, BODY, 600, w - 140, 36, 24, 1, 0); setFont(x, BODY, pf.size, 600, 0);
      const pw = tw(x, pf.lines[0] || ''); x.fillStyle = T.muted; x.fillText(pf.lines[0] || '', w / 2 - pw / 2, 440);
      cells.push([w / 2 - pw / 2 - 16, 440 - pf.size - 8, pw + 32, pf.size + 26]);
      const bens = SC.benefits.slice(0, 3), tw_ = (w - 100 - 2 * 24) / 3;
      bens.forEach((b, i) => {
        const tx = 50 + i * (tw_ + 24), ty = 510;
        rr(x, tx, ty, tw_, 250, 30); x.fillStyle = T.panel2; x.fill(); x.lineWidth = 2; x.strokeStyle = T.border; x.stroke();
        icon(x, b.icon, tx + tw_ / 2, ty + 88, 76, T.pri, 2.1);
        const bf = fit(x, b.text, BODY, 700, tw_ - 28, 26, 17, 2, 0); setFont(x, BODY, bf.size, 700, 0); x.fillStyle = T.text;
        bf.lines.forEach((l, li) => { const lw = tw(x, l); x.fillText(l, tx + tw_ / 2 - lw / 2, ty + 172 + li * bf.size * 1.18); });
        cells.push([tx - 3, ty - 3, tw_ + 6, 256]);
      });
      const cta = SC.offer || SC.cta, cf = fit(x, cta, MONO, 700, w - 220, 34, 22, 1, 0); setFont(x, MONO, cf.size, 700, 0);
      const cw = tw(x, cf.lines[0] || '') + 90;
      rr(x, w / 2 - cw / 2, 820, cw, 80, 40); x.fillStyle = SC.offer ? T.sec : T.pri; x.fill(); x.fillStyle = SC.offer ? T.onSec : T.onPri; x.fillText(cf.lines[0] || '', w / 2 - cw / 2 + 45, 820 + 40 + cf.size * 0.34);
      cells.push([w / 2 - cw / 2 - 4, 816, cw + 8, 88]);
      return { kind: 'card', w, h, scr, seg: { mode: 'ui', bg: T.panel2, cells: cells.map((c) => c.map(Math.round)), callout: 3, second: 4 } };
    }
    function makePieces(scr, seg) {
      const r = rng(seed + 31), cx = scr.width / 2, cy = scr.height / 2;
      const pieces = seg.cells.map(([x0, y0, w, h]) => {
        const spr = mk(w, h), g = spr.getContext('2d');
        g.save(); rr(g, 0, 0, w, h, seg.mode === 'ui' ? Math.min(16, w / 5, h / 5) : 4); g.clip(); g.drawImage(scr, x0, y0, w, h, 0, 0, w, h); g.restore();
        const a = Math.atan2(y0 + h / 2 - cy, x0 + w / 2 - cx) + (r() - 0.5) * 0.9, dist = 380 + r() * 360;
        return { x: x0, y: y0, w, h, spr, ex: Math.cos(a) * dist, ey: Math.sin(a) * dist, rot: (r() - 0.5) * 1.2, s0: 0.5 + r() * 0.5, key: r() };
      });
      // ordem de chegada: de cima para baixo na interface (a página "se monta"); aleatória no mosaico de foto
      const order = pieces.map((p, i) => i).sort((a, b) => (seg.mode === 'ui' ? pieces[a].y - pieces[b].y || pieces[a].x - pieces[b].x : pieces[a].key - pieces[b].key));
      order.forEach((i, j) => { pieces[i].rank = j; });
      return pieces;
    }
    function makeThumb(img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, ar = clamp(ih / iw, 0.62, 1.5), w = 430, h = Math.round(w * ar);
      const c = mk(w + 20, h + 20), x = c.getContext('2d');
      x.save(); x.translate(10, 10); rr(x, 0, 0, w, h, 26); x.clip(); drawCover(x, img, w, h); x.restore();
      x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.2)'; rr(x, 10, 10, w, h, 26); x.stroke();
      return { c, w: w + 20, h: h + 20 };
    }
    // títulos dos capítulos: no alto, centralizados
    function chTitle(m, text, y0) {
      const tf = fit(m, text, F.head, F.hw, 900, 100, 52, 2, F.hls); setFont(m, F.head, tf.size, F.hw, tf.ls);
      return { f: tf, lines: tf.lines.map((l) => layoutWords(m, l, 540, 'center')), ys: tf.lines.map((_, i) => y0 + tf.size * F.cap + i * tf.size * 1.04), h: tf.size * F.cap + (tf.lines.length - 1) * tf.size * 1.04 };
    }
    function drawChTitle(g, tt, tau, t0 = 0.05) {
      setFont(g, F.head, tt.f.size, F.hw, tt.f.ls);
      tt.lines.forEach((ws, i) => (PREM ? pWords(g, ws, tt.ys[i], tau, t0 + i * 0.1, { stagger: 0.07 }) : drawWords(g, ws, tt.ys[i], tt.f.size, tau, t0 + i * 0.1, { stagger: 0.05, color: T.text })));
    }

    function prep30(m) {
      const C = {};
      // ── em detalhes
      const gal = (images.gallery || []).filter(Boolean), src = gal[0] || images.product || null;
      let hero;
      if (src) { const sc = makeScreen(src); hero = { ...sc, seg: segment(sc.scr) }; } else hero = makeBoard();
      hero.pieces = makePieces(hero.scr, hero.seg);
      const chrome = hero.kind === 'phone' ? { l: 14, t: 14, r: 14, b: 14, rad: 66 } : hero.kind === 'browser' ? { l: 3, t: 62, r: 3, b: 3, rad: 24 } : { l: 0, t: 0, r: 0, b: 0, rad: 34 };
      const probe = chTitle(m, SC.showcaseTitle, 0), fw = hero.w + chrome.l + chrome.r, fh = hero.h + chrome.t + chrome.b;
      const s = Math.min(1, (1700 - 190 - probe.h - 70) / fh, 960 / fw), groupH = probe.h + 70 + fh * s, top = Math.max(190, 960 - groupH / 2);
      const title = chTitle(m, SC.showcaseTitle, top);
      const frame = { w: fw * s, h: fh * s, s, cx: 540, cy: top + probe.h + 70 + (fh * s) / 2, chrome };
      frame.sx = frame.cx - frame.w / 2 + chrome.l * s; frame.sy = frame.cy - frame.h / 2 + chrome.t * s;
      const pc = hero.pieces[hero.seg.callout], p2 = hero.pieces[hero.seg.second];
      const center = (p) => ({ x: frame.sx + (p.x + p.w / 2) * s, y: frame.sy + (p.y + p.h / 2) * s });
      C.show = { hero, frame, title, extras: gal.slice(1, 3).map(makeThumb), co: center(pc), co2: p2 && p2 !== pc ? center(p2) : null };
      C.show.n = hero.pieces.length; C.show.step = PREM ? Math.min(0.06, 0.9 / C.show.n) : Math.min(0.07, 0.95 / C.show.n);
      // ── como funciona
      const st = chTitle(m, SC.stepsTitle, 0), items = SC.steps.slice(0, 3);
      // uma linha só quando cabe num tamanho bom (os três passos no mesmo tamanho); senão, até duas linhas
      const one = Math.min(...items.map((it) => fit(m, it.text, F.head, F.hw, 540, 70, 30, 1, F.hls * 0.6).size)), lines2 = one < 50 ? 2 : 1;
      const size = lines2 === 1 ? one : Math.min(...items.map((it) => fit(m, it.text, F.head, F.hw, 540, 66, 34, 2, F.hls * 0.6).size));
      const its = items.map((it, i) => { const f = fit(m, it.text, F.head, F.hw, 540, size, 30, lines2, F.hls * 0.6); return { ...it, f, num: String(i + 1).padStart(2, '0') }; });
      const cardH = 236, gap2 = 92, blockH = st.h + 90 + 3 * cardH + 2 * gap2, top2 = Math.max(200, 960 - blockH / 2);
      C.steps = { title: chTitle(m, SC.stepsTitle, top2), items: its, cardH };
      its.forEach((it, i) => { it.side = i % 2 ? 1 : -1; it.cx = 540 + it.side * 36; it.cy = top2 + st.h + 90 + cardH / 2 + i * (cardH + gap2); it.x = it.cx - 420; it.bx = it.x + 112; });
      C.steps.t = [bt(1), bt(3), bt(5)];
      // ── depoimento / oferta / destaque
      const quote = String(spec.proof.quote || '').trim(), author = String(spec.proof.author || '').trim();
      C.voiceKind = quote ? 'quote' : SC.offer && variant6 !== 'offer' ? 'offer' : 'spot';
      if (C.voiceKind === 'quote') {
        const qf = fit(m, quote, F.head, F.hw, 860, 108, 50, 4, F.hls * 0.5); setFont(m, F.head, qf.size, F.hw, qf.ls);
        const lh = qf.size * 1.12, qh = qf.size * F.cap + (qf.lines.length - 1) * lh, aH = author ? 170 : 0, total = 210 + qh + aH, y0 = Math.max(330, 960 - total / 2) + 210;
        const lines = qf.lines.map((l) => layoutWords(m, l, 120));
        let k2 = 0; const times = lines.map((ws) => ws.map(() => 0.42 + (k2++) * Math.min(0.06, 1.7 / Math.max(1, qf.lines.join(' ').split(' ').length))));
        C.voice = { f: qf, lines, times, ys: qf.lines.map((_, i) => y0 + qf.size * F.cap + i * lh), glyph: { x: 120, y: y0 - 40 }, author, authorT: Math.min(2.55, (times.flat().pop() || 1) + 0.45) };
        C.voice.ay = C.voice.ys[C.voice.ys.length - 1] + 140;
        if (author) { const af = fit(m, author, BODY, 700, 700, 46, 26, 1, 0); C.voice.af = af; }
      } else if (C.voiceKind === 'offer') {
        C.voice = { big: fit(m, upper(SC.offer), F.head, F.hw, 620, 190, 70, 3, F.hls) };
        const cf = fit(m, SC.cta, MONO, 700, 700, 40, 24, 1, 0); setFont(m, MONO, cf.size, 700, 1); C.voice.cf = cf; C.voice.ctaW = tw(m, cf.lines[0] || '') + 150;
      } else {
        const b0 = SC.benefits[0], bf = fit(m, b0.text, F.head, F.hw, 900, 118, 58, 2, F.hls); setFont(m, F.head, bf.size, F.hw, bf.ls);
        C.voice = { b: b0, f: bf, lines: bf.lines.map((l) => layoutWords(m, l, 540, 'center')), ys: bf.lines.map((_, i) => 1180 + bf.size * F.cap * 0.5 + i * bf.size * 1.04), rest: SC.benefits.slice(1, 4) };
      }
      // ── frase final (palavra por palavra, uma por colcheia; a última linha na cor da marca)
      // (sem prova nem oferta, pode retomar o gancho do começo: veja CALLBACK)
      let pf;
      if (CALLBACK) { const size = Math.min(...HOOK_UP.map((l) => fit(m, l, F.head, F.hw, 940, 176, 72, 1, F.hls).size)); pf = { size, lines: HOOK_UP, ls: size * F.hls }; }
      else pf = fit(m, SC.tagline || SC.product, F.head, F.hw, 940, 176, 72, 3, F.hls);
      setFont(m, F.head, pf.size, F.hw, pf.ls);
      const plh = pf.size * 1.06, pcap = pf.size * F.cap, py0 = 930 - (pcap + plh * (pf.lines.length - 1)) / 2 + pcap;
      const plines = pf.lines.map((l, i) => ({ words: layoutWords(m, l, 540 - pf.ls / 2, 'center'), y: py0 + i * plh }));
      const nw = plines.reduce((a, l) => a + l.words.length, 0), stepP = nw > 1 ? Math.min(EIGHTH, 2.1 / (nw - 1)) : 0;
      let q2 = 0; plines.forEach((l) => { l.times = l.words.map(() => 0.1 + (q2++) * stepP); });
      const accentLine = plines.length > 1 ? plines.length - 1 : 0;
      C.punch = { f: pf, lines: plines, accentLine, lastT: 0.1 + (nw - 1) * stepP, single: plines.length === 1 && plines[0].words.length > 1 };
      S.c30 = C;
    }

    // ── desenho dos capítulos (coordenadas do quadro 1080×1920; quem chama posiciona: chicote no Dinâmico, câmera no Premium)
    function drawShow(g, tau) {
      const C = S.c30.show, Hh = C.hero, Fm = C.frame, s = Fm.s, n = C.n;
      drawChTitle(g, C.title, tau);
      // aproximação na peça principal (e volta), com o ponto de interesse indo para o centro
      const zk = PREM ? strack(tau, [[0, 0], [1.2, 1], [2.3, 0]], SPR.heavy) : EIO(inv(1.2, 1.68, tau)) - EIO(inv(2.2, 2.6, tau));
      const Z = 1 + 0.2 * zk, fx = lerp(540, C.co.x, zk), fy = lerp(Fm.cy, C.co.y, zk);
      const fan = C.extras.length ? (PREM ? sstep(tau - bt(5), SPR.glide) : spring(tau - bt(5), 15, 0.55)) : 0, fanC = clamp(fan);
      g.save();
      g.translate(540, Fm.cy); g.scale(Z, Z); g.translate(-fx, -fy);
      // as outras fotos entram por trás, em leque
      if (fan > 0.01) C.extras.forEach((ex, i) => {
        const side = i ? 1 : -1, x = 540 + side * lerp(80, 330, fan), y = Fm.cy + lerp(30, 150, fanC) + (i ? 60 : -40) * fanC, rot = side * lerp(0.02, 0.1, fanC), sc = lerp(0.5, 1, Math.min(1, fan));
        g.save(); g.globalAlpha *= clamp(fan * 1.5); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 18; g.drawImage(ex.c, -ex.w / 2, -ex.h / 2); g.restore();
      });
      // moldura (encolhe um pouco quando as outras fotos chegam)
      const hs = 1 - 0.14 * fanC, hy = -60 * fanC;
      g.translate(540, Fm.cy + hy); g.scale(hs, hs); g.translate(-540, -Fm.cy);
      const fa = PREM ? clamp(sstep(tau + 0.05, SPR.glide) * 1.6) : 1, fsc = PREM ? lerp(0.95, 1, clamp(sstep(tau + 0.05, SPR.glide))) : 1;
      g.save(); g.globalAlpha *= fa; pivot(g, 540, Fm.cy, fsc);
      const x0 = Fm.cx - Fm.w / 2, y0 = Fm.cy - Fm.h / 2, ch = Fm.chrome;
      g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 70; g.shadowOffsetY = 26;
      rr(g, x0, y0, Fm.w, Fm.h, ch.rad * s); g.fillStyle = Hh.kind === 'phone' ? '#07090A' : Hh.kind === 'browser' ? T.panel2 : Hh.seg.bg; g.fill(); g.restore();
      if (Hh.kind === 'phone') { rr(g, x0, y0, Fm.w, Fm.h, ch.rad * s); g.lineWidth = 2.5; g.strokeStyle = mixs(T.border, '#8A9A95', 0.35); g.stroke(); }
      if (Hh.kind === 'browser') {
        rr(g, x0, y0, Fm.w, Fm.h, ch.rad * s); g.lineWidth = 2; g.strokeStyle = T.border; g.stroke();
        [0, 1, 2].forEach((i) => { g.fillStyle = [T.g[5], T.g[4], T.g[3]][i]; g.beginPath(); g.arc(x0 + 34 * s + i * 26 * s, y0 + 31 * s, 8 * s, 0, Math.PI * 2); g.fill(); });
        const url = String(spec.contact.site || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || L.url, aw = Math.min(Fm.w * 0.62, 520 * s);
        rr(g, Fm.cx - aw / 2, y0 + 14 * s, aw, 34 * s, 17 * s); g.fillStyle = T.g[1]; g.fill();
        setFont(g, MONO, 17 * s, 500, 0); g.fillStyle = T.muted; let u2 = url; while (tw(g, u2) > aw - 40 * s && u2.length > 4) u2 = u2.slice(0, -2) + '…'; g.fillText(u2, Fm.cx - tw(g, u2) / 2, y0 + 37 * s);
      }
      // tela: a cor de fundo do print acende e as peças chegam e se encaixam
      const on = PREM ? clamp((tau - 0.02) / 0.3) : clamp((tau - 0.02) / 0.3);
      if (on > 0) { g.save(); g.globalAlpha *= on; rr(g, Fm.sx, Fm.sy, Hh.w * s, Hh.h * s, Math.max(0, (ch.rad - ch.l) * s)); g.fillStyle = Hh.seg.bg; g.fill(); g.restore(); }
      const lift = (i) => {
        if (i === Hh.seg.callout) return PREM ? clamp(sstep(tau - bt(4), SPR.pop)) * (1 - clamp(sstep(tau - 3.2, SPR.glide))) : clamp(spring(tau - 1.5, 16, 0.5)) * (1 - EI(inv(3.1, 3.4, tau)));
        if (!C.extras.length && C.co2 && i === Hh.seg.second) return PREM ? clamp(sstep(tau - bt(6), SPR.pop)) * (1 - clamp(sstep(tau - 3.3, SPR.glide))) : clamp(spring(tau - bt(6), 16, 0.5)) * (1 - EI(inv(3.2, 3.45, tau)));
        return 0;
      };
      const drawPiece = (p, i) => {
        const d0 = 0.1 + p.rank * C.step;
        let u, ox, oy, rot, sc, a;
        if (PREM) { u = sstep(tau - d0, SPR.glide); ox = (1 - u) * p.ex * 0.3; oy = (1 - u) * p.ey * 0.3; rot = 0; sc = lerp(0.9, 1, clamp(u)); a = clamp(u * 1.8); }
        else { u = spring(tau - d0, 17, 0.52); ox = (1 - u) * p.ex; oy = (1 - u) * p.ey; rot = (1 - u) * p.rot; sc = lerp(p.s0, 1, u); a = clamp((tau - d0) * 7); }
        if (a <= 0.003) return;
        const lf = lift(i), cx = Fm.sx + (p.x + p.w / 2) * s + ox, cy = Fm.sy + (p.y + p.h / 2) * s + oy - 14 * lf, w = p.w * s, h = p.h * s;
        g.save(); g.globalAlpha *= a; g.translate(cx, cy); g.rotate(rot); g.scale(sc * (1 + 0.1 * lf), sc * (1 + 0.1 * lf));
        if (lf > 0.02) { g.save(); g.shadowColor = `rgba(0,0,0,${0.5 * lf})`; g.shadowBlur = 44; g.shadowOffsetY = 20; rr(g, -w / 2, -h / 2, w, h, Math.min(16, w / 5, h / 5)); g.fillStyle = Hh.seg.bg; g.fill(); g.restore(); }
        g.drawImage(p.spr, -w / 2, -h / 2, w, h);
        if (lf > 0.02) { rr(g, -w / 2, -h / 2, w, h, Math.min(16, w / 5, h / 5)); g.lineWidth = PREM ? 2.5 : 3.5; g.strokeStyle = rgba(T.pri, (PREM ? 0.9 : 1) * lf); g.stroke(); }
        // Dinâmico: um contorno aceso no instante em que a peça encaixa
        if (!PREM) { const k = tau - d0 - 0.2; if (k > 0 && k < 0.3) { const pth = new Path2D(); pth.roundRect(-w / 2, -h / 2, w, h, Math.min(16, w / 5, h / 5)); glowStroke(g, pth, T.pri, 3, 0.55 * (1 - k / 0.3), null); } }
        g.restore();
      };
      const hp = Hh.pieces, top = [Hh.seg.callout, C.co2 ? Hh.seg.second : -1];
      hp.forEach((p, i) => { if (!top.includes(i)) drawPiece(p, i); });
      top.filter((i) => i >= 0).sort((a, b) => lift(a) - lift(b)).forEach((i) => drawPiece(hp[i], i));
      if (Hh.kind === 'phone') { g.fillStyle = '#000'; rr(g, Fm.cx - 58 * s, y0 + 24 * s, 116 * s, 32 * s, 16 * s); g.fill(); }
      // Dinâmico: toque com anel e brilho passando pela peça
      if (!PREM) {
        for (const [tt, pt] of [[bt(4), C.co], [bt(6), !C.extras.length ? C.co2 : null]]) {
          if (!pt) continue; const k = tau - tt; if (k < 0 || k > 0.45) continue;
          const ring = new Path2D(); ring.arc(pt.x, pt.y - 14, 30 + 140 * EO(k / 0.45), 0, Math.PI * 2); glowStroke(g, ring, T.sec, 4, 1 - k / 0.45, '#FFFFFF');
        }
        const p = hp[Hh.seg.callout]; lightSweep(g, Fm.sx + p.x * s, Fm.sy + p.y * s - 14, p.w * s, p.h * s, tau, 1.62, 0.5, 0.2);
      }
      g.restore();
      g.restore();
      // Premium: o cursor desliza em arco e toca a peça principal (e a segunda, se não houver outras fotos)
      if (PREM) {
        const toScr = (pt) => { const k2 = 1 + 0.2 * clamp(strack(bt(4), [[0, 0], [1.2, 1], [2.3, 0]], SPR.heavy)); return { x: 540 + (pt.x - lerp(540, C.co.x, (k2 - 1) / 0.2)) * k2, y: Fm.cy + (pt.y - lerp(Fm.cy, C.co.y, (k2 - 1) / 0.2)) * k2 }; };
        const a1 = toScr(C.co), keys = [{ t: 1.1, x: 1160, y: 1760 }, { t: bt(4), x: a1.x + 18, y: a1.y + 10, click: true }];
        if (!C.extras.length && C.co2) keys.push({ t: bt(6), x: C.co2.x + 18, y: C.co2.y - 4, click: true });
        keys.push({ t: bt(6) + 0.55, x: 1170, y: 1790 });
        const c = cursorAt(tau, keys); drawCursor(g, c.x, c.y, c.sq, inv(1.1, 1.22, tau) * (1 - inv(bt(6) + 0.4, bt(6) + 0.55, tau)));
      }
    }

    function drawSteps(g, tau) {
      const C = S.c30.steps, its = C.items, tt = C.t;
      drawChTitle(g, C.title, tau);
      // ligações entre os passos: a linha corre de um passo ao seguinte e chega junto com ele
      for (let i = 0; i < its.length - 1; i++) {
        const a = its[i], b = its[i + 1], t0 = tt[i] + 0.4, t1 = tt[i + 1] - 0.02, p = clamp((tau - t0) / (t1 - t0));
        if (p <= 0) continue;
        const x0 = a.bx, y0 = a.cy + 72, x1 = b.bx, y1 = b.cy - 72, cx0 = x0 + (b.side - a.side) * 10, path = new Path2D();
        const N = 28, e = PREM ? LAND(p) : EO(p);
        let hx = x0, hy = y0;
        for (let k = 0; k <= N; k++) { const u = (k / N) * e, it = 1 - u; hx = it * it * it * x0 + 3 * it * it * u * cx0 + 3 * it * u * u * x1 + u * u * u * x1; hy = y0 + (y1 - y0) * u; k ? path.lineTo(hx, hy) : path.moveTo(hx, hy); }
        if (PREM) { g.save(); g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = rgba(T.pri, 0.85); g.stroke(path); g.restore(); }
        else glowStroke(g, path, T.pri, 5, 1, T.priCore);
        if (p < 1) { g.fillStyle = PREM ? T.pri : T.priCore; g.beginPath(); g.arc(hx, hy, PREM ? 6 : 8, 0, Math.PI * 2); g.fill(); }
      }
      its.forEach((it, i) => {
        const t0 = tt[i], d = tau - t0;
        let u, ox, a;
        if (PREM) { u = sstep(d + 0.12, SPR.glide); ox = 0; a = clamp(u * 1.6); }
        else { u = spring(d + 0.06, 15, 0.55); ox = (1 - u) * it.side * 520; a = clamp((d + 0.08) * 8); }
        if (a <= 0.003) return;
        const x = it.x, y = it.cy - C.cardH / 2, w = 840, h = C.cardH, lit = clamp(d / 0.12);
        const pulse = (() => { const k = tau - (bt(6.5) + i * 0.1); return k > 0 && k < 0.4 ? Math.sin((Math.PI * k) / 0.4) : 0; })();
        g.save(); g.globalAlpha *= a; g.translate(ox, PREM ? (1 - clamp(u)) * 60 : 0);
        const body = (q) => {
          rr(q, x, y, w, h, 40); q.fillStyle = T.panel; q.fill(); q.lineWidth = 2; q.strokeStyle = mixs(T.border, T.pri, lit * (PREM ? 0.5 : 0.8)); q.stroke();
          q.save(); pivot(q, it.bx, it.cy, 1 + (PREM ? 0.06 : 0.12) * pulse);
          q.fillStyle = mixs(T.panel2, T.pri, lit); q.beginPath(); q.arc(it.bx, it.cy, 72, 0, Math.PI * 2); q.fill();
          iconDraw(q, it.icon, it.bx, it.cy, 72, lit > 0.5 ? T.onPri : T.muted2, 2.2, clamp((d + 0.02) / 0.42));
          q.restore();
          setFont(q, MONO, 26, 700, 3); q.fillStyle = T.pri;
          PREM ? pText(q, it.num, x + 226, y + 66, tau, t0 + 0.02, { color: T.pri, rise: 12, blur: 8 }) : drawWords(q, [{ text: it.num, x: x + 226, w: 64 }], y + 66, 26, tau, t0 + 0.02, { dur: 0.4, color: T.pri });
          setFont(q, F.head, it.f.size, F.hw, it.f.ls);
          const lh = it.f.size * 1.06, yy = y + h / 2 + 24 + it.f.size * F.cap * 0.5 - ((it.f.lines.length - 1) * lh) / 2;
          it.f.lines.forEach((l, li) => (PREM ? pText(q, l, x + 226, yy + li * lh, tau, t0 + 0.1 + li * 0.06) : drawWords(q, [{ text: l, x: x + 226, w: 570 }], yy + li * lh, it.f.size, tau, t0 + 0.08 + li * 0.05, { dur: 0.5, color: T.text })));
        };
        if (PREM && u < 0.98) blurGroup(g, (1 - clamp(u)) * 10, x - 4, y - 4, x + w + 4, y + h + 4, body); else body(g);
        if (!PREM && pulse > 0) { const pth = new Path2D(); pth.arc(it.bx, it.cy, 72 + 10 * pulse, 0, Math.PI * 2); glowStroke(g, pth, T.pri, 4, pulse, T.priCore); }
        g.restore();
      });
    }

    function drawVoice(g, tau) {
      const C = S.c30, V = C.voice;
      if (C.voiceKind === 'quote') {
        // aspas grandes na cor de destaque, depois as palavras do cliente, depois quem disse
        const s0 = PREM ? sstep(tau - 0.05, SPR.pop) : spring(tau - 0.05, 14, 0.45);
        if (s0 > 0.01) {
          g.save(); g.globalAlpha *= clamp(s0 * 1.5); pivot(g, V.glyph.x + 80, V.glyph.y - 90, lerp(0.4, 1, Math.min(1.1, s0)));
          setFont(g, "'Gloock', Georgia, serif", 380, 400, 0); g.fillStyle = PREM ? T.sec : T.pri;
          if (!PREM) { g.shadowColor = rgba(T.pri, 0.6); g.shadowBlur = 40; }
          g.fillText('“', V.glyph.x - 14, V.glyph.y + 130); g.restore();
        }
        setFont(g, F.head, V.f.size, F.hw, V.f.ls);
        V.lines.forEach((ws, li) => (PREM ? pWords(g, ws, V.ys[li], tau, 0, { times: V.times[li], rise: 24, blur: 12 }) : ws.forEach((w, wi) => drawWords(g, [w], V.ys[li], V.f.size, tau, V.times[li][wi], { dur: 0.42, color: T.text }))));
        if (V.author) {
          const d = tau - V.authorT, u = PREM ? sstep(d, SPR.glide) : spring(d, 15, 0.55);
          if (u > 0.01) {
            g.save(); g.globalAlpha *= clamp(u * 1.6); g.translate((1 - Math.min(1, u)) * (PREM ? 0 : -120), PREM ? (1 - clamp(u)) * 30 : 0);
            g.fillStyle = T.sec; g.beginPath(); g.arc(170, V.ay, 50, 0, Math.PI * 2); g.fill();
            const ini = (V.author.trim()[0] || '?').toLocaleUpperCase(LOC); setFont(g, F.head, 52, F.hw, 0); g.fillStyle = T.onSec; g.fillText(ini, 170 - tw(g, ini) / 2, V.ay + 52 * F.cap * 0.5);
            setFont(g, BODY, V.af.size, 700, 0); g.fillStyle = T.text; g.fillText(V.af.lines[0] || V.author, 246, V.ay + V.af.size * 0.36);
            g.restore();
          }
        }
        if (!PREM) lightSweep(g, 80, V.ys[0] - V.f.size, 920, V.ys[V.ys.length - 1] - V.ys[0] + V.f.size * 1.4, tau, 2.9, 0.55, 0.1);
      } else if (C.voiceKind === 'offer') {
        setFont(g, MONO, 30, 700, 6); const lab = L.offer, lw = tw(g, lab);
        PREM ? pText(g, lab, 540 - lw / 2, 600, tau, 0.1, { color: T.pri, rise: 14, blur: 8 }) : drawWords(g, [{ text: lab, x: 540 - lw / 2, w: lw }], 600, 30, tau, 0.1, { dur: 0.4, color: T.pri });
        const sp = PREM ? sstep(tau - bt(1), SPR.snap) : spring(tau - bt(1), 13, 0.42), O = V.big;
        if (sp > 0.01) {
          g.save(); g.translate(540, 960); g.rotate(PREM ? 0 : -0.06 * Math.min(1, sp)); const sc = PREM ? lerp(0.85, 1, Math.min(1, sp)) : sp; g.scale(sc, sc); g.globalAlpha *= clamp(sp * 1.5);
          const w = 820, h = Math.max(340, O.lines.length * O.size * 1.02 + 150);
          g.fillStyle = T.pri; g.beginPath(); g.moveTo(-w / 2 + 100, -h / 2); g.lineTo(w / 2 - 34, -h / 2); g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 34); g.lineTo(w / 2, h / 2 - 34); g.quadraticCurveTo(w / 2, h / 2, w / 2 - 34, h / 2); g.lineTo(-w / 2 + 100, h / 2); g.lineTo(-w / 2, 0); g.closePath(); g.fill();
          g.fillStyle = T.bg; g.beginPath(); g.arc(-w / 2 + 76, 0, 22, 0, Math.PI * 2); g.fill();
          setFont(g, F.head, O.size, F.hw, O.ls); g.fillStyle = T.onPri; g.textAlign = 'center';
          const lh = O.size * 1.02, y0 = -((O.lines.length - 1) * lh) / 2 + O.size * F.cap * 0.5;
          O.lines.forEach((l, i) => g.fillText(l, 44 - O.ls / 2, y0 + i * lh)); g.textAlign = 'left';
          g.restore();
          if (!PREM) for (let k = 0; k < 40; k++) { const d = tau - bt(1); if (d < 0 || d > 1.2) break; const a = hash(k * 1.3 + 7) * Math.PI * 2, v = 500 + hash(k * 2.9 + 3) * 700, x = 540 + Math.cos(a) * v * d, y = 960 + Math.sin(a) * v * d + 900 * d * d; g.globalAlpha = 1 - d / 1.2; g.fillStyle = [T.sec, T.pri, T.text][k % 3]; g.save(); g.translate(x, y); g.rotate(d * 10 + k); g.fillRect(-6, -3, 12, 6); g.restore(); }
          g.globalAlpha = 1;
        }
        const cs = PREM ? sstep(tau - bt(4), SPR.glide) : spring(tau - bt(4), 16, 0.5);
        if (cs > 0.01) {
          const cw = V.ctaW, chh = 96, cy = 1360;
          g.save(); g.globalAlpha *= clamp(cs * 1.5); pivot(g, 540, cy, lerp(0.85, 1, Math.min(1, cs)));
          rr(g, 540 - cw / 2, cy - chh / 2, cw, chh, chh / 2); g.fillStyle = T.panel; g.fill(); g.lineWidth = 2.5; g.strokeStyle = T.pri; g.stroke();
          setFont(g, MONO, V.cf.size, 700, 1); g.fillStyle = T.text; g.fillText(V.cf.lines[0] || '', 540 - cw / 2 + 44, cy + V.cf.size * 0.34);
          icon(g, 'arrow', 540 + cw / 2 - 52, cy, 32, T.pri, 2.6); g.restore();
        }
      } else {
        const b = V.b, s0 = PREM ? sstep(tau - 0.05, SPR.glide) : spring(tau - 0.05, 14, 0.5);
        if (s0 > 0.01) {
          g.save(); g.globalAlpha *= clamp(s0 * 1.5); pivot(g, 540, 800, lerp(0.6, 1, Math.min(1.05, s0)));
          g.fillStyle = T.panel2; g.beginPath(); g.arc(540, 800, 200, 0, Math.PI * 2); g.fill();
          g.lineWidth = PREM ? 2.5 : 4; g.strokeStyle = rgba(T.pri, 0.9); g.beginPath(); g.arc(540, 800, 200, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp((tau - 0.1) / 0.7)); g.stroke();
          iconDraw(g, b.icon, 540, 800, 190, T.pri, 1.9, clamp((tau - 0.2) / 0.8));
          g.restore();
          if (!PREM && tau > 0.2 && tau < 1.2) { const k = (tau - 0.2) / 1.0, ring = new Path2D(); ring.arc(540, 800, 200 + 160 * EO(k), 0, Math.PI * 2); glowStroke(g, ring, T.pri, 5, 1 - k, T.priCore); }
        }
        setFont(g, F.head, V.f.size, F.hw, V.f.ls);
        V.lines.forEach((ws, i) => (PREM ? pWords(g, ws, V.ys[i], tau, bt(2) + i * 0.1, { stagger: 0.07 }) : drawWords(g, ws, V.ys[i], V.f.size, tau, bt(2) + i * 0.1, { stagger: 0.05, color: i === V.lines.length - 1 && V.lines.length > 1 ? T.pri : T.text })));
        V.rest.forEach((rb, i) => {
          const n = V.rest.length, x = 540 + (i - (n - 1) / 2) * 190, u = PREM ? sstep(tau - (bt(5) + i * 0.08), SPR.glide) : spring(tau - (bt(5) + i * 0.08), 16, 0.5);
          if (u <= 0.01) return;
          g.save(); g.globalAlpha *= clamp(u * 1.5); pivot(g, x, 1480, lerp(0.6, 1, Math.min(1, u)));
          rr(g, x - 72, 1408, 144, 144, 36); g.fillStyle = T.panel2; g.fill(); g.lineWidth = 2; g.strokeStyle = T.border; g.stroke();
          icon(g, rb.icon, x, 1480, 64, T.muted, 2); g.restore();
        });
      }
    }

    function drawPunch(g, tau) {
      const P = S.c30.punch;
      setFont(g, F.head, P.f.size, F.hw, P.f.ls);
      P.lines.forEach((l, li) => l.words.forEach((w, wi) => {
        const accent = P.single ? li === 0 && wi === l.words.length - 1 : li === P.accentLine && P.lines.length > 1;
        const col = accent ? T.pri : T.text, at = l.times[wi];
        if (PREM) { pText(g, w.text, w.x, l.y, tau, at, { color: col }); return; }
        const st = slamState(tau, at + 0.11); if (!st) return;
        g.save(); pivot(g, w.x + w.w / 2, l.y - P.f.size * F.cap * 0.5, lerp(1, st.s, 0.7));
        if (st.d >= 0 && st.d < 0.2) { const k = Math.exp(-st.d * 16) * 0.55; g.globalAlpha = k; g.fillStyle = T.pri; g.fillText(w.text, w.x - 8, l.y); g.fillStyle = T.sec; g.fillText(w.text, w.x + 8, l.y); }
        g.globalAlpha = st.a; g.fillStyle = col; g.fillText(w.text, w.x, l.y); g.restore();
      }));
      // sublinhado que se desenha embaixo da linha de destaque
      const al = P.lines[P.single ? 0 : P.accentLine], ws = al.words, x0 = P.single ? ws[ws.length - 1].x : ws[0].x, x1 = ws[ws.length - 1].x + ws[ws.length - 1].w;
      const u = clamp((tau - (P.lastT + 0.3)) / 0.5); if (u <= 0) return;
      const path = new Path2D(), y = al.y + P.f.size * 0.2; path.moveTo(x0, y); path.lineTo(lerp(x0, x1, PREM ? LAND(u) : EO(u)), y);
      if (PREM) { g.save(); g.lineWidth = 5; g.lineCap = 'round'; g.strokeStyle = T.pri; g.stroke(path); g.restore(); } else glowStroke(g, path, T.pri, 7, 1, T.priCore);
    }

    // ── direção: Dinâmico (chicotes horizontais e verticais, como no vídeo de 15 s)
    const CH_D = [
      { c: 7.5, axis: 'x', draw: drawShow }, { c: 11.25, axis: 'x', draw: drawSteps },
      { c: 18.75, axis: 'y', draw: drawVoice }, { c: 22.5, axis: 'y', draw: drawPunch },
    ];
    function drawChapterD(ctx, T_, ch) {
      if (T_ < ch.c - 0.2 || T_ > ch.c + CHLEN + 0.2) return;
      const wi = whipAt(ch.c, T_), wo = whipAt(ch.c + CHLEN, T_), d = 1 - wi - wo;
      const k = inv(ch.c, ch.c + CHLEN, T_), cam = { s: 1 + 0.03 * k, px: 540, py: 960, r: 0, dx: 6 * Math.sin(T_ * 0.8), dy: 8 * Math.sin(T_ * 0.6 + 1) };
      ctx.save(); useCam(ctx, cam, ch.axis === 'x' ? d * 1180 : 0, ch.axis === 'y' ? d * 1300 : 0);
      ch.draw(ctx, T_ - ch.c);
      ctx.restore();
    }
    function drawDust30(ctx, T_) {
      const we = WX30(T_), wb = WY30(T_), old = T_ >= 1.875 && T_ < 5.7;
      for (const p of S.dust) {
        let x = (p.x + p.vx * T_ - we * 1180 * p.z) % W; if (x < 0) x += W;
        let y = (p.y + p.vy * T_ - wb * 900 * p.z) % H; if (y < 0) y += H;
        const s = p.r * (0.55 + p.z * 0.6);
        ctx.globalAlpha = p.a * (old ? 0.35 : 1);
        ctx.drawImage(old ? S.spr.grey : S.spr[p.c], x - s * 2, y - s * 2, s * 4, s * 4);
      }
      ctx.globalAlpha = 1;
    }
    let IMP30 = [], FLASH30 = [];
    function shake30(t) { let x = 0, y = 0; for (const [ti, a] of IMP30) { const d = t - ti; if (d < 0 || d > 0.55) continue; const e = a * Math.exp(-d * 10); x += e * noise1(d * 34 + ti * 10); y += e * noise1(d * 34 + ti * 10 + 50); } return { x, y }; }
    function flashes30(ctx, t) { for (const [ti, a, c] of FLASH30) { const d = t - ti; if (d < 0 || d > 0.22) continue; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(c, a * Math.exp(-d * 20)); ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; } }
    function drawWorld30D(ctx, t) {
      if (t < 7.5) drawBG(ctx, t); else { ctx.drawImage(S.bgBrand, 0, 0); bgDots(ctx, -560 * WX30(t), -t * 7 - 700 * WY30(t), 0.07); }
      const sh = shake30(t); ctx.save(); ctx.translate(sh.x, sh.y);
      drawDust30(ctx, t);
      if (t < 7.75) { sceneHook(ctx, t); scenePain(ctx, t); sceneReveal(ctx, t); }
      CH_D.forEach((ch) => drawChapterD(ctx, t, ch));
      const e2 = t - 7.5; if (e2 > 7.28 && e2 < 11.5) { sceneBenefits(ctx, e2); sceneProof(ctx, e2); }
      const e3 = t - 15; if (e3 > 11.0) { sceneContact(ctx, e3); sceneLogo(ctx, e3); sceneHook(ctx, e3); }
      ctx.restore();
      flashes30(ctx, t);
    }

    // ── direção: Premium (mundo com as cenas lado a lado; câmera com mola pesada leva de uma cena à outra)
    // capítulos em (1180,0) e (2360,0); vantagens e prova em x+2360; depoimento em (3540,1300), frase em (3540,2600);
    // contato e logo em (3540,3900)
    const CH_P = [
      { c: 7.5, wx: 1180, wy: 0, draw: drawShow }, { c: 11.25, wx: 2360, wy: 0, draw: drawSteps },
      { c: 18.75, wx: 3540, wy: 1300, draw: drawVoice }, { c: 22.5, wx: 3540, wy: 2600, draw: drawPunch },
    ];
    const PCX30 = [[0, 0], [7.3, 1180], [11.05, 2360], [14.8, 3540]], PCY30 = [[0, 0], [18.52, 1300], [22.27, 2600], [26.02, 3900]];
    const PZ30 = [[0, 0], [0, Math.log(1.035)], [1.875, 0], [3.75, Math.log(1.025)], [5.625, Math.log(0.99)], [6.3, Math.log(1.03)], [7.3, 0], [9.2, Math.log(1.02)], [11.05, 0], [13.1, Math.log(1.02)],
      [14.8, 0], [16.7, Math.log(1.03)], [18.52, 0], [20.4, Math.log(1.02)], [22.27, 0], [24.3, Math.log(1.03)], [26.02, 0], [28.125, Math.log(1.04)]];
    function pCam30(t) { return { x: strack(t, PCX30, SPR.heavy), y: strack(t, PCY30, SPR.heavy), z: Math.exp(strack(t, PZ30, SPR.soft)) }; }
    function drawWorld30P(ctx, t) {
      ctx.drawImage(S.bgPrem, 0, 0);
      const w = (2 * Math.PI) / 30, lx = 540 + 260 * Math.sin(w * t + 0.6), ly = 760 + 180 * Math.cos(w * t);
      ctx.save(); ctx.globalAlpha = 0.07; ctx.drawImage(S.glowPrem, lx - 900, ly - 900, 1800, 1800); ctx.restore();
      const cam = pCam30(t);
      if (t < 8.5) { pHook(ctx, t, cam); pPain(ctx, t, cam); pReveal(ctx, t, cam); }
      for (const ch of CH_P) {
        if (t < ch.c - 0.35 || t > ch.c + CHLEN + 1.1) continue;
        ctx.save(); pUse(ctx, cam, ch.wx, ch.wy); ch.draw(ctx, t - ch.c); ctx.restore();
      }
      const e2 = t - 7.5; if (e2 > 7.2 && e2 < 12.45) { WO.x = 2360; WO.y = 0; pBenefits(ctx, e2, cam); pProof(ctx, e2, cam); WO.x = 0; }
      const e3 = t - 15; if (e3 > 10.9) { WO.x = 2360; WO.y = 2600; pContact(ctx, e3, cam); pLogo(ctx, e3, cam); WO.x = 0; WO.y = 0; }
    }

    // amostras de desfoque de movimento: as janelas rápidas do vídeo de 15 s, no lugar novo, mais as viradas dos capítulos
    function fast30(list, prem) {
      const out = [];
      for (const [a, b, n] of list) {
        if (a < 7.5) out.push([a, b, n]);
        if (b > 7.3 && a < 11.25) out.push([a + 7.5, b + 7.5, n]);
        if (b > 11.0) out.push([a + 15, b + 15, n]);
      }
      if (prem) out.push([10.95, 11.7, 10], [18.4, 19.2, 10], [22.2, 22.95, 10], [25.95, 26.7, 10], [7.55, 8.6, 8]);
      else { for (const c of [7.5, 11.25, 15, 18.75, 22.5, 26.25]) out.push([c - 0.26, c + 0.26, 24]); out.push([7.55, 8.7, 12], [11.6, 13.9, 10], [22.55, 24.4, 12]); }
      return out;
    }
    let FAST30 = null;
    function prep30Timeline() {
      const C = S.c30;
      IMP30 = [
        ...IMPACTS.filter(([t]) => t < 7.5), ...IMPACTS.filter(([t]) => t >= 7.5 && t < 11.25).map(([t, a]) => [t + 7.5, a]), ...IMPACTS.filter(([t]) => t >= 11.25).map(([t, a]) => [t + 15, a]),
        [7.5 + bt(4), 5], [11.25 + bt(5), 3], ...C.punch.lines.flatMap((l) => l.times.map((tt) => [22.5 + tt + 0.11, 2.5])), [22.5 + C.punch.lastT + 0.11, 8],
      ];
      const FL = FLASHES();
      FLASH30 = [
        ...FL.filter(([t]) => t < 7.5), ...FL.filter(([t]) => t >= 7.5 && t < 11.25).map(([t, a, c]) => [t + 7.5, a, c]), ...FL.filter(([t]) => t >= 11.25).map(([t, a, c]) => [t + 15, a, c]),
        [7.5 + bt(4), 0.07, T.pri], [22.5 + C.punch.lastT + 0.11, 0.12, T.pri],
      ];
      if (C.voiceKind === 'offer') { IMP30.push([18.75 + bt(1), 9]); FLASH30.push([18.75 + bt(1), 0.14, T.pri]); }
      FAST30 = fast30(PREM ? FAST_P : FAST, PREM);
    }
    // eventos que a trilha de 30 s precisa (tempos locais de cada capítulo)
    function events30() {
      const C = S.c30, sh = C.show;
      return {
        show: { lands: sh.hero.pieces.map((p) => 0.1 + p.rank * sh.step + (PREM ? 0.28 : 0.2)).sort((a, b) => a - b), tap: bt(4), tap2: !sh.extras.length && sh.co2 ? bt(6) : null, fan: sh.extras.length ? bt(5) : null },
        steps: { t: C.steps.t.slice(), confirm: bt(6.5) },
        voice: { kind: C.voiceKind, words: C.voiceKind === 'quote' ? C.voice.times.flat() : [], author: C.voiceKind === 'quote' && C.voice.author ? C.voice.authorT : null, n: C.voiceKind === 'spot' ? C.voice.rest.length : 0 },
        punch: { words: C.punch.lines.flatMap((l) => l.times), last: C.punch.lastT },
      };
    }

    // ══════════════════════════════ world + frame pipeline
    function drawWorld(ctx, t) {
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
      if (D30) { if (PREM) drawWorld30P(ctx, t); else drawWorld30D(ctx, t); return; }
      if (PREM) { drawWorldPremium(ctx, t); return; }
      drawBG(ctx, t);
      const sh = shake(t); ctx.save(); ctx.translate(sh.x, sh.y);
      drawDust(ctx, t);
      sceneHook(ctx, t); scenePain(ctx, t); sceneReveal(ctx, t); sceneBenefits(ctx, t); sceneProof(ctx, t); sceneContact(ctx, t); sceneLogo(ctx, t);
      ctx.restore();
      drawFlashes(ctx, t);
    }
    const FAST = [[-1, 0.3, 14], [0.33, 0.8, 12], [0.84, 1.05, 14], [1.86, 2.45, 14], [3.95, 4.55, 12], [5.6, 6.22, 14], [7.26, 7.76, 24], [7.4, 8.5, 10], [9.1, 9.7, 12], [11.0, 11.5, 24], [11.4, 11.9, 12], [12.62, 13.45, 18], [14.68, 16, 16]];
    const FAST_P = [[5.6, 6.1, 10], [7.25, 8.0, 10], [9.15, 9.6, 8], [10.95, 11.7, 10], [12.7, 13.35, 8]];
    function samplesFor(t, base = 7) { let n = base; for (const [a, b, k] of D30 ? FAST30 : PREM ? FAST_P : FAST) if (t >= a && t <= b) n = Math.max(n, k); return n; }
    let buf = null;
    function buffers(w, h) {
      if (buf && buf.w === w && buf.h === h) return buf;
      const sc = mk(w, h), ac = mk(w, h), bw = Math.max(2, Math.round(w / 4)), bh = Math.max(2, Math.round(h / 4));
      buf = { w, h, sc, sx: sc.getContext('2d'), ac, ax: ac.getContext('2d'), b1: mk(bw, bh), b1b: mk(bw, bh), b2: mk(Math.max(2, bw >> 1), Math.max(2, bh >> 1)) };
      buf.b1x = buf.b1.getContext('2d'); buf.b1bx = buf.b1b.getContext('2d'); buf.b2x = buf.b2.getContext('2d');
      return buf;
    }
    // render frame at time t into target (any size with 9:16 aspect); samples: motion-blur subsamples; fps: shutter base
    function renderFrame(target, t, o = {}) {
      const w = target.width, h = target.height, k = w / W, B = buffers(w, h), fps = o.fps || 60;
      const N = o.samples ?? samplesFor(t, o.baseSamples ?? 7);
      FT = t;
      for (let i = 0; i < N; i++) {
        const ts = N === 1 ? t : t + ((i + 0.5) / N - 0.5) * (0.5 / fps);
        B.sx.setTransform(k, 0, 0, k, 0, 0); drawWorld(B.sx, ts);
        B.ax.globalAlpha = 1 / (i + 1); B.ax.drawImage(B.sc, 0, 0);
      }
      B.ax.globalAlpha = 1;
      const out = target.getContext('2d');
      out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1; out.filter = 'none';
      out.drawImage(B.ac, 0, 0);
      if (o.post !== false && CAN_FILTER && !PREM) {
        B.b1x.filter = 'brightness(0.82) contrast(2.5) saturate(1.4)'; B.b1x.drawImage(B.ac, 0, 0, B.b1.width, B.b1.height); B.b1x.filter = 'none';
        B.b1bx.filter = `blur(${Math.max(1, 3 * (B.b1.width / 270)).toFixed(1)}px)`; B.b1bx.clearRect(0, 0, B.b1.width, B.b1.height); B.b1bx.drawImage(B.b1, 0, 0); B.b1bx.filter = 'none';
        B.b2x.filter = `blur(${Math.max(1, 5 * (B.b2.width / 135)).toFixed(1)}px)`; B.b2x.clearRect(0, 0, B.b2.width, B.b2.height); B.b2x.drawImage(B.b1, 0, 0, B.b2.width, B.b2.height); B.b2x.filter = 'none';
        out.imageSmoothingQuality = 'high'; out.globalCompositeOperation = 'screen';
        out.globalAlpha = 0.34; out.drawImage(B.b1b, 0, 0, w, h); out.globalAlpha = 0.42; out.drawImage(B.b2, 0, 0, w, h);
        out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
      }
      if (o.post !== false) {
        // premium: sem bloom, vinheta e grão mais leves (o grão evita faixas no degradê depois da compressão)
        out.globalAlpha = PREM ? 0.55 : 1; out.drawImage(S.vignette, 0, 0, w, h); out.globalAlpha = 1;
        const fi = Math.round(t * 60), g = S.grain[fi % 3];
        out.globalCompositeOperation = 'overlay'; out.globalAlpha = PREM ? 0.14 : 0.26; out.drawImage(g, -hash(fi * 1.7) * 60 * k, -hash(fi * 3.3) * 60 * k, 1140 * k, 2027 * k);
        out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
      }
      out.setTransform(k, 0, 0, k, 0, 0); drawWatermark(out); out.setTransform(1, 0, 0, 1, 0, 0);
    }

    prep();
    // cenas para a linha do tempo e o storyboard do editor: [chave, início, fim, instante da miniatura] no tempo do motor
    const SC15 = [['hook', 0, 1.875, 0.95], ['pain', 1.875, 3.75, 3.2], ['search', 3.75, 5.625, 5.2], ['reveal', 5.625, 7.5, 6.9], ['benefits', 7.5, 9.375, 8.95], [variant6, 9.375, 11.25, 10.8], ['contact', 11.25, 13.125, 12.5], ['logo', 13.125, 15, 14.3]];
    const scenes = (D30 ? [...SC15.slice(0, 4), ['showcase', 7.5, 11.25, 9.5], ['steps', 11.25, 15, 14.35], ['benefits', 15, 16.875, 16.45], [variant6, 16.875, 18.75, 18.3], [S.c30.voiceKind, 18.75, 22.5, 21.95], ['punch', 22.5, 26.25, 25.4], ['contact', 26.25, 28.125, 27.5], ['logo', 28.125, 30, 29.3]] : SC15)
      .map(([key, t0, t1, thumb]) => ({ key, t0, t1, thumb }));
    return { spec, theme: T, events: S.events, renderFrame, drawWorld, samplesFor, W, H, DUR: D30 ? 30 : 15, scenes };
  }

  return { create, makeTheme, normalize, FONTS, SEGMENT_ICON };
})();
if (typeof module !== 'undefined') module.exports = Pulso;
