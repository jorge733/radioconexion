const { requireFirebaseUser, allow } = require('./firebase-auth');

// Boletín de Radio Conexión enviado con Resend (https://resend.com/docs).
// Variables: RESEND_API_KEY, RESEND_SEGMENT_ID y, opcionales, NEWSLETTER_FROM y NEWSLETTER_REPLY_TO.

const RESEND = 'https://api.resend.com';
const SITE = 'https://www.radioconexionweb.com';
const FROM = () => process.env.NEWSLETTER_FROM || 'Radio Conexión <boletin@radioconexionweb.com>';
const ADMIN = () => (process.env.RADIO_ADMIN_EMAIL || 'sabenedettoa@radioconexionweb.com').toLowerCase();
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const MAX_ITEMS = 6;
const IMPORT_BATCH = 20;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (response, status, body) => response.status(status).json(body);

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_SEGMENT_ID);
}

// Llamada a Resend con un reintento si se alcanza el límite de solicitudes.
async function resend(path, { method = 'GET', body } = {}, retry = true) {
  const result = await fetch(`${RESEND}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (result.status === 429 && retry) {
    await sleep(1100);
    return resend(path, { method, body }, false);
  }
  const data = await result.json().catch(() => ({}));
  return { ok: result.ok, status: result.status, data };
}

/* ---------- Contactos ---------- */

async function contactStatus(email) {
  const { ok, status, data } = await resend(`/contacts/${encodeURIComponent(email)}`);
  if (status === 404) return { exists: false, subscribed: false };
  if (!ok) throw new Error(data.message || `Resend respondió ${status}`);
  return { exists: true, subscribed: !data.unsubscribed };
}

async function addToSegment(email) {
  const segment = process.env.RESEND_SEGMENT_ID;
  const { ok, status, data } = await resend(`/contacts/${encodeURIComponent(email)}/segments/${segment}`, { method: 'POST' });
  // Si ya pertenece al segmento, Resend puede responder con un conflicto: no es un error para nosotros.
  if (!ok && status !== 409 && status !== 422) throw new Error(data.message || `Resend respondió ${status}`);
}

async function subscribe(email, name = '', { keepUnsubscribed = false } = {}) {
  const current = await contactStatus(email);
  if (!current.exists) {
    const [firstName, ...rest] = String(name).trim().split(/\s+/);
    const { ok, status, data } = await resend('/contacts', {
      method: 'POST',
      body: {
        email,
        ...(firstName ? { first_name: firstName.slice(0, 60) } : {}),
        ...(rest.length ? { last_name: rest.join(' ').slice(0, 80) } : {}),
        unsubscribed: false,
        segments: [{ id: process.env.RESEND_SEGMENT_ID }]
      }
    });
    if (!ok) throw new Error(data.message || `Resend respondió ${status}`);
    return 'added';
  }
  if (!keepUnsubscribed && !current.subscribed) {
    const { ok, status, data } = await resend(`/contacts/${encodeURIComponent(email)}`, { method: 'PATCH', body: { unsubscribed: false } });
    if (!ok) throw new Error(data.message || `Resend respondió ${status}`);
  }
  await addToSegment(email);
  return current.subscribed ? 'existing' : (keepUnsubscribed ? 'unsubscribed' : 'resubscribed');
}

async function unsubscribe(email) {
  const { ok, status, data } = await resend(`/contacts/${encodeURIComponent(email)}`, { method: 'PATCH', body: { unsubscribed: true } });
  if (!ok && status !== 404) throw new Error(data.message || `Resend respondió ${status}`);
}

/* ---------- Plantilla del correo ---------- */

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
// Convierte texto plano en párrafos con el mismo estilo (los clientes de correo no heredan estilos).
const paragraphs = (value, style) => escapeHTML(value).split(/\r?\n\s*\r?\n/).filter(part => part.trim())
  .map(part => `<p style="${style}">${part.trim().replace(/\r?\n/g, '<br>')}</p>`).join('');
const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

function safeUrl(value) {
  const raw = text(value, 600);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

// Valida y limpia lo que llega desde el panel. Devuelve { newsletter } o { error }.
function readNewsletter(input = {}) {
  const subject = text(input.subject, 120);
  const preheader = text(input.preheader, 160);
  const intro = text(input.intro, 2000);
  const closing = text(input.closing, 800);
  const items = (Array.isArray(input.items) ? input.items : []).slice(0, MAX_ITEMS).map(item => ({
    source: text(item?.source, 60),
    title: text(item?.title, 160),
    summary: text(item?.summary, 900),
    url: safeUrl(item?.url),
    image: safeUrl(item?.image)
  })).filter(item => item.title);
  if (!subject) return { error: 'Escribe el asunto del boletín.' };
  if (!items.length) return { error: 'Agrega al menos una noticia con título.' };
  const badLink = (Array.isArray(input.items) ? input.items : []).find(item => (text(item?.url, 600) && !safeUrl(item.url)) || (text(item?.image, 600) && !safeUrl(item.image)));
  if (badLink) return { error: 'Revisa los enlaces: deben comenzar con https://.' };
  return { newsletter: { subject, preheader, intro, closing, items } };
}

function renderNewsletter({ subject, preheader, intro, closing, items }, { unsubscribeUrl = '{{{RESEND_UNSUBSCRIBE_URL}}}' } = {}) {
  const date = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'America/Santiago' }).format(new Date());
  const font = "font-family:Georgia,'Times New Roman',serif;";
  const sans = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";
  const title = "font-family:'Unica One','Arial Narrow',Arial,sans-serif;letter-spacing:.5px;";
  const news = items.map((item, index) => `
          <tr><td style="padding:0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2dac8;">
              <tr><td style="padding:28px 0 6px;">
                ${item.image ? `<img src="${escapeHTML(item.image)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:12px;margin:0 0 18px;">` : ''}
                <p style="margin:0 0 8px;${sans}font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:#8a5605;">${String(index + 1).padStart(2, '0')}${item.source ? ` · ${escapeHTML(item.source)}` : ''}</p>
                <h2 style="margin:0 0 10px;${title}font-size:25px;line-height:1.2;font-weight:400;color:#1d211d;">${item.url ? `<a href="${escapeHTML(item.url)}" style="color:#1d211d;text-decoration:none;">${escapeHTML(item.title)}</a>` : escapeHTML(item.title)}</h2>
                ${item.summary ? paragraphs(item.summary, `margin:0 0 14px;${sans}font-size:16px;line-height:1.6;color:#4f564e;`) : ''}
                ${item.url ? `<p style="margin:0 0 8px;${sans}font-size:15px;font-weight:bold;"><a href="${escapeHTML(item.url)}" style="color:#8a5605;">Leer la noticia completa →</a></p>` : ''}
              </td></tr>
            </table>
          </td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHTML(subject)}</title>
<style>@font-face{font-family:'Unica One';src:url('${SITE}/assets/fuentes/UnicaOne-Regular.ttf') format('truetype');font-weight:400;font-style:normal;}</style>
</head>
<body style="margin:0;padding:0;background:#f7f3ea;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHTML(preheader || items[0]?.title || subject)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ea;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fffdf8;border:1px solid #e2dac8;border-radius:18px;overflow:hidden;">
        <tr><td style="background:#1b2420;padding:28px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:14px;"><img src="${SITE}/assets/marca/logo-96.png" width="52" height="52" alt="Radio Conexión" style="display:block;border-radius:50%;background:#ffffff;"></td>
            <td>
              <p style="margin:0;${sans}font-size:20px;letter-spacing:3px;text-transform:uppercase;color:#e8b04a;">Radio Conexión</p>
              <p style="margin:4px 0 0;${sans}font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#c9cdc3;">Boletín · ${escapeHTML(date)}</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:34px 32px 10px;">
          <h1 style="margin:0 0 16px;${title}font-size:34px;line-height:1.15;font-weight:400;color:#1d211d;">${escapeHTML(subject)}</h1>
          ${intro ? paragraphs(intro, `margin:0 0 14px;${sans}font-size:17px;line-height:1.65;color:#4f564e;`) : ''}
        </td></tr>
        ${news}
        <tr><td style="padding:12px 32px 34px;">
          ${closing ? paragraphs(closing, `margin:16px 0 0;${sans}font-size:16px;line-height:1.6;color:#4f564e;`) : ''}
          <p style="margin:22px 0 0;${font}font-size:17px;font-style:italic;color:#8a5605;">Conectados con tus sentidos.</p>
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
        <tr><td style="padding:22px 24px;${sans}font-size:12px;line-height:1.6;color:#6b7168;text-align:center;">
          Recibes este correo porque te suscribiste al boletín de Radio Conexión.<br>
          <a href="${unsubscribeUrl}" style="color:#6b7168;">Darme de baja</a> · <a href="${SITE}/suscriptores" style="color:#6b7168;">Administrar mi suscripción</a> · <a href="${SITE}/inicio" style="color:#6b7168;">radioconexionweb.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ---------- Acciones del equipo ---------- */

async function sendTest(newsletter, to) {
  const { ok, status, data } = await resend('/emails', {
    method: 'POST',
    body: {
      from: FROM(),
      to: [to],
      subject: `[Prueba] ${newsletter.subject}`,
      html: renderNewsletter(newsletter, { unsubscribeUrl: `${SITE}/suscriptores` }),
      ...(process.env.NEWSLETTER_REPLY_TO ? { reply_to: process.env.NEWSLETTER_REPLY_TO } : {})
    }
  });
  if (!ok) throw new Error(data.message || `Resend respondió ${status}`);
  return data.id;
}

async function sendBroadcast(newsletter, scheduledAt) {
  const stamp = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Santiago' }).format(scheduledAt || new Date());
  const { ok, status, data } = await resend('/broadcasts', {
    method: 'POST',
    body: {
      segment_id: process.env.RESEND_SEGMENT_ID,
      from: FROM(),
      subject: newsletter.subject,
      name: `${newsletter.subject} · ${stamp}`.slice(0, 200),
      html: renderNewsletter(newsletter),
      ...(process.env.NEWSLETTER_REPLY_TO ? { reply_to: process.env.NEWSLETTER_REPLY_TO } : {}),
      send: true,
      ...(scheduledAt ? { scheduled_at: scheduledAt.toISOString() } : {})
    }
  });
  if (!ok) throw new Error(data.message || `Resend respondió ${status}`);
  return data.id;
}

async function history() {
  const { ok, status, data } = await resend('/broadcasts');
  if (!ok) throw new Error(data.message || `Resend respondió ${status}`);
  return (data.data || []).slice(0, 10).map(item => ({
    id: item.id, name: item.name, status: item.status,
    createdAt: item.created_at, scheduledAt: item.scheduled_at, sentAt: item.sent_at
  }));
}

async function importContacts(list) {
  const results = [];
  for (const raw of list.slice(0, IMPORT_BATCH)) {
    const email = String(raw || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || /\.\.|^\.|\.@|@\./.test(email)) { results.push({ email, result: 'invalid' }); continue; }
    try {
      // Si alguien ya se había dado de baja, se respeta su decisión.
      results.push({ email, result: await subscribe(email, '', { keepUnsubscribed: true }) });
    } catch (error) {
      results.push({ email, result: 'error', message: error.message });
    }
    await sleep(600);
  }
  return results;
}

async function handleAdmin(action, body, user, response) {
  if (action === 'preview') {
    const { newsletter, error } = readNewsletter(body.newsletter);
    if (error) return send(response, 400, { error });
    return send(response, 200, { html: renderNewsletter(newsletter, { unsubscribeUrl: '#' }) });
  }
  if (action === 'history') return send(response, 200, { broadcasts: await history() });
  if (action === 'import') {
    const emails = Array.isArray(body.emails) ? body.emails : [];
    if (!emails.length) return send(response, 400, { error: 'No hay correos para importar.' });
    if (emails.length > IMPORT_BATCH) return send(response, 400, { error: `Importa como máximo ${IMPORT_BATCH} correos por solicitud.` });
    return send(response, 200, { results: await importContacts(emails) });
  }
  const { newsletter, error } = readNewsletter(body.newsletter);
  if (error) return send(response, 400, { error });
  if (action === 'test') {
    if (!allow(`${user.uid}:newsletter-test`, 10 * 1000)) return send(response, 429, { error: 'Espera unos segundos antes de enviar otra prueba.' });
    return send(response, 200, { ok: true, id: await sendTest(newsletter, user.email) });
  }
  if (action === 'send') {
    let scheduledAt = null;
    if (body.scheduledAt) {
      scheduledAt = new Date(body.scheduledAt);
      const now = Date.now();
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < now + 2 * 60 * 1000) return send(response, 400, { error: 'Elige una fecha y hora al menos 2 minutos en el futuro.' });
      if (scheduledAt.getTime() > now + 30 * 24 * 60 * 60 * 1000) return send(response, 400, { error: 'Puedes programar el boletín hasta con 30 días de anticipación.' });
    }
    if (!allow(`${user.uid}:newsletter-send`, 60 * 1000)) return send(response, 429, { error: 'Ya enviaste un boletín hace un momento. Espera un minuto.' });
    return send(response, 200, { ok: true, id: await sendBroadcast(newsletter, scheduledAt), scheduledAt: scheduledAt?.toISOString() || null });
  }
  return send(response, 400, { error: 'Acción no válida.' });
}

