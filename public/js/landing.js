'use strict';
(() => {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.getElementById('heroVideo'), sound = document.getElementById('heroSound');
  if (reduce && hero) { hero.removeAttribute('autoplay'); hero.pause(); }
  if (sound && hero) sound.addEventListener('click', () => {
    const on = hero.muted;
    hero.muted = !on;
    if (on) { hero.currentTime = 0; hero.play().catch(() => {}); }
    sound.setAttribute('aria-pressed', String(on));
    sound.querySelector('span').textContent = on ? T('Som ligado') : T('Ouvir');
  });
  // exemplos: carregam e tocam só quando aparecem na tela
  const vids = [...document.querySelectorAll('video[data-src]')];
  if (!('IntersectionObserver' in window)) { vids.forEach((v) => { v.src = v.dataset.src; }); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!reduce) v.play().catch(() => {}); }
      else v.pause();
    }
  }, { threshold: 0.35 });
  vids.forEach((v) => io.observe(v));
})();
