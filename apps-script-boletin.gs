/* Añade este bloque al proyecto existente de Apps Script.
 * Activa: Servicios avanzados de Google > Admin SDK API.
 * El despliegue web debe ejecutarse como un administrador de Workspace.
 */
const BOLETIN_GROUP = 'boletin@radioconexionweb.com';

function suscribirBoletin_(email, grupoSolicitado) {
  if (grupoSolicitado !== BOLETIN_GROUP) throw new Error('Grupo de boletín no permitido');
  try {
    AdminDirectory.Members.insert({ email: email, role: 'MEMBER' }, BOLETIN_GROUP);
  } catch (error) {
    if (!/already exists|duplicate|409/i.test(String(error))) throw error;
  }
}

/* Dentro de tu doPost(e) existente, añade antes de la respuesta por defecto:

  if (e.parameter.accion === 'suscribir_boletin') {
    suscribirBoletin_(e.parameter.email, e.parameter.grupo);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
*/
