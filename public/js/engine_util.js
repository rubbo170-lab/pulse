'use strict';
// ─── Pulso engine: shared utilities (easing, color, text fitting, icons) ───
const PU = (() => {
  const W = 1080, H = 1920, DUR = 15, BEAT = 60 / 128, BAR = BEAT * 4;
  const bt = (n) => n * BEAT;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / (b - a));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const expoIn = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, 10 * (t - 1)));
  const expoInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
  const cubicOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const cubicIn = (t) => Math.pow(clamp(t), 3);
  const cubicInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const sineInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
      if (!(t >= 0 && t <= 1) || Math.abs(sx(t) - x) > 1e-4) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 40; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-7) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
      return sy(t);
    };
  }
  const EO = cubicBezier(0.16, 1, 0.3, 1), EI = cubicBezier(0.7, 0, 0.84, 0), EIO = cubicBezier(0.87, 0, 0.13, 1);
  function spring(t, w = 16, z = 0.45) {
    if (t <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  }
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); }
  function hash2(a, b) { return hash(a * 57.31 + b * 113.97 + 7.1); }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function noise1(x) { const i = Math.floor(x), f = x - i; return lerp(hash(i), hash(i + 1), smooth(f)) * 2 - 1; }
  function strSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---- color
  function hex(c) { c = String(c || '#888888').trim(); if (c[0] !== '#') c = '#' + c; if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; const n = parseInt(c.slice(1, 7), 16); return isNaN(n) ? [136, 136, 136] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(c, a = 1) { const [r, g, b] = Array.isArray(c) ? c : hex(c); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
  function mixc(c1, c2, t) { const a = Array.isArray(c1) ? c1 : hex(c1), b = Array.isArray(c2) ? c2 : hex(c2); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function mixs(c1, c2, t, a = 1) { return rgba(mixc(c1, c2, clamp(t)), a); }
  function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h, s: s * 100, l: l * 100 }; }
  function hsl2rgb(h, s, l) { h = ((h % 360) + 360) % 360; s = clamp(s / 100); l = clamp(l / 100); const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0) * 255, f(8) * 255, f(4) * 255]; }
  function toHex(c) { return '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); }
  function lum([r, g, b]) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
  function contrast(a, b) { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }

  // ---- canvases & text
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function setFont(ctx, fam, size, weight = 700, ls = 0) { ctx.font = `${weight} ${size}px ${fam}`; ctx.letterSpacing = ls + 'px'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; }
  function tw(ctx, s) { return ctx.measureText(s).width; }
  function wrapGreedy(ctx, words, maxW) {
    const lines = []; let cur = '';
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (tw(ctx, test) <= maxW || !cur) cur = test; else { lines.push(cur); cur = w; } }
    if (cur) lines.push(cur);
    return lines;
  }
  // fit text into maxLines lines of width maxW, shrinking size; 2-line splits are balanced
  function fit(ctx, text, fam, weight, maxW, maxSize, minSize, maxLines = 1, lsEm = 0) {
    text = String(text || '').replace(/[ \t\r\n]+/g, ' ').trim();
    if (!text) return { size: maxSize, lines: [], widths: [], ls: maxSize * lsEm };
    const words = text.split(' ');
    for (let size = maxSize; size >= minSize; size -= Math.max(1, Math.round(size * 0.03))) {
      setFont(ctx, fam, size, weight, size * lsEm);
      if (words.some((w) => tw(ctx, w) > maxW)) continue;
      if (tw(ctx, text) <= maxW) return { size, lines: [text], widths: [tw(ctx, text)], ls: size * lsEm };
      if (maxLines < 2) continue;
      if (maxLines === 2 || words.length <= 3) {
        let best = null;
        for (let i = 1; i < words.length; i++) {
          const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
          const wa = tw(ctx, a), wb = tw(ctx, b), m = Math.max(wa, wb);
          if (m <= maxW && (!best || m < best.m)) best = { m, lines: [a, b], widths: [wa, wb] };
        }
        if (best) return { size, lines: best.lines, widths: best.widths, ls: size * lsEm };
        if (maxLines === 2) continue;
      }
      const lines = wrapGreedy(ctx, words, maxW);
      if (lines.length <= maxLines) return { size, lines, widths: lines.map((l) => tw(ctx, l)), ls: size * lsEm };
    }
    // fallback: min size, greedy, truncate
    setFont(ctx, fam, minSize, weight, minSize * lsEm);
    let lines = wrapGreedy(ctx, words, maxW).slice(0, maxLines);
    lines = lines.map((l) => { while (tw(ctx, l) > maxW && l.length > 2) l = l.slice(0, -2) + '…'; return l; });
    return { size: minSize, lines, widths: lines.map((l) => tw(ctx, l)), ls: minSize * lsEm };
  }
  function layoutWords(ctx, line, x, align = 'left') {
    const words = line.split(' '), sp = tw(ctx, ' '), ws = words.map((w) => tw(ctx, w));
    const total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const out = words.map((w, i) => { const o = { text: w, x: cx, w: ws[i] }; cx += ws[i] + sp; return o; });
    out.total = total;
    return out;
  }
  function drawWords(ctx, words, y, size, t, t0, o = {}) {
    const stagger = o.stagger ?? 0.04, dur = o.dur ?? 0.55, exitT = o.exitT ?? null, exitDur = o.exitDur ?? 0.3, exitStagger = o.exitStagger ?? 0.02;
    for (let i = 0; i < words.length; i++) {
      const s0 = t0 + i * stagger, p = EO(inv(s0, s0 + dur, t));
      if (p <= 0) continue;
      let q = 0;
      if (exitT != null) q = EI(inv(exitT + i * exitStagger, exitT + i * exitStagger + exitDur, t));
      if (q >= 1) continue;
      const off = (1 - p) * size * 1.12 - q * size * 1.12;
      ctx.save(); ctx.beginPath(); ctx.rect(words[i].x - size * 0.3, y - size * 1.12, words[i].w + size * 0.6, size * 1.52); ctx.clip();
      ctx.fillStyle = o.colors ? o.colors[i] : (o.color || '#fff');
      ctx.fillText(words[i].text, words[i].x, y + off);
      ctx.restore();
    }
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
  function glowStroke(ctx, path, color, width, k = 1, core = '#FFFFFF') {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
    for (const [m, a] of [[6.5, 0.03], [3.8, 0.06], [2.3, 0.14], [1, 1]]) { ctx.globalAlpha = a * k; ctx.lineWidth = width * m; ctx.stroke(path); }
    if (core) { ctx.globalAlpha = 0.85 * Math.min(1, k); ctx.strokeStyle = core; ctx.lineWidth = width * 0.34; ctx.stroke(path); }
    ctx.restore();
  }
  function sprite(color, r) {
    const c = mk(r * 2, r * 2), x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, rgba(color, 1)); g.addColorStop(0.25, rgba(color, 0.55)); g.addColorStop(1, rgba(color, 0));
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c;
  }
  function pivot(ctx, px, py, s = 1, r = 0, dx = 0, dy = 0) { ctx.translate(px + dx, py + dy); if (r) ctx.rotate(r); if (s !== 1) ctx.scale(s, s); ctx.translate(-px, -py); }
  function checkPath(ctx, cx, cy, s) { ctx.beginPath(); ctx.moveTo(cx - 0.42 * s, cy + 0.02 * s); ctx.lineTo(cx - 0.12 * s, cy + 0.32 * s); ctx.lineTo(cx + 0.45 * s, cy - 0.3 * s); }

  // ---- icons (24-unit grid, stroked)
  const ICONS = {
    check: (p) => { p.poly([[5, 12.5], [10, 17.5], [19, 7]]); },
    clock: (p) => { p.circle(12, 12, 9); p.poly([[12, 7], [12, 12], [15.5, 14.2]]); },
    truck: (p) => { p.rect(2, 7, 12, 9, 1.2); p.poly([[14, 10], [18, 10], [21.5, 13.5], [21.5, 16], [14, 16]]); p.circle(7, 17.5, 2); p.circle(17.5, 17.5, 2); },
    chat: (p) => { p.path((c) => { c.moveTo(4, 5); c.lineTo(20, 5); c.quadraticCurveTo(21, 5, 21, 6); c.lineTo(21, 15); c.quadraticCurveTo(21, 16, 20, 16); c.lineTo(10, 16); c.lineTo(5.5, 20); c.lineTo(5.5, 16); c.lineTo(4, 16); c.quadraticCurveTo(3, 16, 3, 15); c.lineTo(3, 6); c.quadraticCurveTo(3, 5, 4, 5); c.closePath(); }); p.dot(8, 10.5); p.dot(12, 10.5); p.dot(16, 10.5); },
    star: (p) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4.2 : 9.5; pts.push([12 + Math.cos(a) * r, 12.8 + Math.sin(a) * r]); } p.poly(pts, true); },
    heart: (p) => { p.path((c) => { c.moveTo(12, 20); c.bezierCurveTo(4, 14.5, 2.5, 10.5, 4.3, 7.4); c.bezierCurveTo(6.2, 4.3, 10.3, 4.6, 12, 7.8); c.bezierCurveTo(13.7, 4.6, 17.8, 4.3, 19.7, 7.4); c.bezierCurveTo(21.5, 10.5, 20, 14.5, 12, 20); c.closePath(); }); },
    shield: (p) => { p.path((c) => { c.moveTo(12, 3); c.lineTo(19.5, 6); c.lineTo(19.5, 11.5); c.bezierCurveTo(19.5, 16, 16.3, 19.3, 12, 21); c.bezierCurveTo(7.7, 19.3, 4.5, 16, 4.5, 11.5); c.lineTo(4.5, 6); c.closePath(); }); p.poly([[8.5, 12], [11, 14.5], [15.5, 9.5]]); },
    bolt: (p) => { p.poly([[13, 2.5], [5, 13.5], [11.5, 13.5], [10.5, 21.5], [19, 10.5], [12.5, 10.5]], true); },
    tag: (p) => { p.poly([[3, 12.5], [11.5, 4], [20, 4], [20, 12.5], [11.5, 21]], true); p.circle(16, 8, 1.6); },
    gift: (p) => { p.rect(3.5, 9, 17, 4, 1); p.rect(5, 13, 14, 8, 1); p.line(12, 9, 12, 21); p.path((c) => { c.moveTo(12, 9); c.bezierCurveTo(9, 9, 6.5, 7.5, 7.5, 5.5); c.bezierCurveTo(8.5, 3.8, 11, 5, 12, 9); c.moveTo(12, 9); c.bezierCurveTo(15, 9, 17.5, 7.5, 16.5, 5.5); c.bezierCurveTo(15.5, 3.8, 13, 5, 12, 9); }); },
    leaf: (p) => { p.path((c) => { c.moveTo(5, 19); c.bezierCurveTo(4, 10, 9, 4, 20, 4); c.bezierCurveTo(20, 15, 14, 20, 5, 19); c.closePath(); }); p.path((c) => { c.moveTo(5, 19); c.quadraticCurveTo(10, 12, 15, 9); }); },
    pin: (p) => { p.path((c) => { c.moveTo(12, 21.5); c.bezierCurveTo(7, 16, 5, 12.5, 5, 9.5); c.arc(12, 9.5, 7, Math.PI, 0); c.bezierCurveTo(19, 12.5, 17, 16, 12, 21.5); c.closePath(); }); p.circle(12, 9.5, 2.6); },
    phone: (p) => { p.rect(6.5, 2.5, 11, 19, 2.2); p.line(10.5, 18.5, 13.5, 18.5); },
    card: (p) => { p.rect(2.5, 5.5, 19, 13, 2); p.line(2.5, 9.5, 21.5, 9.5); p.line(6, 15, 10, 15); },
    calendar: (p) => { p.rect(3.5, 5, 17, 15.5, 2); p.line(3.5, 9.5, 20.5, 9.5); p.line(8, 3, 8, 6.5); p.line(16, 3, 16, 6.5); p.dot(8, 13.5); p.dot(12, 13.5); p.dot(16, 13.5); p.dot(8, 17); p.dot(12, 17); },
    people: (p) => { p.circle(9, 8, 3.2); p.path((c) => { c.moveTo(3, 20); c.bezierCurveTo(3, 15, 6, 13, 9, 13); c.bezierCurveTo(12, 13, 15, 15, 15, 20); }); p.circle(17, 9, 2.5); p.path((c) => { c.moveTo(16.5, 13.5); c.bezierCurveTo(19.5, 13.5, 21.5, 15.5, 21.5, 19); }); },
    sparkle: (p) => { p.poly([[12, 3], [13.8, 10.2], [21, 12], [13.8, 13.8], [12, 21], [10.2, 13.8], [3, 12], [10.2, 10.2]], true); },
    flame: (p) => { p.path((c) => { c.moveTo(12, 21.5); c.bezierCurveTo(7, 21.5, 5, 18, 5.5, 14.5); c.bezierCurveTo(6, 11, 9, 9.5, 9, 5.5); c.bezierCurveTo(12.5, 7.5, 13.5, 10.5, 13, 12.5); c.bezierCurveTo(14.5, 11.5, 15.5, 10, 15.5, 8.5); c.bezierCurveTo(18, 11, 19, 14, 18.5, 16.5); c.bezierCurveTo(18, 19.5, 15.5, 21.5, 12, 21.5); c.closePath(); }); },
    home: (p) => { p.poly([[3, 11], [12, 3.5], [21, 11]]); p.poly([[5.5, 9.5], [5.5, 20.5], [18.5, 20.5], [18.5, 9.5]]); p.rect(10, 14, 4, 6.5, 0.5); },
    cart: (p) => { p.poly([[2.5, 4], [5.5, 4], [8, 15.5], [18.5, 15.5], [20.5, 7.5], [6.5, 7.5]]); p.circle(9, 19.5, 1.6); p.circle(17.5, 19.5, 1.6); },
    globe: (p) => { p.circle(12, 12, 9); p.line(3, 12, 21, 12); p.path((c) => { c.ellipse(12, 12, 4, 9, 0, 0, Math.PI * 2); }); },
    at: (p) => { p.circle(12, 12, 3.8); p.path((c) => { c.moveTo(15.8, 8.5); c.lineTo(15.8, 13.5); c.bezierCurveTo(15.8, 16.5, 20.5, 16.5, 20.5, 12); c.arc(12, 12, 8.5, 0, Math.PI * 1.75, false); }); },
    percent: (p) => { p.line(18.5, 5.5, 5.5, 18.5); p.circle(7, 7, 2.6); p.circle(17, 17, 2.6); },
    trophy: (p) => { p.path((c) => { c.moveTo(7, 3.5); c.lineTo(17, 3.5); c.lineTo(17, 9); c.bezierCurveTo(17, 12.5, 14.5, 14.5, 12, 14.5); c.bezierCurveTo(9.5, 14.5, 7, 12.5, 7, 9); c.closePath(); }); p.path((c) => { c.moveTo(7, 5.5); c.lineTo(4, 5.5); c.bezierCurveTo(4, 9, 5.5, 10.5, 7.5, 10.5); c.moveTo(17, 5.5); c.lineTo(20, 5.5); c.bezierCurveTo(20, 9, 18.5, 10.5, 16.5, 10.5); }); p.line(12, 14.5, 12, 18); p.line(8, 20.5, 16, 20.5); p.line(9, 18, 15, 18); },
    search: (p) => { p.circle(10.5, 10.5, 6.5); p.line(15.5, 15.5, 20.5, 20.5); },
    smile: (p) => { p.circle(12, 12, 9); p.dot(9, 10); p.dot(15, 10); p.path((c) => { c.moveTo(8, 14.5); c.quadraticCurveTo(12, 18, 16, 14.5); }); },
    tool: (p) => { p.path((c) => { c.moveTo(14.5, 5.5); c.bezierCurveTo(16.5, 3.5, 20, 4, 20.5, 6.5); c.lineTo(17.5, 9.5); c.lineTo(15, 9); c.lineTo(14.5, 6.5); c.moveTo(14.8, 9.2); c.lineTo(5, 19); }); p.circle(5.2, 18.8, 1.5); },
    bag: (p) => { p.rect(4, 8, 16, 13, 2); p.path((c) => { c.moveTo(8.5, 10.5); c.lineTo(8.5, 7); c.bezierCurveTo(8.5, 3.5, 15.5, 3.5, 15.5, 7); c.lineTo(15.5, 10.5); }); },
    paw: (p) => { p.circle(7, 9, 1.9); p.circle(10.5, 6, 1.9); p.circle(14.5, 6, 1.9); p.circle(18, 9.5, 1.9); p.path((c) => { c.moveTo(12, 11.5); c.bezierCurveTo(8, 11.5, 6, 16, 7.5, 18.5); c.bezierCurveTo(9, 20.5, 11, 19, 12, 19); c.bezierCurveTo(13, 19, 15, 20.5, 16.5, 18.5); c.bezierCurveTo(18, 16, 16, 11.5, 12, 11.5); c.closePath(); }); },
    book: (p) => { p.path((c) => { c.moveTo(12, 6.5); c.bezierCurveTo(9.5, 4.8, 6, 4.5, 3, 5); c.lineTo(3, 19); c.bezierCurveTo(6, 18.5, 9.5, 18.8, 12, 20.5); c.bezierCurveTo(14.5, 18.8, 18, 18.5, 21, 19); c.lineTo(21, 5); c.bezierCurveTo(18, 4.5, 14.5, 4.8, 12, 6.5); c.closePath(); }); p.line(12, 6.5, 12, 20.5); },
    dumbbell: (p) => { p.line(7, 12, 17, 12); p.rect(3, 8, 4, 8, 1); p.rect(17, 8, 4, 8, 1); p.line(2, 12, 3, 12); p.line(21, 12, 22, 12); },
    scissors: (p) => { p.circle(6.5, 17.5, 2.6); p.circle(6.5, 6.5, 2.6); p.line(8.6, 8.2, 20, 18); p.line(8.6, 15.8, 20, 6); },
    coffee: (p) => { p.path((c) => { c.moveTo(4, 9); c.lineTo(17, 9); c.lineTo(17, 15); c.bezierCurveTo(17, 18, 14.5, 20, 11.5, 20); c.lineTo(9.5, 20); c.bezierCurveTo(6.5, 20, 4, 18, 4, 15); c.closePath(); }); p.path((c) => { c.moveTo(17, 11); c.bezierCurveTo(21, 11, 21, 16, 17, 16); }); p.line(8, 3.5, 8, 6); p.line(12, 3.5, 12, 6); },
    arrow: (p) => { p.line(4, 12, 19, 12); p.poly([[13.5, 6.5], [19, 12], [13.5, 17.5]]); },
    enter: (p) => { p.poly([[19, 5], [19, 13], [5, 13]]); p.poly([[9.5, 8.5], [5, 13], [9.5, 17.5]]); },
    x: (p) => { p.line(6, 6, 18, 18); p.line(18, 6, 6, 18); },
    q: (p) => { p.path((c) => { c.moveTo(8.5, 8.5); c.bezierCurveTo(8.5, 3.5, 16.5, 3.5, 16, 8.5); c.bezierCurveTo(15.6, 11.5, 12, 11.5, 12, 15); }); p.dot(12, 19.5); },
    warn: (p) => { p.poly([[12, 3.5], [21.5, 20], [2.5, 20]], true); p.line(12, 9.5, 12, 14); p.dot(12, 17); },
    dots: (p) => { p.dot(6.5, 12); p.dot(12, 12); p.dot(17.5, 12); },
  };
  const ICON_LIST = ['check', 'clock', 'truck', 'chat', 'star', 'heart', 'shield', 'bolt', 'tag', 'gift', 'leaf', 'pin', 'phone', 'card', 'calendar', 'people', 'sparkle', 'flame', 'home', 'cart', 'globe', 'percent', 'trophy', 'smile', 'tool', 'bag', 'paw', 'book', 'dumbbell', 'scissors', 'coffee'];
  function icon(ctx, name, cx, cy, size, color, lw = 1.9) {
    const fn = ICONS[name] || ICONS.check, k = size / 24;
    ctx.save(); ctx.translate(cx - 12 * k, cy - 12 * k); ctx.scale(k, k);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = {
      poly(pts, close) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath(); ctx.stroke(); },
      circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); },
      rect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r || 0); ctx.stroke(); },
      line(a, b, c, d) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); },
      dot(x, y) { ctx.beginPath(); ctx.arc(x, y, lw * 0.75, 0, Math.PI * 2); ctx.fill(); },
      path(f) { ctx.beginPath(); f(ctx); ctx.stroke(); },
    };
    fn(p);
    ctx.restore();
  }
  // keyword → icon (offline copywriter + defaults)
  // palavras (pt / en / es) que sugerem o ícone de cada vantagem
  const ICON_WORDS = [
    [/entreg|delivery|deliver|frete|envío|envio|shipping|motoboy|domicilio/i, 'truck'], [/whats|zap|mensag|message|chat|atendimento|atención|fale|escr[ií]benos|contact|contáct/i, 'chat'],
    [/rápid|rapid|fast|quick|minut|hora|hour|tempo|time|tiempo|agil|ágil|same day|mismo día|\bdia\b|\bday\b|mesmo dia/i, 'clock'],
    [/garanti|guarant|segur|safe|secure|confian|trust|protec|proteç/i, 'shield'], [/preço|preco|precio|price|barat|cheap|desconto|descuento|discount|off|promo|econom|sav/i, 'tag'], [/pix|cart|card|tarjeta|pagament|payment|pago|parcel|install/i, 'card'],
    [/natural|orgânic|organic|fresc|fresh|saud|healthy|vegan|sustent|sustain/i, 'leaf'], [/amor|love|carinho|cariño|feito à mão|handmade|hecho a mano|artesan|artisan|cuidado|care/i, 'heart'], [/qualidade|quality|calidad|premium|melhor|best|mejor|excel|top/i, 'star'],
    [/agend|schedul|book|horári|horario|reserva|marcar|cita|appointment/i, 'calendar'], [/equipe|team|equipo|família|family|familia|clientes|customers|pessoas|people|personas|comunidade|community|comunidad/i, 'people'], [/local|endereç|address|dirección|bairro|barrio|neighborhood|perto|near|cerca|região|region|región|loja física/i, 'pin'],
    [/forno|oven|horno|lenha|wood.?fired|quente|hot|caliente|fogo|fire|fuego|grelh|grill|parrilla|churras|bbq/i, 'flame'], [/presente|gift|regalo|brinde|mimo|kit/i, 'gift'], [/energia|energy|potên|power|forte|strong|fuerte/i, 'bolt'], [/prêmio|premi|award|campeã|campe|champion/i, 'trophy'],
    [/pet|cachorr|dog|perro|gato|cat\b|animal|mascota/i, 'paw'], [/curso|course|aula|class|clase|aprend|learn|estud|study|ensino|teach/i, 'book'], [/treino|train|entren|academia|gym|gimnasio|fitness|muscul/i, 'dumbbell'], [/cabel|hair|pelo|beleza|beauty|belleza|salão|salon|salón|barbear|barber|corte|cut/i, 'scissors'],
    [/café|cafe|coffee|bebida|drink/i, 'coffee'], [/casa|house|home|hogar|lar|imóve|imove|inmueble|property|reforma|remodel/i, 'home'], [/compra|shop|tienda|loja|store|produto|product|producto|estoque|stock/i, 'bag'], [/conserto|repair|reparación|manuten|mainten|mantenimiento|técnic|tecnic|reparo/i, 'tool'], [/site|website|online|internet|digital|web/i, 'globe'],
  ];
  function iconFor(text, fallback = 'check') { for (const [re, n] of ICON_WORDS) if (re.test(text || '')) return n; return fallback; }

  return { W, H, DUR, BEAT, BAR, bt, clamp, lerp, inv, smooth, expoIn, expoInOut, cubicOut, cubicIn, cubicInOut, sineInOut, cubicBezier, EO, EI, EIO, spring, hash, hash2, rng, noise1, strSeed,
    hex, rgba, mixc, mixs, rgb2hsl, hsl2rgb, toHex, lum, contrast, mk, setFont, tw, fit, layoutWords, drawWords, rr, glowStroke, sprite, pivot, checkPath, ICONS, ICON_LIST, icon, iconFor };
})();
if (typeof module !== 'undefined') module.exports = PU;
