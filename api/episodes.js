const crypto = require('crypto');
const { requireFirebaseUser } = require('./firebase-auth');
const { firestore, documentFields, valueOf, credential, accessToken } = require('./firebase-admin');

function send(response, status, body) { response.status(status).json(body); }
function asString(value, limit = 500) { return typeof value === 'string' ? value.trim().slice(0, limit) : ''; }
function episodeFrom(document) {
  return {
    id: document.name.split('/').pop(), number: valueOf(document, 'number'), title: valueOf(document, 'title'),
    date: valueOf(document, 'date'), summary: valueOf(document, 'summary'), duration: valueOf(document, 'duration'),
    audioPath: valueOf(document, 'audioPath'), coverPath: valueOf(document, 'coverPath'),
    publishedAt: valueOf(document, 'publishedAt'), isLatest: valueOf(document, 'isLatest') === 'true'
  };
}
async function admin(request, response) {
  try {
    const user = await requireFirebaseUser(request);
    const email = (process.env.RADIO_ADMIN_EMAIL || 'sabenedettoa@radioconexionweb.com').toLowerCase();
    if ((user.email || '').toLowerCase() !== email) throw new Error('FORBIDDEN');
    return user;
  } catch {
    send(response, 403, { error: 'Solo el equipo de Radio Conexión puede publicar episodios.' });
    return null;
  }
}
async function updateObjectAccess(path, isPublic) {
  const { projectId } = credential();
  const token = await accessToken();
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
  const object = encodeURIComponent(path);
  const result = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${object}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata: { isPublic: isPublic ? 'true' : 'false' } })
  });
  if (!result.ok) throw new Error('No pudimos actualizar el acceso del audio.');
}
async function listEpisodes() {
  const result = await firestore('podcastEpisodes?pageSize=200&orderBy=publishedAt%20desc');
  return (result.documents || []).map(episodeFrom);
}
module.exports = async (request, response) => {
  if (request.method === 'GET') {
    try { return send(response, 200, { episodes: await listEpisodes() }); }
    catch (error) { console.error('Episodes list failed:', error.message); return send(response, 200, { episodes: [] }); }
  }
  if (request.method !== 'POST') return send(response, 405, { error: 'Método no permitido.' });
  if (!await admin(request, response)) return;
  const number = asString(request.body?.number, 12);
  const title = asString(request.body?.title, 140);
  const date = asString(request.body?.date, 10);
  const summary = asString(request.body?.summary, 900);
  const duration = asString(request.body?.duration, 30);
  const audioPath = asString(request.body?.audioPath, 300);
  const coverPath = asString(request.body?.coverPath, 300);
  if (!number || !title || !date || !audioPath || !/^podcast\/audio\/[A-Za-z0-9._-]+$/.test(audioPath)) {
    return send(response, 400, { error: 'Completa número, título, fecha y un archivo de audio válido.' });
  }
  if (coverPath && !/^podcast\/covers\/[A-Za-z0-9._-]+$/.test(coverPath)) return send(response, 400, { error: 'La portada no es válida.' });
  try {
    const previous = await listEpisodes();
    for (const episode of previous.filter(item => item.isLatest)) {
      const { id, isLatest, ...fields } = episode;
      await firestore(`podcastEpisodes/${id}`, { method: 'PATCH', body: JSON.stringify(documentFields({ ...fields, isLatest: 'false' })) });
      if (episode.audioPath) await updateObjectAccess(episode.audioPath, false);
    }
    const id = crypto.randomUUID();
    const publishedAt = new Date().toISOString();
    const episode = { number, title, date, summary, duration, audioPath, coverPath, publishedAt, isLatest: 'true' };
    await firestore(`podcastEpisodes/${id}`, { method: 'PATCH', body: JSON.stringify(documentFields(episode)) });
    await updateObjectAccess(audioPath, true);
    return send(response, 201, { ok: true, episode: { id, ...episode, isLatest: true } });
  } catch (error) {
    console.error('Episode publish failed:', error.message);
    return send(response, 503, { error: 'No pudimos publicar el episodio ahora.' });
  }
};
