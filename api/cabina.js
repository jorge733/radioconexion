const { requireFirebaseUser } = require('./firebase-auth');
const { allow } = require('./rate-limit');
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

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const sharedSecret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (!scriptUrl || !sharedSecret) return respond(response, 503, { error: 'La cabina aún no está configurada.' });

  const form = new URLSearchParams({ accion: action, email: user.email, nombre: user.name, secreto: sharedSecret, ...fields });
  try {
    // Apps Script executes doPost before redirecting its response. Sending the
    // encoded form body here is what records the request in the spreadsheet.
    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: form.toString(),
      redirect: 'follow'
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok || result.error) throw new Error(result.error || `La cabina respondió ${upstream.status}.`);
    const summary = action === 'pedir_canciones' ? `${user.name || user.email} envió una solicitud de canciones.` : `${user.name || user.email} dejó un mensaje.`;
    notifyRadioAdmin(action === 'pedir_canciones' ? 'Nueva solicitud de canción' : 'Nuevo mensaje para la radio', summary);
    return respond(response, 200, { ok: true });
  } catch (error) {
    console.error(`Cabina ${action} failed:`, error.message);
    return respond(response, 502, { error: 'No pudimos entregar tu solicitud a la cabina. Inténtalo nuevamente.' });
  }
}

module.exports = { receiveAtCabina, respond };
