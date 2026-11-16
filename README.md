# Radio Conexión

Sitio web de Radio Conexión, que se está rehaciendo como comunidad.

## Contenido actual

- `inicio.html`: portada provisional mientras se construye la comunidad.
- `historia.html`: historia de la radio, carta del fundador y museo de logos.
- `tiempo.html` + `weather.js` + `api/weather.js`: pronóstico desde la Dirección Meteorológica de Chile (DMC).
- `site.css`, `site.js`, `assets/`: marca, tipografías y estilos compartidos.

## Configuración

El pronóstico necesita estas variables en Vercel (ver `.env.example`):
`DMC_API_USER`, `DMC_API_TOKEN` y, opcionalmente, `DMC_STATION_CODE`.
