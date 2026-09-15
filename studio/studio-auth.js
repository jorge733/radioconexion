/* =========================================================
   RADIO CONEXIÓN STUDIO
   AUTENTICACIÓN PRIVADA V1
========================================================= */

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  firebaseConfig
} from "../firebase-config.js";


/* =========================================================
   CONFIGURACIÓN
========================================================= */

/*
  Esta es la cuenta administrativa que ya utiliza
  Radio Conexión.

  Debe coincidir con la cuenta administrativa existente
  en Firebase y con la utilizada actualmente por la cabina.
*/

const STUDIO_ADMIN_EMAIL =
  "sabenedettoa@radioconexionweb.com";


/* =========================================================
   FIREBASE
========================================================= */

const app =
  getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig);

const auth =
  getAuth(app);

const googleProvider =
  new GoogleAuthProvider();


/*
  Forzamos el selector de cuentas.

  Esto evita que Google entre silenciosamente con otra
  cuenta que esté abierta en el navegador.
*/

googleProvider.setCustomParameters({
  prompt: "select_account"
});


/* =========================================================
   ELEMENTOS DE LA INTERFAZ
========================================================= */

const authGate =
  document.getElementById("studioAuthGate");

const studioApp =
  document.getElementById("studioApp");

const loginButton =
  document.getElementById("studioLoginBtn");

const logoutButton =
  document.getElementById("studioLogoutBtn");

const loginError =
  document.getElementById("studioLoginError");

const authLoading =
  document.getElementById("studioAuthLoading");

const authLoginContent =
  document.getElementById("studioAuthLoginContent");

const studioUserEmail =
  document.getElementById("studioUserEmail");


/* =========================================================
   UTILIDADES
========================================================= */

function normalizeEmail(email) {

  return String(email || "")
    .trim()
    .toLowerCase();
}


function isStudioAdministrator(user) {

  if (!user) {
    return false;
  }

  return (
    normalizeEmail(user.email) ===
    normalizeEmail(STUDIO_ADMIN_EMAIL)
  );
}


function showLoginError(message) {

  if (!loginError) {
    return;
  }

  loginError.textContent =
    message;

  loginError.hidden =
    false;
}


function clearLoginError() {

  if (!loginError) {
    return;
  }

  loginError.textContent =
    "";

  loginError.hidden =
    true;
}


/* =========================================================
   ESTADO: COMPROBANDO SESIÓN
========================================================= */

function showCheckingSession() {

  if (authGate) {
    authGate.hidden = false;
  }

  if (studioApp) {
    studioApp.hidden = true;
  }

  if (authLoading) {
    authLoading.hidden = false;
  }

  if (authLoginContent) {
    authLoginContent.hidden = true;
  }
}


/* =========================================================
   ESTADO: LOGIN
========================================================= */

function showLogin() {

  if (authGate) {
    authGate.hidden = false;
  }

  if (studioApp) {
    studioApp.hidden = true;
  }

  if (authLoading) {
    authLoading.hidden = true;
  }

  if (authLoginContent) {
    authLoginContent.hidden = false;
  }

  if (studioUserEmail) {
    studioUserEmail.textContent = "";
  }
}


/* =========================================================
   ESTADO: STUDIO AUTORIZADO
========================================================= */

function showStudio(user) {

  clearLoginError();

  if (authGate) {
    authGate.hidden = true;
  }

  if (studioApp) {
    studioApp.hidden = false;
  }

  if (authLoading) {
    authLoading.hidden = true;
  }

  if (authLoginContent) {
    authLoginContent.hidden = true;
  }

  if (studioUserEmail) {
    studioUserEmail.textContent =
      user.email || "Radio Conexión";
  }
}


/* =========================================================
   INICIAR SESIÓN
========================================================= */

async function loginToStudio() {

  clearLoginError();

  if (!loginButton) {
    return;
  }

  const originalText =
    loginButton.textContent;

  loginButton.disabled =
    true;

  loginButton.textContent =
    "ABRIENDO GOOGLE...";

  try {

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );

    const user =
      result.user;


    /*
      El usuario puede autenticarse correctamente con Google,
      pero eso NO significa que tenga permiso para Studio.
    */

    if (
      !isStudioAdministrator(user)
    ) {

      await signOut(auth);

      showLogin();

      showLoginError(
        "Esta cuenta no tiene autorización para acceder a Radio Conexión Studio."
      );

      return;
    }


    showStudio(user);

  }
  catch (error) {

    console.error(
      "Error de autenticación de Studio:",
      error
    );


    /*
      Si el usuario simplemente cerró la ventana de Google,
      mostramos un mensaje más natural.
    */

    if (
      error.code ===
        "auth/popup-closed-by-user" ||
      error.code ===
        "auth/cancelled-popup-request"
    ) {

      showLoginError(
        "El inicio de sesión fue cancelado."
      );

      return;
    }


    if (
      error.code ===
      "auth/popup-blocked"
    ) {

      showLoginError(
        "El navegador bloqueó la ventana de acceso. Permite las ventanas emergentes e inténtalo nuevamente."
      );

      return;
    }


    showLoginError(
      "No fue posible iniciar sesión. Inténtalo nuevamente."
    );

  }
  finally {

    loginButton.disabled =
      false;

    loginButton.textContent =
      originalText;
  }
}


/* =========================================================
   CERRAR SESIÓN
========================================================= */

async function logoutFromStudio() {

  if (!logoutButton) {
    return;
  }

  const originalText =
    logoutButton.textContent;

  logoutButton.disabled =
    true;

  logoutButton.textContent =
    "CERRANDO...";

  try {

    await signOut(auth);

  }
  catch (error) {

    console.error(
      "Error al cerrar Studio:",
      error
    );

    alert(
      "No pudimos cerrar la sesión. Inténtalo nuevamente."
    );

  }
  finally {

    logoutButton.disabled =
      false;

    logoutButton.textContent =
      originalText;
  }
}


/* =========================================================
   OBSERVADOR DE FIREBASE
========================================================= */

/*
  Esta es la parte fundamental.

  Cada vez que alguien abre /studio/, Firebase comprueba
  automáticamente si existe una sesión activa.
*/

showCheckingSession();


onAuthStateChanged(
  auth,
  async user => {

    /*
      SIN SESIÓN
    */

    if (!user) {

      showLogin();

      return;
    }


    /*
      SESIÓN AUTORIZADA
    */

    if (
      isStudioAdministrator(user)
    ) {

      showStudio(user);

      return;
    }


    /*
      HAY UNA SESIÓN FIREBASE, PERO NO CORRESPONDE
      A LA CUENTA ADMINISTRATIVA.

      La cerramos inmediatamente.
    */

    try {

      await signOut(auth);

    }
    catch (error) {

      console.error(
        "No se pudo cerrar una sesión no autorizada:",
        error
      );
    }


    showLogin();


    showLoginError(
      "La cuenta actualmente conectada no tiene acceso a Radio Conexión Studio."
    );
  }
);


/* =========================================================
   EVENTOS
========================================================= */

if (loginButton) {

  loginButton.addEventListener(
    "click",
    loginToStudio
  );
}


if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    logoutFromStudio
  );
}


/* =========================================================
   EXPORTACIONES PARA FUTURAS FUNCIONES DE STUDIO
========================================================= */

/*
  Más adelante la Cabina utilizará esta misma sesión para
  obtener el Firebase ID Token y consultar las APIs privadas.
*/

export {
  auth,
  isStudioAdministrator
};