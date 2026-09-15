/* =========================================================
   RADIO CONEXIÓN STUDIO
   CABINA PRIVADA V2
   + CONTROL CENTRAL DE SECCIONES
========================================================= */

import {
  auth,
  isStudioAdministrator
} from "./studio-auth.js";


/* =========================================================
   ESTADO
========================================================= */

let solicitudesCabina = [];

let filtroActual = "todas";

let cabinaCargada = false;

let cargandoCabina = false;


/* =========================================================
   ELEMENTOS
========================================================= */

function getElements() {

  return {

    section:
      document.getElementById(
        "studioSectionCabina"
      ),

    list:
      document.getElementById(
        "studioCabinaList"
      ),

    status:
      document.getElementById(
        "studioCabinaStatus"
      ),

    refreshButton:
      document.getElementById(
        "studioCabinaRefreshBtn"
      ),

    total:
      document.getElementById(
        "studioCabinaTotal"
      ),

    newCount:
      document.getElementById(
        "studioCabinaNewCount"
      ),

    attendedCount:
      document.getElementById(
        "studioCabinaAttendedCount"
      ),

    playedCount:
      document.getElementById(
        "studioCabinaPlayedCount"
      ),

    discardedCount:
      document.getElementById(
        "studioCabinaDiscardedCount"
      ),

    filterButtons:
      document.querySelectorAll(
        "[data-cabina-filter]"
      )

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


function normalizeStatus(status) {

  const validStatuses = [
    "nueva",
    "atendida",
    "reproducida",
    "descartada"
  ];

  return validStatuses.includes(status)
    ? status
    : "nueva";

}


function statusLabel(status) {

  const labels = {

    nueva:
      "Nueva",

    atendida:
      "Atendida",

    reproducida:
      "Reproducida",

    descartada:
      "Descartada"

  };

  return (
    labels[normalizeStatus(status)] ||
    "Nueva"
  );

}


function formatDate(value) {

  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    "es-CL",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  );

}


/* =========================================================
   CONTENIDO DE LA SOLICITUD
========================================================= */

/*
   Conservamos la misma estructura que utiliza actualmente
   /suscriptores.

   pedir_canciones:
   cancion1, cancion2, cancion3

   mensaje:
   comentario
*/

function textoSolicitud(item) {

  if (
    item.type ===
    "pedir_canciones"
  ) {

    return [
      item.cancion1,
      item.cancion2,
      item.cancion3
    ]
      .filter(Boolean)
      .join(" · ");

  }

  return (
    item.comentario ||
    item.message ||
    ""
  );

}


function tipoSolicitud(item) {

  if (
    item.type ===
    "pedir_canciones"
  ) {

    return {
      icon: "🎵",
      label: "Solicitud de canción",
      className: "song"
    };

  }

  return {
    icon: "💬",
    label: "Mensaje de oyente",
    className: "message"
  };

}


/* =========================================================
   API PRIVADA
========================================================= */

async function llamarApiCabina(
  url,
  payload = null,
  method = "GET"
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
      "Esta cuenta no tiene autorización para acceder a la Cabina."
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
   ESTADO VISUAL
========================================================= */

function setStatus(
  message,
  state = ""
) {

  const {
    status
  } = getElements();

  if (!status) {
    return;
  }

  status.textContent =
    message;

  status.dataset.state =
    state;

}


/* =========================================================
   CONTADORES
========================================================= */

function actualizarContadores() {

  const elements =
    getElements();

  const counts = {

    total:
      solicitudesCabina.length,

    nueva:
      0,

    atendida:
      0,

    reproducida:
      0,

    descartada:
      0

  };

  solicitudesCabina.forEach(
    item => {

      const status =
        normalizeStatus(
          item.status
        );

      counts[status] += 1;

    }
  );

  if (elements.total) {

    elements.total.textContent =
      counts.total;

  }

  if (elements.newCount) {

    elements.newCount.textContent =
      counts.nueva;

  }

  if (elements.attendedCount) {

    elements.attendedCount.textContent =
      counts.atendida;

  }

  if (elements.playedCount) {

    elements.playedCount.textContent =
      counts.reproducida;

  }

  if (elements.discardedCount) {

    elements.discardedCount.textContent =
      counts.descartada;

  }

}


/* =========================================================
   FILTROS
========================================================= */

function establecerFiltro(filter) {

  const validFilters = [
    "todas",
    "nueva",
    "atendida",
    "reproducida",
    "descartada"
  ];

  filtroActual =
    validFilters.includes(filter)
      ? filter
      : "todas";

  const {
    filterButtons
  } = getElements();

  filterButtons.forEach(
    button => {

      const active =
        button.dataset.cabinaFilter ===
        filtroActual;

      button.classList.toggle(
        "active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        active
          ? "true"
          : "false"
      );

    }
  );

  renderizarSolicitudesCabina();

}


/* =========================================================
   CREAR TARJETA
========================================================= */

function crearTarjetaSolicitud(item) {

  const article =
    document.createElement(
      "article"
    );

  article.className =
    "cabina-request-card";

  article.dataset.status =
    normalizeStatus(
      item.status
    );

  const tipo =
    tipoSolicitud(item);

  const status =
    normalizeStatus(
      item.status
    );

  const when =
    formatDate(
      item.createdAt
    );

  const name =
    item.name ||
    "Oyente";

  const email =
    item.email ||
    "";

  const content =
    textoSolicitud(item);

  article.innerHTML = `

    <div class="cabina-request-top">

      <div class="cabina-request-type ${tipo.className}">

        <span
          class="cabina-request-icon"
          aria-hidden="true"
        >
          ${tipo.icon}
        </span>

        <div>

          <span class="cabina-request-kicker">
            ${escapeHTML(tipo.label)}
          </span>

          <strong>
            ${escapeHTML(name)}
          </strong>

        </div>

      </div>

      <span
        class="cabina-status-badge cabina-status-${escapeHTML(status)}"
      >
        ${escapeHTML(statusLabel(status))}
      </span>

    </div>


    <div class="cabina-request-meta">

      ${
        email
          ? `
            <span>
              ${escapeHTML(email)}
            </span>
          `
          : ""
      }

      ${
        when
          ? `
            <span>
              ${escapeHTML(when)}
            </span>
          `
          : ""
      }

    </div>


    <div class="cabina-request-content">
      ${
        content
          ? escapeHTML(content)
          : "Sin contenido."
      }
    </div>


    <div class="cabina-request-controls">

      <label>

        <span>
          ESTADO
        </span>

        <select
          class="cabina-status-select"
          aria-label="Estado de la solicitud"
        >

          <option
            value="nueva"
            ${
              status === "nueva"
                ? "selected"
                : ""
            }
          >
            Nueva
          </option>

          <option
            value="atendida"
            ${
              status === "atendida"
                ? "selected"
                : ""
            }
          >
            Atendida
          </option>

          <option
            value="reproducida"
            ${
              status === "reproducida"
                ? "selected"
                : ""
            }
          >
            Reproducida
          </option>

          <option
            value="descartada"
            ${
              status === "descartada"
                ? "selected"
                : ""
            }
          >
            Descartada
          </option>

        </select>

      </label>


      <button
        class="cabina-save-button"
        type="button"
      >
        GUARDAR
      </button>

    </div>

  `;

  const select =
    article.querySelector(
      ".cabina-status-select"
    );

  const saveButton =
    article.querySelector(
      ".cabina-save-button"
    );

  saveButton.addEventListener(
    "click",
    () => {

      actualizarSolicitudCabina(
        item.id,
        select.value,
        saveButton
      );

    }
  );

  return article;

}


/* =========================================================
   RENDERIZAR BANDEJA
========================================================= */

function renderizarSolicitudesCabina() {

  const {
    list
  } = getElements();

  if (!list) {
    return;
  }

  list.replaceChildren();

  const records =
    solicitudesCabina.filter(
      item => {

        if (
          filtroActual ===
          "todas"
        ) {

          return true;

        }

        return (
          normalizeStatus(
            item.status
          ) === filtroActual
        );

      }
    );

  if (
    records.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "cabina-empty";

    empty.innerHTML = `

      <span
        class="cabina-empty-icon"
        aria-hidden="true"
      >
        📭
      </span>

      <strong>
        ${
          filtroActual === "todas"
            ? "La bandeja está vacía"
            : "No hay solicitudes en esta categoría"
        }
      </strong>

      <p>
        ${
          filtroActual === "todas"
            ? "Las solicitudes de canciones y mensajes de los oyentes aparecerán aquí."
            : "Puedes seleccionar otro filtro para revisar el resto de la bandeja."
        }
      </p>

    `;

    list.appendChild(
      empty
    );

    return;

  }

  records.forEach(
    item => {

      list.appendChild(
        crearTarjetaSolicitud(
          item
        )
      );

    }
  );

}


/* =========================================================
   CARGAR BANDEJA
========================================================= */

async function cargarSolicitudesCabina(
  force = false
) {

  if (
    cargandoCabina
  ) {
    return;
  }

  if (
    cabinaCargada &&
    !force
  ) {

    renderizarSolicitudesCabina();

    return;

  }

  const {
    refreshButton,
    list
  } = getElements();

  cargandoCabina =
    true;

  if (refreshButton) {

    refreshButton.disabled =
      true;

    refreshButton.textContent =
      "ACTUALIZANDO...";

  }

  if (list) {

    list.innerHTML = `

      <div class="cabina-loading">

        <span class="cabina-loading-spinner"></span>

        <span>
          Cargando solicitudes y mensajes...
        </span>

      </div>

    `;

  }

  setStatus(
    "Conectando con la Cabina..."
  );

  try {

    const result =
      await llamarApiCabina(
        "/api/cabina-requests",
        null,
        "GET"
      );

    solicitudesCabina =
      Array.isArray(
        result.requests
      )
        ? result.requests
        : [];

    /*
      Dejamos primero las solicitudes más recientes.

      Si la API ya las entrega ordenadas, este bloque
      simplemente conserva el orden cronológico esperado.
    */

    solicitudesCabina.sort(
      (a, b) => {

        const dateA =
          new Date(
            a.createdAt || 0
          ).getTime();

        const dateB =
          new Date(
            b.createdAt || 0
          ).getTime();

        return (
          dateB -
          dateA
        );

      }
    );

    cabinaCargada =
      true;

    actualizarContadores();

    renderizarSolicitudesCabina();

    const nuevas =
      solicitudesCabina.filter(
        item =>
          normalizeStatus(
            item.status
          ) === "nueva"
      ).length;

    if (
      solicitudesCabina.length === 0
    ) {

      setStatus(
        "No hay solicitudes en la bandeja.",
        "ok"
      );

    }
    else if (
      nuevas > 0
    ) {

      setStatus(
        `${solicitudesCabina.length} solicitud(es) · ${nuevas} nueva(s).`,
        "ok"
      );

    }
    else {

      setStatus(
        `${solicitudesCabina.length} solicitud(es) en la bandeja.`,
        "ok"
      );

    }

  }
  catch (error) {

    console.error(
      "Error al cargar la Cabina:",
      error
    );

    if (list) {

      list.innerHTML = `

        <div class="cabina-error">

          <strong>
            No pudimos abrir la Cabina
          </strong>

          <p>
            ${escapeHTML(
              error.message ||
              "Ocurrió un error al cargar la bandeja."
            )}
          </p>

        </div>

      `;

    }

    setStatus(
      error.message ||
      "No pudimos cargar la bandeja.",
      "error"
    );

  }
  finally {

    cargandoCabina =
      false;

    if (refreshButton) {

      refreshButton.disabled =
        false;

      refreshButton.textContent =
        "↻ ACTUALIZAR";

    }

  }

}


/* =========================================================
   ACTUALIZAR ESTADO
========================================================= */

async function actualizarSolicitudCabina(
  id,
  newStatus,
  button
) {

  if (!id) {

    setStatus(
      "Esta solicitud no tiene un identificador válido.",
      "error"
    );

    return;

  }

  const status =
    normalizeStatus(
      newStatus
    );

  const originalText =
    button.textContent;

  button.disabled =
    true;

  button.textContent =
    "GUARDANDO...";

  try {

    await llamarApiCabina(
      "/api/cabina-requests",
      {
        id,
        status
      },
      "PATCH"
    );

    const record =
      solicitudesCabina.find(
        item =>
          item.id === id
      );

    if (record) {

      record.status =
        status;

    }

    actualizarContadores();

    renderizarSolicitudesCabina();

    setStatus(
      `Solicitud marcada como ${statusLabel(status).toLowerCase()}.`,
      "ok"
    );

  }
  catch (error) {

    console.error(
      "Error al actualizar la solicitud:",
      error
    );

    button.disabled =
      false;

    button.textContent =
      originalText;

    setStatus(
      error.message ||
      "No pudimos guardar el nuevo estado.",
      "error"
    );

  }

}


/* =========================================================
   CONTROL CENTRAL DE SECCIONES DEL STUDIO
========================================================= */

function mostrarSeccionStudio(
  sectionName
) {

  const sections = {

    produccion:
      document.getElementById(
        "studioSectionProduccion"
      ),

    cabina:
      document.getElementById(
        "studioSectionCabina"
      ),

    publicar:
      document.getElementById(
        "studioSectionPublicar"
      ),

    episodios:
      document.getElementById(
        "studioSectionEpisodios"
      )

  };


  /*
   * Si por algún motivo recibimos una sección que no existe,
   * volvemos a Producción para no dejar Studio en blanco.
   */

  const validSection =
    Object.prototype.hasOwnProperty.call(
      sections,
      sectionName
    )
      ? sectionName
      : "produccion";


  /*
   * Mostramos exclusivamente la sección seleccionada.
   */

  Object.entries(
    sections
  ).forEach(
    ([name, section]) => {

      if (!section) {
        return;
      }

      section.hidden =
        name !== validSection;

    }
  );


  /*
   * Actualizamos visualmente la pestaña activa.
   */

  document
    .querySelectorAll(
      "[data-studio-section]"
    )
    .forEach(
      button => {

        const active =
          button.dataset.studioSection ===
          validSection;

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          active
            ? "true"
            : "false"
        );

      }
    );


  /*
   * Cabina necesita cargar sus datos al entrar.
   */

  if (
    validSection ===
    "cabina"
  ) {

    cargarSolicitudesCabina();

  }


  /*
   * Avisamos al resto de módulos qué sección
   * acaba de abrirse.

   * Esto permite que Episodios actualice su historial
   * sin volver a controlar la navegación.
   */

  document.dispatchEvent(
    new CustomEvent(
      "studio:sectionchange",
      {
        detail: {
          section:
            validSection
        }
      }
    )
  );

}


/* =========================================================
   EVENTOS
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const {
      refreshButton,
      filterButtons
    } = getElements();


    /*
     * Actualizar Cabina
     */

    if (refreshButton) {

      refreshButton.addEventListener(
        "click",
        () => {

          cargarSolicitudesCabina(
            true
          );

        }
      );

    }


    /*
     * Filtros de Cabina
     */

    filterButtons.forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            establecerFiltro(
              button.dataset.cabinaFilter
            );

          }
        );

      }
    );


    /*
     * NAVEGACIÓN CENTRAL DEL STUDIO

     * Este es el único controlador que debe decidir
     * qué sección se muestra.
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

              mostrarSeccionStudio(
                button.dataset.studioSection
              );

            }
          );

        }
      );

  }
);


/* =========================================================
   EXPORTACIONES
========================================================= */

export {
  cargarSolicitudesCabina,
  renderizarSolicitudesCabina,
  mostrarSeccionStudio
};