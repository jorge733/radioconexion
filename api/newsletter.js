const { requireFirebaseUser, allow } = require('./firebase-auth');

module.exports = async (request, response) => {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido.' });
  let user;
  try { user = await requireFirebaseUser(request); } catch { return response.status(401).json({ error: 'Debes iniciar sesión con Firebase.' }); }
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const groupEmail = process.env.GOOGLE_GROUP_EMAIL;
  const sharedSecret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (!scriptUrl || !groupEmail || !sharedSecret) return response.status(503).json({ error: 'El boletín aún no está configurado.' });
  if (!allow(`${user.uid}:newsletter`, 5 * 60 * 1000)) return response.status(200).json({ ok: true });
  try {
    const form = new URLSearchParams({ accion: 'suscribir_boletin', email: user.email, grupo: groupEmail, secreto: sharedSecret });
    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      // Apps Script redirects after it receives a web-app POST.
      redirect: 'manual'
    });
    const accepted = upstream.ok || (upstream.status >= 300 && upstream.status < 400);
    if (!accepted) throw new Error(`Apps Script respondió ${upstream.status}`);
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Newsletter enrollment failed:', error.message);
    return response.status(502).json({ error: 'No pudimos activar el boletín.' });
  }
};
