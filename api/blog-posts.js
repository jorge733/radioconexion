const crypto = require('crypto');
const { requireFirebaseUser } = require('./firebase-auth');
const { firestore, documentFields, valueOf } = require('./firebase-admin');

function respond(response, status, body) {
  return response.status(status).json(body);
}

function postFromDocument(document) {
  return {
    id: document.name.split('/').pop(),
    url: valueOf(document, 'url'),
    publishedAt: valueOf(document, 'publishedAt')
  };
}

function canonicalInstagramUrl(value) {
  try {
    const url = new URL(value);
    if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) return '';
    const match = url.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/);
    return match ? `https://www.instagram.com/p/${match[1]}/` : '';
  } catch {
    return '';
  }
}

async function adminUser(request, response) {
  try {
    const user = await requireFirebaseUser(request);
    const adminEmail = (process.env.RADIO_ADMIN_EMAIL || 'sabenedettoa@radioconexionweb.com').toLowerCase();
    if ((user.email || '').toLowerCase() !== adminEmail) {
      respond(response, 403, { error: 'Este panel es solo para el equipo de Radio Conexión.' });
      return null;
    }
    return user;
  } catch {
    respond(response, 401, { error: 'Debes iniciar sesión con la cuenta de la radio.' });
    return null;
  }
}

module.exports = async (request, response) => {
  if (request.method === 'GET') {
    try {
      const result = await firestore('blogPosts?pageSize=50&orderBy=publishedAt%20desc');
      return respond(response, 200, { posts: (result.documents || []).map(postFromDocument) });
    } catch (error) {
      console.error('Blog posts list failed:', error.message);
      return respond(response, 200, { posts: [] });
    }
  }

  if (!await adminUser(request, response)) return;

  if (request.method === 'POST') {
    const url = canonicalInstagramUrl(typeof request.body?.url === 'string' ? request.body.url.trim() : '');
    if (!url) return respond(response, 400, { error: 'Pega un enlace válido de una publicación de Instagram.' });
    try {
      const existing = await firestore('blogPosts?pageSize=50&orderBy=publishedAt%20desc');
      if ((existing.documents || []).some((document) => valueOf(document, 'url') === url)) {
        return respond(response, 200, { ok: true, duplicate: true });
      }
      const id = crypto.randomUUID();
      const publishedAt = new Date().toISOString();
      await firestore(`blogPosts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(documentFields({ url, publishedAt }))
      });
      return respond(response, 201, { ok: true, post: { id, url, publishedAt } });
    } catch (error) {
      console.error('Blog post create failed:', error.message);
      return respond(response, 503, { error: 'No pudimos publicar este enlace ahora.' });
    }
  }

  if (request.method === 'DELETE') {
    const id = typeof request.body?.id === 'string' ? request.body.id : '';
    if (!/^[a-f0-9-]{36}$/i.test(id)) return respond(response, 400, { error: 'La publicación no es válida.' });
    try {
      await firestore(`blogPosts/${id}`, { method: 'DELETE' });
      return respond(response, 200, { ok: true });
    } catch (error) {
      console.error('Blog post delete failed:', error.message);
      return respond(response, 503, { error: 'No pudimos retirar esta publicación.' });
    }
  }

  return respond(response, 405, { error: 'Método no permitido.' });
};
