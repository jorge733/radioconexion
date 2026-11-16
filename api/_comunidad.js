// Utilidades compartidas de las funciones de la comunidad.
// Vercel no publica como ruta los archivos que empiezan con "_".
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDn9VYTp8VfsxWQADAtozRmrCySzlETwas';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'radio-conexion-e924e';
const ADMIN_EMAIL = (process.env.COMMUNITY_ADMIN_EMAIL || 'sabenedettoa@benedettowebs.cl').toLowerCase();
const FROM = process.env.COMMUNITY_EMAIL_FROM || 'Radio Conexión <comunidad@radioconexionweb.com>';
const SITE_URL = process.env.SITE_URL || 'https://www.radioconexionweb.com';
const RECENT_MS = 10 * 60 * 1000;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const bearer = request => String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');

// Google valida el token de sesión y devuelve la cuenta a la que pertenece.
async function verifiedUser(idToken) {
  if (!idToken) return null;
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  if (!result.ok) return null;
  const data = await result.json();
  return data.users?.[0] || null;
}

const isAdmin = user => Boolean(user?.emailVerified && String(user.email || '').toLowerCase() === ADMIN_EMAIL);

// Lee un documento con el token de quien llama: las reglas de Firestore deciden si puede.
async function readDoc(path, idToken) {
  const result = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  if (!result.ok) return null;
  const { fields = {} } = await result.json();
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = value.timestampValue ? Date.parse(value.timestampValue) : (value.stringValue ?? value.integerValue ?? value.booleanValue ?? null);
  }
  return out;
}

const firestoreBase = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Miembros aprobados (requiere token de administración).
async function approvedMemberIds(idToken) {
  const result = await fetch(`${firestoreBase()}:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'members' }],
      where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } }
    } })
  });
  if (!result.ok) throw new Error(`Firestore respondió ${result.status}.`);
  const rows = await result.json();
  return rows.filter(row => row.document).map(row => row.document.name.split('/').pop());
}

// Marca un campo de fecha (por ejemplo, notifiedAt) en un documento.
async function stampDoc(path, field, idToken) {
  const result = await fetch(`${firestoreBase()}/${path}?updateMask.fieldPaths=${field}&currentDocument.exists=true`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [field]: { timestampValue: new Date().toISOString() } } })
  });
  return result.ok;
}

// Envía varios correos individuales (cada persona solo ve su propia dirección).
async function sendEmails(messages) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no está configurada; no se enviaron correos.');
    return 0;
  }
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map(message => ({ from: FROM, ...message, to: [message.to] }));
    const result = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk)
    });
    if (result.ok) sent += chunk.length;
    else console.error('Resend (lote) respondió', result.status, await result.text().catch(() => ''));
  }
  return sent;
}

const isRecent = timestamp => Boolean(timestamp) && Date.now() - timestamp <= RECENT_MS;

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no está configurada; no se envió el correo.');
    return false;
  }
  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
  });
  if (!result.ok) console.error('Resend respondió', result.status, await result.text().catch(() => ''));
  return result.ok;
}

// Plantilla sencilla con el logo y los colores de la marca.
const emailLayout = body => `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1d211d;background:#f7f3ea;border-radius:16px;overflow:hidden;border:1px solid #e2dac8">
    <div style="background:#ffffff;padding:20px 24px;text-align:center;border-bottom:3px solid #c77f0d">
      <a href="${SITE_URL}/inicio" style="text-decoration:none">
        <img src="${SITE_URL}/assets/marca/logo-correo.png" width="320" height="104" alt="Radio Conexión · Conectados con tus sentidos" style="display:inline-block;width:320px;max-width:100%;height:auto;border:0">
      </a>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 16px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8a5605;font-weight:600">Comunidad</p>
      ${body}
      <p style="margin:24px 0 0;font-size:13px;color:#545b53">Conectados con tus sentidos.</p>
    </div>
  </div>`;

const button = (href, label) => `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#c77f0d;color:#1d1606;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${label}</a></p>`;

function onlyPost(request, response) {
  if (request.method === 'POST') return true;
  response.setHeader('Allow', 'POST');
  response.status(405).json({ error: 'Método no permitido.' });
  return false;
}

module.exports = { ADMIN_EMAIL, SITE_URL, escapeHtml, bearer, verifiedUser, isAdmin, readDoc, isRecent, sendEmail, sendEmails, approvedMemberIds, stampDoc, emailLayout, button, onlyPost };
