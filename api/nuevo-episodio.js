// Avisa por correo a los miembros aprobados que hay un episodio nuevo.
// Solo la administración puede llamarla, una vez por episodio.
const { SITE_URL, escapeHtml, bearer, verifiedUser, isAdmin, readDoc, isRecent, sendEmails, approvedMemberIds, stampDoc, emailLayout, button, onlyPost } = require('./_comunidad');

const formatDate = iso => {
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' });
};

module.exports = async (request, response) => {
  if (!onlyPost(request, response)) return;
  try {
    const idToken = bearer(request);
    const user = await verifiedUser(idToken);
    if (!isAdmin(user)) return response.status(403).json({ error: 'Solo la administración puede hacer esto.' });

    const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    const episodeId = String(body.episodeId || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(episodeId)) return response.status(400).json({ error: 'Episodio no válido.' });

    const episode = await readDoc(`episodes/${episodeId}`, idToken);
    // Solo episodios recién publicados y sin aviso previo, para no repetir correos.
    if (!episode || episode.notifiedAt || !isRecent(episode.createdAt)) return response.status(200).json({ sent: 0 });
    if (!await stampDoc(`episodes/${episodeId}`, 'notifiedAt', idToken)) return response.status(200).json({ sent: 0 });

    const ids = await approvedMemberIds(idToken);
    const contacts = await Promise.all(ids.map(async uid => {
      const [member, contact] = await Promise.all([readDoc(`members/${uid}`, idToken), readDoc(`members/${uid}/private/contact`, idToken)]);
      return contact?.email && contact.episodeEmails !== false ? { email: contact.email, name: member?.name || '' } : null;
    }));

    const title = escapeHtml(episode.title);
    const description = episode.description ? `<p style="color:#545b53">${escapeHtml(episode.description).replace(/\n/g, '<br>')}</p>` : '';
    const when = formatDate(episode.date);
    const messages = contacts.filter(Boolean).map(contact => ({
      to: contact.email,
      subject: `Nuevo episodio: ${episode.title}`,
      html: emailLayout(`
        <p>Hola${contact.name ? `, ${escapeHtml(contact.name.split(' ')[0])}` : ''}:</p>
        <p>Ya está disponible un nuevo episodio en la comunidad${when ? ` (${escapeHtml(when)})` : ''}:</p>
        <h1 style="margin:0 0 8px;font-size:22px">${title}</h1>
        ${description}
        ${button(`${SITE_URL}/comunidad`, 'Escuchar ahora')}
        <p style="font-size:12px;color:#545b53">Recibes este correo porque eres miembro de la comunidad de Radio Conexión. Puedes desactivarlo en Comunidad → Mi perfil.</p>`),
      text: `Nuevo episodio en la comunidad de Radio Conexión: ${episode.title}. Escúchalo en ${SITE_URL}/comunidad (puedes desactivar estos avisos en Mi perfil).`
    }));

    const sent = messages.length ? await sendEmails(messages) : 0;
    return response.status(200).json({ sent });
  } catch (error) {
    console.error('Aviso de episodio falló:', error.message);
    return response.status(200).json({ sent: 0 });
  }
};
