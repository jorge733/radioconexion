# Radio Conexión

Sitio web de Radio Conexión: una comunidad privada de oyentes, más las páginas de Historia y Tiempo.

## Páginas

| Página | Para qué |
| --- | --- |
| `inicio.html` | Portada (por ahora con aviso de mantención). |
| `comunidad.html` + `comunidad.js` | Comunidad: solicitar ingreso con Google, episodios, miembros y perfil. |
| `admin.html` + `admin.js` | Panel de administración: aprobar solicitudes y publicar episodios. |
| `historia.html` | Historia de la radio, carta del fundador y museo de logos. |
| `tiempo.html` + `weather.js` | Pronóstico de la Dirección Meteorológica de Chile. |

Código compartido: `community-core.js` (Firebase), `firebase-config.js`, `site.css`, `site.js`.

## Cómo funciona la comunidad

1. La persona entra con su cuenta de Google y envía su solicitud (nombre y una breve descripción).
2. Llega un correo de aviso a la administración (`api/solicitud.js`, vía Resend).
3. En `/admin` se aprueba o rechaza. Solo la cuenta `sabenedettoa@benedettowebs.cl` tiene acceso.
4. Los miembros aprobados escuchan los episodios, marcan favoritos, editan su perfil y ven a los demás miembros.

Los episodios son audios de Google Drive: en el panel se pega el enlace de "Compartir". El archivo debe estar
compartido como **"Cualquier persona con el enlace"** para que se pueda reproducir.

### Datos (Firestore)

- `members/{uid}`: `name`, `bio`, `photoURL`, `favorites`, `status` (`pending` | `approved` | `rejected`), `createdAt`.
- `members/{uid}/private/contact`: `email` (solo lo ven la persona y la administración).
- `episodes/{id}`: `title`, `description`, `date` (AAAA-MM-DD), `driveId`, `createdAt`.

Los permisos están en `firestore.rules`. **Hay que publicarlos** cada vez que cambien:

```
firebase deploy --only firestore:rules
```

Para cambiar la cuenta administradora, edita `firestore.rules` y `firebase-config.js` (y opcionalmente
`COMMUNITY_ADMIN_EMAIL` en Vercel).

## Configuración en Vercel

Ver `.env.example`: `DMC_API_USER`, `DMC_API_TOKEN` (tiempo) y `RESEND_API_KEY` (aviso de solicitudes).
