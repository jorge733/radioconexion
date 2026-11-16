# Radio Conexión

Sitio web de Radio Conexión, que se está rehaciendo como comunidad.

## Contenido actual

- `inicio.html`: portada provisional mientras se construye la comunidad.
- `envivo.html` + `envivo.js`: reproductor de la transmisión en directo.
- `historia.html`: historia de la radio, carta del fundador y museo de logos.
- `tiempo.html` + `weather.js` + `api/weather.js`: pronóstico desde la Dirección Meteorológica de Chile (DMC).
- `site.css`, `site.js`, `assets/`: marca, tipografías y estilos compartidos.

## Configuración

El pronóstico necesita estas variables en Vercel (ver `.env.example`):
`DMC_API_USER`, `DMC_API_TOKEN` y, opcionalmente, `DMC_STATION_CODE`.

## Transmisión en vivo

1. Crea una estación en un servicio de streaming (por ejemplo, Zeno.fm) y copia su enlace de stream.
2. Pégalo en `STREAM_URL`, al comienzo de `envivo.js`. Mientras esté vacío, la página muestra "Muy pronto al aire".
3. Para salir al aire, envía el audio desde tu computador con BUTT (o Mixxx) usando los datos de conexión del servicio.
   La contraseña de transmisión va solo en ese programa, nunca en este repositorio.
