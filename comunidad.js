import {
  auth, db, watchUser, signIn, logOut, isAdminUser, drivePreviewUrl, escapeHtml, formatDate,
  avatarHtml, friendlyError, safePhoto,
  doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, updateDoc,
  serverTimestamp, arrayUnion, arrayRemove, addDoc, deleteDoc, setDoc
} from './community-core.js';

const $ = selector => document.querySelector(selector);
const views = ['loading', 'out', 'join', 'pending', 'rejected', 'app'];
const state = { user: null, member: null, episodes: [], members: [], comments: {}, requests: [], reported: new Set() };

function show(name) {
  views.forEach(view => { const el = $(`#view-${view}`); if (el) el.hidden = view !== name; });
  document.body.dataset.view = name;

  // Si el foco quedó en un bloque que se ocultó, lo llevamos a la vista nueva.
  const active = document.activeElement;
  if (!active || active === document.body || active.closest('[hidden]')) $(`#view-${name}`)?.focus({ preventScroll: true });
}

function setMessage(el, text, kind = 'error') {
  if (!el) return;
  el.textContent = text || '';
  el.className = kind === 'ok' ? 'notice' : 'alert';
}

function updateSessionBar(user) {
  const bar = $('#session-bar');
  if (!bar) return;
  bar.hidden = !user;
  if (!user) return;
  $('#session-name').textContent = user.displayName || user.email;
  $('#admin-link').hidden = !isAdminUser(user);
}

// ---------- Inicio de sesión ----------
async function handleSignIn(event) {
  const button = event.currentTarget;
  const message = $('#signin-message');
  button.disabled = true;
  setMessage(message, '');
  try { await signIn(); }
  catch (error) { console.error(error); setMessage(message, friendlyError(error)); }
  finally { button.disabled = false; }
}

// ---------- Solicitud de ingreso ----------
async function handleJoin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#join-message');
  const name = form.name.value.trim();
  const bio = form.bio.value.trim();
  if (!name) { setMessage(message, 'Escribe tu nombre.'); return; }
  form.querySelector('button[type="submit"]').disabled = true;
  setMessage(message, '');
  try {
    const user = auth.currentUser;
    const batch = writeBatch(db);
    batch.set(doc(db, 'members', user.uid), {
      name: name.slice(0, 60), bio: bio.slice(0, 280), photoURL: safePhoto(user.photoURL),
      favorites: [], status: 'pending', createdAt: serverTimestamp()
    });
    batch.set(doc(db, 'members', user.uid, 'private', 'contact'), { email: user.email });
    await batch.commit();
    // Aviso por correo a la administración. Si falla, la solicitud igual queda en el panel.
    user.getIdToken().then(token => fetch('/api/solicitud', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    })).catch(error => console.warn('No se pudo enviar el aviso por correo:', error));
    await loadMember(user);
  } catch (error) {
    console.error(error);
    setMessage(message, friendlyError(error));
  } finally {
    form.querySelector('button[type="submit"]').disabled = false;
  }
}

// ---------- Comunidad (miembros aprobados) ----------
const isFavorite = id => (state.member?.favorites || []).includes(id);

function renderEpisodes() {
  const list = $('#episode-list');
  if (!state.episodes.length) {
    list.innerHTML = '<p class="muted">Todavía no hay episodios publicados. ¡Vuelve pronto!</p>';
    return;
  }
  list.innerHTML = state.episodes.map(episode => `
    <article class="card episode" data-id="${escapeHtml(episode.id)}">
      <div class="episode__head">
        <div>
          <p class="muted small">${escapeHtml(formatDate(episode.date))}</p>
          <h3>${escapeHtml(episode.title)}</h3>
        </div>
        <button type="button" class="fav-btn" data-fav="${escapeHtml(episode.id)}" aria-pressed="${isFavorite(episode.id)}"
          aria-label="${isFavorite(episode.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}" title="Favorito">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>
        </button>
      </div>
      ${episode.description ? `<p class="episode__desc">${escapeHtml(episode.description)}</p>` : ''}
      <div class="episode__player"><button type="button" class="btn btn-primary btn-sm" data-play="${escapeHtml(episode.id)}">▶ Escuchar</button></div>
      <div><button type="button" class="link-btn" data-comments="${escapeHtml(episode.id)}" aria-expanded="false" aria-controls="comments-${escapeHtml(episode.id)}">💬 Ver comentarios</button></div>
      <section class="comments" id="comments-${escapeHtml(episode.id)}" aria-label="Comentarios de ${escapeHtml(episode.title)}" hidden></section>
    </article>`).join('');
}

