// Envía la bienvenida por correo a un miembro recién aprobado.
// Solo la administración puede llamarla; el correo del miembro se lee con su token.
const { SITE_URL, escapeHtml, bearer, verifiedUser, isAdmin, readDoc, isRecent, sendEmail, emailLayout, button, onlyPost } = require('./_comunidad');

module.exports = async (request, response) => {
  if (!onlyPost(request, response)) return;
  try {
    const idToken = bearer(request);
    const user = await verifiedUser(idToken);
    if (!isAdmin(user)) return response.status(403).json({ error: 'Solo la administración puede hacer esto.' });

    const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    const uid = String(body.uid || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return response.status(400).json({ error: 'Miembro no válido.' });

    const member = await readDoc(`members/${uid}`, idToken);
    // Solo para aprobaciones recién hechas, para no repetir la bienvenida.
    if (!member || member.status !== 'approved' || !isRecent(member.reviewedAt)) return response.status(200).json({ sent: false });
    const contact = await readDoc(`members/${uid}/private/contact`, idToken);
    if (!contact?.email) return response.status(200).json({ sent: false });

    const firstName = escapeHtml(String(member.name || '').split(' ')[0] || 'hola');
    const sent = await sendEmail({
      to: contact.email,
      subject: '¡Bienvenido a la comunidad de Radio Conexión!',
      html: emailLayout(`
        <h1 style="margin:0 0 12px;font-size:24px">¡Ya estás dentro, ${firstName}!</h1>
        <p>Aprobamos tu solicitud para la comunidad de Radio Conexión. Ahora puedes escuchar los episodios,
        comentar, pedir canciones y saludos, y conocer a los demás miembros.</p>
        ${button(`${SITE_URL}/comunidad`, 'Entrar a la comunidad')}
        <p style="font-size:14px;color:#545b53">Entra con la misma cuenta de Google con que te registraste.</p>`),
      text: `¡Ya estás dentro! Aprobamos tu solicitud para la comunidad de Radio Conexión. Entra en ${SITE_URL}/comunidad con tu cuenta de Google.`
    });
    return response.status(200).json({ sent });
  } catch (error) {
    console.error('Bienvenida falló:', error.message);
    return response.status(200).json({ sent: false });
  }
};
