// Reproductor de la transmisión en vivo.
// ▶ CONFIGURACIÓN: pega aquí el enlace del stream que entrega tu servicio
//   (por ejemplo, Zeno.fm: "https://stream.zeno.fm/abc123xyz").
//   Mientras esté vacío, la página muestra "Muy pronto al aire".
const STREAM_URL = 'https://sapircast.caster.fm:16637/YGHrl';

(() => {
  const box = document.querySelector('[data-live]');
  if (!box) return;
  const audio = box.querySelector('[data-live-audio]');
  const button = box.querySelector('[data-live-toggle]');
  const status = box.querySelector('[data-live-status]');
  const badge = box.querySelector('[data-live-badge]');
  const volume = box.querySelector('[data-live-volume]');

  // off: sin configurar · ready: listo para escuchar · loading · playing · error: fuera del aire
  const setState = (state, message) => {
    box.dataset.state = state;
    status.textContent = message;
    const playing = state === 'playing' || state === 'loading';
    button.textContent = playing ? '❚❚ Pausar' : '▶ Escuchar en vivo';
    button.setAttribute('aria-pressed', String(playing));
    button.disabled = state === 'off';
    badge.textContent = state === 'playing' ? 'Al aire ahora' : 'Señal en directo';
  };

  if (!STREAM_URL) {
    setState('off', 'Muy pronto al aire. Estamos preparando la transmisión en directo.');
    return;
  }

  setState('ready', 'Presiona escuchar para conectarte a la señal.');

  // Se reconecta desde el directo (no desde el búfer) cada vez que se da play.
  const start = () => {
    audio.src = `${STREAM_URL}${STREAM_URL.includes('?') ? '&' : '?'}t=${Date.now()}`;
    setState('loading', 'Conectando con la señal…');
    audio.play().catch(() => {});
  };
  const stop = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setState('ready', 'Transmisión en pausa. Presiona escuchar para volver al directo.');
  };

  button.addEventListener('click', () => {
    if (box.dataset.state === 'playing' || box.dataset.state === 'loading') stop();
    else start();
  });

  audio.addEventListener('playing', () => setState('playing', 'Estás escuchando Radio Conexión en directo.'));
  audio.addEventListener('waiting', () => {
    if (box.dataset.state === 'playing') setState('loading', 'Cargando la señal…');
  });
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    setState('error', 'En este momento no estamos al aire. Vuelve a intentarlo más tarde.');
  });

  const savedVolume = (() => { try { return localStorage.getItem('live-volume'); } catch (e) { return null; } })();
  if (savedVolume !== null) volume.value = savedVolume;
  audio.volume = Number(volume.value);
  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    try { localStorage.setItem('live-volume', volume.value); } catch (e) {}
  });

  // Barra de controles del sistema (pantalla bloqueada en el celular)
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'En vivo',
      artist: 'Radio Conexión',
      artwork: [{ src: 'assets/marca/logo-512.png', sizes: '512x512', type: 'image/png' }]
    });
    navigator.mediaSession.setActionHandler('play', start);
    navigator.mediaSession.setActionHandler('pause', stop);
  }
})();
