const crypto = require('crypto');

function credential() {
  const email = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!email || !privateKey || !projectId) throw new Error('Las notificaciones aún no están configuradas.');
  return { email, privateKey, projectId };
}

function base64url(value) { return Buffer.from(value).toString('base64url'); }

async function accessToken() {
  const { email, privateKey } = credential();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  const input = `${header}.${claims}`;
  const signature = crypto.createSign('RSA-SHA256').update(input).end().sign(privateKey, 'base64url');
  const result = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${input}.${signature}` })
  });
  if (!result.ok) throw new Error('No fue posible autenticar las notificaciones.');
  return (await result.json()).access_token;
}

async function firestore(path, options = {}) {
  const { projectId } = credential();
  const token = await accessToken();
  const result = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!result.ok) throw new Error(`Firestore respondió ${result.status}.`);
  return result.status === 204 ? null : result.json();
}

function field(value) { return { stringValue: String(value) }; }
function documentFields(values) { return { fields: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, field(value)])) }; }
function valueOf(document, key) { return document.fields?.[key]?.stringValue || ''; }
function tokenId(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

module.exports = { firestore, documentFields, valueOf, tokenId, credential, accessToken };
