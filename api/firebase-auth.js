const crypto = require('crypto');

let certificates;
let certificatesUntil = 0;

async function getCertificates() {
  if (certificates && Date.now() < certificatesUntil) return certificates;
  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('No fue posible obtener las claves de Firebase.');
  certificates = await response.json();
  const maxAge = Number((response.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  certificatesUntil = Date.now() + maxAge * 1000;
  return certificates;
}

function decode(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function requireFirebaseUser(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!token || !projectId) throw new Error('UNAUTHORIZED');
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || !signaturePart) throw new Error('UNAUTHORIZED');
  const header = decode(headerPart);
  const payload = decode(payloadPart);
  if (header.alg !== 'RS256' || !header.kid || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.exp * 1000 < Date.now()) throw new Error('UNAUTHORIZED');
  const cert = (await getCertificates())[header.kid];
  if (!cert || !crypto.createVerify('RSA-SHA256').update(`${headerPart}.${payloadPart}`).end().verify(cert, signaturePart, 'base64url')) throw new Error('UNAUTHORIZED');
  if (!payload.email || !payload.email_verified) throw new Error('UNAUTHORIZED');
  return { uid: payload.user_id || payload.sub, email: payload.email, name: payload.name || '' };
}

module.exports = { requireFirebaseUser };
