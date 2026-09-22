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


/* =========================================================
   ESTADO
========================================================= */

let postsBlog = [];

let blogCargado = false;
let cargandoBlog = false;


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

    blogUrl:
      document.getElementById(
        "studioBlogUrl"
      ),

    publishBlogButton:
      document.getElementById(
        "studioPublishBlogBtn"
      ),

    refreshBlogButton:
      document.getElementById(
        "studioRefreshBlogBtn"
      ),

    blogStatus:
      document.getElementById(
        "studioBlogStatus"
      ),

    blogList:
      document.getElementById(
        "studioBlogList"
      ),

    blogCount:
      document.getElementById(
        "studioBlogCount"
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
   UTILIDADES
========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function normalizarInstagramUrl(value) {

  return String(value || "")
    .trim();
}


function esUrlInstagramValida(value) {

  try {

    const url =
      new URL(value);


    const hostname =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");


    return (
      hostname === "instagram.com" ||
      hostname.endsWith(".instagram.com")
    );

  }
  catch {

    return false;
  }
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


function setBlogStatus(
  message,
  state = ""
) {

  const {
    blogStatus
  } = getPublicarElements();


  if (!blogStatus) {
    return;
  }


  blogStatus.textContent =
    message;


  blogStatus.dataset.state =
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
   BLOG
========================================================= */

function actualizarContadorBlog() {

  const {
    blogCount
  } = getPublicarElements();


  if (!blogCount) {
    return;
  }


  blogCount.textContent =
    postsBlog.length;
}


/* =========================================================
   CREAR PUBLICACIÓN DEL BLOG
========================================================= */

function crearPostBlog(post) {

  const article =
    document.createElement(
      "article"
    );


  article.className =
    "publicar-blog-item";


  const url =
    String(
      post.url || ""
    );


  article.innerHTML = `

    <div class="publicar-blog-item-main">

      <span
        class="publicar-blog-instagram-icon"
        aria-hidden="true"
      >
        ◎
      </span>


      <div class="publicar-blog-item-info">

        <span>
          PUBLICACIÓN DE INSTAGRAM
        </span>

        <a
          href="${escapeHTML(url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver publicación en Instagram ↗
        </a>

        <small>
          ${escapeHTML(url)}
        </small>

      </div>

    </div>


    <button
      class="publicar-remove-button"
      type="button"
    >
      QUITAR
    </button>

  `;


  const removeButton =
    article.querySelector(
      ".publicar-remove-button"
    );


  removeButton.addEventListener(
    "click",
    () => {

      quitarPostBlog(
        post.id,
        removeButton
      );

    }
  );


  return article;
}


/* =========================================================
   RENDERIZAR BLOG
========================================================= */

function renderizarPostsBlog() {

  const {
    blogList
  } = getPublicarElements();


  if (!blogList) {
    return;
  }


  blogList.replaceChildren();


  actualizarContadorBlog();


  if (
    postsBlog.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "publicar-empty";


    empty.innerHTML = `

      <span
        class="publicar-empty-icon"
        aria-hidden="true"
      >
        ◎
      </span>

      <strong>
        No hay publicaciones añadidas
      </strong>

      <p>
        Cuando agregues una publicación de Instagram
        aparecerá aquí y también en el Blog de Radio Conexión.
      </p>

    `;


    blogList.appendChild(
      empty
    );


    return;
  }


  postsBlog.forEach(
    post => {

      blogList.appendChild(
        crearPostBlog(post)
      );

    }
  );
}


/* =========================================================
   CARGAR BLOG
========================================================= */

async function cargarPostsBlog(
  force = false
) {

  if (
    cargandoBlog
  ) {

    return;
  }


  if (
    blogCargado &&
    !force
  ) {

    renderizarPostsBlog();

    return;
  }


  const {
    blogList,
    refreshBlogButton
  } = getPublicarElements();


  cargandoBlog =
    true;


  if (refreshBlogButton) {

    refreshBlogButton.disabled =
      true;


    refreshBlogButton.textContent =
      "ACTUALIZANDO...";

  }


  if (blogList) {

    blogList.innerHTML = `

      <div class="publicar-loading">

        <span class="publicar-loading-spinner"></span>

        <span>
          Cargando publicaciones...
        </span>

      </div>

    `;

  }


  setBlogStatus(
    "Consultando publicaciones..."
  );


  try {

    const result =
      await llamarApiPublicar(
        "/api/blog-posts",
        null,
        "GET"
      );


    postsBlog =
      Array.isArray(
        result.posts
      )
        ? result.posts
        : [];


    blogCargado =
      true;


    renderizarPostsBlog();


    if (
      postsBlog.length === 0
    ) {

      setBlogStatus(
        "El Blog no tiene publicaciones añadidas desde este panel.",
        "ok"
      );

    }
    else {

      setBlogStatus(
        `${postsBlog.length} publicación(es) en el Blog.`,
        "ok"
      );

    }

  }
  catch (error) {

    console.error(
      "Error al cargar el Blog:",
      error
    );


    if (blogList) {

      blogList.innerHTML = `

        <div class="publicar-error">

          <strong>
            No pudimos cargar el Blog
          </strong>

          <p>
            ${escapeHTML(
              error.message ||
              "Ocurrió un error al consultar las publicaciones."
            )}
          </p>

        </div>

      `;

    }


    setBlogStatus(
      error.message ||
      "No pudimos cargar las publicaciones.",
      "error"
    );

  }
  finally {

    cargandoBlog =
      false;


    if (refreshBlogButton) {

      refreshBlogButton.disabled =
        false;


      refreshBlogButton.textContent =
        "↻ ACTUALIZAR";

    }

  }
}


/* =========================================================
   PUBLICAR EN BLOG
========================================================= */

async function publicarPostBlog() {

  const {
    blogUrl,
    publishBlogButton
  } = getPublicarElements();


  if (
    !blogUrl ||
    !publishBlogButton
  ) {

    return;
  }


  const url =
    normalizarInstagramUrl(
      blogUrl.value
    );


  if (!url) {

    setBlogStatus(
      "Pega el enlace de una publicación de Instagram.",
      "error"
    );

    blogUrl.focus();

    return;
  }


  if (
    !esUrlInstagramValida(url)
  ) {

    setBlogStatus(
      "El enlace debe corresponder a Instagram.",
      "error"
    );

    blogUrl.focus();

    return;
  }


  const originalText =
    publishBlogButton.textContent;


  publishBlogButton.disabled =
    true;


  publishBlogButton.textContent =
    "PUBLICANDO...";


  setBlogStatus(
    "Publicando..."
  );


  try {

    await llamarApiPublicar(
      "/api/blog-posts",
      {
        url
      },
      "POST"
    );


    blogUrl.value =
      "";


    setBlogStatus(
      "La publicación ya aparece primero en el Blog.",
      "ok"
    );


    /*
      Forzamos una recarga para obtener exactamente
      la lista guardada por el servidor.
    */

    blogCargado =
      false;


    await cargarPostsBlog(
      true
    );

  }
  catch (error) {

    console.error(
      "Error al publicar en el Blog:",
      error
    );


    setBlogStatus(
      error.message ||
      "No pudimos publicar este enlace.",
      "error"
    );

  }
  finally {

    publishBlogButton.disabled =
      false;


    publishBlogButton.textContent =
      originalText;

  }
}


/* =========================================================
   QUITAR DEL BLOG
========================================================= */

async function quitarPostBlog(
  id,
  button
) {

  if (!id) {

    setBlogStatus(
      "Esta publicación no tiene un identificador válido.",
      "error"
    );

    return;
  }


  const confirmed =
    await confirmModal({
      title: "Retirar publicación",
      message: "¿Quieres retirar esta publicación del Blog?",
      confirmText: "RETIRAR",
      cancelText: "CANCELAR",
      danger: true
    });


  if (!confirmed) {
    return;
  }


  const originalText =
    button.textContent;


  button.disabled =
    true;


  button.textContent =
    "QUITANDO...";


  try {

    await llamarApiPublicar(
      "/api/blog-posts",
      {
        id
      },
      "DELETE"
    );


    postsBlog =
      postsBlog.filter(
        post =>
          post.id !== id
      );


    renderizarPostsBlog();


    setBlogStatus(
      "Publicación retirada del Blog.",
      "ok"
    );

  }
  catch (error) {

    console.error(
      "Error al retirar publicación:",
      error
    );


    button.disabled =
      false;


    button.textContent =
      originalText;


    setBlogStatus(
      error.message ||
      "No pudimos retirar la publicación.",
      "error"
    );

  }
}


/* =========================================================
   ACTIVACIÓN DE LA SECCIÓN PUBLICAR
========================================================= */

function prepararPublicar() {

  cargarPostsBlog();
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


    if (elements.publishBlogButton) {

      elements.publishBlogButton.addEventListener(
        "click",
        publicarPostBlog
      );

    }

    if (elements.publishEpisodeButton) {
      elements.publishEpisodeButton.addEventListener("click", publicarEpisodio);
    }


    if (elements.refreshBlogButton) {

      elements.refreshBlogButton.addEventListener(
        "click",
        () => {

          cargarPostsBlog(
            true
          );

        }
      );

    }


    /*
      Enter en el campo del enlace publica el post.
    */

    if (elements.blogUrl) {

      elements.blogUrl.addEventListener(
        "keydown",
        event => {

          if (
            event.key === "Enter"
          ) {

            event.preventDefault();

            publicarPostBlog();

          }

        }
      );

    }


    /*
      Detectamos cuándo se pulsa PUBLICAR en la
      navegación principal de Studio.

      cabina.js sigue encargándose de mostrar/ocultar
      las secciones. Aquí solamente cargamos los datos
      específicos del Blog.
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
  cargarPostsBlog,
  publicarPostBlog,
  quitarPostBlog,
  prepararPublicar,
  publicarEpisodio
};
