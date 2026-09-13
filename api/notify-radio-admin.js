const { firestore, valueOf, credential, accessToken, tokenId } = require('./firebase-admin');

async function notifyRadioAdmin(title, body) {
  const adminEmail = process.env.RADIO_ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail) return 0;
  try {
    const list = await firestore('pushSubscriptions?pageSize=500');
    const { projectId } = credential();
    const access = await accessToken();
    const recipients = (list.documents || []).filter((document) => valueOf(document, 'email').toLowerCase() === adminEmail);
    let sent = 0;
    await Promise.all(recipients.map(async (document) => {
      const deviceToken = valueOf(document, 'token');
      if (!deviceToken) return;
      const result = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: deviceToken, notification: { title, body }, data: { url: '/suscriptores.html' }, webpush: { fcm_options: { link: '/suscriptores.html' } } } })
      });
      if (result.ok) { sent += 1; return; }
      const details = await result.json().catch(() => ({}));
      if (details.error?.status === 'NOT_FOUND' || details.error?.status === 'UNREGISTERED') await firestore(`pushSubscriptions/${tokenId(deviceToken)}`, { method: 'DELETE' }).catch(() => {});
    }));
    return sent;
  } catch (error) {
    console.error('Admin notification failed:', error.message);
    return 0;
  }
}

module.exports = { notifyRadioAdmin };
