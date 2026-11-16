(() => {
  const endpoint = '/api/weather';
  const $ = selector => document.querySelector(selector);
  const dayFormat = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Santiago' });
  const updatedFormat = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' });
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  const value = number => number === null || number === undefined ? '—' : escapeHTML(number);

  function showMessage(message) {
    document.querySelectorAll('[data-weather-message]').forEach(el => { el.textContent = message; });
  }
  function renderCurrent(data) {
    document.querySelectorAll('[data-weather-current]').forEach(card => {
      const humidity = data.current.humidity === null ? '' : `${value(data.current.humidity)}% de humedad`;
      card.innerHTML = `<span class="weather-kicker">Ahora · ${escapeHTML(data.station)}</span><strong>${value(data.current.temperature)}°</strong><span>${humidity}</span><a href="tiempo.html">Ver pronóstico <span aria-hidden="true">→</span></a><p data-weather-message></p>`;
    });
  }
  function renderUnavailable() {
    document.querySelectorAll('[data-weather-current]').forEach(card => {
      const kicker = card.querySelector('.weather-kicker');
      const detail = card.querySelector(':scope > span:not(.weather-kicker)');
      const temperature = card.querySelector('strong');
      if (kicker) kicker.textContent = 'Tiempo oficial';
      if (temperature) temperature.remove();
      if (detail) detail.textContent = 'Consulta el pronóstico de la Dirección Meteorológica de Chile.';
    });
    const forecast = $('#forecast-days');
    if (forecast) forecast.innerHTML = '<p class="muted">El pronóstico no está disponible en este momento. Vuelve a intentarlo más tarde.</p>';
    const heading = $('#forecast-heading');
    if (heading) heading.textContent = 'Pronóstico no disponible';
  }
  function renderForecast(data) {
    const forecast = $('#forecast-days');
    if (!forecast) return;
    const heading = $('#forecast-heading');
    if (heading) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
      const includesToday = data.forecast.some(day => day.date === today);
      const followingDays = data.forecast.length - (includesToday ? 1 : 0);
      heading.textContent = !data.forecast.length ? 'Pronóstico no disponible' : includesToday ? `Hoy y próximos ${followingDays} días` : `Pronóstico a ${followingDays} días`;
    }
    forecast.innerHTML = data.forecast.map(day => `<article class="forecast-day"><time datetime="${escapeHTML(day.date)}">${escapeHTML(dayFormat.format(new Date(`${day.date}T12:00:00`)))}</time><span class="weather-icon" aria-hidden="true">☀︎</span><strong>${value(day.max)}° <small>${value(day.min)}°</small></strong><span>${day.humidity === null ? 'Sin datos de humedad' : `Humedad mín. ${value(day.humidity)}%`}</span><span>${day.wind === null ? '' : `Viento máx. ${value(day.wind)} kt`}</span></article>`).join('') || '<p class="muted">No hay proyección disponible para esta estación.</p>';
  }
  async function loadWeather() {
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.current) throw new Error(data.error);
      renderCurrent(data);
      renderForecast(data);
      const update = data.updatedAt ? `Actualizado: ${updatedFormat.format(new Date(data.updatedAt.replace(' ', 'T') + 'Z'))}` : 'Actualización reciente';
      showMessage(`${update} · Fuente: ${data.source}`);
    } catch (error) {
      renderUnavailable();
      showMessage(error.message || 'El tiempo no está disponible en este momento.');
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    loadWeather();
    const share = $('#share-weather');
    share?.addEventListener('click', async () => {
      const title = 'Pronóstico del tiempo · Radio Conexión';
      const text = 'Revisa el pronóstico oficial de la Dirección Meteorológica de Chile en Radio Conexión.';
      try {
        if (navigator.share) await navigator.share({ title, text, url: location.href });
        else { await navigator.clipboard.writeText(location.href); share.textContent = 'Enlace copiado ✓'; }
      } catch (error) { if (error.name !== 'AbortError') share.textContent = 'No se pudo compartir'; }
    });
  });
})();
