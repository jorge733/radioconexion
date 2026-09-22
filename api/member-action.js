const crypto = require('crypto');
const { requireFirebaseUser, allow } = require('./firebase-auth');
const { firestore, documentFields, valueOf, credential, accessToken } = require('./firebase-admin');

function send(response, status, body) { response.status(status).json(body); }

function blogPost(document) {
  return { id: document.name.split('/').pop(), url: valueOf(document, 'url'), publishedAt: valueOf(document, 'publishedAt') };
}

function instagramUrl(value) {
  try {
    const url = new URL(value);
    if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) return '';
    const match = url.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/);
    return match ? `https://www.instagram.com/p/${match[1]}/` : '';
  } catch { return ''; }
}

async function radioAdmin(request, response) {
  try {
    const user = await requireFirebaseUser(request);
    const adminEmail = (process.env.RADIO_ADMIN_EMAIL || 'sabenedettoa@radioconexionweb.com').toLowerCase();
    if ((user.email || '').toLowerCase() !== adminEmail) {
      send(response, 403, { error: 'Este panel es solo para el equipo de Radio Conexión.' });
      return null;
    }
    return user;
  } catch {
    send(response, 401, { error: 'Debes iniciar sesión con la cuenta de la radio.' });
    return null;
  }
}

async function handleBlogPosts(request, response) {
  if (request.method === 'GET') {
    try {
      const result = await firestore('blogPosts?pageSize=50&orderBy=publishedAt%20desc');
      return send(response, 200, { posts: (result.documents || []).map(blogPost) });
    } catch (error) {
      console.error('Blog posts list failed:', error.message);
      return send(response, 200, { posts: [] });
    }
  }

  if (!await radioAdmin(request, response)) return;

  if (request.method === 'POST') {
    const url = instagramUrl(typeof request.body?.url === 'string' ? request.body.url.trim() : '');
    if (!url) return send(response, 400, { error: 'Pega un enlace válido de una publicación de Instagram.' });
    try {
      const existing = await firestore('blogPosts?pageSize=50&orderBy=publishedAt%20desc');
      if ((existing.documents || []).some((document) => valueOf(document, 'url') === url)) return send(response, 200, { ok: true, duplicate: true });
      const id = crypto.randomUUID();
      const publishedAt = new Date().toISOString();
      await firestore(`blogPosts/${id}`, { method: 'PATCH', body: JSON.stringify(documentFields({ url, publishedAt })) });
      return send(response, 201, { ok: true, post: { id, url, publishedAt } });
    } catch (error) {
      console.error('Blog post create failed:', error.message);
      return send(response, 503, { error: 'No pudimos publicar este enlace ahora.' });
    }
  }

  if (request.method === 'DELETE') {
    const id = typeof request.body?.id === 'string' ? request.body.id : '';
    if (!/^[a-f0-9-]{36}$/i.test(id)) return send(response, 400, { error: 'La publicación no es válida.' });
    try {
      await firestore(`blogPosts/${id}`, { method: 'DELETE' });
      return send(response, 200, { ok: true });
    } catch (error) {
      console.error('Blog post delete failed:', error.message);
      return send(response, 503, { error: 'No pudimos retirar esta publicación.' });
    }
  }

  return send(response, 405, { error: 'Método no permitido.' });
}

function episodeFrom(document) {
  return {
    id: document.name.split('/').pop(), number: valueOf(document, 'number'), title: valueOf(document, 'title'),
    date: valueOf(document, 'date'), summary: valueOf(document, 'summary'), duration: valueOf(document, 'duration'),
    audioPath: valueOf(document, 'audioPath'), coverPath: valueOf(document, 'coverPath'),
    publishedAt: valueOf(document, 'publishedAt'), isLatest: valueOf(document, 'isLatest') === 'true'
  };
}

async function listEpisodes() {
  const result = await firestore('podcastEpisodes?pageSize=200&orderBy=publishedAt%20desc');
  return (result.documents || []).map(episodeFrom);
}