// Busca sin importar mayúsculas ni tildes.
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function filterEpisodes() {
  const terms = normalize($('#episode-search').value).split(/\s+/).filter(Boolean);
  let visible = 0;
  document.querySelectorAll('#episode-list .episode').forEach(card => {
    const episode = state.episodes.find(item => item.id === card.dataset.id);
    const haystack = normalize(`${episode?.title} ${episode?.description} ${formatDate(episode?.date)}`);
    const match = terms.every(term => haystack.includes(term));
    card.hidden = !match;
    if (match) visible += 1;
  });
  const empty = $('#episode-empty');
  empty.hidden = !(terms.length && visible === 0);
}

function renderMembers() {
  const list = $('#member-list');
  $('#member-count').textContent = state.members.length === 1 ? '1 miembro' : `${state.members.length} miembros`;
  list.innerHTML = state.members.map(member => `
    <button type="button" class="card member-card" data-member="${escapeHtml(member.id)}">
      ${avatarHtml(member, 64)}
      <span class="member-card__name">${escapeHtml(member.name)}</span>
      ${member.bio ? `<span class="member-card__bio muted small">${escapeHtml(member.bio)}</span>` : ''}
    </button>`).join('');
}

function favoriteTitles(member) {
  const byId = new Map(state.episodes.map(episode => [episode.id, episode]));
  return (member.favorites || []).map(id => byId.get(id)).filter(Boolean);
}

function openMember(id) {
  const member = state.members.find(item => item.id === id) || (id === state.user?.uid ? { id, ...state.member } : null);
  if (!member) return;
  const favorites = favoriteTitles(member);
  $('#member-detail-body').innerHTML = `
    <div class="member-detail__top">${avatarHtml(member, 88)}<div><h2 id="member-detail-title">${escapeHtml(member.name)}</h2>
    ${member.bio ? `<p class="muted">${escapeHtml(member.bio)}</p>` : ''}</div></div>
    <h3 class="small muted" style="margin-top:20px">Episodios favoritos</h3>
    ${favorites.length
      ? `<ul class="fav-list">${favorites.map(episode => `<li>★ ${escapeHtml(episode.title)}</li>`).join('')}</ul>`
      : '<p class="muted small">Aún no marca episodios favoritos.</p>'}`;
  const dialog = $('#member-detail');
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
}

async function loadEmailPreference() {
  const box = $('#profile-episode-emails');
  try {
    const contact = await getDoc(doc(db, 'members', state.user.uid, 'private', 'contact'));
    state.contact = contact.exists() ? contact.data() : { email: state.user.email };
    box.checked = state.contact.episodeEmails !== false;
    box.disabled = false;
  } catch (error) {
    console.error(error);
  }
}

function fillProfileForm() {
  const form = $('#profile-form');
  if (!state.contact) loadEmailPreference();
  form.name.value = state.member.name || '';
  form.bio.value = state.member.bio || '';
  $('#profile-preview').innerHTML = avatarHtml({ ...state.member, photoURL: state.user.photoURL || state.member.photoURL }, 72);
}

