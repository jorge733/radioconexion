/* =========================================================
   RADIO CONEXIÓN STUDIO
   EPISODIOS UI V1.2
========================================================= */

import {
  loadEpisodes,
  archiveCurrentSession,
  deleteEpisode,
  getEpisodesSorted,
  getEpisodeStatus,
  getEpisodesSummary,
  openEpisode,
  formatDuration,
  formatEpisodeDate,
  formatSavedDate
} from "./episodios.js";

import {
  confirmModal
} from "./modal.js";


/* =========================================================
   ESTADO
========================================================= */

let searchTerm = "";


/* =========================================================
   ELEMENTOS
========================================================= */

function getElements() {

  return {

    section:
      document.getElementById(
        "studioSectionEpisodios"
      ),

    list:
      document.getElementById(
        "studioEpisodesList"
      ),

    search:
      document.getElementById(
        "studioEpisodesSearch"
      ),

    count:
      document.getElementById(
        "studioEpisodesCount"
      ),

    status:
      document.getElementById(
        "studioEpisodesStatus"
      ),

    total:
      document.getElementById(
        "studioEpisodesTotal"
      ),

    finished:
      document.getElementById(
        "studioEpisodesFinished"
      ),

    progress:
      document.getElementById(
        "studioEpisodesProgress"
      ),

    drafts:
      document.getElementById(
        "studioEpisodesDrafts"
      ),

    newEpisodeButton:
      document.getElementById(
        "studioNewEpisodeBtn"
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


function normalizeSearch(value) {

  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-CL");

}


/* =========================================================
   MENSAJE DE ESTADO
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
   RESUMEN
========================================================= */

function renderSummary() {

  const elements =
    getElements();

  const summary =
    getEpisodesSummary();

  if (elements.total) {

    elements.total.textContent =
      summary.total;

  }

  if (elements.finished) {

    elements.finished.textContent =
      summary.finished;

  }

  if (elements.progress) {

    elements.progress.textContent =
      summary.inProgress;

  }

  if (elements.drafts) {

    elements.drafts.textContent =
      summary.drafts;

  }

}


/* =========================================================
   FILTRAR
========================================================= */

function getFilteredEpisodes() {

  const episodes =
    getEpisodesSorted();

  const term =
    normalizeSearch(
      searchTerm
    );

  if (!term) {

    return episodes;

  }

  return episodes.filter(
    episode => {

      const searchable =
        [
          episode.episodeNumber,
          episode.title,
          episode.date,
          episode.notes
        ]
          .join(" ")
          .toLocaleLowerCase("es-CL");

      return searchable.includes(
        term
      );

    }
  );

}


/* =========================================================
   METADATOS
========================================================= */

function createMetadata(episode) {

  const marks =
    Array.isArray(
      episode.marks
    )
      ? episode.marks.length
      : 0;

  const blocks =
    Array.isArray(
      episode.blocks
    )
      ? episode.blocks.length
      : 0;

  const values = [

    `📅 ${formatEpisodeDate(
      episode.date
    )}`,

    `⏱ ${formatDuration(
      episode.elapsedSeconds
    )}`,

    `✂ ${marks} ${
      marks === 1
        ? "marca"
        : "marcas"
    }`,

    `☷ ${blocks} ${
      blocks === 1
        ? "bloque"
        : "bloques"
    }`

  ];

  if (
    episode.updatedAt
  ) {

    const saved =
      formatSavedDate(
        episode.updatedAt
      );

    if (saved) {

      values.push(
        `Guardado ${saved}`
      );

    }

  }

  return values;

}


/* =========================================================
   ABRIR EPISODIO
========================================================= */

function handleOpenEpisode(
  episode
) {

  const currentArchive =
    archiveCurrentSession();

  if (
    currentArchive.reason ===
    "storage-error"
  ) {

    setStatus(
      "No pudimos guardar la sesión actual antes de abrir el episodio.",
      "error"
    );

    return;

  }

  const opened =
    openEpisode(
      episode.id
    );

  if (!opened) {

    setStatus(
      "No pudimos abrir este episodio.",
      "error"
    );

    return;

  }

  /*
   * studio.js reconstruye la sesión activa
   * desde localStorage al cargar la página.
   */

  window.location.reload();

}


/* =========================================================
   ELIMINAR EPISODIO
========================================================= */

async function handleDeleteEpisode(
  episode
) {

  const number =
    episode.episodeNumber
      ? ` ${episode.episodeNumber}`
      : "";

  const title =
    episode.title
      ? ` — ${episode.title}`
      : "";

  const confirmed =
    await confirmModal({
      title: "Eliminar episodio",
      message:
        `¿Quieres eliminar el episodio${number}${title} del historial?\n\n` +
        "Esta acción no se puede deshacer.",
      confirmText: "ELIMINAR",
      cancelText: "CANCELAR",
      danger: true
    });

  if (!confirmed) {

    return;

  }

  const deleted =
    deleteEpisode(
      episode.id
    );

  if (!deleted) {

    setStatus(
      "No pudimos eliminar el episodio.",
      "error"
    );

    return;

  }

  renderEpisodes();

  setStatus(
    "Episodio eliminado del historial.",
    "ok"
  );

}


/* =========================================================
   CREAR TARJETA
========================================================= */

function createEpisodeCard(
  episode
) {

  const article =
    document.createElement(
      "article"
    );

  article.className =
    "episode-history-card";

  const status =
    getEpisodeStatus(
      episode
    );

  const episodeNumber =
    String(
      episode.episodeNumber ||
      "—"
    );

  const title =
    String(
      episode.title ||
      "Episodio sin título"
    );

  const metadata =
    createMetadata(
      episode
    );

  article.innerHTML = `

    <div class="episode-history-main">

      <div class="episode-history-number">
        ${escapeHTML(
          episodeNumber
        )}
      </div>

      <div class="episode-history-info">

        <div class="episode-history-title-row">

          <strong class="episode-history-title">
            ${escapeHTML(
              title
            )}
          </strong>

          <span
            class="episode-history-status ${escapeHTML(
              status.key
            )}"
          >
            ${escapeHTML(
              status.label
            )}
          </span>

        </div>

        <div class="episode-history-meta">

          ${metadata
            .map(
              item => `
                <span>
                  ${escapeHTML(item)}
                </span>
              `
            )
            .join("")}

        </div>

      </div>

    </div>

    <div class="episode-history-actions">

      <button
        class="episode-history-open"
        type="button"
      >
        ABRIR EN PRODUCCIÓN
      </button>

      <button
        class="episode-history-delete"
        type="button"
        title="Eliminar episodio"
        aria-label="Eliminar episodio"
      >
        ×
      </button>

    </div>

  `;

  const openButton =
    article.querySelector(
      ".episode-history-open"
    );

  const deleteButton =
    article.querySelector(
      ".episode-history-delete"
    );

  openButton.addEventListener(
    "click",
    () => {

      handleOpenEpisode(
        episode
      );

    }
  );

  deleteButton.addEventListener(
    "click",
    () => {

      handleDeleteEpisode(
        episode
      );

    }
  );

  return article;

}


/* =========================================================
   ESTADO VACÍO
========================================================= */

function renderEmptyState(
  searching = false
) {

  const {
    list
  } = getElements();

  if (!list) {

    return;

  }

  const empty =
    document.createElement(
      "div"
    );

  empty.className =
    "episodes-empty";

  if (searching) {

    empty.innerHTML = `

      <span
        class="episodes-empty-icon"
        aria-hidden="true"
      >
        🔎
      </span>

      <strong>
        No encontramos episodios
      </strong>

      <p>
        Prueba buscando otro número,
        título, fecha o palabra.
      </p>

    `;

  }
  else {

    empty.innerHTML = `

      <span
        class="episodes-empty-icon"
        aria-hidden="true"
      >
        📚
      </span>

      <strong>
        Aún no hay episodios guardados
      </strong>

      <p>
        Cuando archives una producción,
        aparecerá aquí con su pauta,
        duración, notas y marcas de edición.
      </p>

    `;

  }

  list.appendChild(
    empty
  );

}


/* =========================================================
   RENDERIZAR
========================================================= */

function renderEpisodes() {

  loadEpisodes();

  const elements =
    getElements();

  if (!elements.list) {

    return;

  }

  renderSummary();

  const episodes =
    getFilteredEpisodes();

  elements.list.replaceChildren();

  if (elements.count) {

    const total =
      getEpisodesSorted().length;

    if (
      searchTerm.trim()
    ) {

      elements.count.textContent =
        `${episodes.length} de ${total} episodio(s)`;

    }
    else {

      elements.count.textContent =
        `${total} episodio(s)`;

    }

  }

  if (
    episodes.length === 0
  ) {

    renderEmptyState(
      Boolean(
        searchTerm.trim()
      )
    );

    return;

  }

  episodes.forEach(
    episode => {

      elements.list.appendChild(
        createEpisodeCard(
          episode
        )
      );

    }
  );

}


/* =========================================================
   ARCHIVAR SESIÓN ACTUAL
========================================================= */

function archiveCurrentProduction(
  showMessage = true
) {

  const result =
    archiveCurrentSession();

  renderEpisodes();

  if (!showMessage) {

    return result;

  }

  if (result.ok) {

    const number =
      result.episode?.episodeNumber
        ? ` ${result.episode.episodeNumber}`
        : "";

    setStatus(
      `Episodio${number} guardado en el historial.`,
      "ok"
    );

  }
  else if (
    result.reason ===
    "empty"
  ) {

    setStatus(
      "La sesión actual todavía no tiene contenido para guardar."
    );

  }
  else {

    setStatus(
      "No pudimos guardar la sesión actual.",
      "error"
    );

  }

  return result;

}


/* =========================================================
   NUEVO EPISODIO
========================================================= */

async function createNewEpisode() {

  const confirmed =
    await confirmModal({
      title: "Comenzar episodio nuevo",
      message:
        "La producción actual se guardará en el historial antes de crear la nueva sesión.",
      confirmText: "COMENZAR EPISODIO",
      cancelText: "CANCELAR",
      type: "warning"
    });

  if (!confirmed) {

    return;

  }

  /*
   * Primero guardamos la producción actual.
   */

  const result =
    archiveCurrentProduction(
      false
    );

  if (
    result.reason ===
    "storage-error"
  ) {

    setStatus(
      "No pudimos guardar la producción actual. No se creó una sesión nueva.",
      "error"
    );

    return;

  }

  /*
   * Eliminamos únicamente la sesión activa.
   * El historial permanece intacto.
   */

  localStorage.removeItem(
    "radioConexionStudioV2"
  );

  window.location.reload();

}


/* =========================================================
   PREPARAR SECCIÓN EPISODIOS
========================================================= */

function prepareEpisodesSection() {

  /*
   * Cada vez que Cabina.js abre Episodios,
   * archivamos primero la producción actual.
   */

  archiveCurrentProduction(
    false
  );

  renderEpisodes();

  setStatus(
    "Historial actualizado.",
    "ok"
  );

}


/* =========================================================
   CAMBIO DE SECCIÓN
========================================================= */

/*
 * IMPORTANTE:
 *
 * Este archivo ya NO controla la navegación del Studio.
 *
 * cabina.js es el único responsable de mostrar u ocultar:
 *
 * - Producción
 * - Cabina
 * - Publicar
 * - Episodios
 *
 * Cuando cambia de sección, cabina.js emite
 * el evento "studio:sectionchange".
 *
 * Episodios únicamente escucha ese evento.
 */

function handleStudioSectionChange(
  event
) {

  const sectionName =
    event.detail?.section;

  if (
    sectionName !==
    "episodios"
  ) {

    return;

  }

  prepareEpisodesSection();

}


/* =========================================================
   EVENTOS
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const elements =
      getElements();

    if (elements.search) {

      elements.search.addEventListener(
        "input",
        event => {

          searchTerm =
            event.target.value;

          renderEpisodes();

        }
      );

    }

    if (
      elements.newEpisodeButton
    ) {

      elements.newEpisodeButton.addEventListener(
        "click",
        createNewEpisode
      );

    }

    /*
     * Render inicial del historial.
     *
     * No muestra la sección.
     * Solo deja sus datos preparados.
     */

    renderEpisodes();

  }
);


/*
 * ÚNICO vínculo con la navegación.
 *
 * No agregamos listeners a los botones.
 */

document.addEventListener(
  "studio:sectionchange",
  handleStudioSectionChange
);


/* =========================================================
   EXPORTACIONES
========================================================= */

export {
  renderEpisodes,
  archiveCurrentProduction,
  prepareEpisodesSection
};