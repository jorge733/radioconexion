function doPost(e) {
  var params = (e && e.parameter) || {};
  var accion = params.accion || '';
  var salto = String.fromCharCode(10);

  if (accion === 'pedir_canciones' || accion === 'dejar_comentario') {
    var secretoCabina = PropertiesService.getScriptProperties().getProperty('SUSCRIPTORES_SHARED_SECRET');
    if (!secretoCabina || params.secreto !== secretoCabina) return responderJSON({ error: 'No autorizado' });
  }

  if (accion === 'pedir_canciones') {
    registrarCanciones_(params);
    MailApp.sendEmail('sabenedettoa@radioconexionweb.com', 'Nueva solicitud de canciones · Radio Conexión', 'De: ' + (params.nombre || 'Suscriptor') + ' <' + (params.email || 'sin correo') + '>' + salto + salto + '1. ' + (params.cancion1 || '') + salto + '2. ' + (params.cancion2 || '') + salto + '3. ' + (params.cancion3 || ''));
    return responderJSON({ result: 'success_canciones' });
  }

  if (accion === 'dejar_comentario') {
    var correo = params.email || 'Suscriptor sin correo';
    var comentario = params.comentario || '';
    registrarMensaje_(params);
    MailApp.sendEmail('sabenedettoa@radioconexionweb.com', 'Nuevo mensaje · Radio Conexión', 'De: ' + (params.nombre || 'Suscriptor') + ' <' + correo + '>' + salto + salto + comentario);
    return responderJSON({ result: 'success_comentario' });
  }

  if (accion === 'suscribir_boletin') {
    var secreto = PropertiesService.getScriptProperties().getProperty('SUSCRIPTORES_SHARED_SECRET');
    if (!secreto || params.secreto !== secreto) return responderJSON({ error: 'No autorizado' });
    if (!params.email || params.grupo !== 'boletin@radioconexionweb.com') return responderJSON({ error: 'Solicitud inválida' });
    try {
      AdminDirectory.Members.insert({ email: params.email, role: 'MEMBER' }, params.grupo);
    } catch (error) {
      if (!/already exists|duplicate|409/i.test(String(error))) throw error;
    }
    return responderJSON({ result: 'success_boletin' });
  }

  return responderJSON({ error: 'Acción no reconocida' });
}

function registrarCanciones_(params) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Canciones Solicitadas');
  if (!hoja) throw new Error('No existe la hoja Canciones Solicitadas.');
  hoja.appendRow([new Date(), params.email || '', params.nombre || '', params.cancion1 || '', params.cancion2 || '', params.cancion3 || '', 'Nueva', '']);
}

function registrarMensaje_(params) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Mensajes');
  if (!hoja) throw new Error('No existe la hoja Mensajes.');
  hoja.appendRow([new Date(), params.email || '', params.nombre || '', params.comentario || '', 'Nuevo', '']);
}

function responderJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
