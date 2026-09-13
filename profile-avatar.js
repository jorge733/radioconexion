import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  const photo = document.getElementById('profile-avatar');
  const fallback = document.getElementById('profile-avatar-fallback');
  const link = document.getElementById('profile-link');
  if (!photo || !fallback || !link) return;
  if (user?.photoURL) {
    photo.src = user.photoURL;
    photo.hidden = false;
    fallback.hidden = true;
    link.setAttribute('aria-label', `Abrir perfil de ${user.displayName || 'suscriptor'}`);
    link.title = user.displayName || 'Mi perfil';
  } else {
    photo.hidden = true;
    fallback.hidden = false;
    link.setAttribute('aria-label', 'Abrir acceso de suscriptores');
    link.title = 'Suscriptores';
  }
});
