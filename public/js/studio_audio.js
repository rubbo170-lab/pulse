'use strict';
// ─── Pulso Studio · trilha própria de cada vídeo ───
// Gênero, tom, progressão e andamento saem do plano do vídeo (mesma semente = mesma música, outra semente = outra).
// A música segue a história: entra no gancho, recua no problema, abre no produto, cresce antes do contato e fecha na marca.
// Os efeitos caem nos acontecimentos da imagem: transições, palavras, itens da lista, toques, digitação.
const PulsoStudioAudio = (() => {
  const PA = PulsoAudio, A = PA._, SR = PA.SR, mtof = A.mtof;
  const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  const PROGS = {
    major: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 0, 4, 5], [0, 3, 5, 4]],
    minor: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [5, 6, 0, 0], [0, 4, 5, 3], [0, 5, 3, 4]],
    jazz: [[1, 4, 0, 5], [0, 5, 1, 4], [3, 2, 1, 0], [0, 3, 2, 4]],
  };
  const KEYS = [0, 2, -3, 5, -1, 3, -5, 4, 1, -2];

  // gêneros: modo, bateria, baixo, acordes, solo e balanço (swing)
  const GEN = {
    pop: { mode: 'major', drums: 'pop', bass: 'pop', chords: 'stab', lead: 'arp16', swing: 0 },
    funk: { mode: 'major', drums: 'funk', bass: 'slap', chords: 'chop', lead: 'none', swing: 0.14 },
    house: { mode: 'minor', drums: 'house', bass: 'offbeat', chords: 'organ', lead: 'arp8', swing: 0.05, duck: 0.4 },
    trap: { mode: 'minor', drums: 'trap', bass: '808', chords: 'bell', lead: 'none', swing: 0 },
    lofi: { mode: 'jazz', drums: 'lofi', bass: 'round', chords: 'keys', lead: 'none', swing: 0.2, lp: 3600, crackle: true },
    cinematic: { mode: 'minor', drums: 'cine', bass: 'drone', chords: 'strings', lead: 'ostinato', swing: 0 },
    synth: { mode: 'minor', drums: 'synth', bass: 'saw8', chords: 'pad', lead: 'arp16', swing: 0 },
    minimal: { mode: 'jazz', drums: 'minimal', bass: 'sine', chords: 'pluck', lead: 'none', swing: 0.06 },
    disco: { mode: 'major', drums: 'disco', bass: 'octave', chords: 'stab', lead: 'strings', swing: 0, duck: 0.45 },
    techno: { mode: 'minor', drums: 'techno', bass: 'rolling', chords: 'organ', lead: 'arp16', swing: 0, duck: 0.35 },
    acoustic: { mode: 'major', drums: 'acoustic', bass: 'round', chords: 'strum', lead: 'none', swing: 0.1 },
  };
  // bateria em 16 passos por compasso: x = forte, o = médio, - = leve
  const X = (s) => s.split('').map((c) => (c === 'x' ? 1 : c === 'o' ? 0.62 : c === '-' ? 0.32 : 0));
  const DR = {
    pop: { k: X('x......ox.o.....'), sn: X('....x.......x...'), hh: X('o.-.o.-.o.-.o.--'), clap: true },
    funk: { k: X('x..o...o..x.....'), sn: X('....x..-.-..x..-'), hh: X('o-o-o-o-o-o-o-o-') },
    house: { k: X('x...x...x...x...'), sn: X('....x.......x...'), hh: X('-.-.-.-.-.-.-.-.'), oh: X('..x...x...x...x.'), clap: true },
    trap: { k: X('x.........o.....'), k2: X('x.....o...o.....'), sn: X('........x.......'), hh: X('o.o.o.o.o.o.o.o.'), clap: true, rolls: true },
    lofi: { k: X('x......o..x.....'), sn: X('....o.......o...'), hh: X('-.-.-.-.-.-.-.--'), soft: true },
    cine: { boom: X('x.......o.......'), tom: X('......o.....o.o.'), sh: X('-.-.-.-.-.-.-.-.') },
    synth: { k: X('x.......x.......'), sn: X('....x.......x...'), hh: X('o.o.o.o.o.o.o.o.'), bigSnare: true },
    minimal: { k: X('x.......x..-....'), rim: X('............x...'), hh: X('..-...-...-...-.'), sh: X('-.-.-.-.-.-.-.-.') },
    disco: { k: X('x...x...x...x...'), sn: X('....x.......x...'), hh: X('-.-.-.-.-.-.-.-.'), oh: X('..x...x...x...x.'), clap: true },
    techno: { k: X('x...x...x...x...'), sn: X('....-.......-...'), hh: X('--o---o---o---o-'), rim: X('...x..x....x..x.'), clap: true },
    acoustic: { k: X('x.......o.o.....'), snap: X('....o.......o...'), sh: X('-o-o-o-o-o-o-o-o') },
  };
  // baixo: [passo, intervalo, duração em 16 avos]
  const BS = {
    pop: [[0, 0, 3], [3, 0, 1], [6, 0, 2], [8, 0, 3], [11, 7, 1], [14, 0, 2]],
    slap: [[0, 0, 1], [2, 12, 1], [3, 0, 1], [6, 0, 1], [7, 12, 1], [10, 0, 1], [11, 7, 1], [14, 12, 1]],
    offbeat: [[2, 0, 2], [6, 0, 2], [10, 0, 2], [14, 0, 2]],
    '808': [[0, 0, 9], [10, 0, 5]],
    round: [[0, 0, 6], [7, 7, 2], [10, 0, 5]],
    drone: [[0, 0, 16]],
    saw8: [[0, 0, 2], [2, 0, 2], [4, 12, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 12, 2], [14, 7, 2]],
    sine: [[0, 0, 3], [6, 0, 1], [8, 0, 3], [14, 7, 1]],
    octave: [[0, 0, 1], [2, 12, 1], [4, 0, 1], [6, 12, 1], [8, 0, 1], [10, 12, 1], [12, 0, 1], [14, 12, 1]],
    rolling: [[1, 0, 1], [2, 0, 1], [3, 0, 1], [5, 0, 1], [6, 0, 1], [7, 0, 1], [9, 0, 1], [10, 0, 1], [11, 0, 1], [13, 0, 1], [14, 0, 1], [15, 0, 1]],
  };
  // ritmo dos acordes: [passo, duração em 16 avos]
  const CR = { stab: [[0, 2], [3, 1], [6, 2], [10, 2], [12, 1]], organ: [[0, 1], [3, 1], [6, 1], [10, 1], [13, 1]], chop: [[2, 1], [5, 1], [10, 1], [13, 1]], keys: [[0, 7], [7, 2], [10, 5]], bell: [[0, 1], [3, 1], [6, 1], [10, 1], [12, 1]] };

  // seções da música por tipo de cena
  const SEC = { hook: 'intro', pain: 'break', search: 'light', product: 'drop', benefits: 'groove', benefit1: 'groove', proof: 'groove', offer: 'drop', quote: 'break', showcase: 'groove', steps: 'light', statement: 'build', cta: 'groove', outro: 'end' };
  const LAY = {
    intro: { k: 1, sn: 0.8, hh: 1, oh: 0.4, bass: 0.6, ch: 1, lead: 0, cut: 0.52 },
    break: { k: 0.35, sn: 0, hh: 0.6, oh: 0, bass: 0.7, ch: 1, lead: 0, cut: 0.4, pad: true },
    light: { k: 0.7, sn: 0.55, hh: 0.9, oh: 0.3, bass: 0.7, ch: 0.9, lead: 0.35, cut: 0.72 },
    groove: { k: 1, sn: 1, hh: 1, oh: 1, bass: 1, ch: 1, lead: 0.6, cut: 0.9 },
    drop: { k: 1, sn: 1, hh: 1, oh: 1, bass: 1, ch: 1, lead: 1, cut: 1 },
    build: { k: 1, sn: 0.7, hh: 1, oh: 0.4, bass: 0.8, ch: 1, lead: 0.4, cut: 0.55, roll: true },
    end: { k: 1, sn: 0.7, hh: 0.8, oh: 0.5, bass: 0.9, ch: 1, lead: 0.3, cut: 0.85 },
  };
  const breathe = () => new Promise((r) => setTimeout(r, 0));
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

  // Janela [a, b) da trilha: só tocam as notas e efeitos que COMEÇAM nela, deslocados para começar em 0; o que começou
  // antes fica no pedaço anterior (com a cauda). Assim a trilha é renderizada em pedaços, em paralelo, e depois somada.
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

  // ── bateria em amostras: cada som é sintetizado uma vez e depois só tocado (bem mais leve que sintetizar a cada batida)
  const DRUMS = {
    kick: [1.4, (I, d) => I.kick(d, 0.01, 0.95, 0.3, 0)], kickSoft: [1.2, (I, d) => I.kick(d, 0.01, 0.95, 0.24, 1600)],
    clap: [0.8, (I, d) => I.clap(d, 0.01, 0.55)], snare: [0.8, (I, d) => I.snare(d, 0.01, 0.55, 0.1)], snareBig: [1.1, (I, d) => I.snare(d, 0.01, 0.55, 0.16)],
    snareTick: [0.5, (I, d) => I.snare(d, 0.01, 0.55, 0.05)], snareLo: [0.6, (I, d) => I.snare(d, 0.01, 0.22, 0.08)],
    hatA: [0.3, (I, d) => I.hat(d, 0.01, 0.34, 0.025, 0, 7800)], hatB: [0.3, (I, d) => I.hat(d, 0.01, 0.34, 0.025, 0, 7800)], hatSoft: [0.35, (I, d) => I.hat(d, 0.01, 0.34, 0.03, 0, 6500)],
    hatRoll: [0.25, (I, d) => I.hat(d, 0.01, 0.2, 0.018, 0, 8000)], oh: [0.9, (I, d) => I.hat(d, 0.01, 0.2, 0.11, 0, 6000)],
    rim: [0.3, (I, d) => I.click(d, 0.01, 0.3, 1700, 0.9, 480)], rimSoft: [0.3, (I, d) => I.click(d, 0.01, 0.35, 1800, 0.9, 420)],
    shaker: [0.3, (I, d) => I.noiseBurst(d, 0.01, 0.08, 'bandpass', 6500, 1.4, 0.16, 0.022)],
    snap: [0.45, (I, d) => { I.noiseBurst(d, 0.01, 0.12, 'bandpass', 2400, 2.2, 0.5, 0.018); I.click(d, 0.01, 0.2, 3200); }],
    boom: [2.4, (I, d) => I.impact(d, 0.01, 0.5, 70, 36, 0.5)], tomHi: [1, (I, d) => I.impact(d, 0.01, 0.22, 175, 110, 0.18)], tomLo: [1, (I, d) => I.impact(d, 0.01, 0.22, 140, 90, 0.18)],
    rollHit: [0.9, (I, d) => I.impact(d, 0.01, 0.3, 150, 100, 0.1)],
  };
  const kitCache = new Map();
  function sampleKit(seed) {
    if (kitCache.has(seed)) return kitCache.get(seed);
    const jobs = Object.entries(DRUMS).map(async ([name, [len, play]], i) => {
      const ctx = new OfflineAudioContext(2, Math.ceil(SR * len), SR), K = A.makeKit(ctx, seed + 101 + i * 7), I = A.instruments(ctx, K);
      const g = ctx.createGain(); g.connect(ctx.destination); play(I, g);
      const buf = await ctx.startRendering();
      // corta o silêncio do começo (o som foi tocado em 10 ms) e suaviza o fim
      const n = buf.length, fade = Math.floor(SR * 0.03), off = Math.floor(SR * 0.01), out = new AudioBuffer({ length: n - off, numberOfChannels: 2, sampleRate: SR });
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c).slice(off); for (let k = 0; k < fade; k++) d[d.length - 1 - k] *= k / fade; out.copyToChannel(d, c); }
      return [name, out];
    });
    const p = Promise.all(jobs).then((list) => Object.fromEntries(list));
    kitCache.set(seed, p); if (kitCache.size > 4) kitCache.delete(kitCache.keys().next().value);
    return p;
  }

  // a trilha inteira: pedaços de alguns compassos renderizados em paralelo e somados; depois a emenda do loop e o volume final
  async function render(ev, opts = {}) {
    const dur = ev.dur, B = 60 / ev.bpm, bar = B * 4, bars = Math.max(1, Math.round(ev.total / 4));
    const kit = await sampleKit((Number(ev.seed) >>> 0) % 997);
    const per = Math.max(2, Math.round(3.8 / bar)), cuts = [];
    for (let b0 = 0; b0 < bars; b0 += per) cuts.push([b0 * bar, Math.min(dur, (b0 + per) * bar)]);
    cuts[cuts.length - 1][1] = dur;
    const jobs = [];
    for (const [a, b] of cuts) { jobs.push(compose(ev, opts, a, b, kit)); await breathe(); }
    const bufs = await Promise.all(jobs);
    const n = Math.floor(SR * dur), total = n + SR * 4, L = new Float32Array(total), Rr = new Float32Array(total);
    bufs.forEach((buf, i) => { const o = Math.round(cuts[i][0] * SR); [L, Rr].forEach((dst, c) => { const d = buf.getChannelData(c), m = Math.min(d.length, total - o); for (let k = 0; k < m; k++) dst[o + k] += d[k]; }); });
    const mix = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: SR }); mix.copyToChannel(L, 0); mix.copyToChannel(Rr, 1);
    return A.master(mix, n);
  }

  async function compose(ev, opts, wa, wb, kit) {
    const mood = opts.mood || ev.mood || 'energia', M = mood !== 'nenhuma', soft = mood === 'suave';
    const seed = (Number(ev.seed) >>> 0) || 7, R = A.rngf((seed ^ 0x51f15e) >>> 0);
    const dur = ev.dur, bpm = ev.bpm, B = 60 / bpm, S16 = B / 4, steps = Math.round(ev.total * 4);
    const gid = GEN[ev.genre] ? ev.genre : 'pop', g = GEN[gid], dp = DR[g.drums], energy = ev.energy ?? 0.7;
    const inW = (t) => t >= wa - 1e-6 && t < wb;
    const ctx = windowed(new OfflineAudioContext(2, Math.ceil(SR * (wb - wa + 3.2)), SR), wa, wb), K = A.makeKit(ctx, seed + 11), I = A.instruments(ctx, K);
    const bus = A.buses(ctx, K, mood, 128 / bpm), { drums, music, sfx } = bus;
    // rotas de mixagem reaproveitadas (reverb e eco por envio), uma por combinação
    const routes = new Map();
    const both = (dest, rv = 0, dly = 0) => { const k = `${dest === drums ? 'd' : dest === music ? 'm' : 's'}|${rv}|${dly}`; if (!routes.has(k)) routes.set(k, bus.both(dest, rv, dly)); return routes.get(k); };
    // filtro da música: abre e fecha com a história
    const mf = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.Q.value = 0.7; music.disconnect(); music.connect(mf).connect(bus.master);
    const cutHz = (c) => Math.min(g.lp || 18000, 280 * Math.pow(64, c));
    drums.gain.value = soft ? 0.62 : 1; music.gain.value = 1; sfx.gain.value = (soft ? 0.7 : 1) * (0.75 + 0.3 * energy);

    // tom e progressão
    const mode = g.mode === 'jazz' ? 'major' : g.mode, sc = SCALE[mode], key = KEYS[Math.floor(R() * KEYS.length)];
    const progs = PROGS[g.mode === 'jazz' ? 'jazz' : mode], prog = progs[Math.floor(R() * progs.length)], seventh = g.mode === 'jazz';
    const chord = (bar) => {
      const d = prog[bar % prog.length], tones = [0, 2, 4].concat(seventh ? [6] : []).map((k) => sc[(d + k) % 7] + 12 * Math.floor((d + k) / 7));
      const notes = tones.map((x) => { let n = 48 + key + x; while (n < 55) n += 12; while (n > 71) n -= 12; return n; }).sort((a, b) => a - b);
      const pc = (((key + sc[d]) % 12) + 12) % 12;
      return { notes, root: 36 + pc, d };
    };
    const scaleNote = (i, oct = 72) => oct + key + sc[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);

    // seções
    const scenes = ev.scenes.map((s, i) => ({ ...s, sec: i === 0 ? 'intro' : i === ev.scenes.length - 1 ? 'end' : SEC[s.kind] || 'groove' }));
    for (let i = 1; i < scenes.length - 1; i++) if (scenes[i].sec === 'break' && scenes[i - 1].sec === 'break') scenes[i].sec = 'light';
    const secAt = (t) => { for (const s of scenes) if (t < s.t1 - 1e-6) return s; return scenes[scenes.length - 1]; };
    // automação do filtro por cena (no começo da janela, o valor que o filtro teria naquele instante)
    const cutAt = (t) => { const s = secAt(t), L = LAY[s.sec]; if (L.roll && t > s.t0 + 0.05) { const u = clamp((t - s.t0 - 0.05) / Math.max(0.05, s.t1 - s.t0 - 0.07)); return cutHz(L.cut) * Math.pow(cutHz(1) / cutHz(L.cut), u); } return cutHz(L.cut); };
    mf.frequency.setValueAtTime(cutAt(wa), wa);
    scenes.forEach((s, i) => {
      const L = LAY[s.sec];
      if (i && s.t0 - 0.03 >= wa) mf.frequency.setTargetAtTime(cutHz(L.cut), s.t0 - 0.03, 0.05);
      if (L.roll && s.t1 > wa) { if (s.t0 + 0.05 >= wa) mf.frequency.setValueAtTime(cutHz(L.cut), s.t0 + 0.05); mf.frequency.exponentialRampToValueAtTime(cutHz(1), s.t1 - 0.02); }
    });

    // ── instrumentos
    const hit = (name, dest, t, v, pan = 0) => {
      if (v <= 0.001 || !kit[name]) return;
      const src = ctx.createBufferSource(); src.buffer = kit[name]; const ga = ctx.createGain(); ga.gain.value = v;
      if (pan) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; src.connect(ga).connect(pn).connect(dest); } else src.connect(ga).connect(dest);
      src.start(t);
    };
    const bassNote = (t, m, len, v) => {
      const f = mtof(m), kind = g.bass;
      if (kind === '808') {
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f * 2, t); o.frequency.setTargetAtTime(f, t, 0.025);
        const sh = ctx.createWaveShaper(); sh.curve = K.shaper(2.4); const ga = ctx.createGain();
        ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(0.75 * v, t + 0.006); ga.gain.setTargetAtTime(0.45 * v, t + 0.006, 0.3); ga.gain.setTargetAtTime(0, t + len - 0.04, 0.03);
        o.connect(ga).connect(sh).connect(music); o.start(t); o.stop(t + len + 0.3); return;
      }
      const sub = ctx.createOscillator(); sub.frequency.value = f; const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.46 * v, t + 0.005); sg.gain.setTargetAtTime((kind === 'drone' ? 0.4 : 0.32) * v, t + 0.005, 0.2); sg.gain.setTargetAtTime(0, t + len - 0.03, 0.02);
      sub.connect(sg).connect(music); sub.start(t); sub.stop(t + len + 0.2);
      if (kind === 'sine' || kind === 'round') return;
      const o = ctx.createOscillator(); o.type = kind === 'slap' ? 'square' : 'sawtooth'; o.frequency.value = f * (kind === 'drone' ? 1 : 2);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = kind === 'slap' ? 4 : 1.2;
      const top = kind === 'slap' ? 2600 : kind === 'rolling' ? 1400 : kind === 'drone' ? 500 : 1100;
      lp.frequency.setValueAtTime(top, t); lp.frequency.setTargetAtTime(kind === 'drone' ? 400 : 260, t, kind === 'slap' ? 0.05 : 0.09);
      const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime((kind === 'drone' ? 0.1 : 0.13) * v, t + 0.004); og.gain.setTargetAtTime(0.05 * v, t + 0.004, 0.08); og.gain.setTargetAtTime(0, t + len - 0.03, 0.02);
      o.connect(lp).connect(og).connect(music); o.start(t); o.stop(t + len + 0.2);
    };
    // acorde sustentado leve: 2 vozes por nota, abertas no estéreo
    const pad = (dest, t, notes, len, level, cutoff, attack, release, detune) => {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.5;
      const ga = ctx.createGain(); ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(level, t + attack); ga.gain.setValueAtTime(level, t + Math.max(attack, len)); ga.gain.setTargetAtTime(0, t + Math.max(attack, len), release / 3);
      f.connect(ga).connect(dest);
      [-1, 1].forEach((side) => {
        const pn = ctx.createStereoPanner(); pn.pan.value = side * 0.55; const vg = ctx.createGain(); vg.gain.value = 0.6 / notes.length; pn.connect(vg).connect(f);
        notes.forEach((m) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = side * detune; o.connect(pn); o.start(t); o.stop(t + len + release * 2 + 0.1); });
      });
      return { f, ga };
    };
    const stab = (dest, t, notes, len, v, cutoff = 2600, type = 'sawtooth') => {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1; f.frequency.setValueAtTime(cutoff, t); f.frequency.setTargetAtTime(cutoff * 0.35, t, 0.12);
      const ga = ctx.createGain(); ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(v, t + 0.004); ga.gain.setTargetAtTime(v * 0.5, t + 0.004, 0.1); ga.gain.setTargetAtTime(0, t + len, 0.04);
      const vg = ctx.createGain(); vg.gain.value = 0.5 / notes.length; vg.connect(f); f.connect(ga).connect(dest);
      notes.forEach((m) => [-7, 7].forEach((dt) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(m); o.detune.value = dt; o.connect(vg); o.start(t); o.stop(t + len + 0.3); }));
    };
    // dedilhado leve (uma voz)
    const pl = (dest, t, freq, dur2, level, bright, pan, softK) => {
      const o = ctx.createOscillator(); o.type = softK ? 'triangle' : 'sawtooth'; o.frequency.value = freq;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(500 + bright, t); f.frequency.setTargetAtTime(500, t, 0.07);
      const ga = ctx.createGain(); ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(level, t + 0.002); ga.gain.setTargetAtTime(0, t + 0.002, dur2 * 0.45);
      const pn = ctx.createStereoPanner(); pn.pan.value = pan; o.connect(f).connect(ga).connect(pn).connect(dest); o.start(t); o.stop(t + dur2 * 4 + 0.1);
    };
    // piano elétrico (FM suave)
    const ep = (dest, t, m, len, v, pan) => {
      const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(); car.frequency.value = f; mod.frequency.value = f;
      const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.4, t); mg.gain.setTargetAtTime(f * 0.15, t, 0.2); mod.connect(mg).connect(car.frequency);
      const ga = ctx.createGain(); ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(v, t + 0.005); ga.gain.setTargetAtTime(v * 0.45, t + 0.005, 0.35); ga.gain.setTargetAtTime(0, t + len, 0.12);
      const pn = ctx.createStereoPanner(); pn.pan.value = pan; car.connect(ga).connect(pn).connect(dest);
      [car, mod].forEach((o) => { o.start(t); o.stop(t + len + 0.8); });
    };
    const strum = (dest, t, notes, v, up) => { const ns = up ? notes.slice().reverse() : notes; ns.forEach((m, i) => pl(dest, t + i * 0.014, mtof(m), 0.55, v * (up ? 0.7 : 1), 1800, (i - 1.5) * 0.25, true)); };

    // ── a música, passo a passo (só os passos desta janela)
    const kicks = [];
    if (M) {
      const s0 = Math.max(0, Math.floor(wa / S16 - 1e-6)), s1 = Math.min(steps, Math.ceil(wb / S16 - 1e-6));
      for (let st = s0; st < s1; st++) {
        const bar = Math.floor(st / 16), s = st % 16, t = st * S16 + (s % 2 ? g.swing * S16 : 0), T0 = st * S16;
        if (T0 < wa - 1e-6 || T0 >= wb - 1e-6) continue;
        const scn = secAt(T0 + 1e-4), L = LAY[scn.sec], ch = chord(bar), lastBeat = T0 >= scn.t1 - B - 1e-6, first = Math.abs(T0 - scn.t0) < 1e-4, toBar = (16 - s) * S16;
        const dv = soft ? 0.7 : 1;
        // bateria
        const kp = dp.k2 && bar % 2 ? dp.k2 : dp.k;
        if (kp && kp[s] && L.k) { hit(soft || dp.soft ? 'kickSoft' : 'kick', drums, t, kp[s] * L.k * dv * (dp.soft ? 0.8 : 1)); if (kp[s] > 0.5) kicks.push(t); }
        if (dp.boom && dp.boom[s] && L.k) { hit('boom', both(drums, 0.3), t, dp.boom[s] * L.k * dv); kicks.push(t); }
        if (dp.tom && dp.tom[s] && L.sn) hit(s > 12 ? 'tomHi' : 'tomLo', both(drums, 0.25), t, dp.tom[s] * L.sn * dv);
        if (dp.sn && dp.sn[s] && L.sn && !(L.roll && lastBeat)) {
          const lv = dp.sn[s] * L.sn * dv;
          if (soft) hit('rimSoft', both(drums, 0.2), t, lv);
          else if (dp.clap) { hit('clap', both(drums, 0.2), t, lv); if (lv > 0.5) hit('snareLo', both(drums, 0.1), t, lv); }
          else hit(dp.bigSnare ? 'snareBig' : 'snare', both(drums, dp.bigSnare ? 0.45 : 0.18), t, lv);
        }
        if (dp.snap && dp.snap[s] && L.sn) hit('snap', both(drums, 0.3), t, dp.snap[s] * L.sn * dv);
        if (dp.rim && dp.rim[s] && L.sn) hit('rim', both(drums, 0.15), t, dp.rim[s] * L.sn * dv, 0.2);
        if (dp.hh && dp.hh[s] && L.hh) hit(soft ? 'hatSoft' : st % 4 < 2 ? 'hatA' : 'hatB', drums, t, dp.hh[s] * L.hh * dv, s % 4 === 2 ? 0.25 : -0.2);
        if (dp.oh && dp.oh[s] && L.oh && !soft) hit('oh', both(drums, 0.1), t, dp.oh[s] * L.oh, 0.15);
        if (dp.sh && dp.sh[s] && L.hh) hit('shaker', drums, t, dp.sh[s] * L.hh * dv);
        if (dp.rolls && L.hh && bar % 2 === 1 && s >= 12) hit('hatRoll', drums, t + S16 / 2, 0.8 + 0.15 * (s - 12), 0.3);
        // virada antes da próxima cena (build): caixa em 32 avos, crescendo
        if (L.roll && lastBeat && !soft) {
          const rl = (T0 - (scn.t1 - B)) / B;
          for (let r = 0; r < 2; r++) { const tt = T0 + (r * S16) / 2; if (gid === 'cinematic') hit('rollHit', drums, tt, 0.4 + 0.66 * rl); else hit('snareTick', both(drums, 0.12), tt, 0.18 + 0.55 * rl); }
        }
        // baixo
        if (L.bass) {
          if (L.pad) { if (s === 0 || first) bassNote(t, ch.root, Math.min(toBar, scn.t1 - T0), 0.55 * L.bass); }
          else for (const [bs, iv, len] of BS[g.bass]) if (bs === s) bassNote(t, (g.bass === '808' ? ch.root - 12 : ch.root) + iv, len * S16 * 0.95, L.bass * (soft ? 0.8 : 1));
        }
        // acordes
        if (L.ch) {
          const cv = L.ch * (soft ? 0.8 : 1);
          if (L.pad || g.chords === 'pad' || g.chords === 'strings') { if (s === 0 || first) pad(both(music, 0.35, 0.15), t, ch.notes, toBar, (L.pad ? 0.2 : 0.16) * cv, L.pad ? 900 : g.chords === 'strings' ? 1600 : 2200, g.chords === 'strings' || L.pad ? 0.35 : 0.08, 0.3, 11); }
          else if (g.chords === 'strum') { const pat = { 0: 'd', 4: 'd', 6: 'u', 8: 'd', 10: 'u', 12: 'd', 14: 'u' }; if (pat[s]) strum(both(music, 0.25), t, ch.notes, 0.13 * cv, pat[s] === 'u'); }
          else if (g.chords === 'pluck') { if (s % 2 === 0) { const pat = [0, 2, 1, 3, 2, 1, 3, 2], m = ch.notes[pat[s / 2] % ch.notes.length] + 12; pl(both(music, 0.3, 0.3), t, mtof(m), 0.4, 0.1 * cv, 1500, s % 4 ? -0.3 : 0.3, true); } }
          else if (g.chords === 'keys') { for (const [cs, len] of CR.keys) if (cs === s) ch.notes.forEach((m, i) => ep(both(music, 0.3, 0.12), t + i * 0.012, m, len * S16, 0.075 * cv, (i - 1.5) * 0.25)); }
          else if (g.chords === 'bell') { for (const [cs] of CR.bell) if (cs === s) { const m = ch.notes[(cs / 3 | 0) % ch.notes.length] + 12; I.bell(both(music, 0.4, 0.25), t, mtof(m), 0.9, 0.07 * cv, (cs % 2 ? 0.3 : -0.3)); } }
          else { const pat = CR[g.chords] || CR.stab; for (const [cs, len] of pat) if (cs === s) stab(both(music, 0.2, 0.12), t, ch.notes, len * S16, (g.chords === 'chop' ? 0.12 : 0.1) * cv, g.chords === 'organ' ? 1800 : 3000, g.chords === 'organ' ? 'square' : 'sawtooth'); }
        }
        // solo / arpejo
        if (L.lead && g.lead !== 'none' && !soft) {
          const lv = L.lead;
          if (g.lead === 'arp16' || (g.lead === 'arp8' && s % 2 === 0)) { const pat = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2], m = ch.notes[pat[s] % ch.notes.length] + 12; pl(both(music, 0.12, 0.3), t, mtof(m), 0.2, 0.085 * lv, 3400, s % 2 ? -0.35 : 0.35); }
          else if (g.lead === 'ostinato' && s % 2 === 0) { const iv = [0, 0, 7, 0, 12, 0, 7, 3][s / 2]; pl(both(music, 0.2), t, mtof(ch.root + 12 + iv), 0.16, 0.11 * lv, 1800, s % 4 ? -0.25 : 0.25); }
          else if (g.lead === 'strings' && s === 0) pad(both(music, 0.4, 0.1), t, [ch.notes[ch.notes.length - 1] + 12], 16 * S16, 0.1 * lv, 3000, 0.25, 0.4, 8);
        }
        if (s === 15 && bar % 2 === 1) await breathe();
      }
      // chiado de vinil (lofi)
      if (g.crackle) {
        const src = ctx.createBufferSource(); src.buffer = K.nb; src.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; const ng = ctx.createGain(); ng.gain.value = 0.014;
        src.connect(lp).connect(ng).connect(music); src.start(wa); src.stop(wb + 0.05);
        for (let i = 0; i < dur * 7; i++) { const t = R() * dur, lv = 0.04 + R() * 0.08, fc = 1500 + R() * 4000; if (inW(t)) I.click(music, t, lv, fc); }
      }
      // compressão lateral: a música respira com o bumbo
      const depth = soft ? 0.78 : g.duck ?? (['lofi', 'acoustic', 'cinematic', 'minimal'].includes(gid) ? 0.75 : 0.5);
      music.gain.setValueAtTime(1, wa);
      kicks.sort((a, b) => a - b).forEach((k) => { music.gain.setValueAtTime(1, k); music.gain.setValueAtTime(depth, k + 0.002); music.gain.setTargetAtTime(1, k + 0.004, 0.09); });
    }

    // ── viradas de cena: impacto nas quedas, subida antes delas, fecho na marca
    const S = both(sfx), SV = (v) => both(sfx, v), E = 0.6 + 0.4 * energy;
    scenes.forEach((s, i) => {
      if (!i) { if (inW(0.01)) { I.impact(SV(0.15), 0.01, (soft ? 0.35 : 0.6) * E, 72, 38, 0.4); if (M) I.noiseBurst(SV(0.3), 0.01, 1.4, 'highpass', 6000, 0.5, 0.1 * E, 0.45); } return; }
      const prev = scenes[i - 1];
      if ((s.sec === 'drop' || s.sec === 'end') && prev.sec !== 'drop') {
        if (inW(s.t0)) { I.impact(SV(0.2), s.t0, (soft ? 0.45 : 0.8) * E, 64, 30, 0.9); if (M) I.noiseBurst(SV(0.35), s.t0, 2, 'highpass', 5500, 0.5, 0.14 * E, 0.6); }
        const rl = Math.min(s.t0 - 0.05, prev.t1 - prev.t0, prev.sec === 'build' ? prev.t1 - prev.t0 : B * 2);
        if (rl > 0.2 && inW(s.t0 - rl)) I.riser(SV(0.12), s.t0 - rl, rl, 280, 6500, (soft ? 0.12 : 0.22) * E, !soft);
      } else if (s.sec === 'break' && inW(s.t0 - 0.1)) I.whoosh(SV(0.3), s.t0 - 0.1, 0.9, 2400, 500, 200, 0.12 * E, 0, 0, 0.3);
    });
    const endS = scenes[scenes.length - 1];
    if (M) { const ch = chord(Math.floor(endS.t0 / (B * 4))); [12, 19, 24].forEach((iv, i) => { const t = endS.t0 + 0.02 + i * 0.05; if (inW(t)) I.bell(SV(0.5), t, mtof(ch.notes[0] + iv + 12), 1.6, 0.05, (i - 1) * 0.4); }); }

    // ── transições
    for (const tr of ev.trans || []) {
      const t = tr.t, d = tr.d, a = t - d / 2, q = soft ? 0.6 : 1, gl = Array.from({ length: 6 }, () => R());
      if (!inW(tr.kind === 'zoom' ? Math.max(0, a - 0.1) : a)) continue;
      switch (tr.kind) {
        case 'cut': I.impact(S, t, 0.3 * q, 95, 50, 0.2); I.noiseBurst(SV(0.2), t, 0.25, 'highpass', 5000, 0.7, 0.12 * q, 0.03); break;
        case 'push': I.whoosh(SV(0.1), a, d, 280, 2400, 600, 0.32 * q, -0.6, 0.6, 0.55); break;
        case 'whip': I.whoosh(SV(0.08), a, d, 500, 5200, 900, 0.42 * q, 0.8, -0.8, 0.5); I.click(S, t, 0.2 * q, 2600, 0.6, 140); break;
        case 'slideover': I.whoosh(SV(0.12), a, d, 200, 1800, 500, 0.3 * q, 0, 0, 0.6); break;
        case 'iris': case 'blob': I.chirp(SV(0.2), a + 0.02, 260, 780, Math.min(0.3, d), 0.16 * q, 0); I.whoosh(SV(0.1), a, d, 400, 2000, 700, 0.16 * q, 0, 0, 0.5); break;
        case 'wipe': I.whoosh(SV(0.1), a, d, 800, 4200, 1400, 0.28 * q, -0.8, 0.8, 0.5); break;
        case 'stripes': for (let i = 0; i < 4; i++) I.whoosh(S, a + (i * d) / 6, d / 2.5, 600, 3000, 900, 0.13 * q, i % 2 ? 0.5 : -0.5, 0, 0.5); break;
        case 'shutter': I.noiseBurst(SV(0.2), t - 0.02, 0.2, 'bandpass', 1800, 1.2, 0.26 * q, 0.04); I.impact(S, t, 0.22 * q, 110, 60, 0.2); break;
        case 'blocks': for (let i = 0; i < 8; i++) I.click(S, a + (i / 8) * d, 0.16 * q, 2500 + i * 300, 0.4, 200 + i * 20, ((i % 3) - 1) * 0.5); break;
        case 'zoom': I.riser(S, Math.max(0, a - 0.1), d * 0.6 + 0.1, 400, 5000, 0.22 * q, false); I.impact(S, t, 0.35 * q, 80, 40, 0.35); break;
        case 'dissolve': [0, 4, 7].forEach((iv, i) => I.bell(SV(0.5), a + i * 0.05, mtof(84 + key + iv), 0.8, 0.035 * q, (i - 1) * 0.4)); break;
        case 'flip': case 'spin': I.whoosh(SV(0.1), a, d, 300, 3000, 400, 0.28 * q, -0.5, 0.5, 0.5); break;
        case 'glitch': for (let i = 0; i < 6; i++) I.noiseBurst(S, a + (i / 6) * d, 0.05, 'bandpass', 800 + gl[i] * 5000, 3, 0.22 * q, 0.012); break;
        default: I.whoosh(SV(0.1), a, d, 300, 2400, 600, 0.25 * q, 0, 0, 0.5);
      }
    }

    // ── acontecimentos de cada cena (palavras, itens, toques, digitação)
    let item = 0;
    for (const s of ev.scenes) {
      for (const [t, type, n] of s.hits || []) {
        if (t < 0 || t > dur) continue;
        const q = (soft ? 0.6 : 1) * E, pan = ((item % 5) - 2) * 0.2, it = item;
        if (type === 'item') item++;
        if (!inW(type === 'swoosh' ? t - 0.12 : t)) continue;
        switch (type) {
          case 'word': I.impact(S, t, 0.2 * q, 120, 70, 0.1); I.click(S, t, 0.14 * q, 3000, 0.5, 180, pan); break;
          case 'stamp': I.impact(SV(0.15), t, 0.42 * q, 72, 36, 0.35); I.noiseBurst(SV(0.2), t, 0.2, 'highpass', 4000, 0.7, 0.12 * q, 0.04); break;
          case 'item': { const m = scaleNote(it % 7, 84); pl(both(sfx, 0.25, 0.2), t, mtof(m), 0.25, 0.1 * q, 4200, pan, soft); I.tone(S, t, mtof(m), 0.35, 0.03 * q, 0.1); break; }
          case 'pop': I.pop(S, t, 0.26 * q, 700, 340, 0.07, pan); break;
          case 'click': I.click(S, t, 0.34 * q, 2300, 1.1, 150); [0, 2, 4].forEach((iv, i) => I.bell(SV(0.4), t + 0.04 + i * 0.05, mtof(scaleNote(iv, 84)), 0.6, 0.03 * q, (i - 1) * 0.4)); break;
          case 'star': I.pop(S, t, 0.14 * q, 1500 + (n || 0) * 180, 1100 + (n || 0) * 150, 0.04, ((n || 0) - 2) * 0.3); break;
          case 'count': for (let k = 0; k < 14; k++) I.click(S, t + k * 0.05 * (1 + k * 0.04), 0.05 * q, 5200, 0, 0, 0.1); break;
          case 'land': I.impact(SV(0.2), t, 0.4 * q, 80, 40, 0.4); I.bell(SV(0.4), t + 0.02, mtof(scaleNote(4, 84)), 0.9, 0.06 * q); break;
          case 'strobe': I.noiseBurst(SV(0.15), t, 0.1, 'highpass', 5000, 0.7, 0.14 * q, 0.03); break;
          case 'thud': I.impact(S, t, 0.3 * q, 60, 40, 0.3); break;
          case 'swoosh': I.whoosh(SV(0.1), t - 0.12, 0.3, 500, 3000, 900, 0.16 * q, -0.4, 0.4, 0.6); break;
          case 'shine': [0, 2, 4].forEach((iv, i) => I.bell(SV(0.5), t + i * 0.06, mtof(scaleNote(iv, 96)), 0.7, 0.028 * q, (i - 1) * 0.4)); break;
          default: break;
        }
      }
      if (s.typing) {
        const { t, cps, n } = s.typing, txt = s.typing.chars || '';
        for (let k = 0; k < n; k++) { const tt = t + k / cps, sp = txt[k] === ' ', r1 = R(), r2 = R(), r3 = R(); if (tt > dur) break; if (inW(tt)) I.click(S, tt, (sp ? 0.2 : 0.3) * (soft ? 0.7 : 1), sp ? 1800 : 2600 + r1 * 1400, sp ? 1 : 0.7, sp ? 120 : 170 + r2 * 60, (r3 - 0.5) * 0.4); }
      }
    }
    return ctx.startRendering();
  }
  return { render, GEN: Object.keys(GEN) };
})();
if (typeof module !== 'undefined') module.exports = PulsoStudioAudio;
