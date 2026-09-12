# Radio Conexión

Sitio estático en español, compatible con GitHub Pages y Vercel. La portada está en `index.html`; `inicio.html` conserva el acceso anterior. Las páginas utilizan enlaces relativos con extensión `.html` para funcionar también sin reglas de reescritura.

## Contenido

- Inicio: presentación, accesos a episodios y comunidad, suscripción y WhatsApp.
- Episodios: reproductor de Spotify.
- Noticias: titulares obtenidos de las fuentes configuradas.
- Suscriptores: acceso, solicitudes de canciones, mensajes y fonoteca.
- Historia: información de la radio y su fundador.

Los ajustes visuales compartidos están en `site.css`; las mejoras de accesibilidad están en `site.js`. No se necesita compilar ni instalar dependencias para publicar estos archivos.

## Servicios externos

El portal de suscriptores usa Firebase Authentication con Google. Las solicitudes de canciones y los mensajes pasan por rutas de Vercel que validan el token Firebase antes de reenviarlos al Apps Script; el navegador ya no conoce esa URL. Spotify, las fuentes de noticias y las imágenes remotas necesitan conexión a Internet.ss

Antes de publicar, completa `firebase-config.js` y configura en Vercel las variables de `.env.example`. Activa Google como proveedor de Firebase Authentication y añade el dominio publicado en **Authorized domains**. El alta automática del boletín se delega al Apps Script de Google Workspace, que debe ejecutarse con una cuenta administradora. Configura el mismo valor aleatorio de `APPS_SCRIPT_SHARED_SECRET` como secreto de Vercel y como propiedad de script `SUSCRIPTORES_SHARED_SECRET`; así el Apps Script no acepta altas directas. Esta alternativa evita almacenar claves privadas en Vercel.

Las rutas de cabina aplican un límite básico de un envío por minuto y usuario. Para una protección persistente entre instancias de Vercel, reemplaza el limitador en memoria por Redis/Upstash antes de una campaña o de aumentar la audiencia.

## Notificaciones del navegador

Las personas suscritas pueden activar avisos de nuevos episodios y del boletín desde `suscriptores.html`. La primera vez se solicita permiso de forma voluntaria y el dispositivo queda registrado en Firestore. Para activarlo en producción:

1. En Firebase Console, crea una base de datos **Firestore** en modo producción y crea una clave de **Web Push** en Cloud Messaging. Copia esa clave pública en `firebaseMessagingVapidKey` de `firebase-config.js`.
2. En Firebase Console > Configuración del proyecto > Cuentas de servicio, crea una clave privada. Configura `FIREBASE_SERVICE_ACCOUNT_EMAIL` y `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY` en Vercel; no copies esa clave a ningún archivo público.
3. Configura `RADIO_ADMIN_EMAIL` con el correo de quien publica. Tras iniciar sesión con esa cuenta, aparece la tarjeta para enviar un aviso; permite elegir entre episodio, boletín o ambos.

Los avisos requieren HTTPS. En iPhone/iPad, la persona debe añadir Radio Conexión a la pantalla de inicio antes de poder activarlos.

## Tiempo oficial

La página `tiempo.html` y la tarjeta de Inicio obtienen condiciones actuales y proyecciones de hasta cinco días desde la Dirección Meteorológica de Chile (DMC). Registra una credencial personal en el Portal de Servicios Climáticos de la DMC y configura `DMC_API_USER`, `DMC_API_TOKEN` y, si hace falta, `DMC_STATION_CODE` en las variables de entorno de Vercel. Las credenciales se consumen únicamente en `/api/weather`.

## Cambios de esta revisión

Portada renovada con los colores de la marca, accesos directos, ajustes para móviles y modo oscuro, navegación con teclado, etiquetas accesibles, portada raíz y mensajes de suscripción que no anuncian éxito ante una respuesta desconocida. La zona de suscriptores presenta mejor sus beneficios, organiza las acciones en un panel adaptable y ya no concede acceso si falla la verificación externa. Se eliminó la encuesta, el envío de votos y sus referencias al cerrar sesión. Se retiró la dependencia de animaciones AOS para que el contenido permanezca visible si falla un servicio externo.
