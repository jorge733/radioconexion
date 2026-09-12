const { receiveAtCabina, respond } = require('./cabina');

module.exports = async (request, response) => {
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
  if (!message || message.length > 600) {
    return respond(response, 400, { error: 'Escribe un mensaje de hasta 600 caracteres.' });
  }
  return receiveAtCabina(request, response, 'dejar_comentario', { comentario: message });
};