async function handleProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#profile-message');
  const name = form.name.value.trim();
  if (!name) { setMessage(message, 'Escribe tu nombre.'); return; }
  const changes = { name: name.slice(0, 60), bio: form.bio.value.trim().slice(0, 280), photoURL: safePhoto(state.user.photoURL) };
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    await updateDoc(doc(db, 'members', state.user.uid), changes);
    if (state.contact) {
      const episodeEmails = $('#profile-episode-emails').checked;
      await setDoc(doc(db, 'members', state.user.uid, 'private', 'contact'), { email: state.user.email, episodeEmails });
      state.contact.episodeEmails = episodeEmails;
    }
    Object.assign(state.member, changes);
    const own = state.members.find(item => item.id === state.user.uid);
    if (own) Object.assign(own, changes);
    renderMembers();
    setMessage(message, 'Perfil guardado.', 'ok');
  } catch (error) {
    console.error(error);
    setMessage(message, friendlyError(error));
  } finally {
    form.querySelector('button[type="submit"]').disabled = false;
  }
}

async function toggleFavorite(id, button) {
  const adding = !isFavorite(id);
  button.disabled = true;
  try {
    await updateDoc(doc(db, 'members', state.user.uid), { favorites: adding ? arrayUnion(id) : arrayRemove(id) });
    state.member.favorites = adding ? [...(state.member.favorites || []), id] : state.member.favorites.filter(item => item !== id);
    const own = state.members.find(item => item.id === state.user.uid);
    if (own) own.favorites = state.member.favorites;
    button.setAttribute('aria-pressed', String(adding));
    button.setAttribute('aria-label', adding ? 'Quitar de favoritos' : 'Agregar a favoritos');
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
  } finally {
    button.disabled = false;
  }
}

function selectTab(name) {
  document.querySelectorAll('[role="tab"]').forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $(`#panel-${tab.dataset.tab}`).hidden = !active;
  });
  tabTuner?.tuneTo(name);
  if (name === 'perfil') fillProfileForm();
  if (name === 'pedidos' && !state.requestsLoaded) { state.requestsLoaded = true; loadRequests(); }
}

async function loadCommunity() {
  show('app');
  $('#welcome-name').textContent = (state.member.name || '').split(' ')[0] || 'bienvenido';
  $('#episode-list').innerHTML = '<p class="muted">Cargando episodios…</p>';
  $('#member-list').innerHTML = '<p class="muted">Cargando miembros…</p>';
  const [episodes, members] = await Promise.allSettled([
    getDocs(query(collection(db, 'episodes'), orderBy('date', 'desc'))),
    getDocs(query(collection(db, 'members'), where('status', '==', 'approved')))
  ]);
  if (episodes.status === 'fulfilled') {
    state.episodes = episodes.value.docs.map(item => ({ id: item.id, ...item.data() }));
    renderEpisodes();
    $('#episode-search-wrap').hidden = state.episodes.length < 2;
  } else {
    $('#episode-list').innerHTML = `<p class="alert">${escapeHtml(friendlyError(episodes.reason))}</p>`;
  }
  if (members.status === 'fulfilled') {
    state.members = members.value.docs.map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
    renderMembers();
  } else {
    $('#member-list').innerHTML = `<p class="alert">${escapeHtml(friendlyError(members.reason))}</p>`;
  }
}

async function loadMember(user) {
  const snapshot = await getDoc(doc(db, 'members', user.uid));
  if (!snapshot.exists()) {
    const form = $('#join-form');
    form.name.value = user.displayName || '';
    show('join');
    return;
  }
  state.member = snapshot.data();
  if (state.member.status === 'approved') await loadCommunity();
  else show(state.member.status === 'rejected' ? 'rejected' : 'pending');
}


// ---------- Comentarios ----------
const REACTIONS = [['hearts', '❤️', 'Me encanta'], ['claps', '👏', 'Aplausos']];

