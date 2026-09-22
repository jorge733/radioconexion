import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getStorage, getDownloadURL, ref } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const list = document.getElementById('podcast-hub-list');
const status = document.getElementById('podcast-hub-status');
let episodes = [];
let user = null;

function escapeHTML(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function dateLabel(value) { return value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`)) : ''; }
async function fileUrl(path) { return path ? getDownloadURL(ref(storage, path)) : ''; }

function render() {
  list.replaceChildren();
  if (!episodes.length) {
    status.textContent = 'Aún no hay episodios publicados.';
    return;
  }
  status.textContent = user ? 'Tu suscripción está activa: tienes acceso a toda la fonoteca.' : 'Escucha el episodio más reciente o inicia sesión para desbloquear el archivo completo.';
  episodes.forEach(episode => {
    const unlocked = episode.isLatest || Boolean(user);
    const article = document.createElement('article');
    article.className = `podcast-episode${episode.isLatest ? ' podcast-episode--latest' : ''}`;
    article.innerHTML = `<div class="podcast-episode__number">${episode.isLatest ? 'NUEVO' : `EP. ${escapeHTML(episode.number)}`}</div><div class="podcast-episode__body"><p class="podcast-episode__date">${escapeHTML(dateLabel(episode.date))}</p><h2>${escapeHTML(episode.title)}</h2><p>${escapeHTML(episode.summary || 'Un nuevo episodio de Radio Conexión.')}</p><div class="podcast-episode__action"></div></div>`;
    const action = article.querySelector('.podcast-episode__action');
    if (!unlocked) {
      action.innerHTML = `<a class="btn-custom" href="suscriptores.html">🔒 Escuchar como suscriptor</a>`;
    } else {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.setAttribute('aria-label', `Reproducir ${episode.title}`);
      action.appendChild(audio);
      const loading = document.createElement('span');
      loading.className = 'podcast-episode__loading';
      loading.textContent = 'Preparando reproductor…';
      action.appendChild(loading);
      Promise.all([fileUrl(episode.audioPath), fileUrl(episode.coverPath)]).then(([audioUrl, coverUrl]) => {
        audio.src = audioUrl;
        if (coverUrl) article.style.setProperty('--cover', `url("${coverUrl}")`);
        loading.remove();
      }).catch(() => { audio.remove(); loading.textContent = 'El audio no está disponible en este momento.'; });
    }
    list.appendChild(article);
  });
}

async function loadEpisodes() {
  try {
    const response = await fetch('/api/episodes');
    const data = await response.json();
    episodes = Array.isArray(data.episodes) ? data.episodes : [];
    render();
  } catch { status.textContent = 'No pudimos cargar el catálogo. Inténtalo nuevamente más tarde.'; }
}
onAuthStateChanged(auth, currentUser => { user = currentUser; render(); });
loadEpisodes();
