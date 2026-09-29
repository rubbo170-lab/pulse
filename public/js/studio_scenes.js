'use strict';
// ─── Pulso Studio · cenas: cada tipo de cena tem várias composições; o plano escolhe uma por vídeo ───
// Cada variação recebe o contexto do vídeo (C) e a cena (sc) e desenha no tempo local lt (segundos desde o início da cena).
// Tudo cabe na área segura do Reels/TikTok (texto entre y≈300 e y≈1560, x entre 90 e 990).
const SS = (() => {
  const U = PU, K = SK;
  const { W, H, clamp, lerp, inv, smooth, EO, EI, EIO, spring, hash, rgba, mixc, hex, toHex } = U;
  const TAU = Math.PI * 2;
  const MX = 96; // margem lateral

  // ══════════════════════════════ ajudantes comuns
  const head = (ctx, C, text, o = {}) => K.block(ctx, text, C.ty, { loc: C.loc, ...o });
  const bodyTy = { head: K.BODY, w: 700, ls: -0.01, upper: false, lh: 1.14 };
  const body = (ctx, C, text, o = {}) => K.block(ctx, text, bodyTy, { loc: C.loc, ...o });
  function emph(sc, b, want, style) {
    const st = style || sc.em;
    if (!st || st === 'none') return null;
    return { i: K.emphIndex(b, want), style: st, color: st === 'color' ? sc.s.acc : sc.s.acc, on: sc.s.onAcc };
  }
  // texto com a entrada escolhida para a cena, no compasso (uma palavra a cada 1/4 de tempo)
  // (texto longo entra mais depressa: a última palavra começa até ~55% da cena)
  function txt(ctx, C, sc, b, lt, o = {}) {
    const t0 = o.t0 ?? sc.in, room = Math.max(0.015, (sc.d * 0.55 - Math.max(0, t0 - sc.in)) / Math.max(1, b.count));
    K.drawText(ctx, b, lt, {
      fx: o.fx || sc.fx, t0, stagger: Math.min(o.stagger ?? Math.min(0.12, sc.beat / 4), room), dur: o.dur ?? Math.min(0.55, sc.beat * 1.05),
      color: o.color || sc.s.fg, emph: o.emph === undefined ? null : o.emph, shadow: o.shadow === undefined ? C.shadowFor(sc.s) : o.shadow, stroke: o.stroke, exit: o.exit, glitchA: sc.s.acc, glitchB: sc.s.acc2, outline: o.outline,
    });
  }
  const beatsIn = (sc, lt, n) => lt - sc.in - n * sc.beat; // tempo desde o n-ésimo tempo da cena
  const pop = (tt, k = 18, z = 0.46) => (tt <= 0 ? 0 : spring(tt, k, z));
  const pulse = (C, sc, lt) => (C.look.energy > 0.55 ? Math.exp(-(((lt % sc.beat) + sc.beat) % sc.beat) * 9) : 0);
  function badge(ctx, C, sc, name, cx, cy, size, p, o = {}) {
    if (p <= 0) return;
    const s = sc.s, st = o.style || C.look.badge || 'circle';
    ctx.save(); ctx.translate(cx, cy); ctx.scale(p, p);
    const r = size / 2;
    if (st === 'circle') { ctx.fillStyle = o.bg || s.acc; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); U.icon(ctx, name, 0, 0, size * 0.56, o.fg || s.onAcc, 2.1); }
    else if (st === 'square') { ctx.fillStyle = o.bg || s.acc; U.rr(ctx, -r, -r, size, size, size * 0.26); ctx.fill(); U.icon(ctx, name, 0, 0, size * 0.56, o.fg || s.onAcc, 2.1); }
    else if (st === 'ring') { ctx.strokeStyle = o.bg || s.acc; ctx.lineWidth = size * 0.06; ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, TAU); ctx.stroke(); U.icon(ctx, name, 0, 0, size * 0.52, o.bg || s.acc, 2.1); }
    else if (st === 'glow') { K.shadow(ctx, s.acc, size * 0.4); ctx.strokeStyle = s.acc; ctx.lineWidth = size * 0.05; ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, TAU); ctx.stroke(); K.noShadow(ctx); U.icon(ctx, name, 0, 0, size * 0.52, s.fg, 2.1); }
    else { U.icon(ctx, name, 0, 0, size * 0.7, o.bg || s.acc, 2.2); }
    ctx.restore();
  }
  // foto (ou arte da marca, sem foto) na moldura do visual
  function hero(ctx, C, sc, img, box, lt, o = {}) {
    const kind = o.kind || C.frame, s = sc.s;
    const pic = img ? K.scaled(img) : K.artCard(`hero${o.key || ''}`, Math.round(box.w), Math.round(box.h), s, C.logo, C.D.segIcon, sc.seed);
    const zoom = (o.zoom ?? 1.04) + (o.kb ?? 0.07) * clamp(lt / Math.max(1, sc.d + 0.6));
    K.photo(ctx, pic, box, { kind, t: lt, seed: sc.seed, zoom, px: o.px ?? 0.5, py: o.py ?? 0.5, radius: C.look.radius, shadow: C.look.shadow === 'hard' || kind === 'offset' ? 'hard' : o.shadow, accent: o.accent || (kind === 'offset' ? s.acc2 : s.acc), border: o.border ?? (kind === 'card' && C.look.stroke ? s.fg : null), bw: C.look.stroke || 8, glow: kind === 'glow' ? s.acc : null, caption: o.caption, tape: kind === 'polaroid' ? s.acc2 : null, hx: 20, hy: 20 });
  }
  // decoração do visual, fora da área do texto
  function decorate(ctx, C, sc, lt, o = {}) {
    const s = sc.s, set = C.look.deco, r = (i) => hash(sc.seed * 13.7 + i * 7.3);
    const app = (i) => EO(clamp((lt - sc.in - 0.08 * i) / 0.5));
    const spots = o.spots || [[150, 300], [930, 420], [120, 1560], [960, 1640], [880, 260], [180, 1720]];
    ctx.save();
    switch (set) {
      case 'sparkle': spots.slice(0, 4).forEach(([x, y], i) => { const a = app(i); if (a <= 0) return; const sz = 26 + 30 * r(i), tw_ = 0.75 + 0.25 * Math.sin(lt * 4 + i * 2); ctx.fillStyle = i % 2 ? s.acc2 : s.acc; K.star4(ctx, x, y, sz * a * tw_); ctx.fill(); }); break;
      case 'confetti': for (let i = 0; i < 16; i++) { const a = app(i * 0.3); if (a <= 0) continue; const x = 60 + r(i) * 960, y0 = (r(i + 40) * H + lt * (40 + 60 * r(i + 9))) % H; if (y0 > 330 && y0 < 1540 && x > 150 && x < 930) continue; ctx.save(); ctx.translate(x, y0); ctx.rotate(lt * (1 + r(i + 3) * 3) + i); ctx.globalAlpha = 0.85 * a; ctx.fillStyle = [s.acc, s.acc2, s.fg][i % 3]; if (i % 3 === 2) { ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); } else ctx.fillRect(-12, -6, 24, 12); ctx.restore(); } break;
      case 'squiggle': [[70, 330, 0.3], [700, 1650, -0.2]].forEach(([x, y, a0], i) => K.squiggle(ctx, x, y, 300, 22, 2.5, 12, i ? s.acc2 : s.acc, app(i) * 1, a0)); spots.slice(1, 3).forEach(([x, y], i) => { const a = app(i + 2); ctx.fillStyle = s.acc2; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, 18 * a, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }); break;
      case 'rules': { const a = app(0); ctx.strokeStyle = s.fg; ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(MX, 240); ctx.lineTo(MX + (W - MX * 2) * a, 240); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(W - MX, 1690); ctx.lineTo(W - MX - (W - MX * 2) * a, 1690); ctx.stroke(); ctx.globalAlpha = a; K.label(ctx, C.D.brand, MX, 212, { size: 26, color: s.fg, fam: K.LABEL, ls: 0.22, loc: C.loc }); K.label(ctx, `${String(sc.i + 1).padStart(2, '0')} / ${String(C.n).padStart(2, '0')}`, W - MX, 212, { size: 26, color: s.fg, fam: K.MONO, w: 500, align: 'right', ls: 0.1 }); break; }
      case 'neon': spots.slice(0, 3).forEach(([x, y], i) => { const a = app(i); if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(lt * 7 + i)); K.shadow(ctx, i % 2 ? s.acc2 : s.acc, 30); ctx.strokeStyle = i % 2 ? s.acc2 : s.acc; ctx.lineWidth = 5; ctx.beginPath(); if (i === 1) { ctx.moveTo(x - 60, y); ctx.lineTo(x + 60, y); } else ctx.arc(x, y, 34 + 10 * r(i), 0, TAU); ctx.stroke(); ctx.restore(); }); break;
      case 'plus': for (let i = 0; i < Math.min(6, spots.length); i++) { const [x, y] = spots[i]; const a = app(i); if (a <= 0) continue; ctx.save(); ctx.translate(x, y); ctx.rotate((1 - a) * 1.5); ctx.strokeStyle = i % 2 ? s.acc : s.line; ctx.lineWidth = 6; ctx.lineCap = 'round'; const L = 18 * a; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.moveTo(0, -L); ctx.lineTo(0, L); ctx.stroke(); ctx.restore(); } break;
      case 'burst': { const a = app(0); if (a > 0) { ctx.save(); ctx.translate(930, 300); ctx.rotate(lt * 0.6); ctx.fillStyle = s.acc2; K.starN(ctx, 0, 0, 90 * a, 62 * a, 12); ctx.fill(); ctx.restore(); } const b2 = app(2); if (b2 > 0) { ctx.save(); ctx.translate(150, 1640); ctx.rotate(-lt * 0.5); ctx.strokeStyle = s.acc; ctx.lineWidth = 7; K.starN(ctx, 0, 0, 70 * b2, 44 * b2, 10); ctx.stroke(); ctx.restore(); } break; }
      case 'ticker': { const hgt = 74, ys = [150, 1720]; ys.forEach((y, i) => { ctx.fillStyle = i ? s.acc : s.fg; ctx.fillRect(0, y, W, hgt); K.font(ctx, K.MONO, 30, 700, 3); ctx.fillStyle = i ? s.onAcc : s.bg; const str = `${C.D.brand} ✦ `.toLocaleUpperCase(C.loc).repeat(12), off = ((lt * (i ? -140 : 140)) % 600 + 600) % 600; ctx.fillText(str, -600 + off, y + 48); }); break; }
      case 'blobs': spots.slice(0, 2).forEach(([x, y], i) => { const a = app(i); if (a <= 0) return; ctx.globalAlpha = 0.9; ctx.fillStyle = i ? s.acc2 : s.acc; K.blobPath(ctx, x, y, 70 * a, lt, sc.seed + i, 0.18); ctx.fill(); ctx.globalAlpha = 1; }); U.icon(ctx, 'leaf', 900, 1620, 90 * app(3), s.acc, 2); break;
      case 'marks': [[MX, 280], [W - MX, 280], [MX, 1640], [W - MX, 1640]].forEach(([x, y], i) => { const a = app(i); if (a <= 0) return; ctx.strokeStyle = s.fg; ctx.lineWidth = 4; const L = 34 * a, dx = x < W / 2 ? 1 : -1, dy = y < H / 2 ? 1 : -1; ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke(); }); break;
      default: break;
    }
    ctx.restore();
  }
  // forma grande atrás do texto principal, no estilo do visual
  function backShape(ctx, C, sc, lt, cx, cy, size, o = {}) {
    const s = sc.s, st = C.look.back, a = EO(clamp((lt - sc.in + 0.05) / 0.5));
    if (!st || a <= 0) return;
    ctx.save();
    if (st === 'blob') { ctx.fillStyle = s.acc2; ctx.globalAlpha = s.light ? 0.55 : 0.35; K.blobPath(ctx, cx, cy, size * a, lt, sc.seed, 0.12); ctx.fill(); }
    else if (st === 'burst') { ctx.translate(cx, cy); ctx.rotate(lt * 0.25); ctx.fillStyle = s.acc2; ctx.globalAlpha = 0.9; K.starN(ctx, 0, 0, size * a, size * 0.8 * a, 18); ctx.fill(); }
    else if (st === 'ring') { ctx.strokeStyle = s.acc; K.shadow(ctx, s.acc, 40); ctx.lineWidth = 10; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(cx, cy, size * a, 0, TAU); ctx.stroke(); }
    else if (st === 'circle') { ctx.fillStyle = s.acc; ctx.globalAlpha = s.light ? 0.16 : 0.18; ctx.beginPath(); ctx.arc(cx, cy, size * a, 0, TAU); ctx.fill(); }
    else if (st === 'box') {
      // atrás de foto: moldura deslocada do mesmo tamanho (registro de impressão); atrás de texto: caixa larga
      ctx.strokeStyle = s.fg; ctx.lineWidth = 5;
      if (o.w) { const d = 34 * a; ctx.globalAlpha = a; ctx.strokeRect(cx - o.w / 2 + d, cy - o.h / 2 + d, o.w, o.h); }
      else { const w = size * 1.7 * a, h = size * 1.1 * a; ctx.strokeRect(cx - w / 2, cy - h / 2, w, h); }
    }
    ctx.restore();
  }
  // itens de lista: coloca n linhas centradas entre y0 e y1
  const rows = (n, y0, y1, gap) => { const g = Math.min(gap, (y1 - y0) / Math.max(1, n)); const top = (y0 + y1) / 2 - ((n - 1) * g) / 2; return Array.from({ length: n }, (_, i) => top + i * g); };
  // itens de lista no mesmo tamanho; letras largas (ou texto longo demais) passam para a letra do texto corrido
  // (maxH: altura máxima de cada item, para as linhas da lista não se encostarem)
  function fitList(ctx, C, items, maxW, maxS0, minS0, maxH = 9999) {
    const run = (ty, lines, maxS, minS) => { const size = Math.min(...items.map((it) => K.block(ctx, it.text, ty, { loc: C.loc, maxW, maxS, minS, maxLines: lines, upper: false }).size)); return items.map((it) => K.block(ctx, it.text, ty, { loc: C.loc, maxW, maxS: size, minS: Math.min(minS, size), maxLines: lines, upper: false })); };
    const pick = (maxS, minS) => {
      const a = C.ty.listBody ? null : run(C.ty, 2, maxS, minS);
      if (a && !a.some((b) => b.cut || b.fam !== C.ty.head) && a[0].size >= maxS * 0.6) return a;
      const b = run(K.BODY_TY, 3, maxS, minS);
      return !a || b[0].size > a[0].size * 1.12 ? b : a;
    };
    let mx = maxS0, res = pick(mx, minS0);
    for (let g = 0; g < 14; g++) {
      if (Math.max(...res.map((b) => b.height + b.desc * 0.6)) <= maxH || mx <= 30) break;
      mx = Math.max(30, Math.round(mx * 0.9)); res = pick(mx, Math.min(minS0, mx));
    }
    return res;
  }
  function card(ctx, C, s, x, y, w, h, o = {}) {
    const r = o.r ?? C.look.radius;
    ctx.save();
    if (C.look.shadow === 'hard') { ctx.fillStyle = o.shadowColor || s.fg; U.rr(ctx, x + 12, y + 12, w, h, r); ctx.fill(); }
    else if (C.look.shadow !== 'none') K.shadow(ctx, s.light ? 'rgba(20,16,40,0.16)' : 'rgba(0,0,0,0.45)', 44, 0, 18);
    ctx.fillStyle = o.bg || s.card; U.rr(ctx, x, y, w, h, r); ctx.fill();
    K.noShadow(ctx);
    if (C.look.stroke || o.border) { ctx.strokeStyle = o.border || s.fg; ctx.lineWidth = C.look.stroke || 3; U.rr(ctx, x, y, w, h, r); ctx.stroke(); }
    if (C.look.glowCards) { K.shadow(ctx, s.acc, 26); ctx.strokeStyle = s.acc; ctx.lineWidth = 3; U.rr(ctx, x, y, w, h, r); ctx.stroke(); }
    ctx.restore();
  }
  const cardFg = (s, bg) => K.onColor(bg || s.card, s.ink || '#111014');
  // intervalo entre os itens de uma lista: o último entra até ~60% da cena (sobra tempo para ler tudo junto)
  function listStep(sc, n, minBeats = 0.5) { if (n <= 1) return sc.beat; return clamp((sc.d * 0.6 - sc.in - sc.beat) / (n - 1), sc.beat * minBeats, sc.beat * 2); }

  // ══════════════════════════════ GANCHO
  const hookText = (C) => C.D.hook.join(' ');
  // texto que a cena mostra (para saber se a composição combina com o tamanho dele)
  const nWords = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
  const longest = (t) => Math.max(0, ...String(t || '').split(/\s+/).map((w) => w.length));
  const textOf = (sp, kind) => (kind === 'statement' ? sp.script.tagline : kind === 'pain' ? sp.script.pain : (sp.script.hook || []).join(' '));
  const V = {};
  V.hookStack = {
    kinds: ['hook', 'statement'], looks: 'any', w: 3,
    prep(ctx, C, sc) { const t = sc.kind === 'hook' ? hookText(C) : C.D.tagline; sc.b = K.place(head(ctx, C, t, { maxW: 880, maxS: sc.kind === 'hook' ? 230 : 170, minS: 70, maxLines: 3 }), W / 2, 960, 'center'); },
    draw(ctx, C, sc, lt) {
      backShape(ctx, C, sc, lt, W / 2, 960, Math.max(340, sc.b.width * 0.55));
      decorate(ctx, C, sc, lt);
      const pl = 1 + 0.018 * pulse(C, sc, lt);
      ctx.save(); ctx.translate(W / 2, 960); ctx.scale(pl, pl); ctx.translate(-W / 2, -960);
      txt(ctx, C, sc, sc.b, lt, { emph: emph(sc, sc.b, sc.kind === 'hook' ? C.D.hookKey : C.D.tagKey), stagger: Math.min(sc.beat / 2, (sc.d * 0.45) / Math.max(1, sc.b.count)) });
      ctx.restore();
    },
  };
  V.hookWords = {
    kinds: ['hook', 'statement'], looks: ['bold', 'grid', 'neon', 'pop', 'retro'], w: 3, ok: (sp, k) => nWords(textOf(sp, k)) <= 6 && longest(textOf(sp, k)) <= 13,
    prep(ctx, C, sc) {
      const t = sc.kind === 'hook' ? hookText(C) : C.D.tagline;
      const ws = t.split(/\s+/).filter(Boolean).slice(0, 7);
      sc.ws = ws.map((w) => K.place(head(ctx, C, w, { maxW: 900, maxS: 330, minS: 90, maxLines: 1 }), W / 2, 960, 'center'));
      sc.all = K.place(head(ctx, C, t, { maxW: 880, maxS: 210, minS: 70, maxLines: 3 }), W / 2, 960, 'center');
      const slot = Math.min(sc.beat / 2, (sc.d * 0.62) / Math.max(1, ws.length));
      sc.slot = Math.max(0.16, slot); sc.fin = sc.in + sc.slot * ws.length; sc.thumbT = Math.max(sc.fin + 0.6, sc.d * 0.84);
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s;
      if (lt < sc.fin) {
        const i = clamp(Math.floor((lt - sc.in) / sc.slot), 0, sc.ws.length - 1), tt = lt - sc.in - i * sc.slot;
        if (lt < sc.in) return;
        const inv_ = C.look.flashWords && i % 2 === 1;
        if (inv_) { ctx.fillStyle = s.acc; ctx.fillRect(0, 0, W, H); }
        const b = sc.ws[i], k = 1 + 0.35 * Math.exp(-tt * 16);
        ctx.save(); ctx.translate(W / 2, 960); ctx.scale(k, k); ctx.translate(-W / 2, -960);
        K.drawText(ctx, b, tt, { fx: 'none', color: inv_ ? s.onAcc : s.fg, shadow: C.shadowFor(s) });
        ctx.restore();
        return;
      }
      decorate(ctx, C, sc, lt);
      K.drawText(ctx, sc.all, lt - sc.fin, { fx: 'stamp', stagger: 0.02, dur: 0.2, color: s.fg, emph: emph(sc, sc.all, sc.kind === 'hook' ? C.D.hookKey : C.D.tagKey, sc.em === 'none' ? 'box' : sc.em), shadow: C.shadowFor(s) });
    },
  };
  V.hookMarquee = {
    kinds: ['hook'], looks: ['bold', 'grid', 'retro', 'pop'], w: 2, ok: (sp) => String((sp.script.hook || [])[0] || '').length <= 16 && nWords(textOf(sp, 'hook')) <= 8,
    prep(ctx, C, sc) {
      sc.b = K.place(head(ctx, C, hookText(C), { maxW: 860, maxS: 170, minS: 64, maxLines: 2 }), W / 2, 960, 'center');
      const fill = head(ctx, C, `${C.D.hook[0]} ✦ `, { maxW: 4000, maxS: 150, minS: 150, maxLines: 1 }); sc.rep = fill;
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, band = sc.b.height + 150, enter = EO(clamp((lt - sc.in + 0.15) / 0.45));
      [[560, -1, s.acc2], [1360, 1, s.acc]].forEach(([y, dir, col], i) => {
        ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.08 + i * 0.16); ctx.translate(-W / 2, -y);
        ctx.globalAlpha = 0.95 * enter; ctx.fillStyle = col; ctx.fillRect(-100, y - 100, W + 200, 200);
        K.font(ctx, sc.rep.fam, 150, sc.rep.w, sc.rep.ls); ctx.fillStyle = K.onColor(col); const str = sc.rep.txt.repeat(6), w = U.tw(ctx, sc.rep.txt);
        const off = ((lt * 320 * dir) % w + w) % w; ctx.fillText(str, -w + off - (1 - enter) * 400 * dir, y + 52); ctx.restore();
      });
      const a = EO(clamp((lt - sc.in) / 0.4));
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = s.bg; U.rr(ctx, W / 2 - (sc.b.width / 2 + 60), 960 - band / 2, sc.b.width + 120, band, C.look.radius); ctx.fill(); ctx.restore();
      txt(ctx, C, sc, sc.b, lt, { emph: emph(sc, sc.b, C.D.hookKey), t0: sc.in + 0.08 });
    },
  };
  V.hookType = {
    kinds: ['hook', 'pain'], looks: ['clean', 'editorial', 'neon', 'organic'], w: 2,
    prep(ctx, C, sc) { const t = sc.kind === 'hook' ? hookText(C) : C.D.pain; sc.b = K.place(head(ctx, C, t, { maxW: 800, maxS: 150, minS: 62, maxLines: 3, upper: sc.kind === 'hook' ? undefined : false }), MX + 40, 940, 'left'); sc.cps = clamp(sc.b.txt.length / Math.max(0.6, sc.d * 0.5), 14, 34); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, b = sc.b, pad = 56, x = MX - 10, y = b.top - pad - 40, w = W - MX * 2 + 20, h = b.height + pad * 2 + 80;
      const a = EO(clamp((lt - sc.in + 0.1) / 0.4));
      decorate(ctx, C, sc, lt);
      if (C.look.id !== 'editorial') { ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 60); card(ctx, C, s, x, y, w, h, { bg: C.look.id === 'neon' ? s.bg : s.card }); ctx.restore(); }
      else { ctx.save(); ctx.strokeStyle = s.fg; ctx.lineWidth = 3; ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(MX, y + 20); ctx.lineTo(MX + (W - 2 * MX) * a, y + 20); ctx.stroke(); ctx.restore(); }
      const fg = C.look.id === 'editorial' || C.look.id === 'neon' ? s.fg : cardFg(s);
      ctx.save(); ctx.globalAlpha = a; K.label(ctx, sc.kind === 'hook' ? C.D.brand : '…', x + 44, y + 64, { size: 26, color: s.acc, fam: K.MONO, w: 700, ls: 0.12, loc: C.loc }); ctx.restore();
      const cps = sc.cps;
      K.font(ctx, b.fam, b.size, b.w, b.ls, b.italic);
      const done = K.drawTyped(ctx, b, lt, { t0: sc.in + 0.15, cps, color: fg, cursorColor: s.acc });
      if (done >= 1 && sc.em !== 'none') { const e = emph(sc, b, sc.kind === 'hook' ? C.D.hookKey : C.D.painKey, sc.em === 'marker' || sc.em === 'box' ? 'underline' : sc.em); if (e) K.drawText(ctx, b, lt - (sc.in + 0.15 + b.txt.length / cps) - 0.05, { fx: 'none', color: fg, emph: { ...e, at: 0 } }); }
    },
  };
  V.hookPhoto = {
    kinds: ['hook', 'statement'], looks: ['editorial', 'clean', 'bold', 'organic', 'neon'], need: 'photo', w: 3,
    prep(ctx, C, sc) { const t = sc.kind === 'hook' ? hookText(C) : C.D.tagline; sc.b = K.place(head(ctx, C, t, { maxW: 880, maxS: 190, minS: 70, maxLines: 3 }), MX, 1480, 'left', 'bot'); },
    draw(ctx, C, sc, lt) {
      const img = K.scaled(C.images.product);
      ctx.save(); const z = 1.12 + 0.08 * clamp(lt / (sc.d + 0.5)); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); K.cover(ctx, img, 0, 0, W, H, 1); ctx.restore();
      // o degradê fica opaco onde o texto começa (qualquer foto, texto legível)
      const g = ctx.createLinearGradient(0, sc.b.top - 420, 0, sc.b.top + 30); g.addColorStop(0, rgba(sc.s.bg, 0)); g.addColorStop(0.55, rgba(sc.s.bg, 0.62)); g.addColorStop(1, rgba(sc.s.bg, 0.93)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      K.label(ctx, C.D.brand, MX, sc.b.top - 40, { size: 28, color: sc.s.acc, fam: K.LABEL, t: lt, t0: sc.in, loc: C.loc, ls: 0.2 });
      txt(ctx, C, sc, sc.b, lt, { emph: emph(sc, sc.b, sc.kind === 'hook' ? C.D.hookKey : C.D.tagKey), shadow: null });
    },
  };
  V.hookSplit = {
    kinds: ['hook'], looks: ['pop', 'bold', 'retro', 'grid'], w: 2, ok: (sp) => nWords(textOf(sp, 'hook')) >= 2 && nWords(textOf(sp, 'hook')) <= 8,
    prep(ctx, C, sc) {
      const [a, b] = C.D.hook.length > 1 ? C.D.hook : (() => { const ws = C.D.hook[0].split(' '); const h2 = Math.ceil(ws.length / 2); return [ws.slice(0, h2).join(' '), ws.slice(h2).join(' ') || ws[0]]; })();
      sc.b1 = K.place(head(ctx, C, a, { maxW: 860, maxS: 230, minS: 70, maxLines: 2 }), MX, 820, 'left', 'bot');
      sc.b2 = K.place(head(ctx, C, b, { maxW: 860, maxS: 230, minS: 70, maxLines: 2 }), W - MX, 1080, 'right', 'top');
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, e = EIO(clamp((lt - sc.in + 0.1) / 0.5));
      ctx.save(); ctx.fillStyle = s.acc; ctx.beginPath(); ctx.moveTo(W, 900 - 160); ctx.lineTo(W, H + 40); ctx.lineTo(-40, H + 40); ctx.lineTo(-40, 1180); ctx.closePath(); ctx.translate(0, (1 - e) * 1200); ctx.fill(); ctx.restore();
      decorate(ctx, C, sc, lt, { spots: [[150, 300], [930, 380]] });
      txt(ctx, C, sc, sc.b1, lt, { fx: 'slideL', stagger: 0.05 });
      txt(ctx, C, sc, sc.b2, lt, { fx: 'skew', t0: sc.in + sc.beat, stagger: 0.05, color: s.onAcc, emph: emph(sc, sc.b2, C.D.hookKey, sc.em === 'marker' ? 'underline' : sc.em), shadow: null });
    },
  };
  V.hookStickers = {
    kinds: ['hook', 'statement'], looks: ['pop', 'retro', 'organic'], w: 2, ok: (sp, k) => nWords(textOf(sp, k)) <= 8,
    prep(ctx, C, sc) {
      const t = sc.kind === 'hook' ? hookText(C) : C.D.tagline;
      sc.b = K.place(head(ctx, C, t, { maxW: 820, maxS: 200, minS: 64, maxLines: 4, lh: 1.42 }), W / 2, 960, 'center');
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, b = sc.b;
      decorate(ctx, C, sc, lt);
      K.words(b).forEach((wd) => {
        const tt = lt - sc.in - wd.i * (sc.beat / 2), p = pop(tt, 16, 0.4);
        if (p <= 0) return;
        const cx = wd.ax + wd.w / 2, cy = wd.ay - b.cap / 2, rot = (hash(sc.seed + wd.i * 3.3) - 0.5) * 0.16, col = [s.acc, s.card, s.acc2][wd.i % 3];
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(p, p);
        const w = wd.w + b.size * 0.5, h = b.cap + b.size * 0.52;
        ctx.fillStyle = s.fg; U.rr(ctx, -w / 2 + 10, -h / 2 + 12, w, h, h * 0.3); ctx.fill();
        ctx.fillStyle = col; U.rr(ctx, -w / 2, -h / 2, w, h, h * 0.3); ctx.fill();
        K.font(ctx, b.fam, b.size, b.w, b.ls, b.italic); ctx.fillStyle = K.onColor(col); ctx.fillText(wd.text, -wd.w / 2, b.cap / 2);
        ctx.restore();
      });
    },
  };

  // ══════════════════════════════ PROBLEMA
  V.painBig = {
    kinds: ['pain'], looks: 'any', w: 3,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.pain, { maxW: 860, maxS: 150, minS: 60, maxLines: 3, upper: C.ty.upper && C.D.pain.length < 22 }), W / 2, 1000, 'center'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, a = EO(clamp((lt - sc.in) / 0.6));
      ctx.save(); K.font(ctx, C.ty.head, 900, C.ty.w, 0); ctx.globalAlpha = 0.12 * a; ctx.fillStyle = s.acc; ctx.translate(W / 2, 980); ctx.rotate(0.12 + Math.sin(lt * 1.2) * 0.04); const q = '?', qw = U.tw(ctx, q); ctx.fillText(q, -qw / 2, 320); ctx.restore();
      decorate(ctx, C, sc, lt);
      const shake = C.look.energy > 0.6 ? Math.exp(-Math.max(0, lt - sc.in - sc.beat * 2) * 8) * (lt > sc.in + sc.beat * 2 ? 1 : 0) : 0;
      ctx.save(); ctx.translate(Math.sin(lt * 70) * 10 * shake, 0);
      txt(ctx, C, sc, sc.b, lt, { emph: emph(sc, sc.b, C.D.painKey, sc.em === 'marker' ? 'color' : sc.em) });
      ctx.restore();
    },
  };
  V.painChat = {
    kinds: ['pain'], looks: ['clean', 'pop', 'neon', 'organic'], w: 3,
    prep(ctx, C, sc) { sc.b = K.place(body(ctx, C, C.D.pain, { maxW: 680, maxS: 88, minS: 46, maxLines: 3 }), MX + 190, 1000, 'left'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, b = sc.b, x = MX + 150, y = b.top - 48, w = b.width + 90, h = b.height + 96;
      decorate(ctx, C, sc, lt);
      const tIn = sc.in, tMsg = sc.in + sc.beat * 2, pa = pop(lt - tIn, 16, 0.5);
      if (pa > 0) { ctx.save(); ctx.translate(MX + 60, y + h - 40); ctx.scale(pa, pa); ctx.fillStyle = s.acc2; ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fill(); U.icon(ctx, 'people', 0, 0, 52, K.onColor(s.acc2), 2); ctx.restore(); }
      const bw = lt < tMsg ? 170 : lerp(170, w, EO(clamp((lt - tMsg) / 0.3))), bh = lt < tMsg ? 110 : lerp(110, h, EO(clamp((lt - tMsg) / 0.3)));
      if (pa > 0) {
        ctx.save(); ctx.translate(x, y + h); ctx.scale(pa, pa); ctx.translate(-x, -(y + h));
        card(ctx, C, s, x, y + h - bh, bw, bh, { r: 44, bg: s.card });
        if (lt < tMsg) { for (let i = 0; i < 3; i++) { const bounce = Math.sin(lt * 10 - i * 0.9) * 8; ctx.fillStyle = s.mute; ctx.beginPath(); ctx.arc(x + 50 + i * 36, y + h - 55 + bounce, 11, 0, TAU); ctx.fill(); } }
        ctx.restore();
      }
      if (lt >= tMsg) txt(ctx, C, sc, b, lt, { fx: 'fade', t0: tMsg + 0.1, color: cardFg(s), shadow: null, emph: emph(sc, b, C.D.painKey, 'color') });
    },
  };
  V.painStrike = {
    kinds: ['pain'], looks: ['editorial', 'pop', 'retro', 'organic', 'clean'], w: 2,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.pain, { maxW: 860, maxS: 140, minS: 60, maxLines: 3, upper: false }), W / 2, 980, 'center'); },
    draw(ctx, C, sc, lt) {
      decorate(ctx, C, sc, lt);
      const e = emph(sc, sc.b, C.D.painKey, 'strike');
      txt(ctx, C, sc, sc.b, lt, { emph: e ? { ...e, at: sc.beat * 2.5, dur: 0.3 } : null });
      if (C.look.hand) { const p = clamp((lt - sc.in - sc.beat * 3) / 0.5); if (p > 0) { K.font(ctx, K.HAND, 64, 700); ctx.fillStyle = sc.s.acc; ctx.globalAlpha = EO(p); ctx.fillText(C.L.solved, W / 2 + 60, sc.b.bot + 150); ctx.globalAlpha = 1; K.arrowHand(ctx, W / 2 + 40, sc.b.bot + 120, W / 2 - 60, sc.b.bot + 40, sc.s.acc, 7, EO(p)); } }
    },
  };
  V.painGlitch = {
    kinds: ['pain', 'hook'], looks: ['neon', 'bold', 'grid'], w: 2,
    prep(ctx, C, sc) { const t = sc.kind === 'hook' ? hookText(C) : C.D.pain; sc.b = K.place(head(ctx, C, t, { maxW: 860, maxS: 150, minS: 60, maxLines: 3, upper: sc.kind === 'hook' ? undefined : C.ty.upper && t.length < 22 }), W / 2, 960, 'center'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s;
      decorate(ctx, C, sc, lt);
      const k = Math.floor(lt * 24); if (hash(k * 1.7 + sc.seed) > 0.86) { ctx.save(); ctx.fillStyle = rgba(s.acc, 0.12); ctx.fillRect(0, hash(k) * H, W, 30 + hash(k + 2) * 90); ctx.restore(); }
      txt(ctx, C, sc, sc.b, lt, { fx: 'glitch', stagger: sc.beat / 4, emph: emph(sc, sc.b, sc.kind === 'hook' ? C.D.hookKey : C.D.painKey, 'color') });
    },
  };

  // ══════════════════════════════ BUSCA
  V.searchBar = {
    kinds: ['search'], looks: 'any', w: 3,
    prep(ctx, C, sc) {
      sc.q = String(C.D.search || '').trim();
      let size = 58; K.font(ctx, K.BODY, size, 500, 0); while (U.tw(ctx, sc.q) > W - 2 * MX - 190 && size > 36) { size -= 2; K.font(ctx, K.BODY, size, 500, 0); } sc.qs = size;
      let ns = 60; K.font(ctx, K.BODY, ns, 700, 0); while (U.tw(ctx, C.D.brand) > W - 2 * MX - 250 && ns > 42) { ns -= 2; K.font(ctx, K.BODY, ns, 700, 0); }
      let nm = C.D.brand; while (U.tw(ctx, nm) > W - 2 * MX - 250 && nm.length > 3) nm = nm.slice(0, -2) + '…'; sc.nm = nm; sc.ns = ns;
      sc.sub = C.D.handle || C.D.site || (C.D.proof.rating ? `★ ${C.D.proof.rating}${C.D.proof.src ? ` · ${C.D.proof.src}` : ''}` : sc.q);
      sc.cps = clamp(sc.q.length / Math.max(0.5, sc.d * 0.3), 12, 30); sc.tType = sc.in + 0.2; sc.tRes = sc.tType + sc.q.length / sc.cps + 0.12; sc.tap = sc.tRes + Math.max(0.5, sc.beat * 1.5);
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, x = MX - 6, w = W - (MX - 6) * 2, y = 520, h = 150, a = pop(lt - sc.in + 0.1, 15, 0.55);
      const paper = s.light ? '#FFFFFF' : s.card, ink = s.light ? '#15131B' : s.cardFg;
      decorate(ctx, C, sc, lt, { spots: [[140, 330], [950, 360], [980, 1700], [120, 1640]] });
      if (a > 0) {
        ctx.save(); ctx.translate(W / 2, y + h / 2); ctx.scale(a, a); ctx.translate(-W / 2, -(y + h / 2));
        card(ctx, C, s, x, y, w, h, { r: C.look.id === 'grid' ? 0 : h / 2, bg: paper, border: C.look.stroke ? s.fg : s.acc });
        U.icon(ctx, 'search', x + 80, y + h / 2, 62, s.acc, 2.4);
        ctx.restore();
      }
      const cps = sc.cps, t0 = sc.tType, n = Math.floor(clamp((lt - t0) * cps, 0, sc.q.length));
      K.font(ctx, K.BODY, sc.qs, 500, 0); const room = w - 190; let str = sc.q.slice(0, n); while (U.tw(ctx, str) > room && str.length > 4) str = str.slice(1);
      ctx.save(); ctx.beginPath(); ctx.rect(x + 130, y, room + 20, h); ctx.clip(); ctx.fillStyle = ink; ctx.fillText(str, x + 140, y + h / 2 + sc.qs * 0.36); ctx.restore();
      if (lt > t0 - 0.2 && (n < sc.q.length || Math.floor(lt * 2.4) % 2 === 0)) { ctx.fillStyle = s.acc; ctx.fillRect(Math.min(x + w - 40, x + 146 + U.tw(ctx, str)), y + h / 2 - sc.qs * 0.52, 6, sc.qs * 1.06); }
      const tRes = sc.tRes, tap = sc.tap, sel = EO(clamp((lt - tap) / 0.35));
      const ys = [740, 1030, 1250], hs = [250, 190, 190];
      for (let i = 2; i >= 0; i--) {
        const p = EO(clamp((lt - tRes - i * 0.09) / 0.42)); if (p <= 0) continue;
        const ry = ys[i], rh = hs[i], hi = i === 0, k = hi ? 1 + 0.04 * sel : 1;
        ctx.save(); ctx.globalAlpha = p * (hi ? 1 : 1 - 0.55 * sel); ctx.translate(W / 2, ry + rh / 2 + (1 - p) * 60); ctx.scale(k, k); ctx.translate(-W / 2, -(ry + rh / 2));
        if (hi) {
          card(ctx, C, s, x, ry, w, rh, { r: C.look.id === 'grid' ? 0 : Math.min(48, C.look.radius), bg: paper, border: sel > 0.05 ? s.acc : null });
          if (sel > 0.05) { ctx.save(); ctx.strokeStyle = s.acc; ctx.lineWidth = 8 * sel; U.rr(ctx, x - 4, ry - 4, w + 8, rh + 8, C.look.id === 'grid' ? 0 : Math.min(52, C.look.radius + 4)); ctx.stroke(); ctx.restore(); }
          K.logo(ctx, C.logo, x + 100, ry + rh / 2, 132, { s, name: C.D.brand, loc: C.loc, ty: C.ty, shadow: false });
          K.font(ctx, K.BODY, sc.ns, 700, 0); ctx.fillStyle = ink; ctx.fillText(sc.nm, x + 196, ry + rh / 2 - 8);
          K.font(ctx, K.MONO, 32, 500, 0); ctx.fillStyle = K.ensure(s.acc, paper, 3); ctx.fillText(sc.sub, x + 198, ry + rh / 2 + 50);
        } else {
          ctx.fillStyle = rgba(s.fg, s.light ? 0.07 : 0.08); U.rr(ctx, x, ry, w, rh, Math.min(40, C.look.radius)); ctx.fill();
          ctx.fillStyle = rgba(s.fg, 0.16); ctx.beginPath(); ctx.arc(x + 90, ry + rh / 2, 50, 0, TAU); ctx.fill();
          U.rr(ctx, x + 170, ry + rh / 2 - 36, w * 0.5, 30, 15); ctx.fill(); U.rr(ctx, x + 170, ry + rh / 2 + 16, w * 0.32, 24, 12); ctx.fill();
        }
        ctx.restore();
      }
      const tp = clamp((lt - tap) / 0.4);
      if (tp > 0 && tp < 1) { ctx.save(); ctx.strokeStyle = s.acc; ctx.globalAlpha = 1 - tp; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x + w - 150, ys[0] + hs[0] / 2, 40 + tp * 90, 0, TAU); ctx.stroke(); ctx.restore(); }
    },
  };

  // ══════════════════════════════ PRODUTO
  function offerSticker(ctx, C, sc, lt, cx, cy, size, t0) {
    if (!C.D.offer) return;
    const s = sc.s, p = pop(lt - t0, 15, 0.42); if (p <= 0) return;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.18 + Math.sin(lt * 2) * 0.03); ctx.scale(p, p);
    ctx.fillStyle = s.acc2; K.starN(ctx, 0, 0, size, size * 0.86, 16, lt * 0.3); ctx.fill();
    const b = K.place(head(ctx, C, C.D.offer, { maxW: size * 1.3, maxS: size * 0.4, minS: 22, maxLines: 3, upper: true }), 0, 0, 'center');
    K.drawText(ctx, b, 1, { fx: 'none', color: K.onColor(s.acc2) }); ctx.restore();
  }
  V.productHero = {
    kinds: ['product'], looks: 'any', w: 4,
    prep(ctx, C, sc) {
      const ny = 1430; sc.b = K.place(head(ctx, C, C.D.product, { maxW: 880, maxS: 120, minS: 54, maxLines: 2, upper: C.ty.upper && C.D.product.length < 20 }), W / 2, ny, 'center');
      const frame = C.frame, tall = frame === 'arch' || frame === 'card' || frame === 'glow' || frame === 'offset';
      sc.box = { cx: W / 2, cy: 800, w: frame === 'circle' || frame === 'blob' ? 640 : tall ? 620 : 600, h: frame === 'circle' || frame === 'blob' ? 640 : tall ? 780 : 640 };
      if (sc.b.top < sc.box.cy + sc.box.h / 2 + 60) sc.box.cy = sc.b.top - 60 - sc.box.h / 2;
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, p = pop(lt - sc.in + 0.05, 13, 0.55);
      decorate(ctx, C, sc, lt, { spots: [[120, 260], [960, 380], [110, 1680], [980, 1700]] });
      backShape(ctx, C, sc, lt, sc.box.cx, sc.box.cy, sc.box.w * 0.62, { w: sc.box.w, h: sc.box.h });
      if (p > 0) hero(ctx, C, sc, C.images.product, { ...sc.box, s: p, rot: (C.frame === 'polaroid' ? -0.05 : 0) + (1 - Math.min(1, p)) * 0.2 }, lt, { caption: C.frame === 'polaroid' ? C.D.brand : null });
      offerSticker(ctx, C, sc, lt, sc.box.cx + sc.box.w * 0.42, sc.box.cy - sc.box.h * 0.42, 118, sc.in + sc.beat * 2);
      txt(ctx, C, sc, sc.b, lt, { t0: sc.in + sc.beat, emph: emph(sc, sc.b, C.D.productKey, sc.em === 'circle' ? 'underline' : sc.em) });
    },
  };
  V.productFull = {
    kinds: ['product'], looks: ['bold', 'editorial', 'neon', 'clean', 'organic'], need: 'photo', w: 3,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.product, { maxW: 880, maxS: 150, minS: 60, maxLines: 3 }), MX, 1540, 'left', 'bot'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, img = K.scaled(C.images.product), rv = EIO(clamp((lt - sc.in + 0.2) / 0.55));
      ctx.save(); ctx.beginPath(); ctx.rect(0, H * (1 - rv), W, H * rv); ctx.clip();
      const z = 1.08 + 0.1 * clamp(lt / (sc.d + 0.5)); ctx.translate(W / 2, H * 0.45); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.45); K.cover(ctx, img, 0, 0, W, H, 1); ctx.restore();
      const g = ctx.createLinearGradient(0, sc.b.top - 480, 0, sc.b.top + 30); g.addColorStop(0, rgba(s.bg, 0)); g.addColorStop(0.55, rgba(s.bg, 0.62)); g.addColorStop(1, rgba(s.bg, 0.93)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (rv > 0.5) { const la = EO(clamp((lt - sc.in - 0.3) / 0.4)); ctx.save(); ctx.globalAlpha = la; const pw = K.pill(ctx, C.D.brand, -9999, -9999, { size: 34, loc: C.loc, scale: 0 }).w; K.pill(ctx, C.D.brand, MX + pw / 2, sc.b.top - 80, { size: 34, bg: s.acc, color: s.onAcc, loc: C.loc, scale: 1 }); ctx.restore(); }
      txt(ctx, C, sc, sc.b, lt, { t0: sc.in + sc.beat, emph: emph(sc, sc.b, C.D.productKey), shadow: null });
      offerSticker(ctx, C, sc, lt, W - 210, 420, 130, sc.in + sc.beat * 2);
    },
  };
  V.productSplit = {
    kinds: ['product'], looks: ['grid', 'clean', 'retro', 'bold'], w: 2,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.product, { maxW: 860, maxS: 120, minS: 54, maxLines: 2 }), MX, 1330, 'left', 'top'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, split = 1180, e = EIO(clamp((lt - sc.in + 0.15) / 0.5));
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * e, split); ctx.clip();
      const pic = C.images.product ? K.scaled(C.images.product) : K.artCard('split', W, split, s, C.logo, C.D.segIcon, sc.seed);
      K.cover(ctx, pic, 0, 0, W, split, 1.04 + 0.06 * clamp(lt / (sc.d + 0.5))); ctx.restore();
      ctx.fillStyle = s.acc; ctx.fillRect(0, split, W * e, 16);
      K.label(ctx, C.D.brand, MX, 1290, { size: 28, color: s.acc, fam: K.MONO, w: 700, t: lt, t0: sc.in + 0.2, loc: C.loc, ls: 0.14 });
      txt(ctx, C, sc, sc.b, lt, { t0: sc.in + sc.beat, emph: emph(sc, sc.b, C.D.productKey) });
      if (C.D.offer) { const p = pop(lt - sc.in - sc.beat * 2, 15, 0.5); if (p > 0) K.pill(ctx, C.D.offer, W - MX - 170, split - 20, { size: 34, bg: s.acc2, color: K.onColor(s.acc2), scale: p, rot: -0.05, loc: C.loc, shadow: C.look.shadow === 'hard' ? s.fg : null }); }
    },
  };
  V.productStack = {
    kinds: ['product'], looks: ['pop', 'organic', 'retro'], w: 2,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.product, { maxW: 880, maxS: 120, minS: 54, maxLines: 2 }), W / 2, 1470, 'center'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, fan = EO(clamp((lt - sc.in - sc.beat) / 0.5)), p = pop(lt - sc.in + 0.05, 14, 0.5);
      decorate(ctx, C, sc, lt);
      if (p > 0) {
        [[s.acc2, -0.16 * fan - 0.02, -70 * fan], [s.acc, 0.14 * fan + 0.02, 70 * fan]].forEach(([col, rot, dx]) => { ctx.save(); ctx.translate(W / 2 + dx, 790); ctx.rotate(rot); ctx.scale(p, p); ctx.fillStyle = col; U.rr(ctx, -300, -380, 600, 760, C.look.radius); ctx.fill(); if (C.look.stroke) { ctx.strokeStyle = s.fg; ctx.lineWidth = C.look.stroke; ctx.stroke(); } ctx.restore(); });
        hero(ctx, C, sc, C.images.product, { cx: W / 2, cy: 790, w: 600, h: 760, s: p, rot: -0.02 }, lt, { kind: 'card', shadow: C.look.shadow === 'hard' ? 'hard' : undefined });
      }
      offerSticker(ctx, C, sc, lt, W / 2 + 280, 440, 120, sc.in + sc.beat * 2);
      txt(ctx, C, sc, sc.b, lt, { t0: sc.in + sc.beat, emph: emph(sc, sc.b, C.D.productKey) });
    },
  };
  V.productPhone = {
    kinds: ['product'], looks: ['clean', 'neon', 'grid'], w: 2,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.product, { maxW: 880, maxS: 110, minS: 52, maxLines: 2 }), W / 2, 1500, 'center'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, pw = 470, ph = 900, cx = W / 2, cy = 790, rise = EO(clamp((lt - sc.in + 0.2) / 0.6));
      decorate(ctx, C, sc, lt);
      ctx.save(); ctx.translate(0, (1 - rise) * 900);
      ctx.save(); K.shadow(ctx, C.look.id === 'neon' ? s.acc : 'rgba(0,0,0,0.45)', 70, 0, 26); ctx.fillStyle = '#0D0D12'; U.rr(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 70); ctx.fill(); ctx.restore();
      const sx = cx - pw / 2 + 14, sy = cy - ph / 2 + 14, sw = pw - 28, sh = ph - 28;
      ctx.save(); U.rr(ctx, sx, sy, sw, sh, 58); ctx.clip();
      const pic = C.images.product ? K.scaled(C.images.product) : K.artCard('phone', sw, sh, s, C.logo, C.D.segIcon, sc.seed);
      K.cover(ctx, pic, sx, sy, sw, sh, 1.03 + 0.05 * clamp(lt / (sc.d + 0.5)));
      let g = ctx.createLinearGradient(0, sy, 0, sy + 200); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, 200);
      K.logo(ctx, C.logo, sx + 52, sy + 80, 52, { s, name: C.D.brand, loc: C.loc, ty: C.ty, shadow: false });
      K.font(ctx, K.BODY, 24, 700, 0); ctx.fillStyle = '#FFFFFF'; let nm = C.D.brand; while (U.tw(ctx, nm) > sw - 130 && nm.length > 3) nm = nm.slice(0, -2) + '…'; ctx.fillText(nm, sx + 92, sy + 88);
      const hp = pop(lt - sc.in - sc.beat * 2.5, 16, 0.4); if (hp > 0) { ctx.save(); ctx.translate(sx + sw / 2, sy + sh * 0.5); ctx.scale(hp * 1.6, hp * 1.6); ctx.globalAlpha = clamp(2 - hp * 1.2); U.icon(ctx, 'heart', 0, 0, 90, '#FFFFFF', 2.4); ctx.restore(); }
      ctx.restore(); ctx.restore();
      offerSticker(ctx, C, sc, lt, cx + pw / 2, cy - ph / 2 + 60, 110, sc.in + sc.beat * 2);
      txt(ctx, C, sc, sc.b, lt, { t0: sc.in + sc.beat, emph: emph(sc, sc.b, C.D.productKey) });
    },
  };

  // ══════════════════════════════ VANTAGENS
  function titleBlock(ctx, C, text, y = 420, align = 'center') { return K.place(head(ctx, C, text, { maxW: 880, maxS: 104, minS: 50, maxLines: 2 }), align === 'center' ? W / 2 : MX, y, align, 'bot'); }
  V.benList = {
    kinds: ['benefits'], looks: 'any', w: 4,
    prep(ctx, C, sc) {
      const items = C.D.benefits; sc.title = titleBlock(ctx, C, C.D.benefitsTitle, 470, 'left');
      const g = Math.min(250, 880 / Math.max(1, items.length)); sc.items = fitList(ctx, C, items, 720, 90, 44, g - 36); sc.ys = rows(items.length, 660, 1540, 250);
      sc.items.forEach((b, i) => K.place(b, MX + 160, sc.ys[i], 'left'));
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, n = sc.items.length, step = listStep(sc, n);
      decorate(ctx, C, sc, lt, { spots: [[960, 260], [980, 1660]] });
      txt(ctx, C, sc, sc.title, lt, { emph: null, stagger: 0.05 });
      sc.items.forEach((b, i) => {
        const t0 = sc.in + sc.beat + i * step, p = pop(lt - t0, 17, 0.5);
        if (C.look.id === 'grid' || C.look.id === 'editorial') { ctx.save(); ctx.strokeStyle = s.line; ctx.lineWidth = 2; ctx.globalAlpha = EO(clamp((lt - t0) / 0.4)); ctx.beginPath(); ctx.moveTo(MX, sc.ys[i] + 104); ctx.lineTo(W - MX, sc.ys[i] + 104); ctx.stroke(); ctx.restore(); }
        badge(ctx, C, sc, C.D.benefits[i].icon, MX + 62, sc.ys[i], 124, p);
        txt(ctx, C, sc, b, lt, { t0: t0 + 0.08, fx: sc.fx === 'stamp' || sc.fx === 'glitch' ? 'slide' : sc.fx, stagger: 0.035 });
      });
    },
  };
  V.benCards = {
    kinds: ['benefits'], looks: ['clean', 'pop', 'organic', 'neon'], w: 3,
    prep(ctx, C, sc) {
      sc.title = titleBlock(ctx, C, C.D.benefitsTitle, 460);
      const items = C.D.benefits, g = Math.min(250, 900 / Math.max(1, items.length)); sc.ch = Math.min(230, g - 22); sc.items = fitList(ctx, C, items, 660, 80, 40, sc.ch - 56); sc.ys = rows(items.length, 640, 1540, 250);
      sc.items.forEach((b, i) => K.place(b, MX + 190, sc.ys[i], 'left'));
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, n = sc.items.length, step = listStep(sc, n);
      decorate(ctx, C, sc, lt, { spots: [[970, 280], [110, 1700]] });
      txt(ctx, C, sc, sc.title, lt, { stagger: 0.05 });
      sc.items.forEach((b, i) => {
        const t0 = sc.in + sc.beat + i * step, p = EO(clamp((lt - t0) / 0.5)), y = sc.ys[i];
        if (p <= 0) return;
        const hh = sc.ch, bg = i % 2 && C.look.id === 'pop' ? s.acc2 : s.card;
        ctx.save(); ctx.globalAlpha = clamp(p * 2); ctx.translate((1 - p) * 700 * (i % 2 ? 1 : -1), 0); ctx.rotate(C.look.id === 'pop' ? (i % 2 ? 0.02 : -0.02) * p : 0);
        card(ctx, C, s, MX - 10, y - hh / 2, W - MX * 2 + 20, hh, { bg });
        badge(ctx, C, sc, C.D.benefits[i].icon, MX + 90, y, 108, 1, { style: C.look.badge === 'ring' ? 'circle' : C.look.badge });
        K.drawText(ctx, b, 1, { fx: 'none', color: K.ensure(bg === s.card ? s.cardFg : K.onColor(bg), bg, 4.6) });
        ctx.restore();
      });
    },
  };
  V.benGrid = {
    kinds: ['benefits'], looks: ['grid', 'clean', 'bold', 'retro'], w: 3,
    prep(ctx, C, sc) {
      sc.title = titleBlock(ctx, C, C.D.benefitsTitle, 470, 'left');
      const n = C.D.benefits.length, g = 24, x0 = MX - 10, wAll = W - x0 * 2, top = 560, hAll = 1000;
      sc.tiles = C.D.benefits.map((it, i) => {
        let x, y, w, h;
        if (n === 1) { x = x0; y = top; w = wAll; h = hAll; }
        else if (n === 2) { x = x0; w = wAll; h = (hAll - g) / 2; y = top + i * (h + g); }
        else if (n === 3) { if (i < 2) { w = (wAll - g) / 2; h = (hAll - g) / 2; x = x0 + i * (w + g); y = top; } else { x = x0; w = wAll; h = (hAll - g) / 2; y = top + h + g; } }
        else { w = (wAll - g) / 2; h = (hAll - g) / 2; x = x0 + (i % 2) * (w + g); y = top + Math.floor(i / 2) * (h + g); }
        const b = K.place(head(ctx, C, it.text, { maxW: w - 80, maxS: n <= 2 ? 96 : 78, minS: 36, maxLines: 3, upper: false }), x + 40, y + h - 44, 'left', 'bot');
        return { x, y, w, h, b, icon: it.icon };
      });
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, cols = [s.acc, s.card, s.acc2, s.card], step = listStep(sc, sc.tiles.length, 0.5);
      txt(ctx, C, sc, sc.title, lt, { stagger: 0.05 });
      sc.tiles.forEach((tl, i) => {
        const t0 = sc.in + sc.beat * 0.5 + i * step, p = C.look.id === 'grid' ? EO(clamp((lt - t0) / 0.35)) : pop(lt - t0, 16, 0.55);
        if (p <= 0) return;
        const bg = cols[i % 4], fg = K.ensure(bg === s.card ? s.cardFg : K.onColor(bg), bg, 4.5);
        ctx.save(); ctx.translate(tl.x + tl.w / 2, tl.y + tl.h / 2); ctx.scale(C.look.id === 'grid' ? 1 : p, C.look.id === 'grid' ? p : p); ctx.translate(-(tl.x + tl.w / 2), -(tl.y + tl.h / 2));
        card(ctx, C, s, tl.x, tl.y, tl.w, tl.h, { bg, r: C.look.id === 'grid' ? 0 : C.look.radius });
        U.icon(ctx, tl.icon, tl.x + 84, tl.y + 88, 88, fg, 2.2);
        if (C.look.id === 'grid' || C.look.id === 'bold') { K.font(ctx, K.MONO, 30, 700, 2); ctx.fillStyle = fg; ctx.fillText(String(i + 1).padStart(2, '0'), tl.x + tl.w - 76, tl.y + 58); }
        K.drawText(ctx, tl.b, 1, { fx: 'none', color: fg });
        ctx.restore();
      });
    },
  };
  V.benNumbers = {
    kinds: ['benefits', 'steps'], looks: ['bold', 'editorial', 'grid', 'retro', 'neon'], w: 3, ok: (sp, k) => (k === 'steps' ? sp.script.steps : sp.script.benefits).every((b) => String(b.text).length <= 26),
    prep(ctx, C, sc) {
      const items = sc.kind === 'steps' ? C.D.steps : C.D.benefits;
      sc.title = K.place(head(ctx, C, sc.kind === 'steps' ? C.D.stepsTitle : C.D.benefitsTitle, { maxW: 880, maxS: 130, minS: 60, maxLines: 2 }), W / 2, 960, 'center');
      sc.items = items.map((it) => K.place(head(ctx, C, it.text, { maxW: 860, maxS: 120, minS: 54, maxLines: 3, upper: false }), W / 2, 1180, 'center'));
      sc.icons = items.map((it) => it.icon);
      const n = items.length, tTitle = Math.min(sc.beat * 2, sc.d * 0.22); sc.tTitle = tTitle; sc.slot = (sc.d - sc.in - tTitle) / Math.max(1, n);
      sc.thumbT = sc.in + tTitle + (n - 1) * sc.slot + Math.min(0.7, sc.slot * 0.8); // miniatura com o último item já pousado
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s;
      if (lt < sc.in + sc.tTitle) { decorate(ctx, C, sc, lt); txt(ctx, C, sc, sc.title, lt, { exit: { t: sc.in + sc.tTitle - 0.18, dur: 0.18, fx: 'up' } }); return; }
      const i = clamp(Math.floor((lt - sc.in - sc.tTitle) / sc.slot), 0, sc.items.length - 1), tt = lt - sc.in - sc.tTitle - i * sc.slot;
      const num = String(i + 1).padStart(2, '0'), nb = K.place(head(ctx, C, num, { maxW: 900, maxS: 420, minS: 200, maxLines: 1, upper: false }), W / 2, 760, 'center');
      const outline = C.look.id === 'editorial' || C.look.id === 'neon' || C.look.id === 'grid';
      ctx.save(); const k = 1 + 0.12 * Math.exp(-tt * 10); ctx.translate(W / 2, 700); ctx.scale(k, k); ctx.translate(-W / 2, -700);
      if (outline) { K.font(ctx, nb.fam, nb.size, nb.w, nb.ls); ctx.lineWidth = 6; ctx.strokeStyle = s.acc; if (C.look.id === 'neon') K.shadow(ctx, s.acc, 30); ctx.strokeText(num, nb.lines[0].x0, nb.lines[0].y); }
      else K.drawText(ctx, nb, tt, { fx: 'none', color: s.acc });
      ctx.restore();
      badge(ctx, C, sc, sc.icons[i], W / 2, 980, 110, pop(tt - 0.05, 16, 0.5));
      txt(ctx, C, sc, sc.items[i], tt, { t0: 0.06, stagger: 0.03, dur: 0.38 });
      K.label(ctx, `${num} / ${String(sc.items.length).padStart(2, '0')}`, W / 2, 1600, { size: 28, color: s.mute, fam: K.MONO, w: 500, align: 'center' });
    },
  };
  V.benOne = {
    kinds: ['benefit1'], looks: 'any', w: 3,
    prep(ctx, C, sc) { const it = C.D.benefits[sc.item] || C.D.benefits[0]; sc.it = it; sc.b = K.place(head(ctx, C, it.text, { maxW: 860, maxS: 150, minS: 60, maxLines: 3 }), W / 2, 1180, 'center'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, num = String(sc.item + 1).padStart(2, '0');
      decorate(ctx, C, sc, lt);
      const nb = K.place(head(ctx, C, num, { maxW: 600, maxS: 300, minS: 120, maxLines: 1, upper: false }), W / 2, 640, 'center');
      ctx.save(); ctx.globalAlpha = 0.9 * EO(clamp((lt - sc.in + 0.1) / 0.4)); K.font(ctx, nb.fam, nb.size, nb.w, nb.ls); ctx.lineWidth = 5; ctx.strokeStyle = s.acc; ctx.strokeText(num, nb.lines[0].x0, nb.lines[0].y); ctx.restore();
      badge(ctx, C, sc, sc.it.icon, W / 2, 900, 150, pop(lt - sc.in, 15, 0.5));
      txt(ctx, C, sc, sc.b, lt, { t0: sc.in + sc.beat / 2, emph: emph(sc, sc.b, null) });
    },
  };

  // ══════════════════════════════ PROVA, OFERTA, DEPOIMENTO
  function fmtCount(v, f, loc) { if (!f) return String(Math.round(v)); const d = f.dec || 0, s = v.toFixed(d); let [ip, dp] = s.split('.'); if (f.group) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, f.group); return dp ? `${ip}${f.decSep}${dp}` : ip; }
  V.proofStars = {
    kinds: ['proof'], looks: 'any', w: 3,
    prep(ctx, C, sc) {
      const P = C.D.proof; sc.hasR = !!P.rating; sc.hasC = !!P.cust;
      const rv = parseFloat(String(P.rating).replace(',', '.')); sc.rv = isFinite(rv) ? rv : null;
      sc.custB = sc.hasC ? K.place(head(ctx, C, `${P.cust} ${P.custLabel}`.trim(), { maxW: 860, maxS: 90, minS: 44, maxLines: 2, upper: false }), W / 2, sc.hasR ? 1430 : 1000, 'center') : null;
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, P = C.D.proof;
      decorate(ctx, C, sc, lt);
      if (sc.hasR) {
        const cnt = EO(clamp((lt - sc.in) / Math.min(1.1, sc.beat * 3))), val = sc.rv != null ? sc.rv * cnt : null;
        const str = val != null ? (P.rating.includes(',') ? val.toFixed(1).replace('.', ',') : val.toFixed(1)) : P.rating;
        const b = K.place(head(ctx, C, str, { maxW: 800, maxS: 330, minS: 120, maxLines: 1, upper: false }), W / 2, 760, 'center');
        K.drawText(ctx, b, 1, { fx: 'none', color: s.fg, shadow: C.shadowFor(s) });
        const n = 5, fillTo = sc.rv != null ? clamp(sc.rv / 5) * n : n;
        for (let i = 0; i < n; i++) {
          const p = pop(lt - sc.in - 0.15 - i * 0.08, 18, 0.45); if (p <= 0) continue;
          const x = W / 2 + (i - 2) * 138, y = 1000, amt = clamp(fillTo - i);
          ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
          K.starN(ctx, 0, 0, 58, 25, 5); ctx.fillStyle = rgba(s.fg, 0.16); ctx.fill();
          if (amt > 0) { ctx.save(); ctx.beginPath(); ctx.rect(-60, -60, 120 * amt, 120); ctx.clip(); K.starN(ctx, 0, 0, 58, 25, 5); ctx.fillStyle = s.acc2 === s.fg ? s.acc : s.acc2; ctx.fill(); ctx.restore(); }
          ctx.restore();
        }
        K.label(ctx, P.src ? C.L.rating(P.src) : C.L.rating(''), W / 2, 1160, { size: 34, color: s.mute, fam: K.LABEL, align: 'center', t: lt, t0: sc.in + 0.6, loc: C.loc, ls: 0.12 });
      }
      if (sc.custB) txt(ctx, C, sc, sc.custB, lt, { t0: sc.in + (sc.hasR ? sc.beat * 2 : 0.1), emph: { i: 0, style: 'color', color: s.acc } });
    },
  };
  V.proofCounter = {
    kinds: ['proof'], looks: ['bold', 'pop', 'grid', 'retro', 'neon'], need: 'customers', w: 3,
    prep(ctx, C, sc) {
      const P = C.D.proof, m = String(P.cust).match(/\d[\d.,]*/); sc.nf = m ? C.parseNum(m[0]) : null; sc.pre = m ? P.cust.slice(0, m.index) : ''; sc.suf = m ? P.cust.slice(m.index + m[0].length) : '';
      sc.lab = K.place(head(ctx, C, P.custLabel || '', { maxW: 860, maxS: 96, minS: 44, maxLines: 2, upper: false }), W / 2, 1230, 'center');
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, P = C.D.proof, k = EO(clamp((lt - sc.in) / Math.min(1.3, sc.beat * 3.5)));
      decorate(ctx, C, sc, lt);
      const str = sc.nf ? sc.pre + fmtCount(sc.nf.v * k, sc.nf, C.loc) + sc.suf : P.cust;
      const b = K.place(head(ctx, C, str, { maxW: 900, maxS: 300, minS: 110, maxLines: 1, upper: false }), W / 2, 900, 'center');
      const land = lt - sc.in - Math.min(1.3, sc.beat * 3.5), sk = land > 0 ? 1 + 0.08 * Math.exp(-land * 12) : 1;
      ctx.save(); ctx.translate(W / 2, 880); ctx.scale(sk, sk); ctx.translate(-W / 2, -880); K.drawText(ctx, b, 1, { fx: 'none', color: s.acc, shadow: C.shadowFor(s) }); ctx.restore();
      if (land > 0) for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + sc.seed, d = 200 + land * 900, al = clamp(1 - land * 1.6); if (al <= 0) break; ctx.fillStyle = rgba(i % 2 ? s.acc2 : s.acc, al); ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * d, 880 + Math.sin(a) * d * 0.8, 10, 0, TAU); ctx.fill(); }
      txt(ctx, C, sc, sc.lab, lt, { t0: sc.in + sc.beat });
      if (P.rating) K.label(ctx, `★ ${P.rating}${P.src ? ` · ${P.src}` : ''}`, W / 2, 1480, { size: 40, color: s.mute, fam: K.LABEL, align: 'center', t: lt, t0: sc.in + sc.beat * 2, upper: false });
    },
  };
  V.offerBurst = {
    kinds: ['offer'], looks: ['pop', 'retro', 'bold', 'organic', 'clean'], w: 3,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.offer, { maxW: 560, maxS: 170, minS: 56, maxLines: 3, upper: true }), W / 2, 980, 'center'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, p = pop(lt - sc.in, 13, 0.45);
      decorate(ctx, C, sc, lt);
      K.label(ctx, C.L.offer, W / 2, 520, { size: 44, color: s.acc, fam: K.LABEL, align: 'center', t: lt, t0: sc.in, loc: C.loc, ls: 0.3 });
      if (p > 0) {
        ctx.save(); ctx.translate(W / 2, 960); ctx.rotate(lt * 0.35); ctx.scale(p, p);
        if (C.look.shadow === 'hard') { ctx.fillStyle = s.fg; K.starN(ctx, 16, 16, 420, 360, 22); ctx.fill(); }
        ctx.fillStyle = s.acc; K.starN(ctx, 0, 0, 420, 360, 22); ctx.fill();
        ctx.restore();
      }
      txt(ctx, C, sc, sc.b, lt, { t0: sc.in + sc.beat * 0.5, color: s.onAcc, shadow: null, fx: sc.fx === 'type' ? 'pop' : sc.fx });
    },
  };
  V.offerTag = {
    kinds: ['offer'], looks: ['clean', 'editorial', 'organic', 'neon'], w: 2,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.offer, { maxW: 600, maxS: 160, minS: 56, maxLines: 3, upper: C.ty.upper }), 0, 0, 'center'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, drop = K.bounceOut(clamp((lt - sc.in + 0.1) / 0.7)), sw = Math.sin(lt * 3.2) * 0.1 * Math.exp(-Math.max(0, lt - sc.in) * 1.2);
      decorate(ctx, C, sc, lt);
      K.label(ctx, C.L.offer, W / 2, 470, { size: 44, color: s.acc, fam: K.LABEL, align: 'center', t: lt, t0: sc.in, loc: C.loc, ls: 0.3 });
      ctx.save(); ctx.translate(W / 2, 600 - (1 - drop) * 900); ctx.rotate(sw);
      ctx.strokeStyle = s.fg; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 120); ctx.stroke();
      const w = Math.max(640, sc.b.width + 180), h = sc.b.height + 300, y0 = 120;
      ctx.fillStyle = C.look.id === 'neon' ? s.bg : s.acc; ctx.beginPath(); ctx.moveTo(-w / 2 + 60, y0); ctx.lineTo(w / 2 - 60, y0); ctx.lineTo(w / 2, y0 + 70); ctx.lineTo(w / 2, y0 + h); ctx.lineTo(-w / 2, y0 + h); ctx.lineTo(-w / 2, y0 + 70); ctx.closePath(); ctx.fill();
      if (C.look.id === 'neon') { K.shadow(ctx, s.acc, 30); ctx.strokeStyle = s.acc; ctx.lineWidth = 5; ctx.stroke(); K.noShadow(ctx); }
      ctx.fillStyle = s.bg; ctx.beginPath(); ctx.arc(0, y0 + 60, 18, 0, TAU); ctx.fill();
      K.place(sc.b, 0, y0 + 90 + h / 2, 'center'); K.drawText(ctx, sc.b, 1, { fx: 'none', color: C.look.id === 'neon' ? s.fg : s.onAcc });
      ctx.restore();
    },
  };
  V.offerFlash = {
    kinds: ['offer'], looks: ['bold', 'neon', 'grid'], w: 2,
    prep(ctx, C, sc) { sc.b = K.place(head(ctx, C, C.D.offer, { maxW: 900, maxS: 240, minS: 70, maxLines: 3, upper: true }), W / 2, 960, 'center'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, beats = Math.floor((lt - sc.in) / (sc.beat / 2)), strobe = lt > sc.in && beats < 4;
      if (strobe && beats % 2 === 0) { ctx.fillStyle = s.acc; ctx.fillRect(0, 0, W, H); }
      K.label(ctx, C.L.offer, W / 2, 560, { size: 46, color: strobe && beats % 2 === 0 ? s.onAcc : s.acc, fam: K.MONO, align: 'center', t: lt, t0: sc.in, loc: C.loc, ls: 0.4 });
      K.drawText(ctx, sc.b, lt, { fx: 'stamp', t0: sc.in, stagger: 0.03, dur: 0.2, color: strobe && beats % 2 === 0 ? s.onAcc : s.fg, shadow: C.shadowFor(s) });
      decorate(ctx, C, sc, lt);
    },
  };
  V.quoteCard = {
    kinds: ['quote'], looks: 'any', w: 3,
    prep(ctx, C, sc) {
      const q = C.D.quote; sc.b = K.place(K.block(ctx, `“${q}”`, C.ty.italic ? { ...C.ty } : C.ty, { loc: C.loc, maxW: 860, maxS: 96, minS: 44, maxLines: 5, upper: false, italic: !!C.ty.italic }), MX, 960, 'left');
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, a = EO(clamp((lt - sc.in) / 0.5));
      ctx.save(); ctx.globalAlpha = a; K.font(ctx, "'DM Serif Display'", 460, 400, 0); ctx.fillStyle = s.acc; ctx.fillText('“', MX - 20, sc.b.top + 150); ctx.restore();
      decorate(ctx, C, sc, lt, { spots: [[960, 300], [980, 1700]] });
      txt(ctx, C, sc, sc.b, lt, { fx: sc.fx === 'stamp' || sc.fx === 'glitch' || sc.fx === 'type' ? 'fade' : sc.fx, stagger: Math.min(0.09, (sc.d * 0.45) / Math.max(1, sc.b.count)), shadow: null });
      const ta = sc.in + Math.min(sc.d * 0.55, sc.b.count * 0.09 + 0.4), pa = pop(lt - ta, 16, 0.5);
      if (pa > 0 && C.D.author) {
        const y = sc.b.bot + 150; ctx.save(); ctx.globalAlpha = clamp(pa); ctx.fillStyle = s.acc2; ctx.beginPath(); ctx.arc(MX + 46, y - 14, 46 * pa, 0, TAU); ctx.fill();
        K.font(ctx, C.ty.head, 44, C.ty.w, 0); ctx.fillStyle = K.onColor(s.acc2); const ch = C.D.author.charAt(0).toLocaleUpperCase(C.loc); ctx.fillText(ch, MX + 46 - U.tw(ctx, ch) / 2, y + 2); ctx.restore();
        K.label(ctx, C.D.author, MX + 120, y, { size: 42, color: s.fg, fam: K.BODY, w: 700, upper: false, t: lt, t0: ta, ls: 0 });
        if (C.D.proof.rating) K.label(ctx, `★★★★★  ${C.D.proof.rating}${C.D.proof.src ? ` · ${C.D.proof.src}` : ''}`, MX + 120, y + 52, { size: 30, color: s.acc, fam: K.LABEL, upper: false, t: lt, t0: ta + 0.1, ls: 0.02 });
      }
    },
  };

  // ══════════════════════════════ FOTOS e PASSO A PASSO (vídeo de 30 s)
  V.showCollage = {
    kinds: ['showcase'], looks: ['pop', 'organic', 'retro', 'editorial', 'clean'], w: 3,
    prep(ctx, C, sc) {
      sc.title = K.place(head(ctx, C, C.D.showcaseTitle, { maxW: 880, maxS: 110, minS: 50, maxLines: 2 }), W / 2, 420, 'center', 'bot');
      const imgs = C.gallery.length ? C.gallery : [C.images.product].filter(Boolean);
      const L3 = [{ cx: 360, cy: 830, w: 520, h: 600, r: -0.07 }, { cx: 720, cy: 1080, w: 500, h: 580, r: 0.06 }, { cx: 420, cy: 1380, w: 480, h: 440, r: 0.03 }];
      const L2 = [{ cx: 380, cy: 860, w: 560, h: 660, r: -0.06 }, { cx: 700, cy: 1250, w: 560, h: 620, r: 0.05 }];
      const L1 = [{ cx: W / 2, cy: 1000, w: 720, h: 900, r: -0.03 }];
      sc.imgs = imgs.slice(0, 3); sc.pos = [L1, L2, L3][sc.imgs.length - 1] || L1;
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, step = listStep(sc, sc.imgs.length);
      decorate(ctx, C, sc, lt);
      txt(ctx, C, sc, sc.title, lt, { stagger: 0.05 });
      sc.imgs.forEach((img, i) => {
        const p = pop(lt - sc.in - sc.beat - i * step, 13, 0.55); if (p <= 0) return;
        const q = sc.pos[i], drift = Math.sin(lt * 0.8 + i) * 8;
        const kind = C.frame === 'circle' ? 'card' : C.frame;
        hero(ctx, C, sc, img, { cx: q.cx, cy: q.cy + drift, w: q.w, h: q.h, rot: q.r + (1 - Math.min(1, p)) * 0.3, s: p }, lt, { kind, key: `c${i}`, kb: 0.05 });
      });
    },
  };
  V.showCarousel = {
    kinds: ['showcase'], looks: ['clean', 'bold', 'editorial', 'neon', 'grid'], w: 3,
    prep(ctx, C, sc) {
      sc.title = K.place(head(ctx, C, C.D.showcaseTitle, { maxW: 880, maxS: 100, minS: 48, maxLines: 2 }), MX, 400, 'left', 'bot');
      const imgs = C.gallery.length ? C.gallery : [C.images.product].filter(Boolean);
      sc.imgs = imgs.length ? imgs.slice(0, 3) : [null];
      sc.crops = sc.imgs.length === 1 ? [[0.5, 0.5, 1.05], [0.3, 0.35, 1.5], [0.7, 0.6, 1.7]] : sc.imgs.map(() => [0.5, 0.5, 1.05]);
      sc.n = sc.crops.length;
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, slot = (sc.d - sc.in - 0.3) / sc.n, x = MX - 10, w = W - x * 2, y = 500, h = 1060;
      txt(ctx, C, sc, sc.title, lt, { stagger: 0.05 });
      const f = clamp((lt - sc.in - 0.2) / slot, 0, sc.n - 1), i = Math.floor(f), tr = EIO(clamp((f - i - 0.82) / 0.18));
      ctx.save(); U.rr(ctx, x, y, w, h, C.look.radius); ctx.clip();
      [i, i + 1].forEach((j, k) => {
        if (j >= sc.n) return;
        const img = sc.imgs[Math.min(j, sc.imgs.length - 1)], cr = sc.crops[j], off = (k - tr) * w;
        ctx.save(); ctx.translate(off, 0);
        const pic = img ? K.scaled(img) : K.artCard('car', Math.round(w), Math.round(h), s, C.logo, C.D.segIcon, sc.seed);
        const z = cr[2] + 0.06 * clamp((lt - sc.in - j * slot) / slot);
        K.cover(ctx, pic, x, y, w, h, z, cr[0], cr[1]); ctx.restore();
      });
      ctx.restore();
      if (C.look.id === 'neon') { ctx.save(); K.shadow(ctx, s.acc, 36); ctx.strokeStyle = s.acc; ctx.lineWidth = 5; U.rr(ctx, x, y, w, h, C.look.radius); ctx.stroke(); ctx.restore(); }
      for (let j = 0; j < sc.n; j++) { ctx.fillStyle = j === Math.round(f) ? s.acc : s.line; ctx.beginPath(); ctx.arc(W / 2 + (j - (sc.n - 1) / 2) * 40, y + h + 60, j === Math.round(f) ? 11 : 8, 0, TAU); ctx.fill(); }
    },
  };
  V.stepsPath = {
    kinds: ['steps'], looks: 'any', w: 3,
    prep(ctx, C, sc) {
      sc.title = K.place(head(ctx, C, C.D.stepsTitle, { maxW: 880, maxS: 104, minS: 50, maxLines: 2 }), MX, 450, 'left', 'bot');
      const g = Math.min(320, 800 / Math.max(1, C.D.steps.length)); sc.items = fitList(ctx, C, C.D.steps, 680, 88, 40, g - 96); sc.ys = rows(sc.items.length, 700, 1500, 320);
      sc.items.forEach((b, i) => K.place(b, MX + 200, sc.ys[i], 'left'));
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, n = sc.items.length, step = listStep(sc, n), x = MX + 74;
      decorate(ctx, C, sc, lt, { spots: [[970, 280], [980, 1690]] });
      txt(ctx, C, sc, sc.title, lt, { stagger: 0.05 });
      const lp = clamp((lt - sc.in - sc.beat) / (step * (n - 1) + 0.01));
      if (n > 1) { ctx.save(); ctx.strokeStyle = s.line; ctx.lineWidth = 6; ctx.setLineDash(C.look.id === 'pop' || C.look.id === 'organic' ? [2, 18] : []); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, sc.ys[0]); ctx.lineTo(x, lerp(sc.ys[0], sc.ys[n - 1], lp)); ctx.stroke(); ctx.restore(); }
      sc.items.forEach((b, i) => {
        const t0 = sc.in + sc.beat + i * step, p = pop(lt - t0, 16, 0.5); if (p <= 0) return;
        ctx.save(); ctx.translate(x, sc.ys[i]); ctx.scale(p, p); ctx.fillStyle = s.acc; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill();
        U.icon(ctx, C.D.steps[i].icon, 0, 0, 64, s.onAcc, 2.2); ctx.restore();
        const np = EO(clamp((lt - t0) / 0.35)); ctx.save(); ctx.globalAlpha = np; K.font(ctx, K.MONO, 30, 700, 2); ctx.fillStyle = s.acc; ctx.fillText(String(i + 1).padStart(2, '0'), MX + 200, sc.ys[i] - b.height / 2 - 26); ctx.restore();
        txt(ctx, C, sc, b, lt, { t0: t0 + 0.1, fx: sc.fx === 'stamp' || sc.fx === 'glitch' || sc.fx === 'type' ? 'rise' : sc.fx, stagger: 0.035 });
      });
    },
  };

  // ══════════════════════════════ FRASE (slogan)
  V.stateKinetic = {
    kinds: ['statement'], looks: ['bold', 'grid', 'neon', 'pop', 'retro'], w: 2, ok: (sp) => nWords(sp.script.tagline) <= 12 && longest(sp.script.tagline) <= 14,
    prep(ctx, C, sc) {
      // uma palavra por linha; frase longa junta vizinhas (as menores primeiro) até ficar em 6 linhas
      const ws = C.D.tagline.split(/\s+/).filter(Boolean);
      while (ws.length > 6) { let best = 0, bl = Infinity; for (let i = 0; i < ws.length - 1; i++) { const L = ws[i].length + ws[i + 1].length; if (L < bl) { bl = L; best = i; } } ws.splice(best, 2, ws[best] + ' ' + ws[best + 1]); }
      const n = ws.length;
      const hAvail = 1120, lhK = 1.02;
      const sizes = ws.map((w, i) => head(ctx, C, w, { maxW: 880, maxS: i === n - 1 ? 280 : 200, minS: 70, maxLines: 1 }).size);
      const tot = sizes.reduce((a, b) => a + b * lhK, 0), k = Math.min(1, hAvail / tot);
      let y = 960 - (tot * k) / 2;
      sc.lines = ws.map((w, i) => { const sz = Math.max(60, Math.round(sizes[i] * k)); const b = head(ctx, C, w, { maxW: 880, maxS: sz, minS: 50, maxLines: 1 }); y += b.cap + (i ? (sz * lhK - b.cap) : 0); const al = i % 3 === 0 ? 'left' : i % 3 === 1 ? 'right' : 'center'; K.place(b, al === 'left' ? MX : al === 'right' ? W - MX : W / 2, y, al, 'bot'); return b; });
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, step = Math.min(sc.beat / 2, (sc.d * 0.6) / Math.max(1, sc.lines.length));
      decorate(ctx, C, sc, lt);
      sc.lines.forEach((b, i) => {
        const t0 = sc.in + i * step, last = i === sc.lines.length - 1, outline = !last && C.look.id !== 'pop' && i % 3 === 1;
        if (outline) { const p = EO(clamp((lt - t0) / 0.3)); if (p <= 0) return; ctx.save(); ctx.globalAlpha = p; K.font(ctx, b.fam, b.size, b.w, b.ls); ctx.strokeStyle = s.fg; ctx.lineWidth = Math.max(3, b.size * 0.03); ctx.strokeText(b.lines[0].text, b.lines[0].x0 + (1 - p) * 80, b.lines[0].y); ctx.restore(); return; }
        K.drawText(ctx, b, lt, { fx: i % 2 ? 'slide' : 'stamp', t0, stagger: 0, dur: 0.24, color: last ? s.acc : s.fg, shadow: C.shadowFor(s) });
      });
    },
  };

  // ══════════════════════════════ CHAMADA (contato)
  function contactRows(ctx, C, sc, lt, t0, y0, o = {}) {
    const s = sc.s, R = C.D.contact; if (!R.length) return 0;
    const gap = o.gap || 128, x = o.x || MX + 10;
    R.forEach((r, i) => {
      const p = EO(clamp((lt - t0 - i * 0.12) / 0.4)); if (p <= 0) return;
      const y = y0 + i * gap;
      ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - p) * -80, 0);
      badge(ctx, C, sc, r.icon, x + 40, y, 80, 1, { style: C.look.badge === 'glow' ? 'glow' : 'circle' });
      K.font(ctx, r.mono ? K.MONO : K.BODY, r.size, r.mono ? 500 : 700, 0); ctx.fillStyle = s.fg; ctx.fillText(r.text, x + 110, y + r.size * 0.36);
      ctx.restore();
    });
    return R.length * gap;
  }
  function fitContacts(ctx, C) { C.D.contact.forEach((r) => { let sz = r.mono ? 50 : 46; K.font(ctx, r.mono ? K.MONO : K.BODY, sz, r.mono ? 500 : 700, 0); while (U.tw(ctx, r.text) > 740 && sz > 26) { sz -= 1; K.font(ctx, r.mono ? K.MONO : K.BODY, sz, r.mono ? 500 : 700, 0); } r.size = sz; }); }
  V.ctaButton = {
    kinds: ['cta'], looks: 'any', w: 4,
    prep(ctx, C, sc) { fitContacts(ctx, C); const n = C.D.contact.length; sc.btn = K.place(head(ctx, C, C.D.cta, { maxW: 720, maxS: 116, minS: 44, maxLines: 2, upper: C.ty.upper }), W / 2, n ? 780 - n * 30 : 960, 'center'); sc.rowsY = sc.btn.bot + 250; },
    draw(ctx, C, sc, lt) {
      const s = sc.s, b = sc.btn, p = pop(lt - sc.in, 15, 0.5), tap = sc.in + sc.beat * 2.5, press = lt > tap ? 1 - 0.06 * Math.exp(-(lt - tap) * 10) * Math.sin(Math.min(Math.PI, (lt - tap) * 14)) : 1;
      decorate(ctx, C, sc, lt, { spots: [[140, 330], [950, 360], [980, 1700]] });
      const w = b.width + 150, h = b.height + 120, cy = (b.top + b.bot) / 2;
      if (p > 0) {
        ctx.save(); ctx.translate(W / 2, cy); ctx.scale(p * press, p * press); ctx.translate(-W / 2, -cy);
        const pl = pulse(C, sc, lt); if (pl > 0.01) { ctx.save(); ctx.globalAlpha = 0.35 * pl; ctx.fillStyle = s.acc; U.rr(ctx, W / 2 - w / 2 - 20 * pl, cy - h / 2 - 20 * pl, w + 40 * pl, h + 40 * pl, (h + 40 * pl) / 2); ctx.fill(); ctx.restore(); }
        card(ctx, C, s, W / 2 - w / 2, cy - h / 2, w, h, { r: C.look.id === 'grid' ? 0 : h / 2, bg: s.acc });
        K.drawText(ctx, b, 1, { fx: 'none', color: s.onAcc });
        ctx.restore();
      }
      if (lt > tap - 0.35 && lt < tap + 0.7) { const cp = EO(clamp((lt - tap + 0.35) / 0.35)), fx = W / 2 + w * 0.3 + (1 - cp) * 200, fy = cy + h * 0.3 + (1 - cp) * 240; ctx.save(); ctx.globalAlpha = clamp((tap + 0.7 - lt) / 0.2); ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 12, fy + 58); ctx.lineTo(fx + 26, fy + 42); ctx.lineTo(fx + 48, fy + 64); ctx.lineTo(fx + 58, fy + 54); ctx.lineTo(fx + 36, fy + 32); ctx.lineTo(fx + 56, fy + 22); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
      if (lt > tap && lt < tap + 0.5) { const rp = (lt - tap) / 0.5; ctx.save(); ctx.strokeStyle = s.acc; ctx.globalAlpha = 1 - rp; ctx.lineWidth = 6; U.rr(ctx, W / 2 - w / 2 - rp * 60, cy - h / 2 - rp * 60, w + rp * 120, h + rp * 120, (h + rp * 120) / 2); ctx.stroke(); ctx.restore(); }
      contactRows(ctx, C, sc, lt, sc.in + sc.beat, sc.rowsY);
    },
  };
  V.ctaWhats = {
    kinds: ['cta'], looks: ['pop', 'clean', 'organic', 'neon'], need: 'whatsapp', w: 3,
    prep(ctx, C, sc) { fitContacts(ctx, C); sc.b = K.place(body(ctx, C, C.D.cta, { maxW: 620, maxS: 84, minS: 44, maxLines: 2 }), MX + 60, 780, 'left'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, b = sc.b, p = pop(lt - sc.in, 15, 0.5), x = MX + 10, y = b.top - 60, w = b.width + 110, h = b.height + 120;
      decorate(ctx, C, sc, lt);
      if (p > 0) { ctx.save(); ctx.translate(x, y + h); ctx.scale(p, p); ctx.translate(-x, -(y + h)); card(ctx, C, s, x, y, w, h, { r: 46, bg: '#25D366' }); ctx.fillStyle = '#25D366'; ctx.beginPath(); ctx.moveTo(x + 30, y + h - 10); ctx.lineTo(x - 18, y + h + 34); ctx.lineTo(x + 90, y + h - 10); ctx.fill(); ctx.restore(); }
      txt(ctx, C, sc, b, lt, { t0: sc.in + 0.2, color: '#0B2915', fx: 'fade', shadow: null });
      K.label(ctx, '✓✓', x + w - 90, y + h - 24, { size: 26, color: '#0B6B34', fam: K.BODY, t: lt, t0: sc.in + 0.5, upper: false });
      contactRows(ctx, C, sc, lt, sc.in + sc.beat * 1.5, 1180);
    },
  };

  // ══════════════════════════════ ENCERRAMENTO (marca)
  V.outroLockup = {
    kinds: ['outro'], looks: 'any', w: 4,
    prep(ctx, C, sc) {
      sc.name = K.place(head(ctx, C, C.D.brand, { maxW: 880, maxS: 150, minS: 64, maxLines: 2 }), W / 2, 1110, 'center', 'top');
      sc.tag = C.D.tagline ? K.place(body(ctx, C, C.D.tagline, { maxW: 820, maxS: 56, minS: 34, maxLines: 2 }), W / 2, sc.name.bot + 90, 'center', 'top') : null;
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, p = pop(lt - sc.in, 13, 0.5), cy = 860;
      decorate(ctx, C, sc, lt);
      if (p > 0) {
        ctx.save(); ctx.translate(W / 2, cy); ctx.scale(p, p); ctx.translate(-W / 2, -cy);
        const ringA = clamp((lt - sc.in) / 0.8); if (ringA < 1) { ctx.save(); ctx.strokeStyle = s.acc; ctx.globalAlpha = 1 - ringA; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(W / 2, cy, 150 + ringA * 260, 0, TAU); ctx.stroke(); ctx.restore(); }
        K.logo(ctx, C.logo, W / 2, cy, 250, { s, name: C.D.brand, loc: C.loc, ty: C.ty, ring: C.look.id === 'neon' ? s.acc : null });
        ctx.restore();
      }
      txt(ctx, C, sc, sc.name, lt, { t0: sc.in + sc.beat * 0.75, emph: null });
      if (sc.tag) txt(ctx, C, sc, sc.tag, lt, { t0: sc.in + sc.beat * 1.75, fx: 'fade', color: s.mute, shadow: null, stagger: 0.03 });
      const h = C.D.handle || C.D.site; if (h) K.label(ctx, h, W / 2, 1640, { size: 36, color: s.acc, fam: K.MONO, w: 500, align: 'center', t: lt, t0: sc.in + sc.beat * 2.5, upper: false });
    },
  };
  V.outroStamp = {
    kinds: ['outro'], looks: ['pop', 'retro', 'bold'], w: 3,
    prep(ctx, C, sc) { sc.name = K.place(head(ctx, C, C.D.brand, { maxW: 820, maxS: 150, minS: 60, maxLines: 2 }), W / 2, 1180, 'center', 'top'); },
    draw(ctx, C, sc, lt) {
      const s = sc.s, t0 = sc.in, k = clamp((lt - t0) / 0.14), sc_ = k < 1 ? lerp(2.4, 1, k * k) : 1 + 0.05 * Math.exp(-(lt - t0 - 0.14) * 12) * Math.cos((lt - t0 - 0.14) * 38), cy = 880;
      decorate(ctx, C, sc, lt);
      if (lt >= t0) {
        ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(lt * 0.2); ctx.fillStyle = s.acc2; K.starN(ctx, 0, 0, 300 * Math.min(1, sc_), 250 * Math.min(1, sc_), 20); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(W / 2, cy); ctx.scale(sc_, sc_); ctx.rotate(-0.05); ctx.globalAlpha = clamp(k * 3); K.logo(ctx, C.logo, 0, 0, 280, { s, name: C.D.brand, loc: C.loc, ty: C.ty }); ctx.restore();
      }
      const nb = sc.name, w = nb.width + 110, h = nb.height + 90, rp = EO(clamp((lt - t0 - sc.beat) / 0.4));
      if (rp > 0) { ctx.save(); ctx.translate(W / 2, (nb.top + nb.bot) / 2); ctx.rotate(-0.03); ctx.scale(rp, 1); if (C.look.shadow === 'hard') { ctx.fillStyle = s.fg; ctx.fillRect(-w / 2 + 12, -h / 2 + 12, w, h); } ctx.fillStyle = s.acc; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); }
      if (rp > 0.6) { ctx.save(); ctx.translate(W / 2, (nb.top + nb.bot) / 2); ctx.rotate(-0.03); ctx.translate(-W / 2, -(nb.top + nb.bot) / 2); K.drawText(ctx, nb, lt, { fx: 'pop', t0: t0 + sc.beat + 0.2, stagger: 0.03, color: s.onAcc }); ctx.restore(); }
      if (C.D.tagline) K.label(ctx, C.D.tagline, W / 2, 1560, { size: 40, color: s.fg, fam: K.BODY, w: 700, align: 'center', t: lt, t0: t0 + sc.beat * 2, upper: false, ls: 0 });
    },
  };
  V.outroMinimal = {
    kinds: ['outro'], looks: ['editorial', 'clean', 'neon', 'organic', 'grid'], w: 3,
    prep(ctx, C, sc) {
      sc.name = K.place(head(ctx, C, C.D.brand, { maxW: 880, maxS: 170, minS: 64, maxLines: 2 }), W / 2, 980, 'center');
      sc.tag = C.D.tagline ? K.place(K.block(ctx, C.D.tagline, C.ty.italic ? C.ty : { ...C.ty, upper: false }, { loc: C.loc, maxW: 820, maxS: 64, minS: 36, maxLines: 2, upper: false, italic: !!C.ty.italic }), W / 2, sc.name.bot + 150, 'center', 'top') : null;
    },
    draw(ctx, C, sc, lt) {
      const s = sc.s, la = EO(clamp((lt - sc.in) / 0.5));
      if (la > 0) { ctx.save(); ctx.globalAlpha = la; K.logo(ctx, C.logo, W / 2, sc.name.top - 170, 150, { s, name: C.D.brand, loc: C.loc, ty: C.ty, shadow: false }); ctx.restore(); }
      txt(ctx, C, sc, sc.name, lt, { t0: sc.in + sc.beat * 0.5, fx: sc.fx === 'stamp' || sc.fx === 'glitch' ? 'rise' : sc.fx, shadow: null });
      const lp = EIO(clamp((lt - sc.in - sc.beat * 1.2) / 0.6)); if (lp > 0) { ctx.save(); ctx.strokeStyle = s.acc; ctx.lineWidth = 5; if (C.look.id === 'neon') K.shadow(ctx, s.acc, 24); ctx.beginPath(); ctx.moveTo(W / 2 - 200 * lp, sc.name.bot + 70); ctx.lineTo(W / 2 + 200 * lp, sc.name.bot + 70); ctx.stroke(); ctx.restore(); }
      if (sc.tag) txt(ctx, C, sc, sc.tag, lt, { t0: sc.in + sc.beat * 1.6, fx: 'fade', color: s.mute, shadow: null, stagger: 0.04 });
      const h = C.D.handle || C.D.site; if (h) K.label(ctx, h, W / 2, 1650, { size: 34, color: s.mute, fam: K.MONO, w: 500, align: 'center', t: lt, t0: sc.in + sc.beat * 2.4, upper: false });
    },
  };

  // ══════════════════════════════ acontecimentos para a trilha (tempo local da cena, tipo, índice)
  const at = (sc, x) => sc.in + x;
  const each = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const wordHits = (sc, b, t0, st, type = 'word') => each(Math.min(8, b.count), (i) => [t0 + i * st, i === b.count - 1 && type === 'word' ? 'stamp' : type]);
  const strong = (sc) => sc.fx === 'stamp' || sc.fx === 'pop' || sc.fx === 'drop' || sc.fx === 'zoom';
  const HITS = {
    hookStack: (C, sc) => (strong(sc) ? wordHits(sc, sc.b, sc.in, Math.min(sc.beat / 2, (sc.d * 0.45) / Math.max(1, sc.b.count))) : [[sc.in, 'swoosh']]),
    hookWords: (C, sc) => [...sc.ws.map((_, i) => [sc.in + i * sc.slot, 'word']), [sc.fin, 'stamp']],
    hookMarquee: (C, sc) => [[sc.in, 'swoosh'], [at(sc, 0.1), 'thud']],
    hookType: () => [],
    hookPhoto: (C, sc) => [[sc.in, 'swoosh']],
    hookSplit: (C, sc) => [[sc.in, 'swoosh'], [at(sc, sc.beat), 'thud']],
    hookStickers: (C, sc) => K.words(sc.b).slice(0, 8).map((w) => [sc.in + w.i * (sc.beat / 2), 'pop', w.i]),
    painBig: (C, sc) => [[sc.in, 'swoosh'], ...(C.look.energy > 0.6 ? [[at(sc, sc.beat * 2), 'stamp']] : [])],
    painChat: (C, sc) => [[sc.in, 'pop'], [at(sc, sc.beat * 2), 'pop']],
    painStrike: (C, sc) => [[sc.in, 'swoosh'], [at(sc, sc.beat * 2.5), 'swoosh']],
    painGlitch: (C, sc) => [[sc.in, 'strobe'], [at(sc, 0.12), 'strobe']],
    searchBar: (C, sc) => [[sc.in, 'pop'], [sc.tRes, 'pop'], [sc.tap, 'click']],
    productHero: (C, sc) => [[sc.in, 'pop'], ...(C.D.offer ? [[at(sc, sc.beat * 2), 'pop']] : [])],
    productFull: (C, sc) => [[sc.in, 'swoosh'], ...(C.D.offer ? [[at(sc, sc.beat * 2), 'pop']] : [])],
    productSplit: (C, sc) => [[sc.in, 'swoosh'], ...(C.D.offer ? [[at(sc, sc.beat * 2), 'pop']] : [])],
    productStack: (C, sc) => [[sc.in, 'pop'], [at(sc, sc.beat), 'swoosh'], ...(C.D.offer ? [[at(sc, sc.beat * 2), 'pop']] : [])],
    productPhone: (C, sc) => [[sc.in, 'swoosh'], [at(sc, sc.beat * 2.5), 'pop']],
    benList: (C, sc) => each(sc.items.length, (i) => [at(sc, sc.beat + i * listStep(sc, sc.items.length)), 'item']),
    benCards: (C, sc) => each(sc.items.length, (i) => [at(sc, sc.beat + i * listStep(sc, sc.items.length)), 'item']),
    benGrid: (C, sc) => each(sc.tiles.length, (i) => [at(sc, sc.beat * 0.5 + i * listStep(sc, sc.tiles.length, 0.5)), 'item']),
    benNumbers: (C, sc) => each(sc.items.length, (i) => [at(sc, sc.tTitle + i * sc.slot), 'item']),
    benOne: (C, sc) => [[sc.in, 'item']],
    proofStars: (C, sc) => (sc.hasR ? [[sc.in, 'count'], ...each(5, (i) => [at(sc, 0.15 + i * 0.08), 'star', i])] : [[sc.in, 'swoosh']]),
    proofCounter: (C, sc) => [[sc.in, 'count'], [at(sc, Math.min(1.3, sc.beat * 3.5)), 'land']],
    offerBurst: (C, sc) => [[sc.in, 'stamp']],
    offerTag: (C, sc) => [[at(sc, 0.35), 'thud']],
    offerFlash: (C, sc) => [[sc.in, 'stamp'], ...each(3, (i) => [at(sc, (i + 1) * (sc.beat / 2)), 'strobe'])],
    quoteCard: (C, sc) => [[sc.in, 'swoosh'], [at(sc, Math.min(sc.d * 0.55, sc.b.count * 0.09 + 0.4)), 'pop']],
    showCollage: (C, sc) => each(sc.imgs.length, (i) => [at(sc, sc.beat + i * listStep(sc, sc.imgs.length)), 'pop', i]),
    showCarousel: (C, sc) => each(sc.n - 1, (i) => [at(sc, 0.2 + (i + 0.9) * ((sc.d - sc.in - 0.3) / sc.n)), 'swoosh']),
    stepsPath: (C, sc) => each(sc.items.length, (i) => [at(sc, sc.beat + i * listStep(sc, sc.items.length)), 'item']),
    stateKinetic: (C, sc) => sc.lines.map((_, i, a) => [at(sc, i * Math.min(sc.beat / 2, (sc.d * 0.6) / Math.max(1, a.length))), i === a.length - 1 ? 'stamp' : 'word']),
    ctaButton: (C, sc) => [[sc.in, 'pop'], [at(sc, sc.beat * 2.5), 'click']],
    ctaWhats: (C, sc) => [[sc.in, 'pop'], [at(sc, 0.5), 'pop']],
    outroLockup: (C, sc) => [[at(sc, 0.05), 'shine']],
    outroStamp: (C, sc) => [[sc.in, 'stamp'], [at(sc, sc.beat), 'swoosh']],
    outroMinimal: (C, sc) => [[at(sc, 0.05), 'shine']],
  };
  const TYPING = {
    hookType: (C, sc) => ({ t: sc.in + 0.15, cps: sc.cps, n: sc.b.txt.length, chars: sc.b.txt }),
    searchBar: (C, sc) => ({ t: sc.tType, cps: sc.cps, n: sc.q.length, chars: sc.q }),
  };

  // statement: frase grande reaproveita hookStack/hookWords/hookPhoto/hookStickers (kinds incluem 'statement')
  const VARIANTS = V;
  return { VARIANTS, HITS, TYPING, decorate, badge, hero, card, contactRows, fitContacts, MX };
})();
if (typeof module !== 'undefined') module.exports = SS;
