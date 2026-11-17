# Radio Conexión

Sitio web de Radio Conexión, que se está rehaciendo como comunidad.

## Contenido actual

- `inicio.html`: portada provisional mientras se construye la comunidad.
- `envivo.html`: reproductor de la transmisión en directo (widget de Caster.fm).
- `historia.html`: historia de la radio, carta del fundador y museo de logos.
- `tiempo.html` + `weather.js` + `api/weather.js`: pronóstico desde la Dirección Meteorológica de Chile (DMC).
- `site.css`, `site.js`, `assets/`: marca, tipografías y estilos compartidos.

## Configuración

El pronóstico necesita estas variables en Vercel (ver `.env.example`):
`DMC_API_USER`, `DMC_API_TOKEN` y, opcionalmente, `DMC_STATION_CODE`.

## Transmisión en vivo

- La señal se emite con Caster.fm (plan gratuito) y la página `envivo.html` muestra su widget de reproductor.
- Para salir al aire: abrir **Caster.fm Broadcaster**, elegir micrófono (Deck 1) y audio del computador (Deck 2) y presionar **Go Live**.
- Las credenciales de transmisión (contraseña y token privado) van solo en ese programa, nunca en este repositorio.
