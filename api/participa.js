// Formulario "Participa en la radio": cualquier persona (sin cuenta) puede postular para salir en un episodio.
// Guarda la postulación en Firestore (las reglas validan cada campo) y avisa por correo a la administración.
const crypto = require('crypto');
const { ADMIN_EMAIL, SITE_URL, firestoreBase, escapeHtml, sendEmail, emailLayout, button, onlyPost } = require('./_comunidad');

const TYPES = {
  historia: 'Contar mi historia',
  entrevista: 'Proponer una entrevista',
  talento: 'Mostrar mi música o talento',
  tema: 'Proponer un tema o noticia positiva',
  seccion: 'Hacer una sección o co-conducir',
  otro: 'Otra idea'
};
const FORMATS = { distancia: 'A distancia (audio, llamada o videollamada)', estudio: 'En el estudio', cualquiera: 'Cualquiera de las dos' };
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,180}\.[A-Za-z]{2,24}$/;
const MIN_FILL_MS = 4000; // menos que esto es casi seguro un robot

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const oneLine = (value, max) => clean(value, max).replace(/\s+/g, ' ');

function validate(body) {
  const data = {
    name: oneLine(body.name, 80),
    email: oneLine(body.email, 254).toLowerCase(),
    phone: oneLine(body.phone, 30),
    place: oneLine(body.place, 80),
    type: String(body.type || ''),
    idea: clean(body.idea, 1500),
    format: String(body.format || ''),
    links: oneLine(body.links, 300)
  };
  if (!data.name) return { error: 'Escribe tu nombre.' };
  if (!EMAIL_RE.test(data.email)) return { error: 'Revisa tu correo: no parece válido.' };
  if (data.phone && !/^[0-9+()\s.-]{6,30}$/.test(data.phone)) return { error: 'Revisa tu teléfono: usa solo números, espacios y el signo +.' };
  if (!TYPES[data.type]) return { error: 'Elige cómo te gustaría participar.' };
  if (data.idea.length < 20) return { error: 'Cuéntanos tu idea con un poco más de detalle (al menos 20 caracteres).' };
  if (!FORMATS[data.format]) return { error: 'Elige cómo prefieres grabar.' };
  if (body.consent !== true) return { error: 'Necesitamos tu autorización para contactarte.' };
  return { data };
}

// Crea el documento con la hora del servidor (las reglas exigen createdAt == request.time).
async function savePostulation(data) {
  const id = crypto.randomBytes(15).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 20) || String(Date.now());
  const name = `${firestoreBase().replace('https://firestore.googleapis.com/v1/', '')}/participations/${id}`;
  const fields = Object.fromEntries(Object.entries({ ...data, status: 'nuevo' }).map(([key, value]) => [key, { stringValue: value }]));
  fields.consent = { booleanValue: true };
  const result = await fetch(`${firestoreBase()}:commit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{
      update: { name, fields },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      currentDocument: { exists: false }
    }] })
  });
  if (!result.ok) throw new Error(`Firestore respondió ${result.status}: ${await result.text().catch(() => '')}`);
  return id;
}

module.exports = async (request, response) => {
  if (!onlyPost(request, response)) return;
  let body = request.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return response.status(400).json({ error: 'Solicitud no válida.' });

  // Trampa para robots: un campo oculto que las personas no ven, y un tiempo mínimo de llenado.
  // Respondemos "ok" para no darles pistas, pero no guardamos nada.
  const elapsed = Date.now() - Number(body.startedAt || 0);
  if (body.website || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return response.status(200).json({ ok: true });

  const { data, error } = validate(body);
  if (error) return response.status(400).json({ error });

  try {
    await savePostulation(data);
  } catch (saveError) {
    console.error('No se pudo guardar la postulación:', saveError.message);
    return response.status(500).json({ error: 'No pudimos guardar tu postulación. Inténtalo de nuevo en unos minutos.' });
  }

  // El aviso por correo es un extra: si falla, la postulación ya quedó guardada en el panel.
  try {
    const rows = [
      ['Cómo quiere participar', TYPES[data.type]],
      ['Correo', data.email],
      ['Teléfono', data.phone || '—'],
      ['Desde', data.place || '—'],
      ['Prefiere grabar', FORMATS[data.format]],
      ['Enlaces', data.links || '—']
    ];
    await sendEmail({
      to: ADMIN_EMAIL,
      replyTo: data.email,
      subject: `Quiere participar en la radio: ${data.name}`,
      html: emailLayout(`
        <p><strong>${escapeHtml(data.name)}</strong> quiere ser parte del próximo episodio.</p>
        <blockquote style="border-left:3px solid #c77f0d;margin:0 0 16px;padding-left:12px;color:#545b53;white-space:pre-line">${escapeHtml(data.idea)}</blockquote>
        <table style="border-collapse:collapse;font-size:14px">${rows.map(([label, value]) => `
          <tr><td style="padding:4px 12px 4px 0;color:#545b53;vertical-align:top">${label}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`).join('')}
        </table>
        <p style="font-size:13px;color:#545b53">Responde este correo para escribirle directamente.</p>
        ${button(`${SITE_URL}/admin`, 'Ver en el panel')}`, 'Participa en la radio'),
      text: `${data.name} quiere participar en Radio Conexión.\n\n${data.idea}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nResponde este correo para escribirle. Panel: ${SITE_URL}/admin`
    });
  } catch (mailError) {
    console.error('Aviso de postulación falló:', mailError.message);
  }
  return response.status(200).json({ ok: true });
};
