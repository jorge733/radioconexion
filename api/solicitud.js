// Avisa por correo a la administración cuando alguien pide unirse a la comunidad.
// La solicitud ya quedó guardada en Firestore; esto solo avisa.
const { ADMIN_EMAIL, SITE_URL, escapeHtml, bearer, verifiedUser, readDoc, isRecent, sendEmail, emailLayout, button, onlyPost } = require('./_comunidad');

module.exports = async (request, response) => {
  if (!onlyPost(request, response)) return;
  try {
    const idToken = bearer(request);
    const user = await verifiedUser(idToken);
    if (!user?.localId) return response.status(401).json({ error: 'Sesión no válida.' });

    const member = await readDoc(`members/${encodeURIComponent(user.localId)}`, idToken);
    // Solo avisamos de solicitudes pendientes recién creadas, para evitar correos repetidos.
    if (!member || member.status !== 'pending' || !isRecent(member.createdAt)) return response.status(200).json({ sent: false });

    const name = member.name || user.displayName || 'Alguien';
    const sent = await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Nueva solicitud para la comunidad: ${name}`,
      html: emailLayout(`
        <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(user.email)}) pidió unirse a la comunidad.</p>
        ${member.bio ? `<blockquote style="border-left:3px solid #c77f0d;margin:0;padding-left:12px;color:#545b53">${escapeHtml(member.bio)}</blockquote>` : ''}
        ${button(`${SITE_URL}/admin`, 'Revisar la solicitud')}`),
      text: `${name} (${user.email}) pidió unirse a la comunidad de Radio Conexión. Revísala en ${SITE_URL}/admin`
    });
    return response.status(200).json({ sent });
  } catch (error) {
    console.error('Aviso de solicitud falló:', error.message);
    return response.status(200).json({ sent: false });
  }
};
