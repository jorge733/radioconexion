import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getMessaging, getToken, deleteToken } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';
import { firebaseConfig, firebaseMessagingVapidKey } from './firebase-config.js';
import { montarEditorBoletin } from './boletin-editor.js';

const $ = id => document.getElementById(id);
const ADMIN_PANELS = ['panel-publicar-aviso', 'panel-boletin', 'panel-importar', 'panel-cabina'];

let auth = null;
let provider = null;
if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId) {
  auth = getAuth(getApps().length ? getApps()[0] : initializeApp(firebaseConfig));
  provider = new GoogleAuthProvider();
}
let firebaseUser = null;
let messaging = null;
let currentPushToken = '';
try { currentPushToken = localStorage.getItem('radioConexionPushToken') || ''; } catch (error) {}
if ('serviceWorker' in navigator && firebaseMessagingVapidKey && auth) messaging = getMessaging();

function setStatus(element, text, state = '') {
  if (!element) return;
  element.textContent = text;
  element.dataset.state = state;
}

function abrirModal(title, body) {
  $('modal-title').textContent = title;
  $('modal-body').textContent = body;
  const modal = $('custom-modal');
  if (typeof modal.showModal === 'function') modal.showModal();
  else modal.setAttribute('open', '');
}

async function llamarApi(url, payload, method = 'POST') {
  if (!firebaseUser) throw new Error('Debes iniciar sesión para continuar.');
  const token = await firebaseUser.getIdToken();
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(method === 'GET' ? {} : { body: JSON.stringify(payload) })
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'No fue posible procesar tu solicitud.');
  return response.json();
}

/* ---------- Sesión ---------- */

$('btn-entrar-firebase').addEventListener('click', async () => {
  const button = $('btn-entrar-firebase');
  const label = button.querySelector('span');
  const errorBox = $('error-login-privado');
  errorBox.textContent = '';
  if (!auth) {
    errorBox.textContent = 'El inicio de sesión no está disponible en este momento.';
    return;
  }
  label.textContent = 'Abriendo Google…';
  button.disabled = true;
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    errorBox.textContent = 'No pudimos iniciar sesión. Revisa que el navegador permita ventanas emergentes e inténtalo nuevamente.';
  } finally {
    label.textContent = 'Continuar con Google';
    button.disabled = false;
  }
});

$('btn-cerrar-sesion').addEventListener('click', () => { if (auth) signOut(auth); });

function mostrarPanel(user) {
  const name = (user.displayName || '').split(' ')[0];
  $('texto-bienvenida-usuario').textContent = name ? `¡Hola, ${name}! Sesión iniciada.` : 'Sesión iniciada.';
  $('boletin-email').textContent = user.email || 'tu correo';
  $('portal-login').hidden = true;
  $('portal-abierto').hidden = false;
}

function cerrarPanel() {
  ADMIN_PANELS.forEach(id => { $(id).hidden = true; });
  $('portal-abierto').hidden = true;
  $('portal-login').hidden = false;
  $('rc-step-selection').hidden = false;
  $('rc-music-desc').hidden = false;
  $('rc-music-success-message').hidden = true;
  canciones = [];
  renderSeleccion();
  $('rc-user-msg-form').hidden = false;
  $('rc-msg-desc').hidden = false;
  $('rc-msg-success-box').hidden = true;
  $('rc-txt-mensaje').value = '';
}

if (auth) onAuthStateChanged(auth, async user => {
  firebaseUser = user;
  if (!user) return cerrarPanel();
  mostrarPanel(user);
  actualizarEstadoAvisos();
  // El servidor decide quién es del equipo (variable RADIO_ADMIN_EMAIL en Vercel).
  const { isAdmin, configured } = await cargarEstadoBoletin();
  if (isAdmin && firebaseUser === user) {
    ADMIN_PANELS.forEach(id => { $(id).hidden = false; });
    cargarSolicitudesCabina();
    if (configured) editorBoletin.iniciar();
  }
});

/* ---------- Pedido de canciones ---------- */

