/* =========================================================
   RADIO CONEXIÓN STUDIO
   EPISODIOS V1
   Historial local de producciones
========================================================= */


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const EPISODES_STORAGE_KEY =
  "radioConexionStudioEpisodesV1";

const CURRENT_SESSION_KEY =
  "radioConexionStudioV2";


/* =========================================================
   ESTADO
========================================================= */

let episodes = [];


/* =========================================================
   UTILIDADES
========================================================= */

function createEpisodeId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {

    return window.crypto.randomUUID();

  }


  return (
    "episode-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}


function normalizeText(value) {

  return String(value ?? "").trim();
}


function normalizeNumber(value, fallback = 0) {

  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : fallback;
}


function formatDuration(totalSeconds) {

  const seconds =
    Math.max(
      0,
      Math.floor(
        normalizeNumber(totalSeconds)
      )
    );


  const hours =
    Math.floor(seconds / 3600);


  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    );


  const remainingSeconds =
    seconds % 60;


  return [
    hours,
    minutes,
    remainingSeconds
  ]
    .map(
      value =>
        String(value).padStart(2, "0")
    )
    .join(":");
}


function formatEpisodeDate(value) {

  if (!value) {

    return "Sin fecha";

  }


  const parts =
    String(value).split("-");


  if (parts.length === 3) {

    const [
      year,
      month,
      day
    ] = parts;


    return `${day}/${month}/${year}`;

  }


  return String(value);
}


