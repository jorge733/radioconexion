# Radio Conexión

Sitio estático en español, compatible con GitHub Pages y Vercel. La portada está en `inicio.html`; `index.html` solo redirige a ella (Vercel hace lo mismo con `/`). Las páginas utilizan enlaces relativos con extensión `.html` para funcionar también sin reglas de reescritura.

## Contenido

- Inicio: presentación de la radio, invitación al boletín y tiempo.
- Boletín y suscriptores (`suscriptores.html`): activar o quitar el boletín, pedir canciones, dejar mensajes y avisos del navegador. La cuenta administradora ve además los paneles del equipo.
- Tiempo: pronóstico oficial de la DMC.
- Historia: información de la radio y su fundador.

El Blog y la escucha de episodios están retirados por ahora: `/blog`, `/episodios` y `/noticias` redirigen temporalmente a `/inicio`. Las APIs `/api/episodes` y `/api/blog-posts` se conservan porque el Studio las usa; lo que se publique desde ahí no se muestra en el sitio hasta reactivar esas páginas.

## Estructura

- `site.css`: sistema de diseño único (colores, tipografía, componentes y modo oscuro). Las páginas no llevan estilos propios.
- `site.js`: menú móvil, modo claro/oscuro (respeta la preferencia del sistema) y detalles de accesibilidad.
- Todas las páginas comparten el mismo encabezado y pie; si cambias un enlace del menú, actualízalo en cada archivo `.html`.
- `suscriptores.js`: portal de suscriptores y paneles del equipo (boletín, importación, avisos y cabina). `weather.js`: Tiempo.
- `assets/marca/`: logo de la radio en 96, 192 y 512 px (favicon, encabezado e imagen para redes).

No se necesita compilar ni instalar dependencias para publicar estos archivos.

## Servicios externos

El portal de suscriptores usa Firebase Authentication con Google. Las solicitudes de canciones y los mensajes pasan por rutas de Vercel que validan el token Firebase antes de reenviarlos al Apps Script; el navegador ya no conoce esa URL. Spotify, las fuentes de noticias y las imágenes remotas necesitan conexión a Internet.

Antes de publicar, completa `firebase-config.js` y configura en Vercel las variables de `.env.example`. Activa Google como proveedor de Firebase Authentication y añade el dominio publicado en **Authorized domains**. La cabina (canciones y mensajes) se delega al Apps Script de `apps-script-cabina.gs`. Configura el mismo valor aleatorio de `APPS_SCRIPT_SHARED_SECRET` como secreto de Vercel y como propiedad de script `SUSCRIPTORES_SHARED_SECRET`; así el Apps Script no acepta solicitudes directas.

Las rutas de cabina aplican un límite básico de un envío por minuto y usuario. Para una protección persistente entre instancias de Vercel, reemplaza el limitador en memoria por Redis/Upstash antes de una campaña o de aumentar la audiencia.

## Boletín por correo (Resend)

