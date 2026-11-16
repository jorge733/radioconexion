import {
  auth, db, watchUser, signIn, logOut, isAdminUser, driveIdFrom, escapeHtml, formatDate, avatarHtml, friendlyError,
  doc, getDoc, getDocs, collection, query, orderBy, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, setDoc, getCountFromServer
} from './community-core.js';

const $ = selector => document.querySelector(selector);
const state = { members: [], episodes: [], requests: [], reports: [], commentCounts: {} };

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
  if (member.status === 'approved') actions.push(`<button type="button" class="btn btn-ghost btn-sm" data-welcome="${escapeHtml(member.id)}">Enviar bienvenida</button>`);
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
  const [members, episodes, requests] = await Promise.all([
    getDocs(collection(db, 'members')),
    getDocs(query(collection(db, 'episodes'), orderBy('date', 'desc'))),
    getDocs(query(collection(db, 'requests'), orderBy('createdAt', 'desc')))
  ]);
  state.requests = requests.docs.map(item => ({ id: item.id, ...item.data() }));
  state.members = await Promise.all(members.docs.map(async item => {
    const contact = await getDoc(doc(db, 'members', item.id, 'private', 'contact')).catch(() => null);
    return { id: item.id, ...item.data(), email: contact?.exists() ? contact.data().email : '' };
  }));
  state.members.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  state.episodes = episodes.docs.map(item => ({ id: item.id, ...item.data() }));
  renderMembers();
  renderEpisodes();
  renderRequests();
  syncPublicStats();
  loadReports();
  loadStats();
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
    syncPublicStats();
    loadStats();
    // Correo de bienvenida. Si falla, la aprobación ya quedó hecha y se puede reenviar.
    if (status === 'approved') sendWelcome(member, false);
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

async function sendWelcome(member, resend, button) {
  const message = $('#admin-message');
  if (button) button.disabled = true;
  setMessage(message, `Enviando la bienvenida a ${member.name}…`, 'ok');
  try {
    const token = await auth.currentUser.getIdToken();
    // keepalive: el envío sigue aunque cambies de página.
    const result = await fetch('/api/aprobado', {
      method: 'POST', keepalive: true,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: member.id, resend })
    }).then(response => response.json());
    if (result.sent) {
      setMessage(message, `Bienvenida enviada a ${member.name} (${result.to}).`, 'ok');
      if (button) button.textContent = 'Enviada ✓';
    } else {
      const reason = result.reason || result.error || 'motivo desconocido';
      setMessage(message, `No se envió la bienvenida a ${member.name}: ${reason}`);
      if (button) alert(`No se envió la bienvenida: ${reason}`);
    }
  } catch (error) {
    console.error(error);
    setMessage(message, `No se pudo enviar la bienvenida a ${member.name}. Revisa tu conexión e inténtalo con "Enviar bienvenida".`);
  } finally {
    if (button) button.disabled = false;
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
    syncPublicStats();
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.value)) { setMessage(message, 'Elige la fecha del episodio.'); return; }
  const notify = form.notify.checked;
  const episode = { title: title.slice(0, 140), description: form.description.value.trim().slice(0, 2000), date: form.date.value, driveId, createdAt: serverTimestamp() };
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    const ref = await addDoc(collection(db, 'episodes'), episode);
    state.episodes.push({ id: ref.id, ...episode });
    state.episodes.sort((a, b) => b.date.localeCompare(a.date));
    renderEpisodes();
    syncPublicStats();
    loadStats();
    form.reset();
    form.date.value = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    form.notify.checked = true;
    let note = '';
    if (notify) {
      try {
        const token = await auth.currentUser.getIdToken();
        const result = await fetch('/api/nuevo-episodio', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ episodeId: ref.id })
        }).then(res => res.json());
        note = result.sent ? ` Avisamos por correo a ${result.sent} ${result.sent === 1 ? 'miembro' : 'miembros'}.` : ' No se envió el aviso por correo.';
      } catch (error) {
        console.warn('Aviso de episodio falló:', error);
        note = ' No se pudo enviar el aviso por correo.';
      }
    }
    setMessage(message, `Episodio publicado.${note} Recuerda que el archivo en Drive debe estar compartido como "Cualquier persona con el enlace".`, 'ok');
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
    syncPublicStats();
    loadStats();
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


// ---------- Cifras públicas para la portada ----------
async function syncPublicStats() {
  const members = state.members.filter(item => item.status === 'approved').length;
  try {
    await setDoc(doc(db, 'public', 'stats'), { members, episodes: state.episodes.length, updatedAt: serverTimestamp() });
  } catch (error) {
    console.warn('No se pudieron actualizar las cifras públicas:', error);
  }
}

