'use strict';
// ─── Pulso Studio · kit: fontes, paletas, texto animado, fundos, formas, molduras de foto, logo, transições e pós ───
// Peças reaproveitadas por todas as cenas do motor criativo (studio_scenes.js) e montadas por studio.js.
const SK = (() => {
  const U = PU;
  const { W, H, clamp, lerp, inv, smooth, EO, EI, EIO, spring, hash, rng, noise1, rgba, mixc, hex, rgb2hsl, hsl2rgb, toHex, contrast, mk, tw } = U;
  const TAU = Math.PI * 2;

  // ══════════════════════════════ fontes
  // as da casa (Bricolage, Big Shoulders, Gloock, Instrument Sans, IBM Plex Mono) já vêm do CSS da página
  const FONT_FILES = [
    ['Anton', 'Anton-Regular.woff', '400'], ['Archivo Black', 'ArchivoBlack-Regular.woff', '400'], ['Bungee', 'Bungee-Regular.woff', '400'],
    ['Caveat', 'Caveat-Bold.woff', '700'], ['Cinzel', 'Cinzel-Bold.woff', '700'], ['DM Serif Display', 'DMSerifDisplay-Regular.woff', '400', 'normal'],
    ['DM Serif Display', 'DMSerifDisplay-Italic.woff', '400', 'italic'], ['Fraunces', 'Fraunces-Black.woff', '900'], ['Fredoka', 'Fredoka-Bold.woff', '700'],
    ['Pacifico', 'Pacifico-Regular.woff', '400'], ['Righteous', 'Righteous-Regular.ttf', '400'], ['Space Grotesk', 'SpaceGrotesk-Bold.woff', '700'],
    ['Syne', 'Syne-ExtraBold.woff', '800'], ['Unbounded', 'Unbounded-ExtraBold.woff', '800'],
  ];
  const HOUSE = ["800 40px 'Bricolage Grotesque'", "800 40px 'Big Shoulders Display'", "400 40px 'Gloock'", "400 40px 'Instrument Sans'", "700 40px 'Instrument Sans'", "400 40px 'IBM Plex Mono'", "700 40px 'IBM Plex Mono'"];
  const FACES = [...HOUSE, ...FONT_FILES.map(([f, , w, s]) => `${s === 'italic' ? 'italic ' : ''}${w} 40px '${f}'`)];
  let fontsP = null;
  function loadFonts(base = '/fonts/') {
    if (fontsP) return fontsP;
    if (typeof document === 'undefined' || !document.fonts) return (fontsP = Promise.resolve());
    const own = typeof FontFace === 'undefined' ? [] : FONT_FILES.map(([fam, file, weight, style]) => {
      const ff = new FontFace(fam, `url(${base}${file})`, { weight, style: style || 'normal' });
      document.fonts.add(ff);
      return ff.load().catch(() => null);
    });
    fontsP = Promise.all([...own, ...HOUSE.map((f) => document.fonts.load(f).catch(() => null))]).then(() => undefined);
    return fontsP;
  }

  // sistemas de tipografia: letra dos títulos, peso, espaçamento (em), caixa alta, entrelinha
  const TYPES = {
    grotesk: { head: "'Bricolage Grotesque'", w: 800, ls: -0.03, upper: true, lh: 0.98 },
    condensed: { head: "'Anton'", w: 400, ls: 0.006, upper: true, lh: 1.0 },
    shoulders: { head: "'Big Shoulders Display'", w: 800, ls: 0.01, upper: true, lh: 0.98 },
    heavy: { head: "'Archivo Black'", w: 400, ls: -0.035, upper: true, lh: 1.02 },
    wide: { head: "'Unbounded'", w: 800, ls: -0.04, upper: true, lh: 1.06, listBody: true },
    syne: { head: "'Syne'", w: 800, ls: -0.02, upper: true, lh: 1.02, listBody: true, capsOnly: true },
    serif: { head: "'DM Serif Display'", w: 400, ls: -0.015, upper: false, lh: 1.04, italic: true },
    gloock: { head: "'Gloock'", w: 400, ls: -0.012, upper: false, lh: 1.06 },
    soft: { head: "'Fraunces'", w: 900, ls: -0.025, upper: false, lh: 1.0 },
    round: { head: "'Fredoka'", w: 700, ls: -0.01, upper: false, lh: 1.02 },
    classic: { head: "'Cinzel'", w: 700, ls: 0.03, upper: true, lh: 1.12, listBody: true },
    retro: { head: "'Righteous'", w: 400, ls: -0.005, upper: false, lh: 1.04 },
    sign: { head: "'Bungee'", w: 400, ls: 0, upper: true, lh: 1.1, listBody: true },
  };
  const BODY = "'Instrument Sans'", MONO = "'IBM Plex Mono'", LABEL = "'Space Grotesk'", HAND = "'Caveat'", SCRIPT = "'Pacifico'";

  function font(ctx, fam, size, weight = 700, lsPx = 0, italic = false) {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}, sans-serif`;
    ctx.letterSpacing = `${lsPx}px`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }
  const capCache = new Map();
  // altura das maiúsculas e profundidade das descendentes, em fração do tamanho da letra (medidas reais da fonte)
  function metrics(ctx, fam, w, italic) {
    const k = `${fam}|${w}|${italic ? 1 : 0}`;
    if (capCache.has(k)) return capCache.get(k);
    font(ctx, fam, 200, w, 0, italic);
    const a = ctx.measureText('HÉXÇ'), b = ctx.measureText('HX'), d = ctx.measureText('gjpy');
    const m = { cap: (b.actualBoundingBoxAscent || 140) / 200, acc: (a.actualBoundingBoxAscent || 160) / 200, desc: (d.actualBoundingBoxDescent || 40) / 200 };
    capCache.set(k, m);
    return m;
  }

  // sombra na escala do desenho (o canvas não aplica a transformação ao desfoque nem ao deslocamento da sombra)
  function shadow(ctx, color, blur = 0, ox = 0, oy = 0) {
    const m = ctx.getTransform(), k = Math.hypot(m.a, m.b) || 1;
    ctx.shadowColor = color; ctx.shadowBlur = blur * k; ctx.shadowOffsetX = ox * k; ctx.shadowOffsetY = oy * k;
  }
  function noShadow(ctx) { ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

  // ══════════════════════════════ cores
  function hsl(c) { return rgb2hsl(Array.isArray(c) ? c : hex(c)); }
  const H2 = (h, s, l) => toHex(hsl2rgb(h, s, l));
  // escurece ou clareia `c` até ter contraste mínimo com `bg`
  function ensure(c, bg, min) {
    const b = hex(bg); let x = hex(c);
    if (contrast(x, b) >= min) return toHex(x);
    const { h, s, l } = hsl(x), darker = U.lum(b) > 0.35;
    for (let i = 1; i <= 24; i++) {
      const l2 = darker ? l - i * 3.5 : l + i * 3.5;
      x = hsl2rgb(h, s, clamp(l2, 0, 100));
      if (contrast(x, b) >= min) return toHex(x);
    }
    return darker ? '#0B0B0F' : '#FFFFFF';
  }
  const onColor = (bg, ink = '#111014', paper = '#FFFFFF') => (contrast(hex(paper), hex(bg)) >= contrast(hex(ink), hex(bg)) * 0.82 ? paper : ink);

  // paleta de base tirada das duas cores da marca
  function palette(primary, secondary) {
    const P = hsl(primary), S0 = hsl(secondary || primary);
    const neutral = P.s < 10;
    const hue = neutral ? (S0.s >= 10 ? S0.h : 250) : P.h;
    const pri = neutral ? H2(hue, S0.s >= 10 ? clamp(S0.s, 55, 90) : 70, 58) : H2(P.h, clamp(P.s, 52, 92), clamp(P.l, 46, 62));
    // destaque neutro ou quase igual à principal: cria uma cor companheira (tom vizinho)
    const same = Math.abs(((S0.h - P.h + 540) % 360) - 180) < 14 && Math.abs(S0.l - P.l) < 10 && Math.abs(S0.s - P.s) < 18;
    const S = S0.s < 10 || same ? { h: (hue + 42) % 360, s: 80, l: 60 } : S0;
    const sec = H2(S.h, clamp(S.s, 52, 95), clamp(S.l, 50, 68));
    const ph = hsl(pri);
    return {
      hue, pri, sec,
      ink: H2(hue, 26, 7.5), ink2: H2(hue, 20, 13), paper: H2(hue, 38, 96.5), cream: H2(38, 52, 93.5), white: '#FFFFFF',
      priSoft: H2(ph.h, clamp(ph.s, 45, 85), 88), secSoft: H2(hsl(sec).h, clamp(hsl(sec).s, 45, 85), 88),
      priDeep: H2(ph.h, clamp(ph.s, 40, 80), 24), priDark: H2(ph.h, clamp(ph.s, 40, 85), 36),
      night: H2(hue, 40, 5.5),
    };
  }
  // superfícies: fundo, texto, destaque, destaque 2, texto apagado, cartão e texto do cartão (sempre com contraste)
  function surface(pal, kind) {
    const mk_ = (bg, fg, acc, acc2, card, cardFg, extra = {}) => {
      const lightBg = U.lum(hex(bg)) > 0.4;
      fg = ensure(fg, bg, 4.6); acc = ensure(acc, bg, lightBg ? 3 : 2.6); acc2 = ensure(acc2, bg, 2.2);
      cardFg = ensure(cardFg, card, 4.6);
      return { kind, bg, fg, acc, acc2, card, cardFg, mute: toHex(mixc(hex(fg), hex(bg), 0.42)), line: toHex(mixc(hex(fg), hex(bg), 0.78)), onAcc: onColor(acc, pal.ink), light: U.lum(hex(bg)) > 0.4, ...extra };
    };
    switch (kind) {
      case 'dark': return mk_(pal.ink, pal.paper, pal.pri, pal.sec, pal.ink2, pal.paper);
      case 'night': return mk_(pal.night, '#F4F1FA', pal.pri, pal.sec, '#15131C', '#F4F1FA');
      case 'light': return mk_(pal.paper, pal.ink, pal.pri, pal.sec, '#FFFFFF', pal.ink);
      case 'cream': return mk_(pal.cream, '#17130F', pal.priDark, pal.pri, '#FFFDF8', '#17130F');
      case 'pastel': return mk_(pal.priSoft, pal.ink, pal.priDark, pal.sec, '#FFFFFF', pal.ink);
      case 'pastel2': return mk_(pal.secSoft, pal.ink, pal.priDark, pal.pri, '#FFFFFF', pal.ink);
      case 'vivid': case 'vivid2': {
        // fundo na cor da marca: botão e cartão em tinta escura ou papel (o que tiver mais contraste), detalhe na outra cor da marca
        const bg = kind === 'vivid' ? pal.pri : pal.sec, other = kind === 'vivid' ? pal.sec : pal.pri, B = hex(bg);
        const fg = onColor(bg, pal.ink), inkOk = contrast(hex(pal.ink), B) >= 3.2;
        const acc = inkOk ? pal.ink : '#FFFFFF', card = contrast(hex(pal.paper), B) >= 1.5 ? pal.paper : pal.ink;
        const acc2 = contrast(hex(other), B) >= 1.6 ? other : inkOk ? pal.paper : pal.ink;
        return mk_(bg, fg, acc, acc2, card, card === pal.ink ? pal.paper : pal.ink);
      }
      case 'deep': return mk_(pal.priDeep, pal.paper, pal.sec, pal.priSoft, pal.paper, pal.ink);
      default: return mk_(pal.ink, pal.paper, pal.pri, pal.sec, pal.ink2, pal.paper);
    }
  }

  // ══════════════════════════════ texto
  // bloco de texto: cabe em maxW, até maxLines linhas, no maior tamanho entre minS e maxS
  // nunca corta o texto do cliente: se não couber, tenta mais uma linha, letra menor e, por fim, a letra do texto corrido
  const BODY_TY = { head: "'Instrument Sans'", w: 700, ls: -0.01, upper: false, lh: 1.12 };
  function block(ctx, text, ty, o = {}) {
    let b = block1(ctx, text, ty, o);
    if (!b.cut || o.strict) return b;
    const ml = o.maxLines || 2, ms = o.minS || 44;
    for (const [extra, k] of [[1, 1], [1, 0.82], [2, 0.7]]) { b = block1(ctx, text, ty, { ...o, maxLines: ml + extra, minS: Math.round(ms * k) }); if (!b.cut) return b; }
    return block1(ctx, text, BODY_TY, { ...o, fam: undefined, w: undefined, ls: undefined, italic: false, upper: false, lh: 1.12, maxLines: ml + 3, minS: Math.round(ms * 0.62) });
  }
  function block1(ctx, text, ty, o = {}) {
    // letras que só ficam boas em maiúsculas: frase em minúsculas vai na grotesca da casa
    if (ty.capsOnly && o.upper === false && !o.fam) ty = TYPES.grotesk;
    const upper = o.upper ?? ty.upper, loc = o.loc || 'pt-BR';
    let txt = String(text || '').replace(/[ \t\r\n]+/g, ' ').trim();
    if (upper) txt = txt.toLocaleUpperCase(loc);
    const fam = o.fam || ty.head, w = o.w || ty.w, italic = o.italic ?? false, lsEm = o.ls ?? ty.ls;
    const weight = `${italic ? 'italic ' : ''}${w}`;
    const f = U.fit(ctx, txt, `${fam}, sans-serif`, weight, o.maxW || 880, o.maxS || 160, o.minS || 44, o.maxLines || 2, lsEm);
    const m = metrics(ctx, fam, w, italic);
    font(ctx, fam, f.size, w, f.ls, italic);
    const lines = f.lines.map((l) => { const words = U.layoutWords(ctx, l, 0, 'left'); return { text: l, words, width: words.total }; });
    const lh = f.size * (o.lh ?? ty.lh ?? 1.02);
    const b = { txt, size: f.size, ls: f.ls, fam, w, italic, lines, lh, cap: m.cap * f.size, desc: m.desc * f.size, n: lines.length, width: Math.max(0, ...lines.map((l) => l.width)) };
    b.cut = f.lines.join(' ').replace(/[ \t]+/g, ' ').length < txt.length || f.lines.some((l) => l.endsWith('…') && !txt.endsWith('…'));
    b.height = b.cap + (b.n - 1) * lh;
    let k = 0; lines.forEach((l) => l.words.forEach((wd) => { wd.i = k++; }));
    b.count = k;
    return b;
  }
  // posiciona o bloco: x/align da linha, y do centro (valign 'mid'), do topo ('top') ou da base da última linha ('bot')
  function place(b, x, y, align = 'center', valign = 'mid') {
    const top = valign === 'top' ? y : valign === 'bot' ? y - b.height : y - b.height / 2;
    b.lines.forEach((l, i) => {
      l.y = top + b.cap + i * b.lh;
      l.x0 = align === 'center' ? x - l.width / 2 : align === 'right' ? x - l.width : x;
      l.words.forEach((wd) => { wd.ax = l.x0 + wd.x; wd.ay = l.y; });
    });
    b.top = top; b.bot = top + b.height; b.x = x; b.align = align;
    b.left = Math.min(...b.lines.map((l) => l.x0)); b.right = Math.max(...b.lines.map((l) => l.x0 + l.width));
    return b;
  }
  const words = (b) => b.lines.flatMap((l) => l.words);
  // palavra de destaque: a pedida, ou a mais longa (sem artigos e preposições curtas)
  function emphIndex(b, want) {
    const ws = words(b);
    if (!ws.length) return -1;
    if (want) { const w2 = String(want).toLocaleLowerCase(); const i = ws.findIndex((w) => w.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === w2.replace(/[^\p{L}\p{N}]/gu, '')); if (i >= 0) return i; }
    let best = ws.length - 1, bl = -1;
    ws.forEach((w, i) => { const L = w.text.replace(/[^\p{L}\p{N}]/gu, '').length + (i === ws.length - 1 ? 1.5 : 0); if (L > bl) { bl = L; best = i; } });
    return best;
  }

  const bounceOut = (x) => { const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375; };
  const backOut = (x, s = 1.7) => { x = clamp(x); const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };

  // desenha o bloco com animação de entrada por palavra (e saída opcional)
  // a = { t0, stagger, dur, fx, color, emph: { i, style, color, at }, exit: { t, dur, fx }, shadow: { x, y, color }, stroke: { color, w } }
  function drawText(ctx, b, t, a = {}) {
    const fx = a.fx || 'rise', t0 = a.t0 || 0, st = a.stagger ?? 0.07, dur = a.dur ?? 0.5, col = a.color || '#fff';
    const em = a.emph || null;
    font(ctx, b.fam, b.size, b.w, b.ls, b.italic);
    const all = words(b);
    if (fx === 'type') return drawTyped(ctx, b, t, a);
    for (const wd of all) {
      const ws = t0 + wd.i * st, tt = t - ws, p = clamp(tt / dur);
      if (tt < 0 && fx !== 'none') continue;
      let q = 0;
      if (a.exit) { const et = a.exit.t + wd.i * (a.exit.stagger ?? 0.02); q = clamp((t - et) / (a.exit.dur || 0.3)); if (q >= 1) continue; }
      let dx = 0, dy = 0, sx = 1, sy = 1, alpha = 1, rot = 0, clip = false;
      const cx = wd.ax + wd.w / 2, cy = wd.ay - b.cap / 2;
      switch (fx) {
        case 'rise': dy = (1 - EO(p)) * b.size * 1.15; clip = true; break;
        case 'pop': { const s = spring(tt, 19, 0.42); sx = sy = Math.max(0.001, s); alpha = clamp(tt / 0.06); break; }
        case 'slide': { const dir = wd.i % 2 ? 1 : -1; dx = (1 - EO(p)) * 220 * dir; alpha = clamp(p * 2.5); break; }
        case 'slideL': dx = (1 - EO(p)) * -260; alpha = clamp(p * 2.5); break;
        case 'drop': dy = -(1 - bounceOut(p)) * 300; alpha = clamp(p * 5); break;
        case 'fade': alpha = EO(p); dy = (1 - EO(p)) * b.size * 0.22; break;
        case 'flip': sy = Math.max(0.001, backOut(p, 2.2)); alpha = clamp(p * 4); break;
        case 'stamp': { const k = clamp(tt / 0.13); sx = sy = k < 1 ? lerp(2.1, 1, k * k * k) : 1 + 0.05 * Math.exp(-(tt - 0.13) * 14) * Math.cos((tt - 0.13) * 40); alpha = clamp(tt / 0.05); break; }
        case 'zoom': sx = sy = lerp(1.7, 1, EO(p)); alpha = EO(p); break;
        case 'skew': dx = (1 - EO(p)) * 300; rot = 0; alpha = clamp(p * 3); break;
        case 'wave': case 'glitch': case 'none': break;
        default: dy = (1 - EO(p)) * b.size; clip = true;
      }
      if (q > 0) {
        const e = EI(q), ef = a.exit.fx || 'fade';
        if (ef === 'up') { dy -= e * b.size * 1.2; clip = true; } else if (ef === 'down') { dy += e * b.size * 1.2; clip = true; } else if (ef === 'left') dx -= e * 600; else if (ef === 'scale') { sx *= 1 - e; sy *= 1 - e; } else alpha *= 1 - e;
      }
      if (alpha <= 0.001) continue;
      ctx.save();
      if (clip) { ctx.beginPath(); ctx.rect(wd.ax - b.size * 0.4, wd.ay - b.cap - b.size * 0.42, wd.w + b.size * 0.8, b.cap + b.size * 0.42 + b.desc + b.size * 0.08); ctx.clip(); }
      ctx.globalAlpha *= alpha;
      if (sx !== 1 || sy !== 1 || rot) { ctx.translate(cx + dx, (fx === 'flip' ? wd.ay : cy) + dy); if (rot) ctx.rotate(rot); ctx.scale(sx, sy); ctx.translate(-cx, -(fx === 'flip' ? wd.ay : cy)); } else ctx.translate(dx, dy);
      const isEm = em && em.i === wd.i;
      const emP = isEm ? clamp((t - (ws + (em.at ?? dur * 0.6))) / (em.dur || 0.42)) : 0;
      let fill = col;
      if (isEm) fill = emBefore(ctx, b, wd, emP, em, col);
      if (a.shadow && !a.shadow.blur) { ctx.fillStyle = a.shadow.color; ctx.fillText(wd.text, wd.ax + a.shadow.x, wd.ay + a.shadow.y); }
      if (a.shadow && a.shadow.blur) shadow(ctx, a.shadow.color, a.shadow.blur * (b.size / 140), a.shadow.x || 0, a.shadow.y || 0);
      if (fx === 'wave') drawWave(ctx, wd, tt, b, fill);
      else if (fx === 'glitch') drawGlitch(ctx, wd, tt, b, fill, a);
      else {
        if (a.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = a.stroke.color; ctx.lineWidth = a.stroke.w; ctx.strokeText(wd.text, wd.ax, wd.ay); }
        if (!a.outline) { ctx.fillStyle = fill; ctx.fillText(wd.text, wd.ax, wd.ay); }
      }
      if (isEm) emAfter(ctx, b, wd, emP, em);
      ctx.restore();
    }
  }
  function emBefore(ctx, b, wd, p, em, col) {
    const st = em.style, c = em.color || '#FFD23F';
    const x = wd.ax - b.size * 0.08, y = wd.ay - b.cap - b.size * 0.1, w = wd.w + b.size * 0.16, h = b.cap + b.size * 0.2;
    if (st === 'marker' && p > 0) { ctx.save(); ctx.fillStyle = c; ctx.globalAlpha *= 0.95; const e = EO(p); ctx.beginPath(); ctx.moveTo(x, y + h * 0.18); ctx.lineTo(x + w * e, y + h * 0.1); ctx.lineTo(x + w * e, y + h * 1.02); ctx.lineTo(x, y + h * 0.96); ctx.closePath(); ctx.fill(); ctx.restore(); return p > 0.5 ? (em.on || col) : col; }
    if (st === 'box' && p > 0) { ctx.save(); ctx.fillStyle = c; const e = EO(p); U.rr(ctx, x - b.size * 0.06, y - b.size * 0.04, (w + b.size * 0.12) * e, h + b.size * 0.08, b.size * 0.12); ctx.fill(); ctx.restore(); return p > 0.35 ? (em.on || col) : col; }
    if (st === 'color') return p > 0 ? mixHex(col, c, EO(p)) : col;
    return col;
  }
  function emAfter(ctx, b, wd, p, em) {
    if (p <= 0) return;
    const st = em.style, c = em.color || '#FFD23F';
    ctx.save(); ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (st === 'underline') {
      ctx.lineWidth = Math.max(5, b.size * 0.085); const y = wd.ay + b.size * 0.13, e = EO(p);
      ctx.beginPath(); ctx.moveTo(wd.ax - 6, y + 4); for (let i = 1; i <= 16; i++) { const u = (i / 16) * e; ctx.lineTo(wd.ax - 6 + (wd.w + 12) * u, y + Math.sin(u * 9) * b.size * 0.018 - u * b.size * 0.03); } ctx.stroke();
    } else if (st === 'circle') {
      ctx.lineWidth = Math.max(4, b.size * 0.055); const cx = wd.ax + wd.w / 2, cy = wd.ay - b.cap / 2, rx = wd.w / 2 + b.size * 0.3, ry = b.cap / 2 + b.size * 0.3, e = EO(p);
      ctx.beginPath(); const a0 = -2.2; for (let i = 0; i <= 48; i++) { const u = (i / 48) * e * 1.12, a = a0 + u * TAU, r = 1 + 0.05 * Math.sin(u * 13) + u * 0.06; const px = cx + Math.cos(a) * rx * r, py = cy + Math.sin(a) * ry * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    } else if (st === 'strike') {
      ctx.lineWidth = Math.max(6, b.size * 0.09); const y = wd.ay - b.cap * 0.42, e = EO(p);
      ctx.beginPath(); ctx.moveTo(wd.ax - 10, y + 6); ctx.lineTo(wd.ax - 10 + (wd.w + 20) * e, y - 6 * e); ctx.stroke();
    }
    ctx.restore();
  }
  function mixHex(a, b2, t) { return toHex(mixc(hex(a), hex(b2), clamp(t))); }
  function drawWave(ctx, wd, tt, b, fill) {
    ctx.fillStyle = fill; let x = wd.ax;
    for (let i = 0; i < wd.text.length; i++) {
      const ch = wd.text[i], lt = tt - i * 0.035, p = clamp(lt / 0.42);
      const dy = (1 - backOut(p, 2.6)) * b.size * 0.9 + Math.sin(lt * 9) * b.size * 0.04 * Math.exp(-Math.max(0, lt) * 3);
      ctx.save(); ctx.globalAlpha *= clamp(p * 4); ctx.fillText(ch, x, wd.ay + dy); ctx.restore();
      x += tw(ctx, ch);
    }
  }
  function drawGlitch(ctx, wd, tt, b, fill, a) {
    const on = tt < 0.32, k = Math.floor(tt * 40);
    if (tt < 0) return;
    if (on) {
      const j = (hash(k * 3.1 + wd.i) - 0.5) * b.size * 0.4 * (1 - tt / 0.32), vis = hash(k * 7.7 + wd.i * 2) > 0.22;
      if (!vis) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.8;
      ctx.fillStyle = a.glitchA || '#FF2E88'; ctx.fillText(wd.text, wd.ax + j - 7, wd.ay);
      ctx.fillStyle = a.glitchB || '#22E6FF'; ctx.fillText(wd.text, wd.ax + j + 7, wd.ay);
      ctx.restore();
      ctx.fillStyle = fill; ctx.fillText(wd.text, wd.ax + j, wd.ay);
    } else { ctx.fillStyle = fill; ctx.fillText(wd.text, wd.ax, wd.ay); }
  }
  // máquina de escrever: letras aparecem uma a uma, com cursor
  function drawTyped(ctx, b, t, a) {
    const t0 = a.t0 || 0, cps = a.cps || 22, total = b.lines.reduce((s, l) => s + l.text.length, 0);
    const n = Math.floor(clamp((t - t0) * cps, 0, total));
    let left = n, cx = null, cy = null;
    ctx.fillStyle = a.color || '#fff';
    for (const l of b.lines) {
      if (left <= 0) break;
      const s = l.text.slice(0, left); ctx.fillText(s, l.x0, l.y); cx = l.x0 + tw(ctx, s); cy = l.y; left -= l.text.length;
    }
    if (cx == null) { cx = b.lines[0] ? b.lines[0].x0 : 0; cy = b.lines[0] ? b.lines[0].y : 0; }
    const blink = n >= total ? (Math.floor((t - t0 - total / cps) * 2.4) % 2 === 0) : true;
    if (a.cursor !== false && blink && t >= t0 - 0.2) { ctx.fillStyle = a.cursorColor || a.color || '#fff'; ctx.fillRect(cx + 6, cy - b.cap * 1.05, Math.max(4, b.size * 0.07), b.cap * 1.2); }
    return n / Math.max(1, total);
  }

  // texto simples de uma linha (rótulos, contatos), com entrada opcional
  function label(ctx, text, x, y, o = {}) {
    const size = o.size || 34, fam = o.fam || LABEL, w = o.w || 700;
    font(ctx, fam, size, w, (o.ls ?? 0.08) * size);
    const s = o.upper === false ? String(text) : String(text).toLocaleUpperCase(o.loc || 'pt-BR');
    const tw_ = tw(ctx, s), x0 = o.align === 'center' ? x - tw_ / 2 : o.align === 'right' ? x - tw_ : x;
    const p = o.t == null ? 1 : clamp((o.t - (o.t0 || 0)) / (o.dur || 0.4));
    if (p <= 0) return tw_;
    ctx.save(); ctx.globalAlpha *= EO(p); ctx.fillStyle = o.color || '#fff'; ctx.fillText(s, x0 + (1 - EO(p)) * (o.dx ?? 0), y + (1 - EO(p)) * (o.dy ?? 18)); ctx.restore();
    return tw_;
  }
  // pílula com texto (etiquetas, selos)
  function pill(ctx, text, cx, cy, o = {}) {
    const size = o.size || 32, fam = o.fam || LABEL;
    font(ctx, fam, size, o.w || 700, (o.ls ?? 0.06) * size);
    const s = o.upper === false ? String(text) : String(text).toLocaleUpperCase(o.loc || 'pt-BR');
    const tw_ = tw(ctx, s), padX = size * 0.75, h = size * 1.9, w = tw_ + padX * 2;
    const sc = o.scale ?? 1;
    if (sc <= 0.001) return { w, h };
    ctx.save(); ctx.translate(cx, cy); if (o.rot) ctx.rotate(o.rot); ctx.scale(sc, sc);
    if (o.shadow) { ctx.fillStyle = o.shadow; U.rr(ctx, -w / 2 + 8, -h / 2 + 9, w, h, o.r ?? h / 2); ctx.fill(); }
    ctx.fillStyle = o.bg || '#fff'; U.rr(ctx, -w / 2, -h / 2, w, h, o.r ?? h / 2); ctx.fill();
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = o.bw || 4; ctx.stroke(); }
    ctx.fillStyle = o.color || '#111'; ctx.fillText(s, -tw_ / 2, size * 0.36);
    ctx.restore();
    return { w, h };
  }

  // ══════════════════════════════ formas
  function star4(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.closePath(); }
  function starN(ctx, x, y, r1, r2, n, rot = 0) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n - Math.PI / 2, r = i % 2 ? r2 : r1; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }
  // bolha orgânica: raio com ruído suave, animado por t
  function blobPath(ctx, cx, cy, r, t, seed = 1, amp = 0.12, n = 48) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, k = 1 + amp * (0.6 * Math.sin(a * 2 + t * 0.9 + seed) + 0.4 * Math.sin(a * 3 - t * 1.3 + seed * 2.1) + 0.25 * Math.sin(a * 5 + t * 0.7 + seed * 0.7));
      const px = cx + Math.cos(a) * r * k, py = cy + Math.sin(a) * r * k;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function squiggle(ctx, x, y, len, amp, waves, lw, color, p = 1, ang = 0) {
    if (p <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); const n = 40;
    for (let i = 0; i <= n * p; i++) { const u = i / n; const px = u * len, py = Math.sin(u * waves * TAU) * amp; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke(); ctx.restore();
  }
  function arrowHand(ctx, x0, y0, x1, y1, color, lw, p = 1, bend = 0.3) {
    if (p <= 0) return;
    const mx = (x0 + x1) / 2 + (y1 - y0) * bend, my = (y0 + y1) / 2 - (x1 - x0) * bend;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); const n = 30; let lx = x0, ly = y0, px = x0, py = y0;
    for (let i = 0; i <= n * p; i++) { const u = i / n; lx = px; ly = py; px = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1; py = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    if (p > 0.92) { const a = Math.atan2(py - ly, px - lx), L = lw * 4.2; ctx.beginPath(); ctx.moveTo(px - Math.cos(a - 0.5) * L, py - Math.sin(a - 0.5) * L); ctx.lineTo(px, py); ctx.lineTo(px - Math.cos(a + 0.5) * L, py - Math.sin(a + 0.5) * L); ctx.stroke(); }
    ctx.restore();
  }

  // ══════════════════════════════ fundos
  const bgCache = new Map();
  function gradCanvas(key, draw) { if (bgCache.has(key)) return bgCache.get(key); const c = mk(W, H), x = c.getContext('2d'); draw(x); bgCache.set(key, c); if (bgCache.size > 60) bgCache.delete(bgCache.keys().next().value); return c; }
  const soft = (x, cx, cy, r, color, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(0.6, rgba(color, a * 0.35)); g.addColorStop(1, rgba(color, 0)); x.fillStyle = g; x.fillRect(0, 0, W, H); };
  let patCache = new Map();
  function tile(key, w, h, draw) { if (patCache.has(key)) return patCache.get(key); const c = mk(w, h); draw(c.getContext('2d'), w, h); patCache.set(key, c); if (patCache.size > 80) patCache.delete(patCache.keys().next().value); return c; }
  function patFill(ctx, tileC, ox, oy, alpha = 1, rot = 0) {
    const p = ctx.createPattern(tileC, 'repeat');
    const tw_ = tileC.width, th = tileC.height;
    p.setTransform(new DOMMatrix().rotate(rot * 180 / Math.PI).translate(((ox % tw_) + tw_) % tw_, ((oy % th) + th) % th));
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = p; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
  }
  // bg = { kind, s: superfície, seed, a: intensidade }
  function drawBG(ctx, bg, t) {
    const s = bg.s, k = bg.kind, seed = bg.seed || 1, r = rng(seed * 7 + 3);
    ctx.fillStyle = s.bg; ctx.fillRect(-60, -60, W + 120, H + 120);
    switch (k) {
      case 'glow': ctx.drawImage(gradCanvas(`glow|${s.bg}|${s.acc}|${s.acc2}|${seed % 4}`, (x) => { const q = seed % 4; soft(x, q % 2 ? W * 0.1 : W * 0.95, q < 2 ? -80 : H * 0.2, 1350, s.acc, s.light ? 0.2 : 0.24); soft(x, q % 2 ? W : 0, H + 60, 1200, s.acc2, s.light ? 0.16 : 0.13); }), 0, 0); break;
      case 'mesh': {
        // manchas de luz nas bordas (o miolo fica limpo para o texto)
        const cols = [s.acc, s.acc2, s.acc], spots = [[0, 0.04], [1, 0.34], [0, 0.66], [1, 0.98]], o = seed % 4;
        for (let i = 0; i < 3; i++) {
          const spr = gradCanvas(`blob|${cols[i]}|${s.light ? 1 : 0}`, (x) => soft(x, W / 2, H / 2, 820, cols[i], s.light ? 0.26 : 0.26));
          const [ax, ay] = spots[(o + i) % 4], cx = W * ax + Math.sin(t * 0.35 + i * 2) * 80, cy = H * ay + Math.cos(t * 0.3 + i) * 110;
          ctx.drawImage(spr, cx - W / 2, cy - H / 2);
        }
        break;
      }
      case 'paper': {
        const noiseT = tile(`paper|${s.light ? 1 : 0}`, 256, 256, (x, w, h) => { const im = x.createImageData(w, h), rr_ = rng(99); for (let i = 0; i < im.data.length; i += 4) { const v = rr_() < 0.5 ? 0 : 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = rr_() * 14; } x.putImageData(im, 0, 0); });
        patFill(ctx, noiseT, 0, 0, 1);
        break;
      }
      case 'dots': { const d = tile(`dots|${s.line}`, 64, 64, (x) => { x.fillStyle = s.line; x.beginPath(); x.arc(16, 16, 5, 0, TAU); x.arc(48, 48, 5, 0, TAU); x.fill(); }); patFill(ctx, d, t * 22, t * 22, s.light ? 0.55 : 0.45); break; }
      case 'grid': { const g = tile(`grid|${s.line}`, 90, 90, (x) => { x.strokeStyle = s.line; x.lineWidth = 2; x.beginPath(); x.moveTo(0.5, 0); x.lineTo(0.5, 90); x.moveTo(0, 0.5); x.lineTo(90, 0.5); x.stroke(); }); patFill(ctx, g, 0, t * 30, s.light ? 0.65 : 0.5); break; }
      case 'stripes': { const g = tile(`str|${s.acc}`, 80, 80, (x) => { x.fillStyle = s.acc; x.beginPath(); x.moveTo(0, 0); x.lineTo(40, 0); x.lineTo(0, 40); x.closePath(); x.fill(); x.beginPath(); x.moveTo(80, 0); x.lineTo(80, 40); x.lineTo(40, 80); x.lineTo(0, 80); x.closePath(); x.fill(); }); patFill(ctx, g, t * 40, 0, bg.a ?? 0.12); break; }
      case 'halftone': ctx.drawImage(gradCanvas(`half|${s.bg}|${s.acc}|${seed % 2}`, (x) => { x.fillStyle = s.acc; const step = 30; for (let y = 0; y < H + step; y += step) for (let xx = 0; xx < W + step; xx += step) { const u = seed % 2 ? (y / H - 0.7) / 0.3 : (0.2 - y / H) / 0.2, rad = step * 0.5 * Math.pow(clamp(u), 1.3); if (rad > 0.6) { x.beginPath(); x.arc(xx + ((y / step) % 2) * step / 2, y, rad, 0, TAU); x.fill(); } } }), 0, 0); break;
      case 'sunset': ctx.drawImage(gradCanvas(`sun|${s.bg}|${s.acc}|${s.acc2}`, (x) => {
        const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, s.bg); g.addColorStop(0.55, toHex(mixc(hex(s.acc2), hex(s.bg), 0.55))); g.addColorStop(1, toHex(mixc(hex(s.acc), hex(s.bg), 0.35))); x.fillStyle = g; x.fillRect(0, 0, W, H);
        const sy = H * 0.9; x.fillStyle = rgba(s.acc2, 0.62); x.beginPath(); x.arc(W / 2, sy, 460, Math.PI, 0); x.fill();
        x.fillStyle = toHex(mixc(hex(s.acc2), hex(s.bg), 0.62)); for (let i = 0; i < 5; i++) { const y = sy - 36 - i * 58; x.fillRect(0, y, W, 12 + i * 3); }
      }), 0, 0); break;
      case 'neongrid': {
        ctx.drawImage(gradCanvas(`ng|${s.bg}|${s.acc}`, (x) => { soft(x, W / 2, H * 0.62, 900, s.acc, 0.28); }), 0, 0);
        const hy = H * 0.66; ctx.save(); ctx.strokeStyle = rgba(s.acc, 0.3); ctx.lineWidth = 3;
        for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 26, hy); ctx.lineTo(W / 2 + i * 260, H + 40); ctx.stroke(); }
        for (let j = 0; j < 12; j++) { const u = ((j + (t * 1.4) % 1) / 12), y = hy + Math.pow(u, 2.2) * (H - hy + 60); ctx.globalAlpha = 0.15 + 0.85 * u; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.restore(); break;
      }
      case 'rays': {
        ctx.save(); ctx.translate(W / 2, bg.cy || H * 0.46); ctx.rotate(t * 0.12 + seed); ctx.fillStyle = rgba(s.acc, bg.a ?? 0.12);
        for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1800, (i / 16) * TAU, (i / 16) * TAU + TAU / 32); ctx.closePath(); ctx.fill(); }
        ctx.restore(); break;
      }
      case 'blobs': {
        for (let i = 0; i < 3; i++) {
          const side = (i + seed) % 2 ? 1 : 0, col = i === 1 ? s.acc2 : s.acc, cx = W * (side ? 0.92 + 0.1 * hash(seed + i * 4.1) : -0.02 + 0.1 * hash(seed + i * 4.1)), cy = H * [0.08, 0.5, 0.95][i] + (hash(seed + i * 9.3) - 0.5) * 200, rad = 230 + 150 * hash(seed + i);
          ctx.save(); ctx.globalAlpha = s.light ? 0.28 : 0.22; ctx.fillStyle = col; blobPath(ctx, cx + Math.sin(t * 0.5 + i) * 40, cy + Math.cos(t * 0.4 + i) * 50, rad, t, seed + i, 0.16); ctx.fill(); ctx.restore();
        }
        break;
      }
      case 'split': { ctx.save(); ctx.fillStyle = s.acc; ctx.globalAlpha = bg.a ?? 1; ctx.beginPath(); const y0 = H * (0.56 + 0.1 * hash(seed)), sl = 260 * (seed % 2 ? 1 : -1); ctx.moveTo(-40, y0 + sl); ctx.lineTo(W + 40, y0 - sl); ctx.lineTo(W + 40, H + 60); ctx.lineTo(-40, H + 60); ctx.closePath(); ctx.fill(); ctx.restore(); break; }
      case 'frame': { ctx.save(); ctx.strokeStyle = s.line; ctx.lineWidth = 3; ctx.strokeRect(54, 54, W - 108, H - 108); ctx.restore(); break; }
      default: break;
    }
    void r;
  }

  // ══════════════════════════════ imagens: reduzidas uma vez, desenhadas com recorte e zoom lento
  const imgCache = new WeakMap();
  function scaled(img, max = 1500) {
    if (!img) return null;
    if (imgCache.has(img)) return imgCache.get(img);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(iw, ih));
    const c = mk(iw * k, ih * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    imgCache.set(img, c); return c;
  }
  function cover(ctx, img, x, y, w, h, zoom = 1, px = 0.5, py = 0.5) {
    const iw = img.width, ih = img.height, k = Math.max(w / iw, h / ih) * zoom, dw = iw * k, dh = ih * k;
    ctx.drawImage(img, x + (w - dw) * px, y + (h - dh) * py, dw, dh);
  }
  function contain(ctx, img, cx, cy, w, h) { const iw = img.width, ih = img.height, k = Math.min(w / iw, h / ih); ctx.drawImage(img, cx - (iw * k) / 2, cy - (ih * k) / 2, iw * k, ih * k); }

  // arte da marca para quando não há foto: gradiente, textura e o logo ou o ícone do segmento
  function artCard(key, w, h, s, logo, iconName, seed = 1) {
    return tile(`art|${key}|${w}|${h}|${s.acc}|${s.acc2}|${!!logo}|${iconName}|${seed}`, w, h, (x) => {
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, s.acc); g.addColorStop(1, toHex(mixc(hex(s.acc), hex(s.acc2), 0.55))); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.10)'; for (let yy = 22; yy < h; yy += 42) for (let xx = 22 + ((yy / 42) % 2) * 21; xx < w; xx += 42) { x.beginPath(); x.arc(xx, yy, 3.2, 0, TAU); x.fill(); }
      const R = Math.min(w, h) * 0.3;
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.arc(w / 2, h / 2, R * 1.32, 0, TAU); x.fill();
      if (logo) { x.save(); x.shadowColor = 'rgba(0,0,0,0.2)'; x.shadowBlur = 30; x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(w / 2, h / 2, R, 0, TAU); x.fill(); x.restore(); x.save(); x.beginPath(); x.arc(w / 2, h / 2, R, 0, TAU); x.clip(); contain(x, logo, w / 2, h / 2, R * 1.42, R * 1.42); x.restore(); }
      else U.icon(x, iconName || 'sparkle', w / 2, h / 2, R * 1.35, onColor(s.acc) === '#FFFFFF' ? '#FFFFFF' : s.onAcc, 1.7);
    });
  }

  // moldura de foto. box = { cx, cy, w, h, rot }, o = { kind, t, zoom, px, py, border, shadow, radius, accent, hard }
  function photo(ctx, img, box, o = {}) {
    const k = o.kind || 'card', w = box.w, h = box.h, r = o.radius ?? 28;
    ctx.save(); ctx.translate(box.cx, box.cy); if (box.rot) ctx.rotate(box.rot); if (box.s && box.s !== 1) ctx.scale(box.s, box.s);
    const x = -w / 2, y = -h / 2, z = o.zoom ?? 1.06;
    const path = () => {
      ctx.beginPath();
      if (k === 'circle') ctx.arc(0, 0, Math.min(w, h) / 2, 0, TAU);
      else if (k === 'arch') { ctx.moveTo(x, y + w / 2); ctx.arc(0, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
      else if (k === 'blob') blobPath(ctx, 0, 0, Math.min(w, h) / 2, o.t || 0, o.seed || 1, 0.09);
      else if (k === 'full') ctx.rect(x, y, w, h);
      else ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    };
    if (k === 'polaroid') {
      const pad = w * 0.06, bot = h * 0.16;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; U.rr(ctx, x - pad + 10, y - pad + 18, w + pad * 2, h + pad + bot, 8); ctx.fill();
      ctx.fillStyle = '#FFFEFA'; U.rr(ctx, x - pad, y - pad, w + pad * 2, h + pad + bot, 8); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); img ? cover(ctx, img, x, y, w, h, z, o.px ?? 0.5, o.py ?? 0.5) : null; ctx.restore();
      if (o.caption) { font(ctx, HAND, bot * 0.5, 700); ctx.fillStyle = '#2A2A30'; const cw = tw(ctx, o.caption); ctx.fillText(o.caption, -cw / 2, y + h + bot * 0.62); }
      if (o.tape) { ctx.fillStyle = rgba(o.tape, 0.75); ctx.save(); ctx.translate(0, y - pad - 4); ctx.rotate(-0.06); ctx.fillRect(-w * 0.18, -22, w * 0.36, 44); ctx.restore(); }
      ctx.restore(); return;
    }
    if (o.shadow === 'hard') { ctx.save(); ctx.translate(o.hx ?? 22, o.hy ?? 22); ctx.fillStyle = o.accent || '#111'; path(); ctx.fill(); ctx.restore(); }
    else if (o.shadow !== false) { ctx.save(); shadow(ctx, o.shadowColor || 'rgba(0,0,0,0.35)', 60, 0, 26); ctx.fillStyle = '#000'; path(); ctx.fill(); ctx.restore(); }
    ctx.save(); path(); ctx.clip();
    if (img) cover(ctx, img, x, y, w, h, z, o.px ?? 0.5, o.py ?? 0.5); else { ctx.fillStyle = '#888'; ctx.fillRect(x, y, w, h); }
    if (o.tint) { ctx.fillStyle = o.tint; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = o.bw || 8; path(); ctx.stroke(); }
    if (o.glow) { ctx.save(); shadow(ctx, o.glow, 40); ctx.strokeStyle = o.glow; ctx.lineWidth = 6; path(); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 0.8; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; path(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }

  // logo: imagem do cliente num selo claro, ou monograma na cor de destaque
  function logo(ctx, img, cx, cy, size, o = {}) {
    const shape = o.shape || 'circle', s = o.s || { acc: '#7c5cff', onAcc: '#fff' };
    const path = () => { ctx.beginPath(); if (shape === 'square') ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.24); else ctx.arc(cx, cy, size / 2, 0, TAU); };
    if (img) {
      ctx.save(); if (o.shadow !== false) shadow(ctx, 'rgba(0,0,0,0.25)', size * 0.18, 0, size * 0.05);
      ctx.fillStyle = o.plate || '#FFFFFF'; path(); ctx.fill(); ctx.restore();
      ctx.save(); path(); ctx.clip(); contain(ctx, img, cx, cy, size * 0.74, size * 0.74); ctx.restore();
    } else {
      ctx.fillStyle = s.acc; path(); ctx.fill();
      const ch = (o.name || 'P').trim().charAt(0).toLocaleUpperCase(o.loc || 'pt-BR') || 'P';
      const ty = o.ty || TYPES.grotesk, m = metrics(ctx, ty.head, ty.w, false);
      font(ctx, ty.head, size * 0.56, ty.w, 0); ctx.fillStyle = s.onAcc; const cw = tw(ctx, ch); ctx.fillText(ch, cx - cw / 2, cy + (m.cap * size * 0.56) / 2);
    }
    if (o.ring) { ctx.save(); ctx.strokeStyle = o.ring; ctx.lineWidth = size * 0.035; ctx.beginPath(); ctx.arc(cx, cy, size * 0.62, 0, TAU); ctx.stroke(); ctx.restore(); }
  }

  // ══════════════════════════════ transições (p de 0 a 1; drawA / drawB desenham as cenas)
  // alguns tipos compõem com transparência e precisam das cenas em camadas separadas (buf)
  function transition(ctx, kind, p, drawA, drawB, o) {
    const e = EIO(p), c = o.color || '#FFFFFF', dir = o.dir || 1;
    switch (kind) {
      case 'cut': { (p < 0.5 ? drawA : drawB)(ctx); const f = p >= 0.5 ? Math.exp(-(p - 0.5) * 14) : 0; if (f > 0.01) { ctx.save(); ctx.globalAlpha = 0.5 * f; ctx.fillStyle = o.flash || c; ctx.fillRect(0, 0, W, H); ctx.restore(); } return; }
      case 'push': case 'whip': {
        const ee = kind === 'whip' ? U.expoInOut(p) : e, vert = o.vert;
        ctx.save(); vert ? ctx.translate(0, -ee * H * dir) : ctx.translate(-ee * W * dir, 0); drawA(ctx); ctx.restore();
        ctx.save(); vert ? ctx.translate(0, (1 - ee) * H * dir) : ctx.translate((1 - ee) * W * dir, 0); drawB(ctx); ctx.restore(); return;
      }
      case 'slideover': { drawA(ctx); ctx.save(); ctx.translate(0, (1 - U.cubicOut(p)) * H); shadow(ctx, 'rgba(0,0,0,0.4)', 80); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); noShadow(ctx); drawB(ctx); ctx.restore(); return; }
      case 'iris': case 'blob': {
        drawA(ctx);
        const ox = o.x ?? W / 2, oy = o.y ?? H / 2, R = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy)) * 1.08 * EIO(p);
        if (R < 1) return;
        ctx.save(); if (kind === 'blob') blobPath(ctx, ox, oy, R, p * 6, o.seed || 1, 0.14); else { ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); } ctx.clip(); drawB(ctx); ctx.restore();
        if (o.ring && p < 0.98) { ctx.save(); ctx.strokeStyle = o.ring; ctx.lineWidth = 26 * (1 - p) + 4; if (kind === 'blob') blobPath(ctx, ox, oy, R, p * 6, o.seed || 1, 0.14); else { ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); } ctx.stroke(); ctx.restore(); }
        return;
      }
      case 'wipe': {
        // faixa colorida em diagonal que atravessa a tela e troca a cena por trás dela
        const sl = 420, band = 260, pos = lerp(-sl - band, W + sl + band, EIO(p)) * 1;
        const edge = (xx) => { ctx.beginPath(); ctx.moveTo(xx - sl, H + 40); ctx.lineTo(xx + sl, -40); ctx.lineTo(W + sl * 2 + 400, -40); ctx.lineTo(W + sl * 2 + 400, H + 40); ctx.closePath(); };
        ctx.save(); if (dir < 0) { ctx.translate(W, 0); ctx.scale(-1, 1); }
        ctx.save(); edge(pos + band); ctx.clip(); if (dir < 0) { ctx.translate(W, 0); ctx.scale(-1, 1); } drawA(ctx); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.moveTo(-40 - sl * 2, H + 40); ctx.lineTo(pos - sl, H + 40); ctx.lineTo(pos + sl, -40); ctx.lineTo(-40 - sl * 2, -40); ctx.closePath(); ctx.clip(); if (dir < 0) { ctx.translate(W, 0); ctx.scale(-1, 1); } drawB(ctx); ctx.restore();
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pos - sl, H + 40); ctx.lineTo(pos + sl, -40); ctx.lineTo(pos + sl + band, -40); ctx.lineTo(pos - sl + band, H + 40); ctx.closePath(); ctx.fill();
        if (o.color2) { ctx.fillStyle = o.color2; ctx.beginPath(); ctx.moveTo(pos - sl + band, H + 40); ctx.lineTo(pos + sl + band, -40); ctx.lineTo(pos + sl + band + 40, -40); ctx.lineTo(pos - sl + band + 40, H + 40); ctx.closePath(); ctx.fill(); }
        ctx.restore(); return;
      }
      case 'stripes': case 'shutter': {
        const n = kind === 'shutter' ? 2 : (o.n || 6), cover_ = p < 0.5, q = cover_ ? EIO(p * 2) : EIO((p - 0.5) * 2);
        (cover_ ? drawA : drawB)(ctx);
        ctx.save(); ctx.fillStyle = c;
        for (let i = 0; i < n; i++) {
          const d = (i / n) * 0.35, qq = clamp((q - d) / (1 - 0.35));
          const amt = cover_ ? EIO(qq) : 1 - EIO(qq);
          if (kind === 'shutter') { const hh = (H / 2) * amt; if (i === 0) ctx.fillRect(0, 0, W, hh); else ctx.fillRect(0, H - hh, W, hh); }
          else { const bw = W / n, hh = H * amt; if (o.vert) ctx.fillRect(0, (H / n) * i, W * amt, H / n + 1); else if (i % 2) ctx.fillRect(bw * i, H - hh, bw + 1, hh); else ctx.fillRect(bw * i, 0, bw + 1, hh); }
        }
        ctx.restore(); return;
      }
      case 'blocks': {
        drawA(ctx);
        const cols = 4, rows = 7, cw = W / cols, ch = H / rows;
        ctx.save(); ctx.beginPath();
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const d = hash(i * 13.1 + j * 7.7 + (o.seed || 1)) * 0.5, q = EO(clamp((p - d) / 0.5)); if (q <= 0) continue; const s = q; ctx.rect(i * cw + (cw * (1 - s)) / 2, j * ch + (ch * (1 - s)) / 2, cw * s + 1, ch * s + 1); }
        ctx.clip(); drawB(ctx); ctx.restore(); return;
      }
      case 'zoom': case 'dissolve': case 'flip': case 'spin': case 'glitch': {
        const A = o.buf(0), B = o.buf(1);
        A.clear(); drawA(A.ctx); B.clear(); drawB(B.ctx);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        const cw = ctx.canvas.width, chh = ctx.canvas.height;
        if (kind === 'dissolve') { ctx.drawImage(A.c, 0, 0); ctx.globalAlpha = smooth(p); ctx.drawImage(B.c, 0, 0); }
        else if (kind === 'zoom') {
          const za = 1 + 0.9 * U.expoIn(clamp(p * 1.4)), zb = lerp(0.72, 1, U.expoInOut(clamp((p - 0.25) / 0.75)));
          ctx.save(); ctx.translate(cw / 2, chh / 2); ctx.scale(za, za); ctx.globalAlpha = 1 - smooth(clamp((p - 0.35) / 0.4)); ctx.drawImage(A.c, -cw / 2, -chh / 2); ctx.restore();
          ctx.save(); ctx.translate(cw / 2, chh / 2); ctx.scale(zb, zb); ctx.globalAlpha = smooth(clamp((p - 0.35) / 0.4)); ctx.drawImage(B.c, -cw / 2, -chh / 2); ctx.restore();
        } else if (kind === 'spin') {
          const a = p < 0.5 ? EI(p * 2) : 1 - EO((p - 0.5) * 2), img = p < 0.5 ? A.c : B.c, rot = (p < 0.5 ? a : -a) * 0.9 * dir, s = 1 - 0.55 * a;
          ctx.fillStyle = o.color || '#000'; ctx.fillRect(0, 0, cw, chh);
          ctx.translate(cw / 2, chh / 2); ctx.rotate(rot); ctx.scale(s, s); ctx.drawImage(img, -cw / 2, -chh / 2);
        } else if (kind === 'flip') {
          const a = p < 0.5 ? EI(p * 2) : 1 - EO((p - 0.5) * 2), img = p < 0.5 ? A.c : B.c;
          ctx.fillStyle = o.color || '#000'; ctx.fillRect(0, 0, cw, chh);
          ctx.translate(cw / 2, chh / 2); ctx.scale(Math.max(0.002, 1 - a), 1 - 0.08 * a); ctx.drawImage(img, -cw / 2, -chh / 2);
          ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#000'; ctx.fillRect(-cw / 2, -chh / 2, cw, chh);
        } else {
          const img = p < 0.5 ? A.c : B.c, n = 14, sh = chh / n, amp = Math.sin(p * Math.PI) * cw * 0.12;
          for (let i = 0; i < n; i++) { const off = (hash(i * 3.3 + Math.floor(p * 18)) - 0.5) * 2 * amp; ctx.drawImage(img, 0, i * sh, cw, sh + 1, off, i * sh, cw, sh + 1); }
          const f = Math.sin(p * Math.PI);
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * f;
          ctx.drawImage(img, -cw * 0.012 * f, 0); ctx.drawImage(img, cw * 0.012 * f, 0);
        }
        ctx.restore(); return;
      }
      default: (p < 0.5 ? drawA : drawB)(ctx);
    }
  }

  // ══════════════════════════════ pós: grão, vinheta, linhas de TV
  const SHARED = {};
  function prepPost() {
    if (SHARED.grain) return SHARED;
    SHARED.grain = [];
    for (let k = 0; k < 3; k++) {
      const c = mk(540, 960), cx = c.getContext('2d'), im = cx.createImageData(540, 960), r = rng(300 + k);
      for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 90; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      cx.putImageData(im, 0, 0); SHARED.grain.push(c);
    }
    const v = mk(W, H), vx = v.getContext('2d'), vg = vx.createRadialGradient(W / 2, H * 0.47, H * 0.3, W / 2, H * 0.47, H * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); vx.fillStyle = vg; vx.fillRect(0, 0, W, H); SHARED.vignette = v;
    const sl = mk(4, 8), sx = sl.getContext('2d'); sx.fillStyle = 'rgba(0,0,0,0.5)'; sx.fillRect(0, 0, 4, 3); SHARED.scan = sl;
    return SHARED;
  }
  function post(out, t, w, h, o) {
    const S = prepPost(), k = w / W;
    if (o.vignette) { out.globalAlpha = o.vignette; out.drawImage(S.vignette, 0, 0, w, h); out.globalAlpha = 1; }
    if (o.scan) { const p = out.createPattern(S.scan, 'repeat'); p.setTransform(new DOMMatrix().scale(k * 1.5, k * 1.5)); out.globalAlpha = o.scan; out.fillStyle = p; out.fillRect(0, 0, w, h); out.globalAlpha = 1; }
    if (o.grain) {
      // grão de filme trocando 12 vezes por segundo (como película; a cada quadro ele pesa demais no arquivo)
      const fi = Math.floor(t * 12 + 1e-6), g = S.grain[fi % 3];
      out.globalCompositeOperation = 'overlay'; out.globalAlpha = o.grain * 0.6; out.drawImage(g, -hash(fi * 1.7) * 60 * k, -hash(fi * 3.3) * 60 * k, 1140 * k, 2027 * k);
      out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    }
  }

  return { TYPES, BODY_TY, BODY, MONO, LABEL, HAND, SCRIPT, FACES, FONT_FILES, loadFonts, font, metrics, shadow, noShadow, palette, surface, ensure, onColor, mixHex, block, place, words, emphIndex, drawText, drawTyped, label, pill,
    star4, starN, blobPath, squiggle, arrowHand, drawBG, scaled, cover, contain, artCard, photo, logo, transition, post, bounceOut, backOut, TAU };
})();
if (typeof module !== 'undefined') module.exports = SK;
