const { requireFirebaseUser } = require('./firebase-auth');
const { allow } = require('./rate-limit');

function send(response, status, body) { response.status(status).json(body); }

module.exports = async (request, response) => {
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
