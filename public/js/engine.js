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
      benefits: ['Atendimento próximo', 'Feito com cuidado', 'Fale com a gente'], custLabel: 'clientes atendidos', search: 'Pesquisar…', rating: (src) => (src ? `Nota no ${src}` : 'Nota'), made: 'Feito com Pulso' },
    en: { loc: 'en-US', brand: 'Your Business', hook: ['YOUR BRAND', 'IN MOTION'], pain: 'Tired of being overlooked?', why: (n) => `Why ${n}?`, cta: 'Get in touch',
      benefits: ['Friendly service', 'Made with care', 'Message us'], custLabel: 'happy customers', search: 'Search…', rating: (src) => (src ? `Rated on ${src}` : 'Rating'), made: 'Made with Pulso' },
    es: { loc: 'es', brand: 'Tu Empresa', hook: ['TU MARCA', 'EN MOVIMIENTO'], pain: '¿Cansado de pasar desapercibido?', why: (n) => `¿Por qué ${n}?`, cta: 'Escríbenos',
      benefits: ['Atención cercana', 'Hecho con cuidado', 'Escríbenos'], custLabel: 'clientes atendidos', search: 'Buscar…', rating: (src) => (src ? `Nota en ${src}` : 'Calificación'), made: 'Hecho con Pulso' },
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
    };
    if (!s.script.hook.length) s.script.hook = [L.hook[0]];
    if (!s.script.benefits.length) s.script.benefits = [{ text: L.benefits[0], icon: 'people' }, { text: L.benefits[1], icon: 'heart' }, { text: L.benefits[2], icon: 'chat' }];
    s.proof = { rating: '', ratingSource: '', customers: '', customersLabel: L.custLabel, ...(s.proof || {}) };
    s.contact = { whatsapp: '', instagram: '', site: '', address: '', ...(s.contact || {}) };
    return s;
  }

  function create(specIn, images = {}) {
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

    // ── layout constants
    const PH = { cx: 540, cy: 758, w: 530, h: 940, r: 72 };
    PH.x = PH.cx - PH.w / 2; PH.y = PH.cy - PH.h / 2;
    const SCR = { x: PH.x + 12, y: PH.y + 12, w: PH.w - 24, h: PH.h - 24, r: 60 };
    const BARR = { cx: 540, cy: 1226, w: 860, h: 112 };
    const NODE_T = [7.73, 7.965, 8.2, 8.435];
    const CARD = { x: 110, y: 540, w: 860, h: 760 };

    function hasProof() { return !!(String(spec.proof.rating).trim() || String(spec.proof.customers).trim()); }
    const variant6 = hasProof() ? 'proof' : SC.offer ? 'offer' : 'statement';

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
        S.stmt = fit(ctx, SC.tagline || SC.product, F.head, F.hw, 860, 132, 60, 3, F.hls);
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
      const sh = mk(PH.w + 240, PH.h + 240), sx = sh.getContext('2d');
      sx.shadowColor = 'rgba(0,0,0,0.75)'; sx.shadowBlur = 80; sx.fillStyle = 'rgba(0,0,0,0.75)'; sx.beginPath(); sx.roundRect(120, 120, PH.w, PH.h, PH.r); sx.fill();
      S.phoneShadow = sh;
      S.events = {
        typeT: S.typeT.slice(), typeChars: S.query.text, variant: variant6, benefitsN: SC.benefits.length, nodeT: NODE_T.slice(0, SC.benefits.length),
        contactRows: S.contact.rows.length, hasOffer: !!SC.offer, mood: spec.style.mood, cards: S.cards.filter((c) => c.extra).map((c) => c.appear),
        style: PREM ? 'premium' : 'dinamico', clicks: PREM ? [4.36, 5.625, 14.25] : [],
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
    function pUse(ctx, cam, wx = 0, wy = 0) { ctx.translate(540, 960); ctx.scale(cam.z, cam.z); ctx.translate(-540 + wx - cam.x, -960 + wy - cam.y); }

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

    // ══════════════════════════════ world + frame pipeline
    function drawWorld(ctx, t) {
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
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
    function samplesFor(t, base = 7) { let n = base; for (const [a, b, k] of PREM ? FAST_P : FAST) if (t >= a && t <= b) n = Math.max(n, k); return n; }
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
    return { spec, theme: T, events: S.events, renderFrame, drawWorld, samplesFor, W, H, DUR: 15 };
  }

  return { create, makeTheme, normalize, FONTS, SEGMENT_ICON };
})();
if (typeof module !== 'undefined') module.exports = Pulso;
