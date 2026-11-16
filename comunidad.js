import {
  auth, db, watchUser, signIn, logOut, isAdminUser, drivePreviewUrl, escapeHtml, formatDate,
  avatarHtml, friendlyError, safePhoto,
  doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, updateDoc,
  serverTimestamp, arrayUnion, arrayRemove
} from './community-core.js';

const $ = selector => document.querySelector(selector);
const views = ['loading', 'out', 'join', 'pending', 'rejected', 'app'];
const state = { user: null, member: null, episodes: [], members: [] };

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
    </article>`).join('');
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

function fillProfileForm() {
  const form = $('#profile-form');
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
  if (name === 'perfil') fillProfileForm();
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
  if (fav) toggleFavorite(fav.dataset.fav, fav);
});
$('#member-list').addEventListener('click', event => {
  const card = event.target.closest('[data-member]');
  if (card) openMember(card.dataset.member);
});
$('#member-detail-close').addEventListener('click', () => $('#member-detail').close?.() ?? $('#member-detail').removeAttribute('open'));

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
