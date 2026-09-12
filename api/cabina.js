const { requireFirebaseUser } = require('./firebase-auth');
const { allow } = require('./rate-limit');

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
  if (!scriptUrl) return respond(response, 503, { error: 'La cabina aún no está configurada.' });

  const form = new URLSearchParams({ accion: action, email: user.email, ...fields });
  try {
    // Apps Script returns a redirect only after receiving the POST.
    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      redirect: 'manual'
    });
    const accepted = upstream.ok || (upstream.status >= 300 && upstream.status < 400);
    if (!accepted) throw new Error(`La cabina respondió ${upstream.status}.`);
    return respond(response, 200, { ok: true });
  } catch (error) {
    console.error(`Cabina ${action} failed:`, error.message);
    return respond(response, 502, { error: 'No pudimos entregar tu solicitud a la cabina. Inténtalo nuevamente.' });
  }
}

module.exports = { receiveAtCabina, respond };
