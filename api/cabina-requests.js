const { requireFirebaseUser } = require('./firebase-auth');
const { firestore, documentFields, valueOf } = require('./firebase-admin');

const STATUSES = new Set(['nueva', 'atendida', 'reproducida', 'descartada']);

function isRadioAdmin(email) {
  const normalized = (email || '').toLowerCase();
  const configuredAdmin = (process.env.RADIO_ADMIN_EMAIL || '').toLowerCase();
  return normalized === configuredAdmin || normalized.endsWith('@radioconexionweb.com');
}

function respond(response, status, body) {
  return response.status(status).json(body);
}

async function adminUser(request, response) {
  try {
    const user = await requireFirebaseUser(request);
    if (!isRadioAdmin(user.email)) {
      respond(response, 403, { error: 'Este panel es solo para el equipo de Radio Conexión.' });
      return null;
    }
    return user;
  } catch {
    respond(response, 401, { error: 'Debes iniciar sesión con la cuenta de la radio.' });
    return null;
  }
}

function requestFromDocument(document) {
  const values = {};
  for (const key of Object.keys(document.fields || {})) values[key] = valueOf(document, key);
  return { id: document.name.split('/').pop(), ...values };
}

module.exports = async (request, response) => {
  if (!await adminUser(request, response)) return;

  if (request.method === 'GET') {
    try {
      const result = await firestore('cabinaRequests?pageSize=100&orderBy=createdAt%20desc');
      return respond(response, 200, { requests: (result.documents || []).map(requestFromDocument) });
    } catch (error) {
      console.error('Cabina request list failed:', error.message);
      return respond(response, 503, { error: 'No pudimos cargar la bandeja de cabina.' });
    }
  }

  if (request.method === 'PATCH') {
    const id = typeof request.body?.id === 'string' ? request.body.id : '';
    const status = typeof request.body?.status === 'string' ? request.body.status : '';
    if (!/^[a-zA-Z0-9_-]{10,}$/.test(id) || !STATUSES.has(status)) {
      return respond(response, 400, { error: 'La actualización no es válida.' });
    }
    try {
      await firestore(`cabinaRequests/${id}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`, {
        method: 'PATCH',
        body: JSON.stringify(documentFields({ status, updatedAt: new Date().toISOString() }))
      });
      return respond(response, 200, { ok: true });
    } catch (error) {
      console.error('Cabina request update failed:', error.message);
      return respond(response, 503, { error: 'No pudimos actualizar esta solicitud.' });
    }
  }

  return respond(response, 405, { error: 'Método no permitido.' });
};
