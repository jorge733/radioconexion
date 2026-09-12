const { requireFirebaseUser } = require('./firebase-auth');
const { firestore, valueOf, credential, accessToken, tokenId } = require('./firebase-admin');

const destinations = { episodio: '/episodios.html', boletin: '/noticias.html' };

module.exports = async (request, response) => {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido.' });
  let user;
  try { user = await requireFirebaseUser(request); } catch { return response.status(401).json({ error: 'Debes iniciar sesión con Firebase.' }); }
  if (!process.env.RADIO_ADMIN_EMAIL || user.email.toLowerCase() !== process.env.RADIO_ADMIN_EMAIL.toLowerCase()) return response.status(403).json({ error: 'No tienes permiso para publicar avisos.' });
  const kind = request.body?.kind;
  const title = typeof request.body?.title === 'string' ? request.body.title.trim().slice(0, 90) : '';
  const body = typeof request.body?.body === 'string' ? request.body.body.trim().slice(0, 180) : '';
  const url = typeof request.body?.url === 'string' ? request.body.url.trim().slice(0, 500) : destinations[kind];
  if (!destinations[kind] || !title || !body || !url?.startsWith('/')) return response.status(400).json({ error: 'Completa el tipo, título y mensaje del aviso.' });
  try {
    const list = await firestore('pushSubscriptions?pageSize=500');
    const documents = list.documents || [];
    const { projectId } = credential();
    const token = await accessToken();
    let sent = 0;
    await Promise.all(documents.map(async (document) => {
      const deviceToken = valueOf(document, 'token');
      if (!deviceToken) return;
      const result = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: deviceToken, notification: { title, body }, data: { url }, webpush: { fcm_options: { link: url } } } })
      });
      if (result.ok) { sent += 1; return; }
      const details = await result.json().catch(() => ({}));
      if (details.error?.status === 'NOT_FOUND' || details.error?.status === 'UNREGISTERED') await firestore(`pushSubscriptions/${tokenId(deviceToken)}`, { method: 'DELETE' }).catch(() => {});
    }));
    return response.status(200).json({ ok: true, sent });
  } catch (error) {
    console.error('Push send failed:', error.message);
    return response.status(503).json({ error: 'No pudimos enviar los avisos ahora.' });
  }
};
