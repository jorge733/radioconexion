# Radio Conexión

Sitio web de Radio Conexión: una comunidad privada de oyentes, más las páginas de Historia y Tiempo.

## Páginas

| Página | Para qué |
| --- | --- |
| `inicio.html` + `home.js` | Portada de bienvenida: sintonizador interactivo, reloj de Chile y contador de la comunidad. |
| `comunidad.html` + `comunidad.js` | Comunidad: solicitar ingreso con Google, episodios, miembros y perfil. Las secciones se eligen con un sintonizador. |
| `admin.html` + `admin.js` | Panel de administración: aprobar solicitudes y publicar episodios. |
| `historia.html` | Historia de la radio, carta del fundador y museo de logos. |
| `tiempo.html` + `weather.js` | Pronóstico de la Dirección Meteorológica de Chile. |

Código compartido: `community-core.js` (Firebase), `firebase-config.js`, `site.css`, `site.js`. La portada usa `home.js` para el contador.

## Cómo funciona la comunidad

1. La persona entra con su cuenta de Google y envía su solicitud (nombre y una breve descripción).
2. Llega un correo de aviso a la administración (`api/solicitud.js`, vía Resend).
3. En `/admin` se aprueba o rechaza. Solo la cuenta `sabenedettoa@benedettowebs.cl` tiene acceso.
4. Al aprobar, el miembro recibe un correo de bienvenida (`api/aprobado.js`).
5. Los miembros aprobados escuchan y **buscan** episodios, marcan favoritos, **comentan** y **reaccionan** (❤️ 👏),
   envían **pedidos de canciones y saludos** (máximo 3 en espera), editan su perfil y ven a los demás miembros.
6. En el panel se revisan los pedidos y se marcan como "leído al aire"; el miembro lo ve en su pestaña Pedidos.
7. Al publicar un episodio, se puede avisar por correo a los miembros (`api/nuevo-episodio.js`). Cada miembro puede
   desactivar estos avisos en Mi perfil.
8. Los miembros pueden **reportar** comentarios ajenos; en el panel se borran o se mantienen.
9. El panel muestra **estadísticas** (favoritos, comentarios, miembros nuevos por mes) y actualiza `public/stats`,
   que la portada lee para mostrar el contador (solo aparece desde 5 miembros).

Los episodios son audios de Google Drive: en el panel se pega el enlace de "Compartir". El archivo debe estar
compartido como **"Cualquier persona con el enlace"** para que se pueda reproducir.

### Datos (Firestore)

- `members/{uid}`: `name`, `bio`, `photoURL`, `favorites`, `status` (`pending` | `approved` | `rejected`), `createdAt`.
- `members/{uid}/private/contact`: `email`, `episodeEmails` (solo lo ven la persona y la administración).
- `episodes/{id}`: `title`, `description`, `date` (AAAA-MM-DD), `driveId`, `createdAt`, `notifiedAt`.
- `episodes/{id}/comments/{id}`: `uid`, `name`, `photoURL`, `text`, `createdAt`, `hearts`, `claps` (listas de uid).
- `requests/{id}`: `uid`, `name`, `type` (`cancion` | `saludo`), `text`, `to`, `status` (`nuevo` | `hecho`), `createdAt`.
  Los pedidos en espera usan las casillas `<uid>_1`, `<uid>_2` y `<uid>_3` (así las reglas limitan a 3); al leerse al
  aire, el panel los mueve a un documento nuevo con estado `hecho` y la casilla queda libre.
- `reports/{comentario}_{uid}`: `reporterUid`, `episodeId`, `commentId`, `createdAt` (un reporte por persona).
- `public/stats`: `members`, `episodes` (lectura pública; lo escribe el panel).

Los permisos están en `firestore.rules`. **Hay que publicarlos** cada vez que cambien:

```
firebase deploy --only firestore:rules
```

Para cambiar la cuenta administradora, edita `firestore.rules` y `firebase-config.js` (y opcionalmente
`COMMUNITY_ADMIN_EMAIL` en Vercel).

## Configuración en Vercel

Ver `.env.example`: `DMC_API_USER`, `DMC_API_TOKEN` (tiempo) y `RESEND_API_KEY` (correos de solicitud, bienvenida y episodios nuevos).
