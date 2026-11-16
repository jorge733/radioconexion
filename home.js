// Contador público de la portada: cuántos miembros y episodios tiene la comunidad.
(async () => {
  const box = document.getElementById('community-stats');
  if (!box) return;
  const url = 'https://firestore.googleapis.com/v1/projects/radio-conexion-e924e/databases/(default)/documents/public/stats';
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const { fields = {} } = await response.json();
    const members = Number(fields.members?.integerValue || 0);
    const episodes = Number(fields.episodes?.integerValue || 0);
    // Con números muy chicos la comunidad parece vacía: mostramos el contador desde 5 miembros.
    if (members < 5) return;
    const format = new Intl.NumberFormat('es-CL');
    box.querySelector('[data-members]').textContent = format.format(members);
    box.querySelector('[data-episodes]').textContent = format.format(episodes);
    box.querySelector('[data-episodes-label]').textContent = episodes === 1 ? 'episodio' : 'episodios';
    box.hidden = false;
  } catch (error) {
    // Si no hay conexión, la portada funciona igual sin el contador.
  }
})();

// Reloj "en sintonía": hora actual de Chile en la portada.
(() => {
  const clocks = document.querySelectorAll('[data-clock]');
  if (!clocks.length) return;
  const format = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' });
  const tick = () => clocks.forEach(el => { el.textContent = format.format(new Date()); });
  tick();
  setInterval(tick, 15000);
})();

// Sintonizador de la portada: arrastrar el dial revela cada sección de la comunidad.
// Entre emisoras se ve estática; al acercarse a una frecuencia, la señal se aclara.
(() => {
  const tuner = document.querySelector('[data-tuner]');
  if (!tuner) return;
  const range = tuner.querySelector('.tuner__range');
  const readout = tuner.querySelector('[data-tuner-freq]');
  const canvas = tuner.querySelector('.tuner__static');
  const stations = [...tuner.querySelectorAll('.tuner__station')].map(el => ({ el, freq: Number(el.dataset.freq) }));
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  let noise = 0;
  let frame = 0;
  let glide = 0;

  const drawStatic = () => {
    frame = 0;
    if (noise < 0.02) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    if (!reduceMotion) frame = requestAnimationFrame(drawStatic);
  };

  const update = () => {
    const freq = Number(range.value);
    let nearest = stations[0];
    stations.forEach(s => { if (Math.abs(s.freq - freq) < Math.abs(nearest.freq - freq)) nearest = s; });
    const signal = Math.max(0, 1 - Math.abs(nearest.freq - freq) / 1.8);
    noise = 1 - signal;
    readout.textContent = freq.toFixed(1);
    tuner.style.setProperty('--signal', signal.toFixed(3));
    tuner.dataset.bars = String(Math.round(signal * 4));
    stations.forEach(s => {
      const on = s === nearest && signal > 0.3;
      s.el.classList.toggle('is-tuned', on);
      s.el.setAttribute('aria-hidden', String(!on));
    });
    const title = nearest.el.querySelector('h3').textContent;
    range.setAttribute('aria-valuetext', signal > 0.3 ? `${freq.toFixed(1)} FM: ${title}` : `${freq.toFixed(1)} FM: sin señal`);
    if (!frame) drawStatic();
  };

  // Desliza la aguja suavemente hasta una frecuencia
  const tuneTo = target => {
    cancelAnimationFrame(glide);
    if (reduceMotion) { range.value = target; update(); return; }
    const start = Number(range.value);
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 650);
      const ease = 1 - Math.pow(1 - k, 3);
      range.value = (start + (target - start) * ease).toFixed(1);
      update();
      if (k < 1) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };

  const nearestIndex = () => {
    const freq = Number(range.value);
    return stations.reduce((best, s, i) => (Math.abs(s.freq - freq) < Math.abs(stations[best].freq - freq) ? i : best), 0);
  };

  range.addEventListener('input', () => { cancelAnimationFrame(glide); update(); });
  // Al soltar la aguja con el mouse o el dedo, se "engancha" a la emisora más cercana
  // (con el teclado se mueve libremente de a 0,1 y los botones saltan entre emisoras)
  const snap = () => tuneTo(stations[nearestIndex()].freq);
  range.addEventListener('pointerup', snap);
  range.addEventListener('touchend', snap, { passive: true });
  tuner.querySelectorAll('[data-seek]').forEach(button => button.addEventListener('click', () => {
    const dir = Number(button.dataset.seek);
    const next = (nearestIndex() + dir + stations.length) % stations.length;
    tuneTo(stations[next].freq);
  }));

  tuner.classList.add('is-ready');
  update();
})();