/* ---------- Entrada ---------- */

module.exports = async (request, response) => {
  if (!['GET', 'POST'].includes(request.method)) return send(response, 405, { error: 'Método no permitido.' });
  let user;
  try { user = await requireFirebaseUser(request); } catch { return send(response, 401, { error: 'Debes iniciar sesión para continuar.' }); }
  const email = user.email.toLowerCase();
  const isAdmin = email === ADMIN();
  // El navegador usa esta respuesta para saber si muestra los paneles del equipo.
  if (!configured()) {
    if (request.method === 'GET') return send(response, 200, { configured: false, subscribed: false, isAdmin });
    return send(response, 503, { error: 'El boletín aún no está configurado.', configured: false });
  }
  try {
    if (request.method === 'GET') {
      const status = await contactStatus(email);
      return send(response, 200, { configured: true, subscribed: status.subscribed, isAdmin });
    }
    const body = request.body || {};
    const action = body.action;
    if (action === 'subscribe' || action === 'unsubscribe') {
      if (!allow(`${user.uid}:newsletter-toggle`, 3 * 1000)) return send(response, 429, { error: 'Espera un momento antes de volver a intentarlo.' });
      if (action === 'subscribe') await subscribe(email, user.name);
      else await unsubscribe(email);
      return send(response, 200, { ok: true, subscribed: action === 'subscribe' });
    }
    if (!isAdmin) return send(response, 403, { error: 'Esta acción es solo para el equipo de Radio Conexión.' });
    return await handleAdmin(action, body, user, response);
  } catch (error) {
    console.error('Newsletter action failed:', error.message);
    return send(response, 502, { error: 'No pudimos completar la acción con el servicio de correo. Inténtalo nuevamente.' });
  }
};

module.exports.renderNewsletter = renderNewsletter;
module.exports.readNewsletter = readNewsletter;