async function toggleReaction(button) {
  const { react: field, comment: id, episode: episodeId } = button.dataset;
  const comment = state.comments[episodeId]?.find(item => item.id === id);
  if (!comment) return;
  const adding = !(comment[field] || []).includes(state.user.uid);
  button.disabled = true;
  try {
    await updateDoc(doc(db, 'episodes', episodeId, 'comments', id), { [field]: adding ? arrayUnion(state.user.uid) : arrayRemove(state.user.uid) });
    comment[field] = adding ? [...(comment[field] || []), state.user.uid] : comment[field].filter(uid => uid !== state.user.uid);
    renderComments(episodeId);
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

const timeAgo = timestamp => {
  const date = timestamp?.toDate ? timestamp.toDate() : null;
  if (!date) return 'ahora';
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) + ', ' + date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

function renderComments(episodeId) {
  const box = document.getElementById(`comments-${episodeId}`);
  const comments = state.comments[episodeId] || [];
  const canDelete = comment => comment.uid === state.user.uid || isAdminUser(state.user);
  box.innerHTML = `
    <ul class="comment-list">
      ${comments.length ? comments.map(comment => `
        <li class="comment">
          ${avatarHtml(comment, 36)}
          <div class="comment__body">
            <p class="comment__meta"><strong>${escapeHtml(comment.name)}</strong> <span class="muted small">${escapeHtml(timeAgo(comment.createdAt))}</span></p>
            <p class="comment__text">${escapeHtml(comment.text)}</p>
            <div class="comment__actions">
              ${REACTIONS.map(([field, emoji, label]) => {
                const list = comment[field] || [];
                const mine = list.includes(state.user.uid);
                return `<button type="button" class="reaction" data-react="${field}" data-comment="${escapeHtml(comment.id)}" data-episode="${escapeHtml(episodeId)}" aria-pressed="${mine}" aria-label="${label}${list.length ? `: ${list.length}` : ''}">${emoji}${list.length ? ` <span>${list.length}</span>` : ''}</button>`;
              }).join('')}
              ${canDelete(comment) ? `<button type="button" class="link-btn small" data-delete-comment="${escapeHtml(comment.id)}" data-episode="${escapeHtml(episodeId)}">Borrar</button>` : ''}
              ${comment.uid !== state.user.uid
                ? (state.reported.has(comment.id)
                  ? '<span class="muted small">Reportado. Gracias, lo revisaremos.</span>'
                  : `<button type="button" class="link-btn small link-btn--quiet" data-report="${escapeHtml(comment.id)}" data-episode="${escapeHtml(episodeId)}">Reportar</button>`)
                : ''}
            </div>
          </div>
        </li>`).join('') : '<li class="muted small">Aún no hay comentarios. ¡Sé la primera persona en comentar!</li>'}
    </ul>
    <form class="comment-form" data-comment-form="${escapeHtml(episodeId)}" novalidate>
      <label class="sr-only" for="comment-text-${escapeHtml(episodeId)}">Escribe un comentario</label>
      <textarea id="comment-text-${escapeHtml(episodeId)}" name="text" maxlength="500" rows="2" placeholder="Escribe un comentario…" required></textarea>
      <button type="submit" class="btn btn-primary btn-sm">Comentar</button>
    </form>
    <p class="alert" role="alert"></p>`;
}

async function toggleComments(button) {
  const episodeId = button.dataset.comments;
  const box = document.getElementById(`comments-${episodeId}`);
  const open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(open));
  button.textContent = open ? '💬 Ocultar comentarios' : '💬 Ver comentarios';
  box.hidden = !open;
  if (!open) return;
  box.innerHTML = '<p class="muted small">Cargando comentarios…</p>';
  try {
    const snapshot = await getDocs(query(collection(db, 'episodes', episodeId, 'comments'), orderBy('createdAt', 'asc')));
    state.comments[episodeId] = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderComments(episodeId);
  } catch (error) {
    console.error(error);
    box.innerHTML = `<p class="alert">${escapeHtml(friendlyError(error))}</p>`;
  }
}

async function submitComment(form) {
  const episodeId = form.dataset.commentForm;
  const text = form.text.value.trim();
  const message = form.nextElementSibling;
  if (!text) { setMessage(message, 'Escribe algo antes de comentar.'); return; }
  form.querySelector('button').disabled = true;
  try {
    const comment = { uid: state.user.uid, name: state.member.name, photoURL: state.member.photoURL || '', text: text.slice(0, 500), createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, 'episodes', episodeId, 'comments'), comment);
    (state.comments[episodeId] ||= []).push({ ...comment, id: ref.id, createdAt: null });
    renderComments(episodeId);
  } catch (error) {
    console.error(error);
    setMessage(message, friendlyError(error));
    form.querySelector('button').disabled = false;
  }
}

