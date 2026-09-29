'use strict';
// ─── Pulso audio: 128 BPM score + synced sound design, rendered offline with WebAudio ───
const PulsoAudio = (() => {
  const SR = 48000, LEN = 17.6, T15 = 15, BEAT = 60 / 128, BAR = BEAT * 4; // partitura em 15 s; render(…, { scale: 20 / 15 }) estica para 20 s
  const bt = (n) => n * BEAT;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Vídeo mais longo (ex.: 20 s) = a mesma partitura num andamento mais lento. Em vez de reescrever cada tempo,
  // o contexto de áudio multiplica por k todo horário agendado (início/fim de notas e automações).
  // As constantes de envelope (ataque/decaimento) não mudam, então o timbre continua o mesmo.
  function timeScaled(ctx, k) {
    if (k === 1) return ctx;
    const patchParam = (p) => {
      if (!p || p.__scaled) return;
      p.__scaled = true;
      const sv = p.setValueAtTime.bind(p), lr = p.linearRampToValueAtTime.bind(p), er = p.exponentialRampToValueAtTime.bind(p), st = p.setTargetAtTime.bind(p), sc = p.setValueCurveAtTime.bind(p);
      p.setValueAtTime = (v, t) => sv(v, t * k);
      p.linearRampToValueAtTime = (v, t) => lr(v, t * k);
      p.exponentialRampToValueAtTime = (v, t) => er(v, t * k);
      p.setTargetAtTime = (v, t, tau) => st(v, t * k, tau);
      p.setValueCurveAtTime = (c, t, d) => sc(c, t * k, d * k);
    };
    const patchNode = (n) => {
      for (const key of ['frequency', 'detune', 'gain', 'Q', 'pan', 'playbackRate', 'delayTime']) if (n[key] instanceof AudioParam) patchParam(n[key]);
      if (typeof n.start === 'function') { const s0 = n.start.bind(n); n.start = (w = 0, off, dur) => (dur !== undefined ? s0(w * k, off, dur * k) : off !== undefined ? s0(w * k, off) : s0(w * k)); }
      if (typeof n.stop === 'function') { const s1 = n.stop.bind(n); n.stop = (w = 0) => s1(w * k); }
      return n;
    };
    for (const m of ['createOscillator', 'createGain', 'createBiquadFilter', 'createBufferSource', 'createStereoPanner', 'createDelay']) { const f = ctx[m].bind(ctx); ctx[m] = (...a) => patchNode(f(...a)); }
    return ctx;
  }

  // Janela [a, b) da partitura (vídeo de 30 s): só tocam as notas e efeitos que COMEÇAM dentro da janela, deslocados para
  // começar em 0; o que começou antes fica no pedaço anterior (com a cauda de reverb dele). Automações antes de `a` são ignoradas.
  function windowed(ctx, a, b) {
    const patchParam = (p) => {
      if (!p || p.__win) return;
      p.__win = true;
      const sv = p.setValueAtTime.bind(p), lr = p.linearRampToValueAtTime.bind(p), er = p.exponentialRampToValueAtTime.bind(p), st = p.setTargetAtTime.bind(p), sc = p.setValueCurveAtTime.bind(p);
      p.setValueAtTime = (v, t) => (t >= a ? sv(v, t - a) : p);
      p.linearRampToValueAtTime = (v, t) => (t >= a ? lr(v, t - a) : p);
      p.exponentialRampToValueAtTime = (v, t) => (t >= a ? er(v, t - a) : p);
      p.setTargetAtTime = (v, t, tau) => (t >= a ? st(v, t - a, tau) : p);
      p.setValueCurveAtTime = (c, t, d) => (t >= a ? sc(c, t - a, d) : p);
    };
    const patchNode = (n) => {
      for (const key of ['frequency', 'detune', 'gain', 'Q', 'pan', 'playbackRate', 'delayTime']) if (n[key] instanceof AudioParam) patchParam(n[key]);
      if (typeof n.start === 'function') { const s0 = n.start.bind(n); n.start = (w = 0, off, dur) => { if (w < a || w >= b) { n.__skip = true; return; } if (dur !== undefined) s0(w - a, off, dur); else if (off !== undefined) s0(w - a, off); else s0(w - a); }; }
      if (typeof n.stop === 'function') { const s1 = n.stop.bind(n); n.stop = (w = 0) => { if (!n.__skip) s1(Math.max(0, w - a)); }; }
      return n;
    };
    for (const m of ['createOscillator', 'createGain', 'createBiquadFilter', 'createBufferSource', 'createStereoPanner', 'createDelay']) { const f = ctx[m].bind(ctx); ctx[m] = (...args) => patchNode(f(...args)); }
    return ctx;
  }

  function rngf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function makeKit(ctx, seed) {
    const r = rngf(seed);
    const nb = ctx.createBuffer(2, SR * 3, SR);
    for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    const irLen = Math.floor(SR * 2.4), ir = ctx.createBuffer(2, irLen, SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < irLen; i++) { const tt = i / SR; lp += 0.35 * ((r() * 2 - 1) - lp); d[i] = tt < 0.025 ? 0 : lp * Math.exp(-(tt - 0.025) * 6.9 / 2.2); }
    }
    const shaper = (drive) => { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / Math.tanh(drive); } return c; };
    return { r, nb, ir, shaper };
  }

  async function renderOld(ev, mood, seed, k = 1) {
    const len = BAR + 0.6, ctx = timeScaled(new OfflineAudioContext(2, Math.ceil(SR * len * k), SR), k), K = makeKit(ctx, seed + 5);
    const out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
    const I = instruments(ctx, K);
    const t0 = 0;
    // dissonant drone
    for (const [m, g] of [[45, 1], [46, 0.9], [33, 0.6]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m) * (m === 46 ? 1.003 : 1);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5;
      const ga = ctx.createGain(); ga.gain.setValueAtTime(0, t0); ga.gain.linearRampToValueAtTime(0.07 * g * (mood === 'suave' ? 0.7 : 1), t0 + 0.25);
      o.connect(f).connect(ga).connect(out); o.start(t0); o.stop(t0 + len);
    }
    for (let s = 0; s < 16; s++) I.click(out, t0 + (s * BEAT) / 4, 0.28, s % 4 ? 5200 : 3800, 0.2, s % 2 ? 900 : 1200, s % 2 ? -0.35 : 0.35);
    for (let b = 0; b < 4; b++) I.kick(out, t0 + bt(b), mood === 'suave' ? 0.45 : 0.7, 0.2, 900);
    (ev.cards || []).forEach((a, i) => { I.click(out, a - 1.875, 0.42, 3000, 0.25, 260, ((i % 5) - 2) / 3); I.click(out, a - 1.875 + 0.06, 0.2, 3400, 0, 0, ((i % 5) - 2) / 3); });
    I.impact(out, bt(6) - 1.875, 0.33, 90, 45, 0.35);
    return ctx.startRendering();
  }

  function instruments(ctx, K) {
    const noise = (t, dur, dest, off) => { const s = ctx.createBufferSource(); s.buffer = K.nb; s.connect(dest); s.start(t, off ?? K.r() * 1.5, dur); return s; };
    const pan = (dest, p) => { if (!p) return dest; const n = ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); n.connect(dest); return n; };
    const g = (dest, v = 1) => { const n = ctx.createGain(); n.gain.value = v; n.connect(dest); return n; };
    const bq = (type, f, q, dest) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q; n.connect(dest); return n; };
    const decayEnv = (param, t, level, tau, att = 0.002) => { param.setValueAtTime(0, t); param.linearRampToValueAtTime(level, t + att); param.setTargetAtTime(0, t + att, tau); };
    const I = {
      kick(dest, t, level = 1, dec = 0.32, lp = 0) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(168, t); o.frequency.setTargetAtTime(48, t, 0.035);
        const sh = ctx.createWaveShaper(); sh.curve = K.shaper(1.6); const out = lp ? bq('lowpass', lp, 0.7, dest) : dest; sh.connect(out);
        const ga = ctx.createGain(); decayEnv(ga.gain, t, level, dec, 0.002); o.connect(ga).connect(sh); o.start(t); o.stop(t + dec * 6);
        const cg = ctx.createGain(); decayEnv(cg.gain, t, 0.3 * level, 0.004, 0.0005); noise(t, 0.05, bq('highpass', 1800, 0.7, cg)); cg.connect(sh);
      },
      clap(dest, t, level = 1, p = 0.05) {
        const ga = ctx.createGain(); ga.gain.setValueAtTime(0, t);
        [0, 0.009, 0.018].forEach((d) => { ga.gain.setValueAtTime(0.8 * level, t + d); ga.gain.setTargetAtTime(0, t + d + 0.0005, 0.003); });
        ga.gain.setValueAtTime(0.8 * level, t + 0.027); ga.gain.setTargetAtTime(0, t + 0.0275, 0.11);
        ga.connect(pan(dest, p)); noise(t, 0.6, bq('bandpass', 2000, 0.8, ga));
      },
      snare(dest, t, level = 1, dec = 0.12) {
        const ga = ctx.createGain(); decayEnv(ga.gain, t, level, dec, 0.001); ga.connect(dest);
        noise(t, dec * 6, bq('highpass', 1500, 0.7, bq('lowpass', 7000, 0.7, ga)));
        const o = ctx.createOscillator(); o.frequency.value = 190; const og = ctx.createGain(); decayEnv(og.gain, t, 0.55 * level, 0.05, 0.001); o.connect(og).connect(dest); o.start(t); o.stop(t + 0.4);
      },
      hat(dest, t, level = 1, dec = 0.03, p = 0.25, hpf = 7500) {
        const ga = ctx.createGain(); decayEnv(ga.gain, t, level, dec, 0.0005); ga.connect(pan(dest, p)); noise(t, Math.max(0.12, dec * 6), bq('highpass', hpf, 0.8, ga));
      },
      pluck(dest, t, freq, dur = 0.3, level = 1, bright = 4000, p = 0, kind = 'saw') {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(500 + bright, t); f.frequency.setTargetAtTime(500, t, 0.07);
        const ga = ctx.createGain(); decayEnv(ga.gain, t, level, dur * 0.45, 0.002); f.connect(ga).connect(pan(dest, p));
        const types = kind === 'soft' ? ['triangle', 'sine'] : ['sawtooth', 'sawtooth'];
        [1, 1.004].forEach((k, i) => { const o = ctx.createOscillator(); o.type = types[i]; o.frequency.value = freq * k; const og = ctx.createGain(); og.gain.value = i ? 0.4 : 0.6; o.connect(og).connect(f); o.start(t); o.stop(t + dur * 4 + 0.1); });
      },
      bell(dest, t, freq, dur = 1.2, level = 1, p = 0) {
        const car = ctx.createOscillator(); car.frequency.value = freq; const mod = ctx.createOscillator(); mod.frequency.value = freq * 3.5;
        const mg = ctx.createGain(); mg.gain.setValueAtTime(freq * 2.2, t); mg.gain.setTargetAtTime(0, t, 0.18); mod.connect(mg).connect(car.frequency);
        const ga = ctx.createGain(); decayEnv(ga.gain, t, level, dur * 0.35, 0.002); car.connect(ga).connect(pan(dest, p));
        const o2 = ctx.createOscillator(); o2.frequency.value = freq * 2; const g2 = ctx.createGain(); decayEnv(g2.gain, t, 0.3 * level, 0.15, 0.002); o2.connect(g2).connect(pan(dest, p));
        [car, mod, o2].forEach((o) => { o.start(t); o.stop(t + dur + 0.1); });
      },
      pad(dest, t, notes, len, level = 1, cutoff = 2000, attack = 0.08, release = 0.25, detune = 12) {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.5;
        const ga = ctx.createGain(); ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(level, t + attack); ga.gain.setValueAtTime(level, t + len); ga.gain.setTargetAtTime(0, t + len, release / 3);
        f.connect(ga).connect(dest);
        notes.forEach((m, ni) => { for (let v = 0; v < 4; v++) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = (v - 1.5) * detune; const og = ctx.createGain(); og.gain.value = 0.55 / (notes.length * 4) * 2.2; o.connect(og).connect(pan(f, (v / 3) * 1.4 - 0.7)); o.start(t); o.stop(t + len + release * 2 + 0.1); } });
        return { f, ga };
      },
      whoosh(dest, t, dur, f0, f1, f2, level = 1, p0 = 0, p1 = 0, peak = 0.5) {
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
        f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur * peak); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
        const ga = ctx.createGain(), n = 64, c = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = i / (n - 1); c[i] = level * (x < peak ? Math.pow(x / peak, 2.2) : Math.exp(-((x - peak) / (1 - peak)) * 3.2)); }
        ga.gain.setValueCurveAtTime(c, t, dur);
        const pn = ctx.createStereoPanner(); pn.pan.setValueAtTime(p0, t); pn.pan.linearRampToValueAtTime(p1, t + dur);
        f.connect(ga).connect(pn).connect(dest); noise(t, dur, f);
      },
      riser(dest, t, dur, f0 = 300, f1 = 6000, level = 1, tone = true) {
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const ga = ctx.createGain(), n = 64, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = level * Math.pow(i / (n - 1), 2.2);
        ga.gain.setValueCurveAtTime(c, t, dur); f.connect(ga).connect(dest); noise(t, dur, f);
        if (tone) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(1080, t + dur); const lp = bq('lowpass', 5000, 0.7, dest); const og = ctx.createGain(); const c2 = new Float32Array(n); for (let i = 0; i < n; i++) c2[i] = 0.18 * level * Math.pow(i / (n - 1), 2); og.gain.setValueCurveAtTime(c2, t, dur); o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.01); }
      },
      click(dest, t, level = 1, fc = 3200, thock = 0, tf = 180, p = 0) {
        const d = pan(dest, p), ga = ctx.createGain(); decayEnv(ga.gain, t, level, 0.003, 0.0003); ga.connect(d); noise(t, 0.05, bq('bandpass', fc, 1.1, ga));
        if (thock) { const o = ctx.createOscillator(); o.frequency.value = tf; const og = ctx.createGain(); decayEnv(og.gain, t, thock * level, 0.018, 0.0005); o.connect(og).connect(d); o.start(t); o.stop(t + 0.15); }
      },
      impact(dest, t, level = 1, f0 = 62, f1 = 32, dec = 0.9) {
        const sh = ctx.createWaveShaper(); sh.curve = K.shaper(1.3); sh.connect(dest);
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.setTargetAtTime(f1, t, 0.12);
        const ga = ctx.createGain(); decayEnv(ga.gain, t, level, dec, 0.003); o.connect(ga).connect(sh); o.start(t); o.stop(t + dec * 6);
        const ng = ctx.createGain(); decayEnv(ng.gain, t, 0.45 * level, 0.09, 0.001); ng.connect(sh); noise(t, 0.8, bq('lowpass', 2500, 0.7, ng));
      },
      pop(dest, t, level = 1, f0 = 900, f1 = 420, dec = 0.07, p = 0) {
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.setTargetAtTime(f1, t, 0.018);
        const ga = ctx.createGain(); decayEnv(ga.gain, t, level, dec, 0.001); o.connect(ga).connect(pan(dest, p)); o.start(t); o.stop(t + dec * 6 + 0.05);
      },
      chirp(dest, t, f0, f1, dur, level, p) {
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const ga = ctx.createGain(), n = 32, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = level * Math.sin((Math.PI * i) / (n - 1)); ga.gain.setValueCurveAtTime(c, t, dur);
        o.connect(ga).connect(pan(dest, p)); o.start(t); o.stop(t + dur + 0.01);
      },
      tone(dest, t, freq, dur, level, tau, p = 0) { const o = ctx.createOscillator(); o.frequency.value = freq; const ga = ctx.createGain(); decayEnv(ga.gain, t, level, tau, 0.002); o.connect(ga).connect(pan(dest, p)); o.start(t); o.stop(t + dur); },
      noiseBurst(dest, t, dur, type, f, q, level, tau) { const ga = ctx.createGain(); decayEnv(ga.gain, t, level, tau, 0.0008); ga.connect(dest); noise(t, dur, bq(type, f, q, ga)); },
    };
    return I;
  }

  const CH = { F: [53, 57, 60, 64], C: [48, 55, 60, 64], G: [55, 59, 62, 67], Am: [57, 60, 64, 67], Fadd9: [53, 57, 60, 64, 67], Fmaj7: [53, 57, 60, 64], Em7: [52, 55, 59, 62], Dm7: [50, 53, 57, 60], Cmaj7: [48, 52, 55, 59], Cmaj9: [48, 52, 55, 59, 62] };
  const ROOT = { F: 29, C: 36, G: 31, Am: 33, Fmaj7: 29, Em7: 28, Dm7: 26, Cmaj7: 36 };

  // barramentos de mixagem (bateria, música, efeitos, reverb e eco), iguais na partitura e nos capítulos do vídeo de 30 s
  function buses(ctx, K, mood, k = 1) {
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    const drums = ctx.createGain(); drums.connect(master);
    const music = ctx.createGain(); music.connect(master);
    const sfx = ctx.createGain(); sfx.gain.value = mood === 'suave' ? 0.85 : 1; sfx.connect(master);
    const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = K.ir; const revOut = ctx.createGain(); revOut.gain.value = 0.9; conv.connect(revOut).connect(master);
    const rev = (v) => { const gn = ctx.createGain(); gn.gain.value = v; gn.connect(conv); return gn; };
    const dl = ctx.createDelay(1), dr = ctx.createDelay(1), fb = ctx.createGain(), dlp = ctx.createBiquadFilter(), merge = ctx.createChannelMerger(2), dIn = ctx.createGain();
    dl.delayTime.value = ((3 * BEAT) / 4) * k; dr.delayTime.value = ((3 * BEAT) / 4) * k; fb.gain.value = 0.36; dlp.type = 'lowpass'; dlp.frequency.value = 4500;
    dIn.connect(dl); dl.connect(dlp); dlp.connect(dr); dr.connect(fb); fb.connect(dl); dl.connect(merge, 0, 0); dr.connect(merge, 0, 1); const dOut = ctx.createGain(); dOut.gain.value = 0.5; merge.connect(dOut).connect(music);
    const both = (dest, rv = 0, dly = 0) => { const n = ctx.createGain(); n.connect(dest); if (rv) n.connect(rev(rv)); if (dly) { const d2 = ctx.createGain(); d2.gain.value = dly; n.connect(d2).connect(dIn); } return n; };
    return { master, drums, music, sfx, both };
  }

  async function render(ev, opts = {}) {
    // motor criativo (Pulso Studio): trilha composta a partir do plano de cada vídeo
    if (ev && ev.v === 2 && typeof PulsoStudioAudio !== 'undefined') return PulsoStudioAudio.render(ev, opts);
    if (ev.dur === 30) return render30(ev, opts);
    const k = opts.scale && opts.scale > 0 ? opts.scale : 1;
    return master(await score(ev, opts), Math.floor(SR * T15 * k));
  }

  // a partitura do vídeo de 15 s (esticada para 20 s com scale, ou um pedaço dela com window: [a, b])
  async function score(ev, opts = {}) {
    const mood = opts.mood || ev.mood || 'energia', seed = opts.seed || 7, win = opts.window || null, k = win ? 1 : opts.scale && opts.scale > 0 ? opts.scale : 1;
    const base = new OfflineAudioContext(2, Math.ceil(SR * (win ? win[1] - win[0] + 3.2 : LEN * k)), SR);
    const ctx = win ? windowed(base, win[0], win[1]) : timeScaled(base, k), K = makeKit(ctx, seed), I = instruments(ctx, K);
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    const drums = ctx.createGain(); drums.connect(master);
    const music = ctx.createGain(); music.connect(master);
    const sfx = ctx.createGain(); sfx.gain.value = mood === 'suave' ? 0.85 : 1; sfx.connect(master);
    const conv = ctx.createConvolver(); conv.normalize = true; conv.buffer = K.ir; const revOut = ctx.createGain(); revOut.gain.value = 0.9; conv.connect(revOut).connect(master);
    const rev = (v) => { const gn = ctx.createGain(); gn.gain.value = v; gn.connect(conv); return gn; };
    const dl = ctx.createDelay(1), dr = ctx.createDelay(1), fb = ctx.createGain(), dlp = ctx.createBiquadFilter(), merge = ctx.createChannelMerger(2), dIn = ctx.createGain();
    dl.delayTime.value = ((3 * BEAT) / 4) * k; dr.delayTime.value = ((3 * BEAT) / 4) * k; fb.gain.value = 0.36; dlp.type = 'lowpass'; dlp.frequency.value = 4500;
    dIn.connect(dl); dl.connect(dlp); dlp.connect(dr); dr.connect(fb); fb.connect(dl); dl.connect(merge, 0, 0); dr.connect(merge, 0, 1); const dOut = ctx.createGain(); dOut.gain.value = 0.5; merge.connect(dOut).connect(music);
    const both = (dest, rv = 0, dly = 0) => { const n = ctx.createGain(); n.connect(dest); if (rv) n.connect(rev(rv)); if (dly) { const d2 = ctx.createGain(); d2.gain.value = dly; n.connect(d2).connect(dIn); } return n; };
    const kicks = [];
    const M = mood !== 'nenhuma', soft = mood === 'suave';
    // estilo Premium: a música conduz; sem o "caos" do 2º compasso, sem rufar, efeitos curtos e baixos (um por acontecimento)
    const PREMI = ev.style === 'premium';

    // ── bar 1 hook
    if (M) {
      for (let b = 0; b < 4; b++) { kicks.push(bt(b)); I.hat(drums, bt(b + 0.5), soft ? 0.25 : 0.35, 0.025, 0.3, soft ? 6000 : 7500); }
      [bt(1), bt(1) + BEAT / 2].forEach((tt) => {
        if (soft || PREMI) CH.Am.forEach((m, i) => I.pluck(both(music, 0.3), tt, mtof(m + 12), 0.5, soft ? 0.12 : 0.14, soft ? 2200 : 3000, (i - 1.5) * 0.3, 'soft'));
        else { const p = I.pad(both(music, 0.25), tt, [45, 57, 60, 64, 69], 0.12, 0.5, 5200, 0.002, 0.12, 14); }
        if (PREMI) I.noiseBurst(both(drums, 0.25), tt, 0.2, 'bandpass', 3000, 1.3, soft ? 0.22 : 0.3, 0.03);
        else I.snare(both(drums, 0.2), tt, soft ? 0.25 : 0.5, 0.1);
      });
    }
    if (PREMI) {
      // ── bar 2 (premium): acorde suspenso, grave só no 1 e no 3, a tensão é a própria pergunta
      if (M) {
        const p = I.pad(both(music, 0.35), 1.875, CH.Dm7, 1.875, soft ? 0.2 : 0.24, 1200, 0.3, 0.3, 9);
        p.f.frequency.setValueAtTime(1200, 1.875); p.f.frequency.exponentialRampToValueAtTime(2400, 3.7);
        [bt(4), bt(6)].forEach((tt) => {
          kicks.push(tt);
          const o = ctx.createOscillator(); o.frequency.value = mtof(38); const gg = ctx.createGain(); gg.gain.setValueAtTime(0, tt); gg.gain.linearRampToValueAtTime(0.34, tt + 0.02); gg.gain.setTargetAtTime(0.16, tt + 0.02, 0.35); gg.gain.setTargetAtTime(0, tt + 2 * BEAT - 0.06, 0.03);
          o.connect(gg).connect(music); o.start(tt); o.stop(tt + 2 * BEAT + 0.2);
        });
        for (let b = 4; b < 8; b++) I.hat(drums, bt(b + 0.5), 0.2, 0.03, 0.25, 6500);
        const dm = CH.Dm7.map((m) => m + 12), pat = [0, 2, 1, 3, 2, 1, 3, 2];
        for (let e = 0; e < 8; e++) I.pluck(both(music, 0.3, 0.3), bt(4) + (e * BEAT) / 2, mtof(dm[pat[e]]), 0.4, 0.05, 1500, e % 2 ? -0.3 : 0.3, 'soft');
      }
    } else {
      // ── bar 2 old way (pre-rendered, tape-stopped at the freeze)
      if (!win || (win[0] <= 1.875 && win[1] > 1.875)) {
      const oldBuf = await renderOld(ev, mood, seed, k);
      const os = ctx.createBufferSource(); os.buffer = oldBuf; const og = ctx.createGain(); og.gain.value = M ? 0.9 : 0.55; os.connect(og).connect(master);
      os.playbackRate.setValueAtTime(1, 3.75); os.playbackRate.exponentialRampToValueAtTime(0.03, 4.07);
      og.gain.setValueAtTime(M ? 0.9 : 0.55, 3.75); og.gain.linearRampToValueAtTime(0, 4.07);
      os.start(1.875); os.stop(4.1);
      }
    }
    // ── bar 3 build
    if (M) {
      const p = I.pad(both(music, 0.3), 3.9, CH.F, 1.75, soft ? 0.22 : 0.3, 400, 0.55, 0.2, 10);
      p.f.frequency.setValueAtTime(400, 3.9); p.f.frequency.exponentialRampToValueAtTime(soft ? 1800 : 3000, 5.62);
      if (!soft && !PREMI) for (let k = 0; k < 8; k++) I.snare(both(drums, 0.1), bt(11) + (k * BEAT) / 8, 0.1 + 0.05 * k, 0.05);
      if (PREMI) {
        // subida discreta: bumbo nos tempos, chimbal em semicolcheias crescendo e um arpejo suave do acorde
        for (let b = 8; b < 12; b++) { I.kick(drums, bt(b), 0.3 + 0.06 * (b - 8), 0.22, 1600); for (let s2 = 0; s2 < 4; s2++) I.hat(drums, bt(b) + (s2 * BEAT) / 4, 0.05 + 0.045 * (b - 8) + (s2 === 2 ? 0.05 : 0), 0.02, s2 % 2 ? -0.25 : 0.25, 7000); }
        const fn = CH.F.map((m) => m + 12), pat = [0, 1, 2, 3, 2, 1, 2, 3];
        for (let e = 0; e < 8; e++) I.pluck(both(music, 0.3, 0.3), bt(8) + (e * BEAT) / 2, mtof(fn[pat[e]]), 0.35, 0.05 + 0.006 * e, 1800 + 250 * e, e % 2 ? -0.3 : 0.3, 'soft');
      }
      I.riser(both(sfx, 0.1), 5.625 - 0.9, 0.9, 250, 6500, PREMI ? 0.12 : soft ? 0.18 : 0.28, !soft && !PREMI);
    }
    // ── bars 4–7 groove
    if (M) {
      const prog = soft ? ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'] : ['F', 'C', 'G', 'Am'];
      prog.forEach((ch, bi) => {
        const b0 = 12 + bi * 4;
        for (let b = 0; b < 4; b++) {
          const tt = bt(b0 + b), last = bi === 3 && b === 3;
          if (!last && (!soft || b % 2 === 0)) kicks.push(tt);
          if (!soft) {
            if ((b === 1 || b === 3) && !last) I.clap(both(drums, 0.18), tt, 0.5);
            I.hat(drums, tt + BEAT / 2, 0.42, b % 2 ? 0.05 : 0.03, 0.25); I.hat(drums, tt + BEAT / 4, 0.2, 0.02, -0.3); I.hat(drums, tt + (3 * BEAT) / 4, 0.22, 0.02, -0.25);
          } else {
            if ((b === 1 || b === 3) && !last) I.noiseBurst(both(drums, 0.25), tt, 0.2, 'bandpass', 3200, 1.4, 0.35, 0.03);
            I.hat(drums, tt + BEAT / 2, 0.22, 0.06, 0.2, 5500); I.hat(drums, tt + BEAT / 4, 0.1, 0.05, -0.3, 5500);
          }
        }
        const root = ROOT[ch];
        if (!soft) {
          for (let e = 0; e < 8; e++) {
            const tt = bt(b0) + (e * BEAT) / 2, f = mtof(root + (e % 4 === 3 ? 12 : 0)), len = BEAT / 2;
            const sub = ctx.createOscillator(); sub.frequency.value = f; const sg = ctx.createGain(); sg.gain.setValueAtTime(0, tt); sg.gain.linearRampToValueAtTime(0.5, tt + 0.004); sg.gain.setTargetAtTime(0.4, tt + 0.004, 0.2); sg.gain.setTargetAtTime(0, tt + len - 0.03, 0.015);
            const gr = ctx.createOscillator(); gr.type = 'sawtooth'; gr.frequency.value = f * 2; const gl = ctx.createBiquadFilter(); gl.type = 'lowpass'; gl.frequency.value = 900; const gg = ctx.createGain(); gg.gain.setValueAtTime(0, tt); gg.gain.linearRampToValueAtTime(0.12, tt + 0.003); gg.gain.setTargetAtTime(0.04, tt + 0.003, 0.06); gg.gain.setTargetAtTime(0, tt + len - 0.03, 0.015);
            sub.connect(sg).connect(music); gr.connect(gl).connect(gg).connect(music); [sub, gr].forEach((o) => { o.start(tt); o.stop(tt + len + 0.1); });
          }
          const notes = CH[ch].map((m) => m + 12), pat = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2];
          for (let k = 0; k < 16; k++) I.pluck(both(music, 0.12, 0.35), bt(b0) + (k * BEAT) / 4, mtof(notes[pat[k] % notes.length] + (k === 6 || k === 14 ? 12 : 0)), 0.22, 0.1, 3600, k % 2 ? -0.35 : 0.35);
          I.pad(both(music, 0.25), bt(b0), CH[ch], BAR, 0.2, 2200, 0.08, 0.25, 12);
        } else {
          for (let h = 0; h < 2; h++) { const tt = bt(b0) + h * 2 * BEAT; const o = ctx.createOscillator(); o.frequency.value = mtof(root + (h ? 7 : 0)); const gg = ctx.createGain(); gg.gain.setValueAtTime(0, tt); gg.gain.linearRampToValueAtTime(0.42, tt + 0.02); gg.gain.setTargetAtTime(0.2, tt + 0.02, 0.4); gg.gain.setTargetAtTime(0, tt + 2 * BEAT - 0.05, 0.03); o.connect(gg).connect(music); o.start(tt); o.stop(tt + 2 * BEAT + 0.2); }
          const notes = CH[ch].map((m) => m + 12), pat = [0, 2, 1, 3, 2, 1, 3, 0];
          for (let k = 0; k < 8; k++) I.pluck(both(music, 0.3, 0.3), bt(b0) + (k * BEAT) / 2, mtof(notes[pat[k] % notes.length]), 0.5, 0.09, 1600, k % 2 ? -0.3 : 0.3, 'soft');
          I.pad(both(music, 0.35), bt(b0), CH[ch], BAR, 0.16, 1400, 0.3, 0.4, 8);
        }
      });
      if (!soft && !PREMI) for (let k = 0; k < 12; k++) I.snare(both(drums, 0.1), 12.66 + (k * (13.125 - 12.66)) / 12, 0.14 + 0.03 * k, 0.05);
      I.riser(both(sfx, 0.12), 12.3, 0.825, 300, 8000, PREMI ? 0.13 : soft ? 0.22 : 0.34, !soft && !PREMI);
      // bar 8
      I.kick(drums, bt(28), soft ? 0.9 : 1.2, 0.5);
      [77, 81, 84, 88, 91].forEach((m, i) => I.bell(both(music, 0.6), bt(28), mtof(m), 2.4, 0.09, (i - 2) * 0.25));
      I.pad(both(music, 0.35), bt(28), soft ? CH.Cmaj9 : CH.Fadd9, 1.55, 0.22, 1800, 0.25, 0.3, 12);
      [29, 30, 31].forEach((b) => { kicks.push(bt(b)); I.hat(drums, bt(b) + BEAT / 2, 0.3, 0.03, 0.25); });
      if (!soft) I.clap(both(drums, 0.25), bt(30), 0.35);
    }
    kicks.forEach((k) => I.kick(drums, k, soft ? 0.55 : (k > 5.6 && k < 13.1 ? 1 : 0.85), soft ? 0.24 : 0.32, soft ? 1800 : 0));
    // sidechain on the music bus
    if (M) {
      const sc = [...kicks, bt(28)].sort((a, b) => a - b);
      music.gain.setValueAtTime(1, 0);
      sc.forEach((k) => { music.gain.setValueAtTime(1, k); music.gain.setValueAtTime(soft ? 0.7 : 0.38, k + 0.002); music.gain.setTargetAtTime(1, k + 0.004, 0.09); });
    }

    // ══════ sound design (synced to the picture)
    const S = both(sfx), SR_ = (v) => both(sfx, v);
    if (PREMI) {
      // Premium: curtos, secos e baixos; um som por acontecimento que importa (clique, virada, prova, logo)
      I.whoosh(S, 0.0, 0.32, 700, 2600, 900, 0.1, 0, 0, 0.8);
      I.impact(SR_(0.12), 0.1, 0.32, 72, 40, 0.35);
      I.click(S, 4.36, 0.3, 2400, 1.0, 160);
      (ev.typeT || []).forEach((kt, i) => {
        const sp = (ev.typeChars || '')[i] === ' ';
        I.click(S, kt, sp ? 0.14 : 0.18, sp ? 1800 : 2600 + K.r() * 1400, sp ? 0.8 : 0.5, sp ? 120 : 170 + K.r() * 60, (K.r() - 0.5) * 0.4);
      });
      I.click(S, 5.625, 0.4, 2200, 1.2, 150);
      I.whoosh(SR_(0.15), 5.48, 0.62, 180, 1400, 260, 0.32, 0.2, -0.2, 0.25);
      I.impact(SR_(0.2), 5.625, 0.55, 64, 32, 0.8);
      [96, 100, 103, 108].forEach((m, i) => I.bell(SR_(0.45), 5.95 + i * 0.06, mtof(m), 0.8, 0.03, (i - 1.5) * 0.4));
      if (ev.hasOffer) I.pop(S, 6.36, 0.16, 700, 320, 0.07);
      I.whoosh(SR_(0.1), 7.22, 0.52, 250, 2200, 400, 0.17, 0.7, -0.7, 0.45);
      (ev.nodeT || []).forEach((nt, i) => { const m = [69, 72, 74, 76][i] + 12; I.pluck(both(sfx, 0.3, 0.2), nt, mtof(m), 0.25, 0.08, 3800, -0.2 + i * 0.13, 'soft'); I.tone(S, nt, mtof(m), 0.4, 0.03, 0.1); });
      I.whoosh(SR_(0.1), 9.12, 0.42, 300, 1500, 500, 0.12, -0.3, 0.3, 0.6);
      if (ev.variant === 'proof') { for (let i = 0; i < 5; i++) I.pop(S, 9.82 + i * 0.07, 0.07, 1500 + i * 160, 1100 + i * 140, 0.04, (i - 2) * 0.3); I.bell(SR_(0.4), 10.75, mtof(88), 0.9, 0.07); }
      else if (ev.variant === 'offer') { I.pop(S, 9.64, 0.2, 800, 380, 0.08); I.impact(SR_(0.15), 9.62, 0.22, 110, 60, 0.25); }
      else I.whoosh(SR_(0.15), 9.55, 0.45, 400, 2000, 800, 0.12, -0.3, 0.3, 0.5);
      I.whoosh(SR_(0.1), 10.95, 0.52, 220, 2200, 360, 0.17, 0, 0, 0.45);
      for (let i = 0; i < (ev.contactRows || 0); i++) I.pop(S, 11.47 + i * 0.09, 0.11, 620 + i * 90, 300 + i * 50, 0.06, 0.2);
      { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(300, 12.66); f.frequency.exponentialRampToValueAtTime(4500, 13.13); const ga = ctx.createGain(), n = 64, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = 0.2 * Math.pow(i / (n - 1), 1.6); ga.gain.setValueCurveAtTime(c, 12.66, 0.47); f.connect(ga).connect(SR_(0.1)); const s = ctx.createBufferSource(); s.buffer = K.nb; s.connect(f); s.start(12.66, 1.1, 0.47); }
      I.impact(SR_(0.25), 13.125, soft ? 0.6 : 0.75, 60, 28, 1.2);
      [2637, 3136, 3520, 4186].forEach((f, i) => I.tone(SR_(0.7), 13.14, f, 1.8, 0.025, 0.6, (i - 1.5) * 0.3));
      (ev.clicks || []).filter((c) => c > 13).forEach((c) => I.click(S, c, 0.34, 2300, 1.1, 150));
      I.whoosh(SR_(0.1), 14.68, 0.4, 400, 2400, 700, 0.1, -0.4, 0.4, 0.6);
    } else {
    I.whoosh(both(sfx, 0.08), 14.72, 0.62, 300, 2800, 500, 0.5, -0.8, 0.8, 0.45);
    [bt(1), bt(1) + BEAT / 2].forEach((tt, i) => { I.impact(SR_(0.15), tt, i ? 0.62 : 0.75, 70, 38, 0.35); I.whoosh(S, tt - 0.12, 0.16, 800, 3500, 1200, 0.3, 0, 0, 0.85); });
    I.noiseBurst(SR_(0.3), 0.9375, 0.5, 'highpass', 4500, 0.7, 0.3, 0.05);
    [[2150, 0.25], [3720, 0.2], [5310, 0.16], [6870, 0.12]].forEach(([f, d]) => I.tone(SR_(0.3), 0.9375, f, 0.8, 0.1, d, 0.1));
    I.whoosh(S, 0.8375, 0.2, 1500, 7000, 3000, 0.25, -0.6, 0.6, 0.7);
    I.whoosh(S, bt(3), 0.3, 400, 1400, 400, 0.2, 0.3, -0.3, 0.5);
    I.riser(S, 1.525, 0.35, 500, 6000, 0.2, false);
    for (let k = 0; k < 70; k++) { const st = 1.875 + Math.abs((K.r() + K.r() + K.r() - 1.5) * 0.08), f = 2200 + K.r() * 6800; I.tone(SR_(0.35), st, f, 0.06, 0.05 + K.r() * 0.1, 0.004 + K.r() * 0.01, (K.r() - 0.5) * 1.2); }
    I.noiseBurst(SR_(0.3), 1.875, 0.4, 'highpass', 3000, 0.7, 0.16, 0.05);
    I.impact(S, 1.875, 0.45, 80, 40, 0.3);
    I.pop(S, 3.75, 0.16, 400, 120, 0.12);
    I.whoosh(S, 3.82, 0.26, 3000, 700, 200, 0.28, 0, 0, 0.9);
    I.chirp(SR_(0.3), 4.04, 260, 520, 0.4, 0.14, 0);
    I.click(S, 4.36, 0.06, 5000);
    (ev.typeT || []).forEach((kt, i) => {
      const sp = (ev.typeChars || '')[i] === ' ';
      I.click(S, kt, sp ? 0.28 : 0.38, sp ? 1800 : 2600 + K.r() * 1600, sp ? 1.1 : 0.8, sp ? 120 : 170 + K.r() * 70, (K.r() - 0.5) * 0.5);
      I.click(S, kt + 0.045, 0.1, 3800);
    });
    I.click(S, 5.625, 0.6, 2200, 1.4, 150);
    I.impact(SR_(0.2), 5.625, 0.95, 75, 30, 1.1);
    I.noiseBurst(SR_(0.3), 5.625, 1.6, 'highpass', 3500, 0.7, 0.12, 0.5);
    I.whoosh(S, 5.63, 0.25, 1200, 6000, 3000, 0.18, 0.3, -0.1, 0.8);
    { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1; f.frequency.setValueAtTime(4200, 5.7); f.frequency.exponentialRampToValueAtTime(500, 6.45); const ga = ctx.createGain(), n = 64, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = 0.3 * Math.pow(Math.sin((Math.PI * i) / (n - 1)), 0.8); ga.gain.setValueCurveAtTime(c, 5.7, 0.75); f.connect(ga).connect(SR_(0.2)); const s = ctx.createBufferSource(); s.buffer = K.nb; s.connect(f); s.start(5.7, 0.3, 0.75); }
    for (let k = 0; k < 26; k++) { const tb = 5.72 + K.r() * 0.6, f0 = 350 + K.r() * 550; I.chirp(S, tb, f0, f0 * 2.4, 0.03, 0.05, (K.r() - 0.5) * 1.4); }
    [96, 100, 103, 108].forEach((m, i) => I.bell(SR_(0.4), 6.3 + i * 0.07, mtof(m), 0.7, 0.05, (i - 1.5) * 0.4));
    if (ev.hasOffer) { I.pop(S, 6.34, 0.4, 700, 300, 0.08); I.bell(SR_(0.3), 6.36, mtof(91), 0.6, 0.08); }
    I.pop(S, bt(13), 0.2, 1400, 900, 0.05);
    I.whoosh(SR_(0.08), 7.28, 0.46, 250, 3200, 400, 0.6, 0.8, -0.8, 0.47);
    (ev.nodeT || []).forEach((nt, i) => { const m = [69, 72, 74, 76][i] + 12; I.pluck(both(sfx, 0.25, 0.25), nt, mtof(m), 0.25, 0.14, 5000, -0.2 + i * 0.13); I.tone(S, nt, mtof(m), 0.45, 0.06, 0.12); });
    I.whoosh(S, 9.14, 0.42, 300, 1800, 600, 0.22, -0.3, 0.3, 0.6);
    if (ev.variant === 'proof') {
      for (let i = 0; i < 5; i++) { I.pop(S, 9.78 + i * 0.07, 0.18, 1600 + i * 180, 1200 + i * 150, 0.04, (i - 2) * 0.3); }
      for (let k = 0; k < 20; k++) I.click(S, 9.95 + k * 0.04 * (1 + k * 0.03), 0.06, 5200, 0, 0, 0.1);
      I.bell(SR_(0.35), 10.75, mtof(88), 0.9, 0.12);
    } else if (ev.variant === 'offer') {
      I.impact(S, 9.6, 0.4, 110, 60, 0.25); I.pop(S, 9.6, 0.35, 900, 400, 0.08);
      for (let k = 0; k < 18; k++) I.tone(SR_(0.3), 9.62 + K.r() * 0.35, 3000 + K.r() * 5000, 0.08, 0.05, 0.02, (K.r() - 0.5) * 1.4);
    } else { I.whoosh(SR_(0.2), 9.55, 0.5, 400, 2400, 900, 0.2, -0.4, 0.4, 0.5); }
    I.whoosh(SR_(0.08), 11.03, 0.46, 220, 2600, 360, 0.55, 0, 0, 0.47);
    for (let i = 0; i < (ev.contactRows || 0); i++) { I.pop(S, 11.5 + i * 0.09, 0.3, 620 + i * 90, 300 + i * 50, 0.06, 0.2); I.tone(SR_(0.3), 12.15 + i * 0.1, mtof(84 + i * 3), 0.3, 0.035, 0.08); }
    { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(300, 12.66); f.frequency.exponentialRampToValueAtTime(6000, 13.13); const ga = ctx.createGain(), n = 64, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = 0.35 * Math.pow(i / (n - 1), 1.5); ga.gain.setValueCurveAtTime(c, 12.66, 0.47); f.connect(ga).connect(SR_(0.1)); const s = ctx.createBufferSource(); s.buffer = K.nb; s.connect(f); s.start(12.66, 1.1, 0.47); }
    I.impact(SR_(0.25), 13.125, soft ? 0.95 : 1.2, 60, 28, 1.3);
    [2637, 3136, 3520, 4186, 5274].forEach((f, i) => I.tone(SR_(0.7), 13.13, f, 2, 0.04, 0.7, (i - 2) * 0.3));
    I.whoosh(S, 13.2, 0.45, 500, 3000, 900, 0.2, -0.5, 0.5, 0.5);
    [13.45, 13.51, 13.57, 13.63, 13.69].forEach((tt) => I.click(S, tt, 0.08, 4500));
    I.pop(S, 13.8, 0.35, 1100, 600, 0.07);
    I.bell(SR_(0.4), 14.1, mtof(96), 0.7, 0.05);
    I.riser(S, 14.72, 0.28, 800, 7000, 0.15, false);
    }

    return ctx.startRendering();
  }

  // emenda do loop (o que passa do fim volta para o começo), saturação suave e volume final (~-13 dB RMS)
  function master(buf, n15) {
    const out = new AudioBuffer({ length: n15, numberOfChannels: 2, sampleRate: SR });
    let peak = 0;
    const chans = [0, 1].map((c) => { const src = buf.getChannelData(c), d = new Float32Array(n15); d.set(src.subarray(0, n15)); for (let i = n15; i < src.length; i++) d[i - n15] += src[i]; for (let i = 0; i < n15; i++) peak = Math.max(peak, Math.abs(d[i])); return d; });
    const pre = peak > 0 ? 0.95 / peak : 1, drive = 1.2, norm = Math.tanh(drive);
    let peak2 = 0, sum = 0;
    chans.forEach((d) => { for (let i = 0; i < n15; i++) { d[i] = Math.tanh(d[i] * pre * drive) / norm; peak2 = Math.max(peak2, Math.abs(d[i])); sum += d[i] * d[i]; } });
    const rmsDb = 10 * Math.log10(sum / (2 * n15) + 1e-12);
    let post = Math.pow(10, (-13.2 - rmsDb) / 20); if (peak2 * post > 0.89) post = 0.89 / (peak2 || 1);
    const fade = Math.floor(SR * 0.003);
    chans.forEach((d, c) => { for (let i = 0; i < n15; i++) d[i] *= post; for (let i = 0; i < fade; i++) { d[i] *= i / fade; d[n15 - 1 - i] *= i / fade; } out.copyToChannel(d, c); });
    return out;
  }

  // ══════ vídeo de 30 s
  // A partitura de 15 s é cortada em compassos (7,5 s e 11,25 s, onde o vídeo também corta) e os capítulos novos ganham
  // música própria na mesma harmonia. O ritmo muda com a história: groove cheio nas fotos e no passo a passo, a batida
  // recua no depoimento (só acorde e dedilhado), volta na frase final e sobe antes do contato.
  async function render30(ev, opts = {}) {
    const mood = opts.mood || ev.mood || 'energia', seed = opts.seed || 7;
    // cada trecho monta o próprio grafo (com reverb) na thread principal: um de cada vez, com uma pausa entre eles,
    // para a prévia não travar enquanto a trilha é preparada; a renderização em si corre em paralelo
    const breathe = () => new Promise((r) => setTimeout(r, 0));
    const makers = [() => score(ev, { mood, seed, window: [0, 7.5] }), () => chapters(ev, { mood, seed, part: 1 }), () => score(ev, { mood, seed, window: [7.5, 11.25] }),
      () => chapters(ev, { mood, seed, part: 2 }), () => score(ev, { mood, seed, window: [11.25, 15] })];
    const jobs = [];
    for (const make of makers) { jobs.push(make()); await breathe(); }
    const [s1, c1, s2, c2, s3] = await Promise.all(jobs);
    const n = Math.floor(SR * 30), total = n + SR * 4, L = new Float32Array(total), R = new Float32Array(total);
    const place = (buf, at) => { const o = Math.round(at * SR); [L, R].forEach((dst, c) => { const d = buf.getChannelData(c), m = Math.min(d.length, total - o); for (let i = 0; i < m; i++) dst[o + i] += d[i]; }); };
    for (const [buf, at] of [[s1, 0], [c1, 7.5], [s2, 15], [c2, 18.75], [s3, 26.25]]) { place(buf, at); await breathe(); }
    const mix = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: SR }); mix.copyToChannel(L, 0); mix.copyToChannel(R, 1);
    return master(mix, n);
  }

  async function chapters(ev, { mood, seed, part }) {
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * (7.5 + 3.2)), SR), K = makeKit(ctx, seed + 40 + part), I = instruments(ctx, K);
    const B = buses(ctx, K, mood), { drums, music, sfx, both } = B;
    const M = mood !== 'nenhuma', soft = mood === 'suave', PREMI = ev.style === 'premium', E = ev.ch30 || {};
    const kicks = [];
    // continua o ciclo de acordes do vídeo de 15 s (F C G Am / Fmaj7 Em7 Dm7 Cmaj7) sem quebrar a harmonia nos cortes
    const prog = soft ? (part === 1 ? ['Em7', 'Dm7', 'Cmaj7', 'Fmaj7'] : ['Cmaj7', 'Fmaj7', 'Em7', 'Dm7']) : (part === 1 ? ['C', 'G', 'Am', 'F'] : ['Am', 'F', 'C', 'G']);
    if (M) prog.forEach((ch, bi) => {
      const b0 = bi * 4, calm = part === 2 && bi < 2; // depoimento: a batida recua
      for (let b = 0; b < 4; b++) {
        const tt = bt(b0 + b);
        if (calm) { I.hat(drums, tt + BEAT / 2, 0.1, 0.05, b % 2 ? -0.2 : 0.2, 6500); continue; }
        if (!soft || b % 2 === 0) kicks.push(tt);
        if (!soft) {
          if (b === 1 || b === 3) I.clap(both(drums, 0.18), tt, 0.5);
          I.hat(drums, tt + BEAT / 2, 0.42, b % 2 ? 0.05 : 0.03, 0.25); I.hat(drums, tt + BEAT / 4, 0.2, 0.02, -0.3); I.hat(drums, tt + (3 * BEAT) / 4, 0.22, 0.02, -0.25);
        } else {
          if (b === 1 || b === 3) I.noiseBurst(both(drums, 0.25), tt, 0.2, 'bandpass', 3200, 1.4, 0.35, 0.03);
          I.hat(drums, tt + BEAT / 2, 0.22, 0.06, 0.2, 5500); I.hat(drums, tt + BEAT / 4, 0.1, 0.05, -0.3, 5500);
        }
      }
      const root = ROOT[ch], notes = CH[ch].map((m) => m + 12);
      if (calm) {
        // acorde longo que abre devagar, dedilhado em colcheias e um grave sustentado
        const p = I.pad(both(music, 0.45), bt(b0), CH[ch], BAR, soft ? 0.2 : 0.24, 900, 0.5, 0.5, 9);
        p.f.frequency.setValueAtTime(900, bt(b0)); p.f.frequency.exponentialRampToValueAtTime(1800, bt(b0) + BAR);
        const pat = [0, 2, 1, 3, 2, 1, 3, 2];
        for (let e = 0; e < 8; e++) I.pluck(both(music, 0.35, 0.3), bt(b0) + (e * BEAT) / 2, mtof(notes[pat[e] % notes.length]), 0.45, 0.06, 1400, e % 2 ? -0.3 : 0.3, 'soft');
        const o = ctx.createOscillator(); o.frequency.value = mtof(root); const gg = ctx.createGain(); gg.gain.setValueAtTime(0, bt(b0)); gg.gain.linearRampToValueAtTime(0.22, bt(b0) + 0.3); gg.gain.setTargetAtTime(0, bt(b0) + BAR - 0.1, 0.05);
        o.connect(gg).connect(music); o.start(bt(b0)); o.stop(bt(b0) + BAR + 0.3);
        return;
      }
      if (!soft) {
        for (let e = 0; e < 8; e++) {
          const tt = bt(b0) + (e * BEAT) / 2, f = mtof(root + (e % 4 === 3 ? 12 : 0)), len = BEAT / 2;
          const sub = ctx.createOscillator(); sub.frequency.value = f; const sg = ctx.createGain(); sg.gain.setValueAtTime(0, tt); sg.gain.linearRampToValueAtTime(0.5, tt + 0.004); sg.gain.setTargetAtTime(0.4, tt + 0.004, 0.2); sg.gain.setTargetAtTime(0, tt + len - 0.03, 0.015);
          const gr = ctx.createOscillator(); gr.type = 'sawtooth'; gr.frequency.value = f * 2; const gl = ctx.createBiquadFilter(); gl.type = 'lowpass'; gl.frequency.value = 900; const gg = ctx.createGain(); gg.gain.setValueAtTime(0, tt); gg.gain.linearRampToValueAtTime(0.12, tt + 0.003); gg.gain.setTargetAtTime(0.04, tt + 0.003, 0.06); gg.gain.setTargetAtTime(0, tt + len - 0.03, 0.015);
          sub.connect(sg).connect(music); gr.connect(gl).connect(gg).connect(music); [sub, gr].forEach((o) => { o.start(tt); o.stop(tt + len + 0.1); });
        }
        const pat = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2];
        for (let k = 0; k < 16; k++) I.pluck(both(music, 0.12, 0.35), bt(b0) + (k * BEAT) / 4, mtof(notes[pat[k] % notes.length] + (k === 6 || k === 14 ? 12 : 0)), 0.22, 0.1, 3600, k % 2 ? -0.35 : 0.35);
        I.pad(both(music, 0.25), bt(b0), CH[ch], BAR, 0.2, 2200, 0.08, 0.25, 12);
      } else {
        for (let h = 0; h < 2; h++) { const tt = bt(b0) + h * 2 * BEAT; const o = ctx.createOscillator(); o.frequency.value = mtof(root + (h ? 7 : 0)); const gg = ctx.createGain(); gg.gain.setValueAtTime(0, tt); gg.gain.linearRampToValueAtTime(0.42, tt + 0.02); gg.gain.setTargetAtTime(0.2, tt + 0.02, 0.4); gg.gain.setTargetAtTime(0, tt + 2 * BEAT - 0.05, 0.03); o.connect(gg).connect(music); o.start(tt); o.stop(tt + 2 * BEAT + 0.2); }
        const pat = [0, 2, 1, 3, 2, 1, 3, 0];
        for (let k = 0; k < 8; k++) I.pluck(both(music, 0.3, 0.3), bt(b0) + (k * BEAT) / 2, mtof(notes[pat[k] % notes.length]), 0.5, 0.09, 1600, k % 2 ? -0.3 : 0.3, 'soft');
        I.pad(both(music, 0.35), bt(b0), CH[ch], BAR, 0.16, 1400, 0.3, 0.4, 8);
      }
    });
    if (M && part === 2) {
      // a frase final cai no tempo 1 do 3º compasso (a volta da batida) e o último compasso sobe para o contato
      I.kick(drums, bt(8), soft ? 0.8 : 1.1, 0.45);
      if (!soft && !PREMI) for (let k = 0; k < 12; k++) I.snare(both(drums, 0.1), bt(14) + (k * 2 * BEAT) / 12, 0.1 + 0.03 * k, 0.05);
      I.riser(both(sfx, 0.12), bt(16) - 0.95, 0.9, 280, 7000, PREMI ? 0.12 : soft ? 0.18 : 0.28, !soft && !PREMI);
    }
    kicks.forEach((k) => I.kick(drums, k, soft ? 0.55 : 0.95, soft ? 0.24 : 0.32, soft ? 1800 : 0));
    if (M) {
      music.gain.setValueAtTime(1, 0);
      kicks.slice().sort((a, b) => a - b).forEach((k) => { music.gain.setValueAtTime(1, k); music.gain.setValueAtTime(soft ? 0.7 : 0.38, k + 0.002); music.gain.setTargetAtTime(1, k + 0.004, 0.09); });
    }

    // ── efeitos: um som por acontecimento que importa; no Premium, curtos e baixos
    const S = both(sfx), SR_ = (v) => both(sfx, v), q = PREMI ? 0.5 : 1;
    const whoosh = (t, vert) => (PREMI ? I.whoosh(SR_(0.1), t - 0.06, 0.52, 250, 2200, 400, 0.17, vert ? 0 : 0.7, vert ? 0 : -0.7, 0.45) : I.whoosh(SR_(0.08), t, 0.46, 250, vert ? 2600 : 3200, 400, 0.55, vert ? 0 : 0.8, vert ? 0 : -0.8, 0.47));
    if (part === 1) {
      const sh = E.show || {}, st = E.steps || {}, off = BAR * 2;
      (sh.lands || []).filter((_, i, a) => i < 10 || i === a.length - 1).forEach((t, i) => I.click(S, t, (PREMI ? 0.12 : 0.22) * (i ? 1 : 1.3), 2600 + (i % 5) * 300, PREMI ? 0.6 : 0.9, 150 + (i % 4) * 25, ((i % 5) - 2) * 0.2));
      if (sh.tap != null) { I.click(S, sh.tap, 0.34 * (PREMI ? 0.9 : 1), 2300, 1.1, 150); [96, 100, 103].forEach((m, i) => I.bell(SR_(0.45), sh.tap + 0.05 + i * 0.05, mtof(m), 0.7, 0.035 * q + 0.01, (i - 1) * 0.4)); }
      if (sh.tap2 != null) { I.click(S, sh.tap2, 0.3 * (PREMI ? 0.9 : 1), 2400, 1.0, 160); I.bell(SR_(0.4), sh.tap2 + 0.05, mtof(98), 0.6, 0.03 * q + 0.01, 0.2); }
      if (sh.fan != null) { I.whoosh(SR_(0.12), sh.fan - 0.1, 0.4, 300, 1800, 500, 0.14 * q + 0.04, -0.4, 0.4, 0.6); [0, 1].forEach((i) => I.pop(S, sh.fan + 0.12 + i * 0.07, 0.16 * q, 700 + i * 120, 330 + i * 40, 0.07, i ? 0.3 : -0.3)); }
      whoosh(BAR * 2 - 0.22, false);
      (st.t || []).forEach((nt, i) => { const m = [72, 76, 79][i] + 12; I.pluck(both(sfx, 0.25, 0.25), off + nt, mtof(m), 0.25, PREMI ? 0.08 : 0.14, 4600, -0.2 + i * 0.2, PREMI ? 'soft' : 'saw'); I.tone(S, off + nt, mtof(m), 0.4, PREMI ? 0.03 : 0.05, 0.11); });
      if (st.confirm != null) [84, 88, 91].forEach((m, i) => I.bell(SR_(0.4), off + st.confirm + i * 0.1, mtof(m + 12), 0.6, 0.03 * q + 0.015, (i - 1) * 0.3));
      whoosh(BAR * 4 - 0.22, false);
    } else {
      const v = E.voice || {}, pu = E.punch || {}, off = BAR * 2;
      if (v.kind === 'quote') { I.impact(SR_(0.15), 0.05, PREMI ? 0.2 : 0.3, 90, 50, 0.3); if (v.author != null) I.pop(S, v.author + 0.05, 0.16 * q + 0.04, 650, 320, 0.07); }
      else if (v.kind === 'offer') { I.impact(SR_(0.15), bt(1), PREMI ? 0.22 : 0.4, 110, 60, 0.25); I.pop(S, bt(1), PREMI ? 0.2 : 0.35, 900, 400, 0.08); I.pop(S, bt(4), 0.18 * q + 0.04, 700, 350, 0.07); }
      else { [84, 88].forEach((m, i) => I.bell(SR_(0.4), 0.1 + i * 0.08, mtof(m + 12), 0.8, 0.04 * q + 0.015, (i - 0.5) * 0.4)); for (let i = 0; i < (v.n || 0); i++) I.pop(S, bt(5) + i * 0.08, 0.14 * q + 0.04, 640 + i * 90, 300 + i * 40, 0.06, (i - 1) * 0.3); }
      whoosh(BAR * 2 - 0.22, true);
      (pu.words || []).forEach((wt, i, a) => {
        const t = off + wt + 0.11, last = i === a.length - 1;
        if (PREMI) I.click(S, t, last ? 0.28 : 0.14, 2200 + (i % 3) * 300, last ? 1.1 : 0.7, 150);
        else { I.impact(SR_(0.12), t, last ? 0.7 : 0.28, last ? 70 : 90, last ? 34 : 48, last ? 0.8 : 0.25); I.noiseBurst(SR_(0.2), t, 0.2, 'highpass', 4000, 0.7, last ? 0.2 : 0.1, 0.04); }
      });
      if (pu.last != null) [2637, 3136, 3520].forEach((f, i) => I.tone(SR_(0.6), off + pu.last + 0.45 + i * 0.03, f, 1.2, 0.02 * q + 0.008, 0.5, (i - 1) * 0.3));
      whoosh(BAR * 4 - 0.22, true);
    }
    return ctx.startRendering();
  }

  // 16-bit WAV (for debugging / tests)
  function toWav(ab) {
    const n = ab.length, ch = ab.numberOfChannels, sr = ab.sampleRate, buf = new ArrayBuffer(44 + n * ch * 2), v = new DataView(buf);
    const ws = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    ws(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const data = [...Array(ch)].map((_, c) => ab.getChannelData(c));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { v.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true); o += 2; }
    return new Uint8Array(buf);
  }
  return { render, toWav, SR, _: { instruments, makeKit, buses, master, mtof, rngf } };
})();
