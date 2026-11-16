import {
  db, watchUser, signIn, logOut, isAdminUser, driveIdFrom, escapeHtml, formatDate, avatarHtml, friendlyError,
  doc, getDoc, getDocs, collection, query, orderBy, updateDoc, deleteDoc, addDoc, serverTimestamp
} from './community-core.js';

const $ = selector => document.querySelector(selector);
const state = { members: [], episodes: [] };

function show(name) {
  ['loading', 'out', 'denied', 'app'].forEach(view => { $(`#view-${view}`).hidden = view !== name; });

  // Si el foco quedó en un bloque que se ocultó, lo llevamos a la vista nueva.
  const active = document.activeElement;
  if (!active || active === document.body || active.closest('[hidden]')) $(`#view-${name}`)?.focus({ preventScroll: true });
}

function setMessage(el, text, kind = 'error') {
  el.textContent = text || '';
  el.className = kind === 'ok' ? 'notice' : 'alert';
}

const STATUS_LABEL = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };

function memberRow(member) {
  const actions = [];
  if (member.status !== 'approved') actions.push(`<button type="button" class="btn btn-primary btn-sm" data-status="approved" data-id="${escapeHtml(member.id)}">Aprobar</button>`);
  if (member.status === 'pending') actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-status="rejected" data-id="${escapeHtml(member.id)}">Rechazar</button>`);
  if (member.status === 'approved') actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-status="rejected" data-id="${escapeHtml(member.id)}">Quitar acceso</button>`);
  if (member.status === 'rejected') actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-delete-member="${escapeHtml(member.id)}" title="Permite que vuelva a solicitar acceso">Borrar solicitud</button>`);
  const created = member.createdAt?.toDate ? member.createdAt.toDate().toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return `
    <li class="admin-row">
      ${avatarHtml(member, 48)}
      <div class="admin-row__info">
        <strong>${escapeHtml(member.name)}</strong>
        <span class="muted small">${escapeHtml(member.email || 'correo no disponible')}${created ? ` · ${escapeHtml(created)}` : ''}</span>
        ${member.bio ? `<span class="small">${escapeHtml(member.bio)}</span>` : ''}
      </div>
      <span class="pill pill--${escapeHtml(member.status)}">${escapeHtml(STATUS_LABEL[member.status] || member.status)}</span>
      <div class="admin-row__actions">${actions.join('')}</div>
    </li>`;
}

function renderMembers() {
  const groups = { pending: [], approved: [], rejected: [] };
  state.members.forEach(member => (groups[member.status] || groups.pending).push(member));
  $('#pending-count').textContent = groups.pending.length;
  $('#pending-list').innerHTML = groups.pending.length ? groups.pending.map(memberRow).join('') : '<li class="muted">No hay solicitudes pendientes.</li>';
  $('#approved-list').innerHTML = groups.approved.length ? groups.approved.map(memberRow).join('') : '<li class="muted">Aún no hay miembros aprobados.</li>';
  $('#rejected-list').innerHTML = groups.rejected.length ? groups.rejected.map(memberRow).join('') : '<li class="muted">Ninguna.</li>';
}

function renderEpisodes() {
  $('#admin-episodes').innerHTML = state.episodes.length
    ? state.episodes.map(episode => `
      <li class="admin-row">
        <div class="admin-row__info">
          <strong>${escapeHtml(episode.title)}</strong>
          <span class="muted small">${escapeHtml(formatDate(episode.date))} · <a class="text-link" href="https://drive.google.com/file/d/${encodeURIComponent(episode.driveId)}/view" target="_blank" rel="noopener noreferrer">Abrir en Drive ↗</a></span>
        </div>
        <div class="admin-row__actions"><button type="button" class="btn btn-ghost btn-sm" data-delete-episode="${escapeHtml(episode.id)}">Eliminar</button></div>
      </li>`).join('')
    : '<li class="muted">Todavía no hay episodios.</li>';
}

async function loadAll() {
  const [members, episodes] = await Promise.all([
    getDocs(collection(db, 'members')),
    getDocs(query(collection(db, 'episodes'), orderBy('date', 'desc')))
  ]);
  state.members = await Promise.all(members.docs.map(async item => {
    const contact = await getDoc(doc(db, 'members', item.id, 'private', 'contact')).catch(() => null);
    return { id: item.id, ...item.data(), email: contact?.exists() ? contact.data().email : '' };
  }));
  state.members.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  state.episodes = episodes.docs.map(item => ({ id: item.id, ...item.data() }));
  renderMembers();
  renderEpisodes();
}

async function setStatus(id, status, button) {
  const member = state.members.find(item => item.id === id);
  if (status === 'rejected' && member?.status === 'approved'
      && !confirm(`¿Quitar el acceso a ${member.name}? Dejará de ver la comunidad.`)) return;
  button.disabled = true;
  try {
    await updateDoc(doc(db, 'members', id), { status, reviewedAt: serverTimestamp() });
    member.status = status;
    renderMembers();
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

async function deleteMember(id, button) {
  const member = state.members.find(item => item.id === id);
  if (!confirm(`¿Borrar la solicitud de ${member?.name || 'esta persona'}? Podrá volver a solicitar acceso.`)) return;
  button.disabled = true;
  try {
    await deleteDoc(doc(db, 'members', id, 'private', 'contact')).catch(() => {});
    await deleteDoc(doc(db, 'members', id));
    state.members = state.members.filter(item => item.id !== id);
    renderMembers();
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

async function handleEpisode(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#episode-message');
  const driveId = driveIdFrom(form.drive.value);
  const title = form.title.value.trim();
  if (!driveId) { setMessage(message, 'Ese enlace de Google Drive no es válido. Copia el enlace de "Compartir" del archivo.'); return; }
  if (!title) { setMessage(message, 'Escribe el título del episodio.'); return; }
  const episode = { title: title.slice(0, 140), description: form.description.value.trim().slice(0, 2000), date: form.date.value, driveId, createdAt: serverTimestamp() };
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    const ref = await addDoc(collection(db, 'episodes'), episode);
    state.episodes.push({ id: ref.id, ...episode });
    state.episodes.sort((a, b) => b.date.localeCompare(a.date));
    renderEpisodes();
    form.reset();
    form.date.value = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    setMessage(message, 'Episodio publicado. Recuerda que el archivo en Drive debe estar compartido como "Cualquier persona con el enlace".', 'ok');
  } catch (error) {
    console.error(error);
    setMessage(message, friendlyError(error));
  } finally {
    form.querySelector('button[type="submit"]').disabled = false;
  }
}

async function deleteEpisode(id, button) {
  const episode = state.episodes.find(item => item.id === id);
  if (!confirm(`¿Eliminar "${episode?.title}" del sitio? El archivo en Drive no se borra.`)) return;
  button.disabled = true;
  try {
    await deleteDoc(doc(db, 'episodes', id));
    state.episodes = state.episodes.filter(item => item.id !== id);
    renderEpisodes();
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

document.querySelectorAll('[data-signin]').forEach(button => button.addEventListener('click', async () => {
  try { await signIn(); } catch (error) { console.error(error); alert(friendlyError(error)); }
}));
document.querySelectorAll('[data-signout]').forEach(button => button.addEventListener('click', () => logOut()));
$('#episode-form').addEventListener('submit', handleEpisode);
$('#episode-form').date.value = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

document.addEventListener('click', event => {
  const status = event.target.closest('[data-status]');
  if (status) return setStatus(status.dataset.id, status.dataset.status, status);
  const removeMember = event.target.closest('[data-delete-member]');
  if (removeMember) return deleteMember(removeMember.dataset.deleteMember, removeMember);
  const removeEpisode = event.target.closest('[data-delete-episode]');
  if (removeEpisode) return deleteEpisode(removeEpisode.dataset.deleteEpisode, removeEpisode);
});

watchUser(async user => {
  if (!user) { show('out'); return; }
  if (!isAdminUser(user)) { $('#denied-email').textContent = user.email; show('denied'); return; }
  show('loading');
  try { await loadAll(); show('app'); }
  catch (error) { console.error(error); show('app'); setMessage($('#admin-message'), friendlyError(error)); }
});
