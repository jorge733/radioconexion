const { receiveAtCabina, respond } = require('./cabina');

module.exports = async (request, response) => {
  const songs = request.body?.songs;
  if (!Array.isArray(songs) || songs.length < 1 || songs.length > 3) {
    return respond(response, 400, { error: 'Elige entre una y tres canciones.' });
  }
  const cleaned = songs.map((song) => String(song || '').trim()).filter(Boolean);
  if (cleaned.length !== songs.length || cleaned.some((song) => song.length > 180)) {
    return respond(response, 400, { error: 'Revisa las canciones seleccionadas.' });
  }
  return receiveAtCabina(request, response, 'pedir_canciones', {
    cancion1: cleaned[0] || '', cancion2: cleaned[1] || '', cancion3: cleaned[2] || ''
  });
};