let canciones = [];
let busquedaTimer = null;
const searchInput = $('rc-music-search');
const resultsBox = $('rc-search-results');
const musicStatus = $('rc-music-status');

function cerrarResultados() {
  resultsBox.hidden = true;
  resultsBox.replaceChildren();
}

function notaResultados(text) {
  const note = document.createElement('div');
  note.className = 'search-item search-item--note';
  note.textContent = text;
  resultsBox.replaceChildren(note);
  resultsBox.hidden = false;
}

function buscarCanciones() {
  const query = searchInput.value.trim();
  clearTimeout(busquedaTimer);
  if (query.length < 2) return cerrarResultados();
  busquedaTimer = setTimeout(async () => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=7&country=CL`;
      const data = await (await fetch(url)).json();
      if (!data.results?.length) return notaResultados('No encontramos resultados para esa búsqueda.');
      resultsBox.replaceChildren(...data.results.map(track => {
        const nombre = `${track.artistName} - ${track.trackName}`;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'search-item';
        item.setAttribute('role', 'option');
        const art = document.createElement('img');
        art.src = track.artworkUrl60 || track.artworkUrl30 || '';
        art.alt = '';
        const label = document.createElement('span');
        label.textContent = nombre;
        item.append(art, label);
        item.addEventListener('click', () => agregarCancion(nombre));
        return item;
      }));
      resultsBox.hidden = false;
    } catch (error) {
      console.error(error);
      notaResultados('No pudimos buscar canciones ahora. Inténtalo nuevamente.');
    }
  }, 350);
}

function agregarCancion(cancion) {
  searchInput.value = '';
  cerrarResultados();
  if (canciones.includes(cancion)) return setStatus(musicStatus, 'Ya seleccionaste esta canción.', 'error');
  if (canciones.length >= 3) return setStatus(musicStatus, 'Ya elegiste tres canciones. Quita una para cambiarla.', 'error');
  canciones.push(cancion);
  setStatus(musicStatus, '');
  renderSeleccion();
  searchInput.focus();
}

function renderSeleccion() {
  const container = $('rc-selected-list');
  $('rc-btn-send-music').disabled = canciones.length === 0;
  if (!canciones.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-msg';
    empty.textContent = 'Aún no has elegido canciones.';
    return container.replaceChildren(empty);
  }
  container.replaceChildren(...canciones.map((cancion, index) => {
    const row = document.createElement('div');
    row.className = 'selected-item';
    const label = document.createElement('span');
    label.textContent = `🎵 ${cancion}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Quitar ${cancion}`);
    remove.addEventListener('click', () => {
      canciones.splice(index, 1);
      setStatus(musicStatus, '');
      renderSeleccion();
    });
    row.append(label, remove);
    return row;
  }));
}

searchInput.addEventListener('input', buscarCanciones);
searchInput.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') resultsBox.querySelector('button')?.focus();
  if (event.key === 'Escape') cerrarResultados();
});
resultsBox.addEventListener('keydown', event => {
  const items = [...resultsBox.querySelectorAll('button')];
  const index = items.indexOf(document.activeElement);
  if (event.key === 'ArrowDown') { event.preventDefault(); items[Math.min(index + 1, items.length - 1)]?.focus(); }
  if (event.key === 'ArrowUp') { event.preventDefault(); (index <= 0 ? searchInput : items[index - 1]).focus(); }
  if (event.key === 'Escape') { cerrarResultados(); searchInput.focus(); }
});
document.addEventListener('click', event => {
  if (!event.target.closest('#search-container')) cerrarResultados();
});

$('rc-btn-send-music').addEventListener('click', async () => {
  const button = $('rc-btn-send-music');
  button.textContent = 'Enviando a cabina…';
  button.disabled = true;
  try {
    await llamarApi('/api/song-request', { songs: canciones });
    $('rc-step-selection').hidden = true;
    $('rc-music-desc').hidden = true;
    $('rc-music-success-message').hidden = false;
  } catch (error) {
    abrirModal('No pudimos enviar tu selección', error.message || 'Revisa tu conexión e inténtalo nuevamente.');
    button.disabled = false;
  } finally {
    button.textContent = 'Enviar solicitud a cabina';
  }
});

/* ---------- Mensaje a cabina ---------- */

$('rc-user-msg-form').addEventListener('submit', async event => {
  event.preventDefault();
  const message = $('rc-txt-mensaje').value.trim();
  const button = $('rc-btn-send-msg');
  if (!message) return;
  button.textContent = 'Enviando mensaje…';
  button.disabled = true;
  try {
    await llamarApi('/api/listener-message', { message });
    $('rc-user-msg-form').hidden = true;
    $('rc-msg-desc').hidden = true;
    $('rc-msg-success-box').hidden = false;
  } catch (error) {
    abrirModal('No pudimos enviar tu mensaje', error.message || 'Revisa tu conexión e inténtalo nuevamente.');
  } finally {
    button.textContent = 'Enviar mi mensaje';
    button.disabled = false;
  }
});

/* ---------- Avisos del navegador ---------- */

function actualizarEstadoAvisos() {
  const button = $('btn-activar-avisos');
  const stop = $('btn-desactivar-avisos');
  const status = $('estado-avisos');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    button.disabled = true;
    return setStatus(status, 'Este navegador no admite avisos.', 'error');
  }
  if (!firebaseMessagingVapidKey) {
    button.disabled = true;
    return setStatus(status, 'Los avisos estarán disponibles pronto.');
  }
  if (Notification.permission === 'denied') {
    button.disabled = true;
    return setStatus(status, 'Los avisos están bloqueados en la configuración de tu navegador.', 'error');
  }
  if (currentPushToken) {
    button.hidden = true;
    stop.hidden = false;
    setStatus(status, 'Los avisos están activos en este dispositivo.', 'ok');
    setStatus($('estado-cabina'), 'Las alertas de cabina están activas en este dispositivo.', 'ok');
  } else {
    button.hidden = false;
    stop.hidden = true;
    setStatus(status, 'Actívalos solo si quieres recibir novedades.');
  }
}

async function activarAvisos() {
  const button = $('btn-activar-avisos');
  const status = $('estado-avisos');
  if (!messaging) return setStatus(status, 'Los avisos aún no están configurados.', 'error');
  button.disabled = true;
  setStatus(status, 'Solicitando permiso…');
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('No aceptaste los avisos.');
    const token = await getToken(messaging, { vapidKey: firebaseMessagingVapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error('No pudimos activar los avisos en este navegador.');
    await llamarApi('/api/push-subscription', { action: 'save', token });
    currentPushToken = token;
    try { localStorage.setItem('radioConexionPushToken', token); } catch (error) {}
    actualizarEstadoAvisos();
  } catch (error) {
    setStatus(status, error.message || 'No pudimos activar los avisos.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function desactivarAvisos() {
  try {
    if (currentPushToken) await llamarApi('/api/push-subscription', { action: 'remove', token: currentPushToken });
    if (messaging) await deleteToken(messaging);
    currentPushToken = '';
    try { localStorage.removeItem('radioConexionPushToken'); } catch (error) {}
    actualizarEstadoAvisos();
  } catch (error) {
    setStatus($('estado-avisos'), error.message || 'No pudimos quitar los avisos.', 'error');
  }
}

$('btn-activar-avisos').addEventListener('click', activarAvisos);
$('btn-activar-alertas-cabina').addEventListener('click', activarAvisos);
$('btn-desactivar-avisos').addEventListener('click', desactivarAvisos);

/* ---------- Panel del equipo: notificaciones ---------- */

$('btn-enviar-aviso').addEventListener('click', async () => {
  const button = $('btn-enviar-aviso');
  const status = $('estado-publicacion');
  const kind = $('tipo-aviso').value;
  const title = $('titulo-aviso').value.trim();
  const body = $('mensaje-aviso').value.trim();
  if (!title || !body) return setStatus(status, 'Escribe un título y un mensaje.', 'error');
  button.disabled = true;
  setStatus(status, 'Enviando aviso…');
  try {
    const result = await llamarApi('/api/send-push', { kind, title, body });
    setStatus(status, `Aviso enviado a ${result.sent} dispositivo(s).`, 'ok');
    $('titulo-aviso').value = '';
    $('mensaje-aviso').value = '';
  } catch (error) {
    setStatus(status, error.message || 'No pudimos enviar el aviso.', 'error');
  } finally {
    button.disabled = false;
  }
});

/* ---------- Boletín: suscripción de cada persona ---------- */

const boletinToggle = $('boletin-toggle');
const boletinStatus = $('estado-boletin');

async function cargarEstadoBoletin() {
  boletinToggle.disabled = true;
  setStatus(boletinStatus, 'Consultando tu suscripción…');
  try {
    const result = await llamarApi('/api/newsletter', null, 'GET');
    if (!result.configured) {
      setStatus(boletinStatus, 'El boletín estará disponible muy pronto.');
      return result;
    }
    boletinToggle.checked = Boolean(result.subscribed);
    boletinToggle.disabled = false;
    setStatus(boletinStatus, result.subscribed ? 'Estás suscrito. Te llegará el próximo boletín.' : 'No estás recibiendo el boletín.', result.subscribed ? 'ok' : '');
    return result;
  } catch (error) {
    setStatus(boletinStatus, error.message || 'No pudimos consultar tu suscripción.', 'error');
    return {};
  }
}

boletinToggle.addEventListener('change', async () => {
  const subscribe = boletinToggle.checked;
  boletinToggle.disabled = true;
  setStatus(boletinStatus, subscribe ? 'Activando el boletín…' : 'Quitando tu suscripción…');
  try {
    await llamarApi('/api/newsletter', { action: subscribe ? 'subscribe' : 'unsubscribe' });
    setStatus(boletinStatus, subscribe ? '¡Listo! Te llegará el próximo boletín.' : 'Listo, ya no recibirás el boletín.', subscribe ? 'ok' : '');
  } catch (error) {
    boletinToggle.checked = !subscribe;
    setStatus(boletinStatus, error.message || 'No pudimos actualizar tu suscripción.', 'error');
  } finally {
    boletinToggle.disabled = false;
  }
});

/* ---------- Panel del equipo: redactar y enviar el boletín ---------- */

// El editor es compartido con el Studio (boletin-editor.js).
const editorBoletin = montarEditorBoletin($('editor-boletin'), {
  llamarApi,
  correo: () => firebaseUser?.email || 'tu correo'
});

/* ---------- Panel del equipo: importar suscriptores ---------- */

const EMAIL_PATTERN = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Descarta correos acortados (como "ana.b...@gmail.com", que exporta Google Groups) o con puntos mal puestos.
const correoValido = email => !/\.\.|^\.|\.@|@\./.test(email);
const correosDetectados = () => [...new Set(($('importar-correos').value.match(EMAIL_PATTERN) || []).map(email => email.toLowerCase()).filter(correoValido))];

$('importar-correos').addEventListener('input', () => {
  const count = correosDetectados().length;
  $('importar-conteo').textContent = `${count} ${count === 1 ? 'correo detectado' : 'correos detectados'}.`;
});

$('btn-importar').addEventListener('click', async () => {
  const button = $('btn-importar');
  const status = $('estado-importar');
  const emails = correosDetectados();
  if (!emails.length) return setStatus(status, 'Pega al menos un correo válido.', 'error');
  if (!window.confirm(`¿Agregar ${emails.length} correo(s) al boletín?`)) return;
  button.disabled = true;
  const totals = { added: 0, resubscribed: 0, existing: 0, unsubscribed: 0, invalid: 0, error: 0 };
  try {
    for (let index = 0; index < emails.length; index += 10) {
      setStatus(status, `Importando ${Math.min(index + 10, emails.length)} de ${emails.length}…`);
      const { results = [] } = await llamarApi('/api/newsletter', { action: 'import', emails: emails.slice(index, index + 10) });
      results.forEach(item => { totals[item.result] = (totals[item.result] || 0) + 1; });
    }
    const parts = [`${totals.added} nuevos`, `${totals.existing + totals.resubscribed} ya estaban`];
    if (totals.unsubscribed) parts.push(`${totals.unsubscribed} se habían dado de baja y se respetó`);
    if (totals.invalid) parts.push(`${totals.invalid} no válidos`);
    if (totals.error) parts.push(`${totals.error} con error`);
    setStatus(status, `Importación terminada: ${parts.join(', ')}.`, totals.error ? 'error' : 'ok');
    if (!totals.error) {
      $('importar-correos').value = '';
      $('importar-correos').dispatchEvent(new Event('input'));
    }
  } catch (error) {
    setStatus(status, `${error.message || 'La importación se detuvo.'} Puedes volver a intentarlo: los correos ya agregados no se duplican.`, 'error');
  } finally {
    button.disabled = false;
  }
});

/* ---------- Panel del equipo: cabina ---------- */

let solicitudes = [];
const ESTADOS = ['nueva', 'atendida', 'reproducida', 'descartada'];

function textoSolicitud(item) {
  if (item.type === 'pedir_canciones') return [item.cancion1, item.cancion2, item.cancion3].filter(Boolean).join(' · ');
  return item.comentario || '';
}

function renderSolicitudes() {
  const container = $('lista-cabina');
  const filter = $('filtro-cabina').value;
  const records = solicitudes.filter(item => filter === 'todas' || (item.status || 'nueva') === filter);
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-msg';
    empty.textContent = filter === 'todas' ? 'Aún no hay solicitudes en la bandeja.' : 'No hay solicitudes con este estado.';
    return container.replaceChildren(empty);
  }
  container.replaceChildren(...records.map(item => {
    const card = document.createElement('article');
    card.className = 'admin-item';
    const title = document.createElement('strong');
    title.textContent = item.type === 'pedir_canciones' ? '🎵 Solicitud de canciones' : '💬 Mensaje de oyente';
    const meta = document.createElement('p');
    const when = item.createdAt ? new Date(item.createdAt).toLocaleString('es-CL') : '';
    meta.textContent = [item.name || 'Oyente', item.email, when].filter(Boolean).join(' · ');
    const content = document.createElement('p');
    content.className = 'admin-item__content';
    content.textContent = textoSolicitud(item);
    const controls = document.createElement('div');
    controls.className = 'admin-item__controls';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Estado de la solicitud');
    ESTADOS.forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status[0].toUpperCase() + status.slice(1);
      option.selected = status === (item.status || 'nueva');
      select.appendChild(option);
    });
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn btn-ghost btn-sm';
    save.textContent = 'Guardar';
    save.addEventListener('click', () => actualizarSolicitud(item.id, select.value, save));
    controls.append(select, save);
    card.append(title, meta, content, controls);
    return card;
  }));
}

async function cargarSolicitudesCabina() {
  const status = $('estado-lista-cabina');
  const button = $('btn-recargar-cabina');
  button.disabled = true;
  setStatus(status, 'Cargando bandeja…');
  try {
    solicitudes = (await llamarApi('/api/cabina-requests', null, 'GET')).requests || [];
    renderSolicitudes();
    setStatus(status, `${solicitudes.length} solicitud(es) en la bandeja.`, 'ok');
  } catch (error) {
    setStatus(status, error.message || 'No pudimos cargar la bandeja.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function actualizarSolicitud(id, status, button) {
  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    await llamarApi('/api/cabina-requests', { id, status }, 'PATCH');
    const record = solicitudes.find(item => item.id === id);
    if (record) record.status = status;
    renderSolicitudes();
    setStatus($('estado-lista-cabina'), 'Estado actualizado.', 'ok');
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Guardar';
    setStatus($('estado-lista-cabina'), error.message || 'No pudimos guardar el estado.', 'error');
  }
}

$('btn-recargar-cabina').addEventListener('click', cargarSolicitudesCabina);
$('filtro-cabina').addEventListener('change', renderSolicitudes);

renderSeleccion();