// ---------- Comentarios reportados ----------
async function loadReports() {
  try {
    const snapshot = await getDocs(collection(db, 'reports'));
    const groups = new Map();
    snapshot.docs.forEach(item => {
      const data = item.data();
      const group = groups.get(data.commentId) || { commentId: data.commentId, episodeId: data.episodeId, reportIds: [], last: 0 };
      group.reportIds.push(item.id);
      group.last = Math.max(group.last, data.createdAt?.seconds || 0);
      groups.set(data.commentId, group);
    });
    state.reports = await Promise.all([...groups.values()].map(async group => {
      const comment = await getDoc(doc(db, 'episodes', group.episodeId, 'comments', group.commentId)).catch(() => null);
      return { ...group, comment: comment?.exists() ? comment.data() : null };
    }));
    state.reports.sort((a, b) => b.reportIds.length - a.reportIds.length || b.last - a.last);
    renderReports();
  } catch (error) {
    console.error(error);
    $('#report-list').innerHTML = `<li class="alert">${escapeHtml(friendlyError(error))}</li>`;
  }
}

function renderReports() {
  $('#report-count').textContent = state.reports.length;
  $('#reports-block').classList.toggle('admin-block--alert', state.reports.length > 0);
  $('#report-list').innerHTML = state.reports.length ? state.reports.map(group => {
    const episode = state.episodes.find(item => item.id === group.episodeId);
    const times = group.reportIds.length === 1 ? '1 reporte' : `${group.reportIds.length} reportes`;
    return `
      <li class="admin-row">
        <div class="admin-row__info">
          <span class="muted small">${escapeHtml(times)} · en "${escapeHtml(episode?.title || 'episodio eliminado')}"</span>
          ${group.comment
            ? `<span><strong>${escapeHtml(group.comment.name)}:</strong> ${escapeHtml(group.comment.text)}</span>`
            : '<span class="muted">El comentario ya fue borrado.</span>'}
        </div>
        <div class="admin-row__actions">
          ${group.comment ? `<button type="button" class="btn btn-primary btn-sm" data-report-delete="${escapeHtml(group.commentId)}">Borrar comentario</button>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-report-keep="${escapeHtml(group.commentId)}">${group.comment ? 'Mantener' : 'Descartar'}</button>
        </div>
      </li>`;
  }).join('') : '<li class="muted">No hay comentarios reportados.</li>';
}

async function resolveReport(commentId, removeComment, button) {
  const group = state.reports.find(item => item.commentId === commentId);
  if (!group) return;
  if (removeComment && !confirm('¿Borrar este comentario para todos?')) return;
  button.disabled = true;
  try {
    const batch = writeBatch(db);
    if (removeComment) batch.delete(doc(db, 'episodes', group.episodeId, 'comments', commentId));
    group.reportIds.forEach(id => batch.delete(doc(db, 'reports', id)));
    await batch.commit();
    state.reports = state.reports.filter(item => item.commentId !== commentId);
    renderReports();
    if (removeComment) loadStats();
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

// ---------- Estadísticas ----------
// Una sola serie por gráfico: el título dice qué se mide y cada barra lleva su número.
function barList(rows, emptyText) {
  const max = Math.max(1, ...rows.map(row => row.value));
  if (!rows.length || rows.every(row => row.value === 0)) return `<p class="muted small">${escapeHtml(emptyText)}</p>`;
  return `<ol class="bar-list">${rows.map(row => `
    <li class="bar-row" title="${escapeHtml(`${row.label}: ${row.value}`)}">
      <span class="bar-row__label">${escapeHtml(row.label)}</span>
      <span class="bar-row__track"><span class="bar-row__bar" style="width:${Math.max(row.value ? 2 : 0, (row.value / max) * 100)}%"></span></span>
      <span class="bar-row__value">${row.value}</span>
    </li>`).join('')}</ol>`;
}

async function loadStats() {
  const approved = state.members.filter(item => item.status === 'approved');
  // Comentarios por episodio (conteo en el servidor, sin descargar los comentarios).
  const counts = await Promise.all(state.episodes.map(async episode => {
    try { return [episode.id, (await getCountFromServer(collection(db, 'episodes', episode.id, 'comments'))).data().count]; }
    catch (error) { console.warn(error); return [episode.id, 0]; }
  }));
  state.commentCounts = Object.fromEntries(counts);
  const totalComments = counts.reduce((sum, [, count]) => sum + count, 0);

  const favorites = state.episodes.map(episode => ({
    label: episode.title, value: approved.filter(member => (member.favorites || []).includes(episode.id)).length
  })).sort((a, b) => b.value - a.value).slice(0, 5);
  const commented = state.episodes.map(episode => ({ label: episode.title, value: state.commentCounts[episode.id] || 0 }))
    .sort((a, b) => b.value - a.value).slice(0, 5);

  // Miembros nuevos por mes (últimos 6 meses, según la fecha de su solicitud).
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }), value: 0 });
  }
  approved.forEach(member => {
    const date = member.createdAt?.toDate?.();
    const month = date && months.find(item => item.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (month) month.value += 1;
  });

  const waiting = state.requests.filter(item => item.status === 'nuevo').length;
  $('#stat-tiles').innerHTML = [
    ['Miembros', approved.length], ['Episodios', state.episodes.length], ['Comentarios', totalComments], ['Pedidos en espera', waiting]
  ].map(([label, value]) => `<div class="stat-tile"><span class="stat-tile__value">${value}</span><span class="stat-tile__label">${label}</span></div>`).join('');
  $('#stat-favorites').innerHTML = barList(favorites, 'Aún nadie marca episodios favoritos.');
  $('#stat-comments').innerHTML = barList(commented, 'Aún no hay comentarios.');
  $('#stat-months').innerHTML = barList(months, 'Aún no hay miembros aprobados en los últimos 6 meses.');
}

// ---------- Pedidos de canciones y saludos ----------
const REQUEST_TYPE = { cancion: '🎵 Canción', saludo: '💌 Saludo' };

function requestRow(item) {
  const when = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '';
  return `
    <li class="admin-row">
      <div class="admin-row__info">
        <span class="muted small">${escapeHtml(REQUEST_TYPE[item.type] || item.type)} · de <strong>${escapeHtml(item.name)}</strong>${item.to ? ` · para ${escapeHtml(item.to)}` : ''}${when ? ` · ${escapeHtml(when)}` : ''}</span>
        <span>${escapeHtml(item.text)}</span>
      </div>
      <div class="admin-row__actions">
        ${item.status === 'nuevo'
          ? `<button type="button" class="btn btn-primary btn-sm" data-request-done="${escapeHtml(item.id)}">Marcar como leído al aire</button>`
          : '<span class="pill pill--approved">Leído al aire</span>'}
        <button type="button" class="btn btn-ghost btn-sm" data-delete-request="${escapeHtml(item.id)}">Eliminar</button>
      </div>
    </li>`;
}

function renderRequests() {
  const pending = state.requests.filter(item => item.status === 'nuevo');
  const done = state.requests.filter(item => item.status !== 'nuevo');
  $('#request-count').textContent = pending.length;
  $('#admin-requests').innerHTML = pending.length ? pending.map(requestRow).join('') : '<li class="muted">No hay pedidos nuevos.</li>';
  $('#admin-requests-done').innerHTML = done.length ? done.map(requestRow).join('') : '<li class="muted">Ninguno todavía.</li>';
}

async function markRequestDone(id, button) {
  button.disabled = true;
  try {
    // El pedido pasa al historial y su casilla queda libre para que el miembro envíe otro.
    const item = state.requests.find(request => request.id === id);
    const { id: _slot, ...data } = item;
    const done = doc(collection(db, 'requests'));
    const batch = writeBatch(db);
    batch.set(done, { ...data, status: 'hecho' });
    batch.delete(doc(db, 'requests', id));
    await batch.commit();
    Object.assign(item, { id: done.id, status: 'hecho' });
    renderRequests();
    loadStats();
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

async function deleteRequest(id, button) {
  if (!confirm('¿Eliminar este pedido?')) return;
  button.disabled = true;
  try {
    await deleteDoc(doc(db, 'requests', id));
    state.requests = state.requests.filter(item => item.id !== id);
    renderRequests();
  } catch (error) {
    console.error(error);
    alert(friendlyError(error));
    button.disabled = false;
  }
}

document.addEventListener('click', event => {
  const welcome = event.target.closest('[data-welcome]');
  if (welcome) return sendWelcome(state.members.find(item => item.id === welcome.dataset.welcome), true, welcome);
  const reportDelete = event.target.closest('[data-report-delete]');
  if (reportDelete) return resolveReport(reportDelete.dataset.reportDelete, true, reportDelete);
  const reportKeep = event.target.closest('[data-report-keep]');
  if (reportKeep) return resolveReport(reportKeep.dataset.reportKeep, false, reportKeep);
  const done = event.target.closest('[data-request-done]');
  if (done) return markRequestDone(done.dataset.requestDone, done);
  const removeRequest = event.target.closest('[data-delete-request]');
  if (removeRequest) return deleteRequest(removeRequest.dataset.deleteRequest, removeRequest);
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
