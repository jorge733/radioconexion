// Núcleo compartido de la comunidad: Firebase, sesión y utilidades.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, ADMIN_EMAIL } from './firebase-config.js';

export * from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
auth.languageCode = 'es';

export const isAdminUser = user => Boolean(user && user.emailVerified && user.email?.toLowerCase() === ADMIN_EMAIL);

export function watchUser(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    // Si el navegador bloquea la ventana emergente, usamos redirección.
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return;
    throw error;
  }
}

export const logOut = () => signOut(auth);

// Extrae el identificador de un archivo de Google Drive desde un enlace o id.
export function driveIdFrom(value) {
  const text = String(value || '').trim();
  const patterns = [/\/file\/d\/([A-Za-z0-9_-]{20,})/, /[?&]id=([A-Za-z0-9_-]{20,})/, /^([A-Za-z0-9_-]{20,100})$/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export const drivePreviewUrl = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function formatDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Solo aceptamos fotos https para evitar enlaces extraños en los perfiles.
export const safePhoto = url => (/^https:\/\//i.test(String(url || '')) ? String(url) : '');

export function avatarHtml(member, size = 56) {
  const photo = safePhoto(member?.photoURL);
  const initial = escapeHtml((member?.name || '?').trim().charAt(0).toUpperCase() || '?');
  return photo
    ? `<img class="avatar" src="${escapeHtml(photo)}" width="${size}" height="${size}" alt="" referrerpolicy="no-referrer" loading="lazy">`
    : `<span class="avatar avatar--initial" style="width:${size}px;height:${size}px" aria-hidden="true">${initial}</span>`;
}

export function friendlyError(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return 'No tienes permiso para hacer esto.';
  if (code.includes('unavailable') || code.includes('network')) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
  if (code.includes('unauthorized-domain')) return 'Este dominio no está autorizado para iniciar sesión.';
  return 'Algo salió mal. Inténtalo de nuevo en unos minutos.';
}