async function reportComment(button) {
  if (!confirm('¿Reportar este comentario? La administración lo revisará. Quien lo escribió no sabrá que fuiste tú.')) return;
  const { report: id, episode: episodeId } = button.dataset;
  button.disabled = true;
  try {
    await setDoc(doc(db, 'reports', `${id}_${state.user.uid}`), { reporterUid: state.user.uid, episodeId, commentId: id, createdAt: serverTimestamp() });
    state.reported.add(id);
  } catch (error) {
    // Si ya existía un reporte tuyo, las reglas no permiten repetirlo.
    if (String(error?.code).includes('permission-denied')) state.reported.add(id);
    else { console.error(error); alert(friendlyError(error)); button.disabled = false; return; }
  }
  renderComments(episodeId);
}

async function deleteComment(button) {
  if (!confirm('¿Borrar este comentario?')) return;
  const { episode: episodeId, deleteComment: id } = button.dataset;
  button.disabled = true;
  try {
    await deleteDoc(doc(db, 'episodes', episodeId, 'comments', id));
    state.comments[episodeId] = state.comments[episodeId].filter(item => item.id !== id);
    renderComments(episodeId);
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

// ---------- Pedidos de canciones y saludos ----------
const REQUEST_TYPE = { cancion: 'Canción', saludo: 'Saludo' };

const MAX_WAITING = 3;
const waitingRequests = () => state.requests.filter(item => item.status === 'nuevo');

function renderRequests() {
  const list = $('#request-list');
  const waiting = waitingRequests().length;
  $('#request-slots').textContent = `${waiting} de ${MAX_WAITING} pedidos en espera`;
  $('#request-form button[type="submit"]').disabled = waiting >= MAX_WAITING;
  $('#request-full').hidden = waiting < MAX_WAITING;
  if (!state.requests.length) { list.innerHTML = '<li class="muted small">Todavía no has enviado pedidos.</li>'; return; }
  list.innerHTML = state.requests.map(item => `
    <li class="admin-row">
      <div class="admin-row__info">
        <span class="muted small">${escapeHtml(REQUEST_TYPE[item.type] || item.type)}${item.to ? ` · para ${escapeHtml(item.to)}` : ''} · ${escapeHtml(timeAgo(item.createdAt))}</span>
        <span>${escapeHtml(item.text)}</span>
      </div>
      <span class="pill ${item.status === 'hecho' ? 'pill--approved' : 'pill--pending'}">${item.status === 'hecho' ? '¡Sonó al aire!' : 'En espera'}</span>
      ${item.status === 'nuevo' ? `<div class="admin-row__actions"><button type="button" class="btn btn-ghost btn-sm" data-delete-request="${escapeHtml(item.id)}">Retirar</button></div>` : ''}
    </li>`).join('');
}

async function loadRequests() {
  state.requestsReady = false;
  $('#request-list').innerHTML = '<li class="muted small">Cargando tus pedidos…</li>';
  try {
    const snapshot = await getDocs(query(collection(db, 'requests'), where('uid', '==', state.user.uid)));
    state.requests = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    state.requestsReady = true;
    renderRequests();
  } catch (error) {
    console.error(error);
    $('#request-list').innerHTML = `<li class="alert">${escapeHtml(friendlyError(error))}</li>`;
  }
}

function updateRequestForm() {
  const form = $('#request-form');
  const song = form.type.value === 'cancion';
  $('#request-text-label').textContent = song ? 'Canción y artista' : 'Tu saludo';
  form.text.placeholder = song ? 'Ej.: Vivir mi vida – Marc Anthony' : 'Ej.: Un saludo a mi abuela que siempre escucha la radio';
  form.text.rows = song ? 2 : 4;
}

async function handleRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#request-message');
  const text = form.text.value.trim();
  if (!text) { setMessage(message, form.type.value === 'cancion' ? 'Escribe la canción que quieres escuchar.' : 'Escribe tu saludo.'); return; }
  if (!state.requestsReady) { setMessage(message, 'Espera un momento: estamos cargando tus pedidos.'); return; }
  // Cada miembro tiene tres casillas para pedidos en espera.
  const used = new Set(waitingRequests().map(item => item.id));
  const slot = Array.from({ length: MAX_WAITING }, (_, i) => `${state.user.uid}_${i + 1}`).find(id => !used.has(id));
  if (!slot) { setMessage(message, `Ya tienes ${MAX_WAITING} pedidos en espera. Cuando suenen al aire podrás enviar más.`); return; }
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    const request = { uid: state.user.uid, name: state.member.name, type: form.type.value, text: text.slice(0, 300), to: form.to.value.trim().slice(0, 80), status: 'nuevo', createdAt: serverTimestamp() };
    await setDoc(doc(db, 'requests', slot), request);
    state.requests.unshift({ ...request, id: slot, createdAt: null });
    renderRequests();
    form.text.value = ''; form.to.value = '';
    setMessage(message, '¡Pedido enviado! Te avisaremos aquí cuando suene al aire.', 'ok');
  } catch (error) {
    console.error(error);
    setMessage(message, friendlyError(error));
  } finally {
    form.querySelector('button[type="submit"]').disabled = waitingRequests().length >= MAX_WAITING;
  }
}