function formatSavedDate(value) {

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
   LEER HISTORIAL
========================================================= */

function loadEpisodes() {

  try {

    const raw =
      localStorage.getItem(
        EPISODES_STORAGE_KEY
      );


    if (!raw) {

      episodes = [];

      return episodes;

    }


    const parsed =
      JSON.parse(raw);


    episodes =
      Array.isArray(parsed)
        ? parsed
        : [];

  }
  catch (error) {

    console.error(
      "No fue posible leer el historial de episodios:",
      error
    );


    episodes = [];

  }


  return episodes;
}


/* =========================================================
   GUARDAR HISTORIAL
========================================================= */

function saveEpisodes() {

  try {

    localStorage.setItem(
      EPISODES_STORAGE_KEY,
      JSON.stringify(episodes)
    );


    return true;

  }
  catch (error) {

    console.error(
      "No fue posible guardar el historial de episodios:",
      error
    );


    return false;

  }
}


/* =========================================================
   SESIÓN ACTUAL
========================================================= */

function readCurrentSession() {

  try {

    const raw =
      localStorage.getItem(
        CURRENT_SESSION_KEY
      );


    if (!raw) {

      return null;

    }


    const session =
      JSON.parse(raw);


    if (
      !session ||
      typeof session !== "object"
    ) {

      return null;

    }


    return session;

  }
  catch (error) {

    console.error(
      "No fue posible leer la sesión actual:",
      error
    );


    return null;

  }
}


/* =========================================================
   NORMALIZAR EPISODIO
========================================================= */

function buildEpisodeFromSession(
  session,
  existingEpisode = null
) {

  const now =
    new Date().toISOString();


  const marks =
    Array.isArray(session.marks)
      ? session.marks
      : [];


  const blocks =
    Array.isArray(session.blocks)
      ? session.blocks
      : [];


  return {

    id:
      existingEpisode?.id ||
      session.episodeId ||
      createEpisodeId(),

    episodeNumber:
      normalizeText(
        session.episodeNumber
      ),

    title:
      normalizeText(
        session.title
      ),

    date:
      normalizeText(
        session.date
      ),

    notes:
      String(
        session.notes ?? ""
      ),

    elapsedSeconds:
      normalizeNumber(
        session.elapsedSeconds
      ),

    paused:
      Boolean(
        session.paused
      ),

    finished:
      Boolean(
        session.finished
      ),

    currentBlockIndex:
      normalizeNumber(
        session.currentBlockIndex
      ),

    blocks:
      structuredCloneSafe(
        blocks
      ),

    marks:
      structuredCloneSafe(
        marks
      ),

    createdAt:
      existingEpisode?.createdAt ||
      now,

    updatedAt:
      now

  };
}


/* =========================================================
   CLONADO SEGURO
========================================================= */

function structuredCloneSafe(value) {

  if (
    typeof window.structuredClone ===
    "function"
  ) {

    try {

      return window.structuredClone(
        value
      );

    }
    catch {
      // usamos fallback
    }

  }


  try {

    return JSON.parse(
      JSON.stringify(value)
    );

  }
  catch {

    return value;

  }
}


/* =========================================================
   BUSCAR EPISODIO
========================================================= */

function findEpisodeById(id) {

  return episodes.find(
    episode =>
      episode.id === id
  ) || null;
}


/* =========================================================
   BUSCAR COINCIDENCIA DE SESIÓN
========================================================= */

function findMatchingEpisode(session) {

  const sessionEpisodeId =
    normalizeText(
      session?.episodeId
    );


  if (sessionEpisodeId) {

    const byId =
      findEpisodeById(
        sessionEpisodeId
      );


    if (byId) {

      return byId;

    }

  }


  const episodeNumber =
    normalizeText(
      session?.episodeNumber
    );


  if (!episodeNumber) {

    return null;

  }


  return episodes.find(
    episode =>
      normalizeText(
        episode.episodeNumber
      ) === episodeNumber
  ) || null;
}


/* =========================================================
   ARCHIVAR SESIÓN ACTUAL
========================================================= */

function archiveCurrentSession() {

  const session =
    readCurrentSession();


  if (!session) {

    return {
      ok: false,
      reason: "empty"
    };

  }


  const hasUsefulContent =
    Boolean(
      normalizeText(
        session.episodeNumber
      ) ||
      normalizeText(
        session.title
      ) ||
      normalizeText(
        session.notes
      ) ||
      normalizeNumber(
        session.elapsedSeconds
      ) > 0 ||
      (
        Array.isArray(session.marks) &&
        session.marks.length > 0
      )
    );


  if (!hasUsefulContent) {

    return {
      ok: false,
      reason: "empty"
    };

  }


  const existingEpisode =
    findMatchingEpisode(
      session
    );


  const episode =
    buildEpisodeFromSession(
      session,
      existingEpisode
    );


  if (existingEpisode) {

    const index =
      episodes.findIndex(
        item =>
          item.id === existingEpisode.id
      );


    episodes[index] =
      episode;

  }
  else {

    episodes.unshift(
      episode
    );

  }


  const saved =
    saveEpisodes();


  return {

    ok: saved,

    reason:
      saved
        ? "saved"
        : "storage-error",

    episode

  };
}


/* =========================================================
   GUARDAR EPISODIO
========================================================= */

function saveEpisode(episode) {

  if (
    !episode ||
    typeof episode !== "object"
  ) {

    return false;

  }


  const id =
    normalizeText(
      episode.id
    ) ||
    createEpisodeId();


  const existingIndex =
    episodes.findIndex(
      item =>
        item.id === id
    );


  const normalizedEpisode = {

    ...structuredCloneSafe(
      episode
    ),

    id,

    updatedAt:
      new Date().toISOString()

  };


  if (existingIndex >= 0) {

    episodes[existingIndex] =
      normalizedEpisode;

  }
  else {

    episodes.unshift(
      normalizedEpisode
    );

  }


  return saveEpisodes();
}


/* =========================================================
   ELIMINAR EPISODIO
========================================================= */

function deleteEpisode(id) {

  const previousLength =
    episodes.length;


  episodes =
    episodes.filter(
      episode =>
        episode.id !== id
    );


  if (
    episodes.length ===
    previousLength
  ) {

    return false;

  }


  return saveEpisodes();
}


/* =========================================================
   ORDENAR EPISODIOS
========================================================= */

function getEpisodesSorted() {

  return [...episodes].sort(
    (a, b) => {

      const numberA =
        Number(
          a.episodeNumber
        );


      const numberB =
        Number(
          b.episodeNumber
        );


      if (
        Number.isFinite(numberA) &&
        Number.isFinite(numberB) &&
        numberA !== numberB
      ) {

        return numberB - numberA;

      }


      const dateA =
        new Date(
          a.updatedAt ||
          a.createdAt ||
          0
        ).getTime();


      const dateB =
        new Date(
          b.updatedAt ||
          b.createdAt ||
          0
        ).getTime();


      return dateB - dateA;

    }
  );
}


/* =========================================================
   ESTADO DEL EPISODIO
========================================================= */

function getEpisodeStatus(episode) {

  if (episode.finished) {

    return {
      key: "finished",
      label: "Finalizado"
    };

  }


  if (
    normalizeNumber(
      episode.elapsedSeconds
    ) > 0
  ) {

    return {
      key: "progress",
      label: "En producción"
    };

  }


  return {
    key: "draft",
    label: "Borrador"
  };
}


/* =========================================================
   RESUMEN
========================================================= */

function getEpisodesSummary() {

  const total =
    episodes.length;


  const finished =
    episodes.filter(
      episode =>
        episode.finished
    ).length;


  const inProgress =
    episodes.filter(
      episode =>
        !episode.finished &&
        normalizeNumber(
          episode.elapsedSeconds
        ) > 0
    ).length;


  const drafts =
    Math.max(
      0,
      total -
      finished -
      inProgress
    );


  return {
    total,
    finished,
    inProgress,
    drafts
  };
}


/* =========================================================
   PREPARAR SESIÓN PARA ABRIR
========================================================= */

function episodeToStudioSession(
  episode
) {

  if (!episode) {

    return null;

  }


  return {

    episodeId:
      episode.id,

    episodeNumber:
      episode.episodeNumber || "",

    title:
      episode.title || "",

    date:
      episode.date || "",

    notes:
      episode.notes || "",

    elapsedSeconds:
      normalizeNumber(
        episode.elapsedSeconds
      ),

    paused:
      Boolean(
        episode.paused
      ),

    finished:
      Boolean(
        episode.finished
      ),

    blocks:
      structuredCloneSafe(
        Array.isArray(
          episode.blocks
        )
          ? episode.blocks
          : []
      ),

    marks:
      structuredCloneSafe(
        Array.isArray(
          episode.marks
        )
          ? episode.marks
          : []
      ),

    currentBlockIndex:
      normalizeNumber(
        episode.currentBlockIndex
      )

  };
}


/* =========================================================
   ABRIR EPISODIO EN PRODUCCIÓN
========================================================= */

function openEpisode(id) {

  const episode =
    findEpisodeById(id);


  if (!episode) {

    return false;

  }


  const session =
    episodeToStudioSession(
      episode
    );


  try {

    localStorage.setItem(
      CURRENT_SESSION_KEY,
      JSON.stringify(session)
    );


    return true;

  }
  catch (error) {

    console.error(
      "No fue posible abrir el episodio:",
      error
    );


    return false;

  }
}


/* =========================================================
   EXPORTACIONES
========================================================= */

loadEpisodes();


export {

  EPISODES_STORAGE_KEY,

  CURRENT_SESSION_KEY,

  loadEpisodes,

  saveEpisodes,

  readCurrentSession,

  archiveCurrentSession,

  saveEpisode,

  deleteEpisode,

  findEpisodeById,

  getEpisodesSorted,

  getEpisodeStatus,

  getEpisodesSummary,

  episodeToStudioSession,

  openEpisode,

  formatDuration,

  formatEpisodeDate,

  formatSavedDate

};