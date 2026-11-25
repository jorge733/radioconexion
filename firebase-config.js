// Configuración pública de Firebase (es seguro tenerla en el navegador).
export const firebaseConfig = {
  apiKey: 'AIzaSyDn9VYTp8VfsxWQADAtozRmrCySzlETwas',
  authDomain: 'auth.radioconexionweb.com',
  projectId: 'radio-conexion-e924e',
  storageBucket: 'radio-conexion-e924e.firebasestorage.app',
  messagingSenderId: '164161520710',
  appId: '1:164161520710:web:20e761ce7dae6d2c637647'
};

// Única cuenta que aprueba miembros y publica episodios.
// Si la cambias, cámbiala también en firestore.rules.
export const ADMIN_EMAIL = 'sabenedettoa@benedettowebs.cl';
// Cuentas con acceso a /admin. Si cambias esta lista, cámbiala también en firestore.rules y api/_comunidad.js.
export const ADMIN_EMAILS = [ADMIN_EMAIL, 'sabenedettoa@radioconexionweb.com'];
