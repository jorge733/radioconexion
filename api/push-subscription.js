const { requireFirebaseUser } = require('./firebase-auth');
const { firestore, documentFields, tokenId } = require('./firebase-admin');

module.exports = async (request, response) => {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido.' });
  let user;
  try { user = await requireFirebaseUser(request); } catch { return response.status(401).json({ error: 'Debes iniciar sesión con Firebase.' }); }
  const action = request.body?.action;
  const token = typeof request.body?.token === 'string' ? request.body.token.trim() : '';
  if (!token || token.length > 4096) return response.status(400).json({ error: 'No pudimos registrar este dispositivo.' });
  const id = tokenId(token);
  try {
    if (action === 'remove') {
      await firestore(`pushSubscriptions/${id}`, { method: 'DELETE' });
    } else if (action === 'save') {
      await firestore(`pushSubscriptions/${id}`, {
        method: 'PATCH', body: JSON.stringify(documentFields({ token, uid: user.uid, email: user.email, updatedAt: new Date().toISOString() }))
      });
    } else return response.status(400).json({ error: 'Solicitud inválida.' });
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Push subscription failed:', error.message);
    return response.status(503).json({ error: 'No pudimos guardar la preferencia de avisos.' });
  }
};
