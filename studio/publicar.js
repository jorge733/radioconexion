/* =========================================================
   RADIO CONEXIÓN STUDIO
   PUBLICAR V1
========================================================= */

import {
  auth,
  isStudioAdministrator
} from "./studio-auth.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getStorage, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig } from "../firebase-config.js";

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

import {
  confirmModal
} from "./modal.js";

import {
  montarEditorBoletin
} from "../boletin-editor.js";


/* =========================================================
   ESTADO
========================================================= */

let editorBoletin = null;


/* =========================================================
   ELEMENTOS
========================================================= */

function getPublicarElements() {

  return {

    noticeType:
      document.getElementById(
        "studioNoticeType"
      ),

    noticeTitle:
      document.getElementById(
        "studioNoticeTitle"
      ),

    noticeBody:
      document.getElementById(
        "studioNoticeBody"
      ),

    noticeTitleCount:
      document.getElementById(
        "studioNoticeTitleCount"
      ),

    noticeBodyCount:
      document.getElementById(
        "studioNoticeBodyCount"
      ),

    sendNoticeButton:
      document.getElementById(
        "studioSendNoticeBtn"
      ),

    noticeStatus:
      document.getElementById(
        "studioNoticeStatus"
      ),

    episodeNumber: document.getElementById("studioEpisodeNumber"),
    episodeTitle: document.getElementById("studioEpisodeTitle"),
    episodeDate: document.getElementById("studioEpisodeDate"),
    episodeSummary: document.getElementById("studioEpisodeSummary"),
    episodeAudio: document.getElementById("studioEpisodeAudio"),
    episodeCover: document.getElementById("studioEpisodeCover"),
    publishEpisodeButton: document.getElementById("studioPublishEpisodeBtn"),
    episodeStatus: document.getElementById("studioEpisodeStatus")

  };
}


/* =========================================================
   API PRIVADA
========================================================= */

async function llamarApiPublicar(
  url,
  payload = null,
  method = "POST"
) {

  const user =
    auth.currentUser;


  if (!user) {

    throw new Error(
      "La sesión de Studio no está activa."
    );
  }


  if (
    !isStudioAdministrator(user)
  ) {

    throw new Error(
      "Esta cuenta no tiene autorización para publicar."
    );
  }


  const token =
    await user.getIdToken();


  const options = {

    method,

    headers: {
      "Content-Type":
        "application/json",

      Authorization:
        `Bearer ${token}`
    }

  };


  if (
    method !== "GET" &&
    payload !== null
  ) {

    options.body =
      JSON.stringify(payload);
  }


  const response =
    await fetch(
      url,
      options
    );


  if (!response.ok) {

    let data = {};

    try {

      data =
        await response.json();

    }
    catch {

      data = {};
    }


    throw new Error(
      data.error ||
      "No fue posible procesar la solicitud."
    );
  }


  return response.json();
}


/* =========================================================
   MENSAJES DE ESTADO
========================================================= */

function setNoticeStatus(
  message,
  state = ""
) {

  const {
    noticeStatus
  } = getPublicarElements();


  if (!noticeStatus) {
    return;
  }


  noticeStatus.textContent =
    message;


  noticeStatus.dataset.state =
    state;
}


function setEpisodeStatus(message, state = "") {
  const { episodeStatus } = getPublicarElements();
  if (!episodeStatus) return;
  episodeStatus.textContent = message;
  episodeStatus.dataset.state = state;
}

