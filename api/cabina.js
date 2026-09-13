const crypto = require('crypto');
const { requireFirebaseUser } = require('./firebase-auth');
const { allow } = require('./rate-limit');
const { firestore, documentFields } = require('./firebase-admin');
const { notifyRadioAdmin } = require('./notify-radio-admin');

function respond(response, status, body) {
  return response.status(status).json(body);
}

async function receiveAtCabina(request, response, action, fields) {
  if (request.method !== 'POST') return respond(response, 405, { error: 'Método no permitido.' });

  let user;
  try {
    user = await requireFirebaseUser(request);
  } catch {
    return respond(response, 401, { error: 'Debes iniciar sesión para enviar esta solicitud.' });
  }

  if (!allow(`${user.uid}:${action}`, 15 * 1000)) {
    return respond(response, 429, { error: 'Espera 15 segundos antes de enviar otra solicitud.' });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const record = {
    type: action,
    status: 'nueva',
    uid: user.uid,
    email: user.email || '',
    name: user.name || '',
    createdAt: now,
    updatedAt: now,
    ...fields
  };

  try {
    await firestore(`cabinaRequests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(documentFields(record))
    });
  } catch (error) {
    console.error(`Cabina ${action} failed:`, error.message);
    return respond(response, 503, { error: 'La cabina no está disponible por ahora. Inténtalo nuevamente.' });
  }

  const isSongRequest = action === 'pedir_canciones';
  const summary = isSongRequest
    ? `${user.name || user.email} envió una solicitud de canción.`
    : `${user.name || user.email} dejó un mensaje.`;
  notifyRadioAdmin(isSongRequest ? 'Nueva solicitud de canción' : 'Nuevo mensaje para la radio', summary).catch(() => {});
  return respond(response, 200, { ok: true, id, status: 'nueva' });
}

module.exports = { receiveAtCabina, respond };
