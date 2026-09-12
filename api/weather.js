const DMC_BASE = 'https://climatologia.meteochile.gob.cl/application';

function send(response, status, body) {
  return response.status(status).json(body);
}

function number(value) {
  const found = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return found ? Number(found[0]) : null;
}

function forecastDays(model) {
  const elements = model?.datosModelo?.elementos || model?.elementos || [];
  const list = Array.isArray(elements) ? elements : Object.values(elements);
  const days = new Map();

  for (const element of list) {
    const definition = element?.elemento || element;
    const name = String(definition?.nombre || definition?.campo || definition?.sigla || '').toLowerCase();
    // La DMC entrega varias corridas. La primera es la corrida vigente y evita
    // mezclar proyecciones de horas distintas para un mismo momento.
    const runs = Object.values(element || {}).filter(value => value && typeof value === 'object' && Array.isArray(value.valorPronosticado)).slice(0, 1);
    for (const run of runs) {
      for (const point of run.valorPronosticado) {
        const date = new Date(point.fecha?.replace(' ', 'T') + 'Z');
        if (Number.isNaN(date.getTime())) continue;
        const key = date.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
        const entry = days.get(key) || { date: key, temperatures: [], humidity: [], wind: [] };
        const value = number(point.valor);
        if (value === null) continue;
        if (name.includes('temperatura')) entry.temperatures.push(value);
        else if (name.includes('humedad')) entry.humidity.push(value);
        else if (name.includes('viento')) entry.wind.push(value);
        days.set(key, entry);
      }
    }
  }
  return [...days.values()].slice(0, 5).map(day => ({
    date: day.date,
    min: day.temperatures.length ? Math.round(Math.min(...day.temperatures)) : null,
    max: day.temperatures.length ? Math.round(Math.max(...day.temperatures)) : null,
    humidity: day.humidity.length ? Math.round(Math.min(...day.humidity)) : null,
    wind: day.wind.length ? Math.round(Math.max(...day.wind)) : null
  }));
}

module.exports = async (request, response) => {
  if (request.method !== 'GET') return send(response, 405, { error: 'Método no permitido.' });
  const user = process.env.DMC_API_USER;
  const token = process.env.DMC_API_TOKEN;
  const station = process.env.DMC_STATION_CODE || '330021';
  if (!user || !token) return send(response, 503, { error: 'El pronóstico oficial aún no está configurado.' });

  const query = new URLSearchParams({ usuario: user, token });
  try {
    const [currentResult, modelResult] = await Promise.all([
      fetch(`${DMC_BASE}/servicios/getDatosRecientesEma/${station}?${query}`),
      fetch(`${DMC_BASE}/serviciosb/getDatosModelo/${station}?${query}`)
    ]);
    if (!currentResult.ok || !modelResult.ok) throw new Error('La DMC no respondió correctamente.');
    const [currentData, modelData] = await Promise.all([currentResult.json(), modelResult.json()]);
    const readings = currentData?.datosEstaciones?.datos || [];
    const latest = readings[readings.length - 1] || {};
    const stationInfo = currentData?.datosEstaciones?.estacion || modelData?.estacion || {};
    return send(response, 200, {
      source: 'Dirección Meteorológica de Chile (DMC)',
      station: stationInfo.nombreEstacion || stationInfo.NombreEstacion || 'Estación seleccionada',
      updatedAt: latest.momento || currentData.fechaCreacion || null,
      current: { temperature: number(latest.temperatura), humidity: number(latest.humedadRelativa), wind: number(latest.fuerzaDelViento) },
      forecast: forecastDays(modelData)
    });
  } catch (error) {
    console.error('DMC weather request failed:', error.message);
    return send(response, 502, { error: 'No pudimos actualizar los datos de la DMC. Inténtalo nuevamente.' });
  }
};
