const crypto = require('crypto');
const { requireFirebaseUser, allow } = require('./firebase-auth');
const { firestore, documentFields, valueOf } = require('./firebase-admin');

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

module.exports = async (request, response) => {
  if (request.query?.route === 'blog-posts') return handleBlogPosts(request, response);
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
