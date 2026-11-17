// Avisa por correo a quien postuló a "Participa en la radio" si su postulación fue aceptada o no.
// Solo la administración puede llamarla; la postulación se lee con su token.
const { SITE_URL, escapeHtml, bearer, verifiedUser, isAdmin, readDoc, stampDoc, sendEmail, emailLayout, button, onlyPost } = require('./_comunidad');

const paragraphs = text => escapeHtml(text).split(/\n{2,}/).map(part => `<p style="white-space:pre-line">${part}</p>`).join('');

module.exports = async (request, response) => {
  if (!onlyPost(request, response)) return;
  try {
    const idToken = bearer(request);
    const user = await verifiedUser(idToken);
    if (!isAdmin(user)) return response.status(403).json({ error: 'Solo la administración puede hacer esto.' });

    const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    const id = String(body.id || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return response.status(400).json({ error: 'Postulación no válida.' });
    // Mensaje opcional de la administración (por ejemplo, fecha y forma de grabar).
    const note = String(body.message || '').trim().slice(0, 1500);

    const item = await readDoc(`participations/${id}`, idToken);
    if (!item) return response.status(200).json({ sent: false, reason: 'No se pudo leer la postulación.' });
    if (!['aceptada', 'rechazada'].includes(item.status)) return response.status(200).json({ sent: false, reason: 'La postulación aún no tiene respuesta.' });
    if (!item.email) return response.status(200).json({ sent: false, reason: 'La postulación no tiene correo.' });

    const firstName = escapeHtml(String(item.name || '').split(' ')[0].slice(0, 40) || 'hola');
    const accepted = item.status === 'aceptada';
    const noteHtml = note
      ? `<div style="border-left:3px solid #c77f0d;margin:16px 0;padding-left:12px">${paragraphs(note)}</div>`
      : '';
    const email = accepted
      ? {
          subject: '¡Tu postulación para Radio Conexión fue aceptada!',
          html: emailLayout(`
            <h1 style="margin:0 0 12px;font-size:24px">¡Vas a salir al aire, ${firstName}!</h1>
            <p>Nos encantó tu propuesta y queremos que seas parte de un próximo episodio de Radio Conexión.</p>
            ${noteHtml || '<p>Te escribiremos muy pronto para coordinar el día y la forma de grabar.</p>'}
            <p>Si tienes cualquier duda, responde este correo.</p>`, 'Participa en la radio'),
          text: `¡Tu postulación para Radio Conexión fue aceptada! Queremos que seas parte de un próximo episodio.\n\n${note || 'Te escribiremos muy pronto para coordinar el día y la forma de grabar.'}\n\nSi tienes dudas, responde este correo.`
        }
      : {
          subject: 'Sobre tu postulación para Radio Conexión',
          html: emailLayout(`
            <h1 style="margin:0 0 12px;font-size:24px">Gracias por escribirnos, ${firstName}</h1>
            <p>Leímos tu postulación con mucho cariño. Esta vez no podremos incluirla en los próximos episodios,
            pero nos alegra que quieras ser parte de la radio.</p>
            ${noteHtml}
            <p>Puedes volver a postular con otra idea cuando quieras.</p>
            ${button(`${SITE_URL}/participa`, 'Postular otra idea')}`, 'Participa en la radio'),
          text: `Gracias por escribirnos. Leímos tu postulación con cariño; esta vez no podremos incluirla en los próximos episodios.\n\n${note ? `${note}\n\n` : ''}Puedes volver a postular con otra idea cuando quieras: ${SITE_URL}/participa`
        };

    const sent = await sendEmail({ to: item.email, replyTo: user.email, ...email });
    if (sent) await stampDoc(`participations/${id}`, 'notifiedAt', idToken);
    return response.status(200).json(sent
      ? { sent: true, to: item.email }
      : { sent: false, reason: process.env.RESEND_API_KEY ? 'El servicio de correo (Resend) rechazó el envío.' : 'Falta RESEND_API_KEY en Vercel.' });
  } catch (error) {
    console.error('Respuesta de postulación falló:', error.message);
    return response.status(200).json({ sent: false, reason: 'Error del servidor al enviar.' });
  }
};
