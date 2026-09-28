'use strict';
// Página que o Chrome sem tela abre no servidor para desenhar o vídeo final quadro a quadro.
(() => {
  const W = 1080, H = 1920;
  let E = null, job = null, cv = null, cx = null;
  const FACES = ["800 40px 'Bricolage Grotesque'", "800 40px 'Big Shoulders Display'", "400 40px 'Gloock'", "400 40px 'Instrument Sans'", "600 40px 'Instrument Sans'", "700 40px 'Instrument Sans'", "400 40px 'IBM Plex Mono'", "500 40px 'IBM Plex Mono'", "700 40px 'IBM Plex Mono'"];
  const loadImg = (url) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('imagem não carregou: ' + url)); i.src = url; });
  async function post(path, body) {
    const r = await fetch(`/job/${job.token}/${path}`, { method: 'POST', body });
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  }
  window.PulsoRender = {
    ready: true,
    async setup(j) {
      job = j;
      await Promise.all(FACES.map((f) => document.fonts.load(f)));
      await document.fonts.ready;
      const missing = FACES.filter((f) => !document.fonts.check(f));
      if (missing.length) throw new Error('fontes não carregaram: ' + missing.join(', '));
      const images = { logo: j.logo ? await loadImg(`/job/${j.token}/image/logo`) : null, product: j.photo ? await loadImg(`/job/${j.token}/image/photo`) : null,
        gallery: await Promise.all(Array.from({ length: j.gallery || 0 }, (_, i) => loadImg(`/job/${j.token}/image/gallery${i}`))) };
      E = Pulso.create(j.spec, images);
      cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      cx = cv.getContext('2d', { willReadFrequently: true });
      return { variant: E.events.variant };
    },
    async audio() {
      const ab = await PulsoAudio.render(E.events, { mood: E.events.mood, scale: job.k || 1 });
      const wav = PulsoAudio.toWav(ab);
      await post('audio', wav);
      return wav.length;
    },
    async frame(i) {
      const k = job.k || 1; // vídeo de 20 s: a mesma animação, 4/3 mais lenta (o obturador acompanha); 30 s anda no tempo normal
      E.renderFrame(cv, i / job.fps / k, { fps: job.fps * k, baseSamples: job.baseSamples });
      await post(`frame/${i}`, cx.getImageData(0, 0, W, H).data);
      return i;
    },
    // capa para o Reels/TikTok: um quadro em resolução cheia (com desfoque de movimento)
    async cover(t) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      E.renderFrame(c, t, { fps: 60, baseSamples: 6 });
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      if (!blob || !blob.size) throw new Error('capa vazia');
      await post('cover', blob);
      return blob.size;
    },
    async poster(t) {
      const c = document.createElement('canvas'); c.width = 540; c.height = 960;
      E.renderFrame(c, t, { samples: 4 });
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
      if (!blob || !blob.size) throw new Error('pôster vazio');
      await post('poster', blob);
      return blob.size;
    },
  };
})();
