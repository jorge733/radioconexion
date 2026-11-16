// Envía un correo a la administración cuando alguien pide unirse a la comunidad.
// La solicitud ya quedó guardada en Firestore; esto solo avisa.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDn9VYTp8VfsxWQADAtozRmrCySzlETwas';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'radio-conexion-e924e';
const ADMIN_EMAIL = process.env.COMMUNITY_ADMIN_EMAIL || 'sabenedettoa@benedettowebs.cl';
const FROM = process.env.COMMUNITY_EMAIL_FROM || 'Radio Conexión <comunidad@radioconexionweb.com>';
const SITE_URL = process.env.SITE_URL || 'https://www.radioconexionweb.com';
const RECENT_MS = 10 * 60 * 1000;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

async function verifiedUser(idToken) {
  // Google valida el token y nos devuelve la cuenta a la que pertenece.
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  if (!result.ok) return null;
  const data = await result.json();
  return data.users?.[0] || null;
}

async function memberRequest(uid, idToken) {
  // Leemos la solicitud con el token de la propia persona: las reglas de Firestore lo permiten.
  const result = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/members/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  if (!result.ok) return null;
  const { fields = {} } = await result.json();
  return {
    name: fields.name?.stringValue || '',
    bio: fields.bio?.stringValue || '',
    status: fields.status?.stringValue || '',
    createdAt: fields.createdAt?.timestampValue ? Date.parse(fields.createdAt.timestampValue) : 0
  };
}

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método no permitido.' });
  }
  const idToken = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!idToken) return response.status(401).json({ error: 'Falta la sesión.' });

  try {
    const user = await verifiedUser(idToken);
    if (!user?.localId) return response.status(401).json({ error: 'Sesión no válida.' });

    const member = await memberRequest(user.localId, idToken);
    // Solo avisamos de solicitudes pendientes recién creadas, para evitar correos repetidos.
    if (!member || member.status !== 'pending' || Date.now() - member.createdAt > RECENT_MS) {
      return response.status(200).json({ sent: false });
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY no está configurada; no se envió el aviso.');
      return response.status(200).json({ sent: false });
    }

    const name = member.name || user.displayName || 'Alguien';
    const html = `
      <p>Hola,</p>
      <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(user.email)}) pidió unirse a la comunidad de Radio Conexión.</p>
      ${member.bio ? `<blockquote style="border-left:3px solid #c77f0d;margin:0;padding-left:12px;color:#545b53">${escapeHtml(member.bio)}</blockquote>` : ''}
      <p><a href="${SITE_URL}/admin" style="color:#8a5605;font-weight:600">Revisar la solicitud en el panel</a></p>`;
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [ADMIN_EMAIL], subject: `Nueva solicitud para la comunidad: ${name}`,
        html, text: `${name} (${user.email}) pidió unirse a la comunidad de Radio Conexión. Revísala en ${SITE_URL}/admin`
      })
    });
    if (!sent.ok) {
      console.error('Resend respondió', sent.status, await sent.text().catch(() => ''));
      return response.status(200).json({ sent: false });
    }
    return response.status(200).json({ sent: true });
  } catch (error) {
    console.error('Aviso de solicitud falló:', error.message);
    return response.status(200).json({ sent: false });
  }
};
