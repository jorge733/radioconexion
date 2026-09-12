(() => {
  const endpoint = '/api/weather';
  const $ = selector => document.querySelector(selector);
  const dayFormat = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Santiago' });
  const updatedFormat = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' });

  function showMessage(message) {
    document.querySelectorAll('[data-weather-message]').forEach(el => el.textContent = message);
  }
  function renderCurrent(data) {
    document.querySelectorAll('[data-weather-current]').forEach(card => {
      card.innerHTML = `<span class="weather-kicker">Ahora · ${data.station}</span><strong>${data.current.temperature ?? '—'}°</strong><span>${data.current.humidity === null ? '' : `${data.current.humidity}% de humedad`}</span><a href="tiempo.html">Ver pronóstico <span aria-hidden="true">→</span></a><p data-weather-message></p>`;
    });
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
    forecast.innerHTML = data.forecast.map(day => `<article class="forecast-day"><time datetime="${day.date}">${dayFormat.format(new Date(`${day.date}T12:00:00`))}</time><span class="weather-icon" aria-hidden="true">☀︎</span><strong>${day.max ?? '—'}° <small>${day.min ?? '—'}°</small></strong><span>${day.humidity === null ? 'Sin datos de humedad' : `Humedad mín. ${day.humidity}%`}</span><span>${day.wind === null ? '' : `Viento máx. ${day.wind} kt`}</span></article>`).join('') || '<p>No hay proyección disponible para esta estación.</p>';
  }
  async function loadWeather() {
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      renderCurrent(data);
      renderForecast(data);
      const update = data.updatedAt ? `Actualizado: ${updatedFormat.format(new Date(data.updatedAt.replace(' ', 'T') + 'Z'))}` : 'Actualización reciente';
      showMessage(`${update} · Fuente: ${data.source}`);
    } catch (error) {
      showMessage(error.message || 'El tiempo no está disponible en este momento.');
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = $('#menu-toggle');
    const menu = $('#nav-menu');
    menuToggle?.addEventListener('click', () => {
      const open = menu?.classList.toggle('nav-open');
      menuToggle.textContent = open ? '✕' : '☰';
      menuToggle.setAttribute('aria-expanded', String(open));
    });
    menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      menu.classList.remove('nav-open');
      if (menuToggle) { menuToggle.textContent = '☰'; menuToggle.setAttribute('aria-expanded', 'false'); }
    }));
    loadWeather();
    $('#share-weather')?.addEventListener('click', async () => {
      const title = 'Pronóstico del tiempo · Radio Conexión';
      const text = 'Revisa el pronóstico oficial de la Dirección Meteorológica de Chile en Radio Conexión.';
      try {
        if (navigator.share) await navigator.share({ title, text, url: location.href });
        else { await navigator.clipboard.writeText(location.href); $('#share-weather').textContent = 'Enlace copiado'; }
      } catch (error) { if (error.name !== 'AbortError') $('#share-weather').textContent = 'No se pudo compartir'; }
    });
  });
})();
