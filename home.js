// Contador público de la portada: cuántos miembros y episodios tiene la comunidad.
(async () => {
  const box = document.getElementById('community-stats');
  if (!box) return;
  const url = 'https://firestore.googleapis.com/v1/projects/radio-conexion-e924e/databases/(default)/documents/public/stats';
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const { fields = {} } = await response.json();
    const members = Number(fields.members?.integerValue || 0);
    const episodes = Number(fields.episodes?.integerValue || 0);
    // Con números muy chicos la comunidad parece vacía: mostramos el contador desde 5 miembros.
    if (members < 5) return;
    const format = new Intl.NumberFormat('es-CL');
    box.querySelector('[data-members]').textContent = format.format(members);
    box.querySelector('[data-episodes]').textContent = format.format(episodes);
    box.querySelector('[data-episodes-label]').textContent = episodes === 1 ? 'episodio' : 'episodios';
    box.hidden = false;
  } catch (error) {
    // Si no hay conexión, la portada funciona igual sin el contador.
  }
})();