El boletín se envía con [Resend](https://resend.com). La suscripción es explícita: iniciar sesión no suscribe a nadie; cada persona activa o quita el boletín con el interruptor de `suscriptores.html`, y todos los correos incluyen un enlace para darse de baja con un clic. Toda la lógica está en `api/newsletter.js` (el plan Hobby de Vercel admite 12 funciones y ya están todas en uso, así que no agregues archivos nuevos a `api/`).

Configuración, una sola vez:

1. Crea una cuenta en Resend y, en **Domains**, agrega `radioconexionweb.com`. Copia en el DNS del dominio los registros que indica Resend (SPF, DKIM y, recomendado, DMARC) y espera a que figure como verificado.
2. En **Audience > Segments**, crea un segmento (por ejemplo, «Boletín Radio Conexión») y copia su id.
3. En **API Keys**, crea una clave con permiso *Full access*.
4. En Vercel > Settings > Environment Variables, configura `RESEND_API_KEY`, `RESEND_SEGMENT_ID` y, si quieres cambiarlo, `NEWSLETTER_FROM` (por defecto `Radio Conexión <boletin@radioconexionweb.com>`). `NEWSLETTER_REPLY_TO` es opcional. Vuelve a desplegar.
5. Importa a las personas del antiguo Grupo de Google: en Google Groups > Miembros, exporta la lista (o cópiala) y pégala en el panel **Importar suscriptores**. Quienes ya se habían dado de baja en Resend no se vuelven a suscribir.

Para enviar un boletín, inicia sesión con la cuenta administradora (`RADIO_ADMIN_EMAIL`) y usa el panel **Nuevo boletín**: asunto, introducción, de 1 a 6 noticias (título, resumen, enlace, imagen y fuente), vista previa, **Enviarme una prueba** y luego **Enviar a todos** o **Programar** (hasta 30 días). El borrador se guarda en el navegador mientras escribes. Puedes revisar entregas, aperturas y bajas en el panel de Resend.

El plan gratuito de Resend cubre los envíos de marketing hasta 1.000 contactos; las pruebas cuentan como correos transaccionales (100 al día).

## Podcast Hub y Studio

El Podcast Hub está retirado del sitio por ahora, pero el Studio sigue funcionando. Desde **Studio > Publicar** la cuenta administradora puede subir el audio final, una portada opcional y los datos del episodio. Al publicarlo, ese episodio pasa a ser el único abierto al público y los anteriores requieren una sesión de Firebase.

Antes de usarlo en producción, configura `FIREBASE_STORAGE_BUCKET` en Vercel, conserva las credenciales de la cuenta de servicio ya usadas por las APIs y publica las reglas de `storage.rules` con `firebase deploy --only storage`. Las reglas permiten leer el último audio sin sesión y el catálogo completo solo con sesión iniciada; no publiques los MP3 fuera de Firebase Storage porque eso evitaría la protección.

## Notificaciones del navegador

Las personas suscritas pueden activar avisos del boletín y de las novedades de la radio desde `suscriptores.html`. La primera vez se solicita permiso de forma voluntaria y el dispositivo queda registrado en Firestore. Para activarlo en producción:

1. En Firebase Console, crea una base de datos **Firestore** en modo producción y crea una clave de **Web Push** en Cloud Messaging. Copia esa clave pública en `firebaseMessagingVapidKey` de `firebase-config.js`.
2. En Firebase Console > Configuración del proyecto > Cuentas de servicio, crea una clave privada. Configura `FIREBASE_SERVICE_ACCOUNT_EMAIL` y `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY` en Vercel; no copies esa clave a ningún archivo público.
3. Configura `RADIO_ADMIN_EMAIL` con el correo de quien publica. Tras iniciar sesión con esa cuenta, aparece la tarjeta para enviar un aviso, que abre la portada al tocarlo.

Los avisos requieren HTTPS. En iPhone/iPad, la persona debe añadir Radio Conexión a la pantalla de inicio antes de poder activarlos.

## Tiempo oficial

La página `tiempo.html` y la tarjeta de Inicio obtienen condiciones actuales y proyecciones de hasta cinco días desde la Dirección Meteorológica de Chile (DMC). Registra una credencial personal en el Portal de Servicios Climáticos de la DMC y configura `DMC_API_USER`, `DMC_API_TOKEN` y, si hace falta, `DMC_STATION_CODE` en las variables de entorno de Vercel. Las credenciales se consumen únicamente en `/api/weather`.

## Cambios de esta revisión

Rediseño completo del sitio público (octubre de 2026): nueva identidad visual editorial con los colores de la marca, tipografías Fraunces, Inter y Unica One, un solo archivo de estilos, encabezado y pie comunes y logo alojado en el propio sitio. En noviembre de 2026 se retiraron el Blog y la escucha de episodios, y el boletín pasó del Grupo de Google a Resend con suscripción explícita. El Studio no cambió.