async function updateEpisodeAudioAccess(path, isPublic) {
  const { projectId } = credential();
  const token = await accessToken();
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
  const result = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata: { isPublic: isPublic ? 'true' : 'false' } })
  });
  if (!result.ok) throw new Error('No pudimos actualizar el acceso del audio.');
}

async function handleEpisodes(request, response) {
  if (request.method === 'GET') {
    try { return send(response, 200, { episodes: await listEpisodes() }); }
    catch (error) { console.error('Episodes list failed:', error.message); return send(response, 200, { episodes: [] }); }
  }
  if (request.method !== 'POST') return send(response, 405, { error: 'Método no permitido.' });
  if (!await radioAdmin(request, response)) return;
  const value = (item, limit) => typeof item === 'string' ? item.trim().slice(0, limit) : '';
  const number = value(request.body?.number, 12), title = value(request.body?.title, 140);
  const date = value(request.body?.date, 10), summary = value(request.body?.summary, 900);
  const duration = value(request.body?.duration, 30), audioPath = value(request.body?.audioPath, 300);
  const coverPath = value(request.body?.coverPath, 300);
  if (!number || !title || !date || !/^podcast\/audio\/[A-Za-z0-9._-]+$/.test(audioPath)) return send(response, 400, { error: 'Completa número, título, fecha y un archivo de audio válido.' });
  if (coverPath && !/^podcast\/covers\/[A-Za-z0-9._-]+$/.test(coverPath)) return send(response, 400, { error: 'La portada no es válida.' });
  try {
    for (const episode of (await listEpisodes()).filter(item => item.isLatest)) {
      const { id, isLatest, ...fields } = episode;
      await firestore(`podcastEpisodes/${id}`, { method: 'PATCH', body: JSON.stringify(documentFields({ ...fields, isLatest: 'false' })) });
      if (episode.audioPath) await updateEpisodeAudioAccess(episode.audioPath, false);
    }
    const id = crypto.randomUUID(), publishedAt = new Date().toISOString();
    const episode = { number, title, date, summary, duration, audioPath, coverPath, publishedAt, isLatest: 'true' };
    await firestore(`podcastEpisodes/${id}`, { method: 'PATCH', body: JSON.stringify(documentFields(episode)) });
    await updateEpisodeAudioAccess(audioPath, true);
    return send(response, 201, { ok: true, episode: { id, ...episode, isLatest: true } });
  } catch (error) {
    console.error('Episode publish failed:', error.message);
    return send(response, 503, { error: 'No pudimos publicar el episodio ahora.' });
  }
}

module.exports = async (request, response) => {
  if (request.query?.route === 'blog-posts') return handleBlogPosts(request, response);
  if (request.query?.route === 'episodes') return handleEpisodes(request, response);
  if (request.method !== 'POST') return send(response, 405, { error: 'Método no permitido.' });
  let user;
  try { user = await requireFirebaseUser(request); } catch { return send(response, 401, { error: 'Debes iniciar sesión con Firebase.' }); }
  const { action, songs, message } = request.body || {};
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) return send(response, 503, { error: 'El servicio de cabina aún no está configurado.' });
  const form = new URLSearchParams({ email: user.email });
  if (action === 'songs' && Array.isArray(songs) && songs.length && songs.length <= 3) {
    form.set('accion', 'pedir_canciones');
    songs.forEach((song, index) => form.set(`cancion${index + 1}`, String(song).slice(0, 180)));
  } else if (action === 'message' && typeof message === 'string' && message.trim() && message.length <= 600) {
    form.set('accion', 'dejar_comentario'); form.set('comentario', message.trim());
  } else return send(response, 400, { error: 'Solicitud inválida.' });
  if (!allow(`${user.uid}:${action}`, 60 * 1000)) return send(response, 429, { error: 'Espera un minuto antes de enviar otra solicitud.' });
  const upstream = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    // Apps Script redirects after accepting a web-app POST.
    redirect: 'manual'
  });
  const received = upstream.ok || (upstream.status >= 300 && upstream.status < 400);
  if (!received) return send(response, 502, { error: 'La cabina no pudo recibir tu solicitud.' });
  return send(response, 200, { ok: true });
};