async function deleteRequest(button) {
  if (!confirm('¿Retirar este pedido?')) return;
  button.disabled = true;
  try {
    await deleteDoc(doc(db, 'requests', button.dataset.deleteRequest));
    state.requests = state.requests.filter(item => item.id !== button.dataset.deleteRequest);
    renderRequests();
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

// ---------- Eventos ----------
document.querySelectorAll('[data-signin]').forEach(button => button.addEventListener('click', handleSignIn));
document.querySelectorAll('[data-signout]').forEach(button => button.addEventListener('click', () => logOut()));
$('#join-form').addEventListener('submit', handleJoin);
$('#profile-form').addEventListener('submit', handleProfile);

$('#episode-list').addEventListener('click', event => {
  const play = event.target.closest('[data-play]');
  if (play) {
    const holder = play.parentElement;
    holder.innerHTML = `<iframe src="${drivePreviewUrl(state.episodes.find(e => e.id === play.dataset.play)?.driveId || '')}" title="Reproductor del episodio" allow="autoplay" loading="lazy"></iframe>`;
    return;
  }
  const fav = event.target.closest('[data-fav]');
  if (fav) return toggleFavorite(fav.dataset.fav, fav);
  const comments = event.target.closest('[data-comments]');
  if (comments) return toggleComments(comments);
  const removeComment = event.target.closest('[data-delete-comment]');
  if (removeComment) return deleteComment(removeComment);
  const reaction = event.target.closest('[data-react]');
  if (reaction) return toggleReaction(reaction);
  const report = event.target.closest('[data-report]');
  if (report) return reportComment(report);
});
$('#episode-list').addEventListener('submit', event => {
  const form = event.target.closest('[data-comment-form]');
  if (!form) return;
  event.preventDefault();
  submitComment(form);
});
$('#request-form').addEventListener('submit', handleRequest);
$('#episode-search').addEventListener('input', filterEpisodes);
$('#request-form').addEventListener('change', event => { if (event.target.name === 'type') updateRequestForm(); });
$('#request-list').addEventListener('click', event => {
  const remove = event.target.closest('[data-delete-request]');
  if (remove) deleteRequest(remove);
});
$('#member-list').addEventListener('click', event => {
  const card = event.target.closest('[data-member]');
  if (card) openMember(card.dataset.member);
});
$('#member-detail-close').addEventListener('click', () => $('#member-detail').close?.() ?? $('#member-detail').removeAttribute('open'));

// Sintonizador de secciones: cada pestaña es una emisora del dial. Arrastrar la aguja
// muestra estática entre emisoras y, al soltarla, se engancha a la más cercana y abre esa sección.
// Las pestañas siguen siendo el control accesible (teclado y lector de pantalla); el dial es extra.
function createTabTuner(root) {
  if (!root) return null;
  const range = root.querySelector('.tuner__range');
  const freqOut = root.querySelector('[data-tuner-freq]');
  const nameOut = root.querySelector('[data-tuner-name]');
  const canvas = root.querySelector('.tuner__static');
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  const stations = [...root.querySelectorAll('[role="tab"]')].map(tab => ({
    tab, name: tab.dataset.tab, freq: Number(tab.dataset.freq), label: tab.querySelector('.preset__name').textContent
  }));
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let noise = 0, frame = 0, glide = 0;

  const drawStatic = () => {
    frame = 0;
    if (noise < 0.02) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = Math.random() * 255;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    if (!reduceMotion) frame = requestAnimationFrame(drawStatic);
  };
  const nearest = () => {
    const freq = Number(range.value);
    return stations.reduce((best, st) => (Math.abs(st.freq - freq) < Math.abs(best.freq - freq) ? st : best));
  };
  const update = () => {
    const freq = Number(range.value);
    const near = nearest();
    const signal = Math.max(0, 1 - Math.abs(near.freq - freq) / 1.8);
    noise = 1 - signal;
    freqOut.textContent = freq.toFixed(1);
    nameOut.textContent = signal > 0.3 ? near.label : 'Sin señal';
    root.style.setProperty('--signal', signal.toFixed(3));
    root.dataset.bars = String(Math.round(signal * 4));
    if (!frame) drawStatic();
  };
  const glideTo = target => {
    cancelAnimationFrame(glide);
    if (reduceMotion) { range.value = target; update(); return; }
    const start = Number(range.value);
    if (Math.abs(start - target) < 0.05) { range.value = target; update(); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 600);
      range.value = (start + (target - start) * (1 - Math.pow(1 - k, 3))).toFixed(1);
      update();
      if (k < 1) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };

  range.addEventListener('input', () => { cancelAnimationFrame(glide); update(); });
  const snap = () => selectTab(nearest().name);
  range.addEventListener('pointerup', snap);
  range.addEventListener('touchend', snap, { passive: true });

  root.classList.add('is-ready');
  update();
  return {
    tuneTo(name) {
      const station = stations.find(st => st.name === name);
      if (station) glideTo(station.freq);
    }
  };
}
const tabTuner = createTabTuner(document.querySelector('[data-tab-tuner]'));

const tabs = [...document.querySelectorAll('[role="tab"]')];
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab));
  tab.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    selectTab(next.dataset.tab);
  });
});

watchUser(async user => {
  state.user = user;
  updateSessionBar(user);
  if (!user) { state.member = null; show('out'); return; }
  show('loading');
  try { await loadMember(user); }
  catch (error) {
    console.error(error);
    show('out');
    setMessage($('#signin-message'), friendlyError(error));
  }
});