function safeFileName(file) {
  const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${crypto.randomUUID()}.${extension || "bin"}`;
}

function uploadFile(path, file, isPublic) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type, customMetadata: { isPublic: String(isPublic) } });
    task.on("state_changed", snapshot => {
      const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      setEpisodeStatus(`Subiendo archivos… ${percent}%`);
    }, reject, () => resolve(path));
  });
}

async function publicarEpisodio() {
  const elements = getPublicarElements();
  const audio = elements.episodeAudio?.files?.[0];
  const cover = elements.episodeCover?.files?.[0];
  const number = elements.episodeNumber?.value.trim();
  const title = elements.episodeTitle?.value.trim();
  const date = elements.episodeDate?.value;
  const summary = elements.episodeSummary?.value.trim();
  if (!number || !title || !date || !audio) {
    setEpisodeStatus("Completa número, título, fecha y el archivo de audio.", "error");
    return;
  }
  if (audio.size > 500 * 1024 * 1024) {
    setEpisodeStatus("El audio supera el límite de 500 MB.", "error");
    return;
  }
  const user = auth.currentUser;
  if (!user || !isStudioAdministrator(user)) {
    setEpisodeStatus("Tu sesión no tiene permiso para publicar.", "error");
    return;
  }
  const button = elements.publishEpisodeButton;
  const originalText = button.textContent;
  button.disabled = true;
  try {
    const audioPath = `podcast/audio/${safeFileName(audio)}`;
    const coverPath = cover ? `podcast/covers/${safeFileName(cover)}` : "";
    setEpisodeStatus("Subiendo audio…");
    await uploadFile(audioPath, audio, false);
    if (cover) await uploadFile(coverPath, cover, true);
    setEpisodeStatus("Guardando y publicando el episodio…");
    const result = await llamarApiPublicar("/api/episodes", { number, title, date, summary, audioPath, coverPath, duration: "" });
    if (!result.ok) throw new Error("No pudimos publicar el episodio.");
    setEpisodeStatus("Publicado. Este es ahora el episodio abierto para toda la audiencia.", "ok");
    elements.episodeAudio.value = "";
    elements.episodeCover.value = "";
  } catch (error) {
    console.error("Episode publish failed:", error);
    setEpisodeStatus(error.message || "No pudimos subir el episodio.", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}


/* =========================================================
   CONTADORES DE CARACTERES
========================================================= */

function actualizarContadoresAviso() {

  const {
    noticeTitle,
    noticeBody,
    noticeTitleCount,
    noticeBodyCount
  } = getPublicarElements();


  if (
    noticeTitle &&
    noticeTitleCount
  ) {

    noticeTitleCount.textContent =
      `${noticeTitle.value.length}/90`;

  }


  if (
    noticeBody &&
    noticeBodyCount
  ) {

    noticeBodyCount.textContent =
      `${noticeBody.value.length}/180`;

  }
}


/* =========================================================
   ENVIAR AVISO
========================================================= */

async function enviarAviso() {

  const elements =
    getPublicarElements();


  if (
    !elements.noticeType ||
    !elements.noticeTitle ||
    !elements.noticeBody ||
    !elements.sendNoticeButton
  ) {

    return;
  }


  const kind =
    elements.noticeType.value;


  const title =
    elements.noticeTitle.value.trim();


  const body =
    elements.noticeBody.value.trim();


  if (
    !title ||
    !body
  ) {

    setNoticeStatus(
      "Escribe un título y un mensaje.",
      "error"
    );

    return;
  }


  const originalText =
    elements.sendNoticeButton.textContent;


  elements.sendNoticeButton.disabled =
    true;


  elements.sendNoticeButton.textContent =
    "ENVIANDO...";


  setNoticeStatus(
    "Enviando aviso..."
  );


  try {

    const result =
      await llamarApiPublicar(
        "/api/send-push",
        {
          kind,
          title,
          body
        },
        "POST"
      );


    const sent =
      Number.isFinite(
        Number(result.sent)
      )
        ? Number(result.sent)
        : 0;


    setNoticeStatus(
      `Aviso enviado a ${sent} dispositivo(s).`,
      "ok"
    );


    elements.noticeTitle.value =
      "";


    elements.noticeBody.value =
      "";


    actualizarContadoresAviso();

  }
  catch (error) {

    console.error(
      "Error al enviar aviso:",
      error
    );


    setNoticeStatus(
      error.message ||
      "No pudimos enviar el aviso.",
      "error"
    );

  }
  finally {

    elements.sendNoticeButton.disabled =
      false;


    elements.sendNoticeButton.textContent =
      originalText;

  }
}


/* =========================================================
   ACTIVACIÓN DE LA SECCIÓN PUBLICAR
========================================================= */

function prepararPublicar() {

  const root =
    document.getElementById("studioNewsletterEditor");

  if (!root) {
    return;
  }

  if (!editorBoletin) {

    editorBoletin =
      montarEditorBoletin(root, {
        llamarApi: llamarApiPublicar,
        correo: () => auth.currentUser?.email || "tu correo",
        clases: {
          campo: "publicar-field",
          boton: "publicar-secondary-button",
          botonPequeno: "publicar-secondary-button publicar-small-button",
          botonPrincipal: "publicar-primary-button",
          acciones: "publicar-actions",
          estado: "publicar-status",
          etiqueta: "publicar-label",
          nota: "publicar-muted",
          fila: "publicar-history-row",
          lista: "publicar-history-list",
          vacio: "publicar-muted"
        },
        confirmar: message => confirmModal({
          title: "Enviar boletín",
          message,
          confirmText: "ENVIAR",
          cancelText: "CANCELAR",
          type: "warning"
        })
      });
  }

  editorBoletin.iniciar();
}


/* =========================================================
   EVENTOS
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const elements =
      getPublicarElements();


    if (elements.noticeTitle) {

      elements.noticeTitle.addEventListener(
        "input",
        actualizarContadoresAviso
      );

    }


    if (elements.noticeBody) {

      elements.noticeBody.addEventListener(
        "input",
        actualizarContadoresAviso
      );

    }


    if (elements.sendNoticeButton) {

      elements.sendNoticeButton.addEventListener(
        "click",
        enviarAviso
      );

    }


    if (elements.publishEpisodeButton) {
      elements.publishEpisodeButton.addEventListener("click", publicarEpisodio);
    }


    /*
      Detectamos cuándo se pulsa PUBLICAR en la
      navegación principal de Studio.

      cabina.js sigue encargándose de mostrar/ocultar
      las secciones. Aquí solamente preparamos el
      editor del boletín.
    */

    document
      .querySelectorAll(
        "[data-studio-section]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              if (
                button.dataset.studioSection ===
                "publicar"
              ) {

                prepararPublicar();

              }

            }
          );

        }
      );


    actualizarContadoresAviso();

  }
);


/* =========================================================
   EXPORTACIONES
========================================================= */

export {
  enviarAviso,
  prepararPublicar,
  publicarEpisodio
};
