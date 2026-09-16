import {
  showModal,
  confirmModal,
  promptModal
} from "./modal.js";

/* ==========================================
   RADIO CONEXIÓN STUDIO
========================================== */


/* ELEMENTOS */

const timerElement =
  document.getElementById("timer");

const startBtn =
  document.getElementById("startBtn");

const pauseBtn =
  document.getElementById("pauseBtn");

const finishBtn =
  document.getElementById("finishBtn");

const markBtn =
  document.getElementById("markBtn");

const recordingStatus =
  document.getElementById("recordingStatus");

const pautaList =
  document.getElementById("pautaList");

const addBlockBtn =
  document.getElementById("addBlockBtn");

const nextBlockBtn =
  document.getElementById("nextBlockBtn");

const currentBlockElement =
  document.getElementById("currentBlock");

const currentBlockBadge =
  document.getElementById("currentBlockBadge");

const marksList =
  document.getElementById("marksList");

const markCount =
  document.getElementById("markCount");

const episodeNumber =
  document.getElementById("episodeNumber");

const episodeTitle =
  document.getElementById("episodeTitle");

const episodeDate =
  document.getElementById("episodeDate");

const episodeNotes =
  document.getElementById("episodeNotes");

const saveStatus =
  document.getElementById("saveStatus");

/* MODAL */

const markModal =
  document.getElementById("markModal");

const modalMarkTime =
  document.getElementById("modalMarkTime");

const modalMarkBlock =
  document.getElementById("modalMarkBlock");

const markNote =
  document.getElementById("markNote");

const saveMarkBtn =
  document.getElementById("saveMarkBtn");

const cancelMarkBtn =
  document.getElementById("cancelMarkBtn");


/* ==========================================
   ESTADO
========================================== */

const STORAGE_KEY =
  "radioConexionStudioV2";


let elapsedSeconds = 0;

let timerInterval = null;

let running = false;

let paused = false;

let finished = false;

let currentBlockIndex = 0;

let pendingMark = null;


/* ==========================================
   GRABACIÓN REAL · MEDIARECORDER
========================================== */

let mediaRecorder = null;
let recordingChunks = [];
let recordingBlob = null;
let recordingObjectUrl = null;
let audioEngineModule = null;
let recordingPreview = null;


async function getAudioEngineModule() {

  if (!audioEngineModule) {

    audioEngineModule =
      await import("./audio-engine.js");
  }

  return audioEngineModule;
}


function getSupportedRecordingMimeType() {

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];


  return candidates.find(
    type =>
      window.MediaRecorder &&
      MediaRecorder.isTypeSupported(type)
  ) || "";
}


function formatFileSize(bytes) {

  const value = Number(bytes) || 0;

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}


function revokeRecordingUrl() {

  if (recordingObjectUrl) {

    URL.revokeObjectURL(
      recordingObjectUrl
    );

    recordingObjectUrl = null;
  }
}


function removeRecordingPreview() {

  if (recordingPreview) {

    recordingPreview.remove();

    recordingPreview = null;
  }
}


function renderRecordingPreview() {

  removeRecordingPreview();

  if (!recordingBlob) {
    return;
  }


  recordingObjectUrl =
    URL.createObjectURL(
      recordingBlob
    );


  const card =
    document.createElement("section");

  card.id =
    "recordingResult";

  card.style.marginTop =
    "18px";

  card.style.padding =
    "18px";

  card.style.border =
    "1px solid rgba(217, 150, 20, 0.28)";

  card.style.borderRadius =
    "18px";

  card.style.background =
    "rgba(255, 255, 255, 0.82)";

  card.style.boxShadow =
    "0 12px 32px rgba(23, 25, 29, 0.08)";


  const title =
    document.createElement("strong");

  title.textContent =
    "Grabación del episodio";

  title.style.display =
    "block";

  title.style.marginBottom =
    "10px";


  const info =
    document.createElement("div");

  info.textContent =
    `${formatTime(elapsedSeconds)} · ${formatFileSize(recordingBlob.size)}`;

  info.style.marginBottom =
    "12px";

  info.style.color =
    "#667085";


  const audio =
    document.createElement("audio");

  audio.controls = true;

  audio.src =
    recordingObjectUrl;

  audio.style.width =
    "100%";


  const download =
    document.createElement("a");

  const cleanEpisode =
    String(
      episodeNumber.value || "episodio"
    )
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-");


  download.href =
    recordingObjectUrl;

  download.download =
    `Radio-Conexión-Episodio-${cleanEpisode}.webm`;

  download.textContent =
    "DESCARGAR GRABACIÓN";

  download.style.display =
    "inline-block";

  download.style.marginTop =
    "12px";

  download.style.fontWeight =
    "700";

  download.style.color =
    "#a96500";


  card.appendChild(title);
  card.appendChild(info);
  card.appendChild(audio);
  card.appendChild(download);


  const anchor =
    recordingStatus.closest("section") ||
    recordingStatus.parentElement;

  if (anchor) {

    anchor.insertAdjacentElement(
      "afterend",
      card
    );
  }
  else {

    recordingStatus.parentElement
      ?.appendChild(card);
  }


  recordingPreview = card;
}


function finalizeRecordingBlob() {

  if (recordingChunks.length === 0) {
    return;
  }


  const mimeType =
    mediaRecorder?.mimeType ||
    recordingChunks[0]?.type ||
    "audio/webm";


  recordingBlob =
    new Blob(
      recordingChunks,
      { type: mimeType }
    );


  revokeRecordingUrl();

  renderRecordingPreview();
}


async function createMediaRecorder() {

  if (!window.MediaRecorder) {

    throw new Error(
      "Este navegador no admite grabación de audio con MediaRecorder."
    );
  }


  const engine =
    await getAudioEngineModule();


  const programStream =
    engine.getProgramStream();


  if (
    !programStream ||
    programStream.getAudioTracks().length === 0
  ) {

    throw new Error(
      "El bus Program todavía no está activo. Activa primero el micrófono en la consola de audio."
    );
  }


  const mimeType =
    getSupportedRecordingMimeType();


  mediaRecorder =
    mimeType
      ? new MediaRecorder(
          programStream,
          { mimeType }
        )
      : new MediaRecorder(
          programStream
        );


  recordingChunks = [];


  mediaRecorder.addEventListener(
    "dataavailable",
    event => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        recordingChunks.push(
          event.data
        );
      }
    }
  );


  mediaRecorder.addEventListener(
    "stop",
    finalizeRecordingBlob
  );


  mediaRecorder.addEventListener(
    "error",
    event => {

      console.error(
        "Error de MediaRecorder:",
        event.error || event
      );

      showModal({
        title: "Error de grabación",
        message: "Se produjo un error durante la grabación del episodio.",
        type: "danger",
        confirmText: "ENTENDIDO"
      });
    }
  );


  return mediaRecorder;
}


async function startOrResumeMediaRecording() {

  if (
    mediaRecorder &&
    mediaRecorder.state === "paused"
  ) {

    mediaRecorder.resume();

    return;
  }


  if (
    mediaRecorder &&
    mediaRecorder.state === "recording"
  ) {

    return;
  }


  await createMediaRecorder();

  mediaRecorder.start(1000);
}


function pauseMediaRecording() {

  if (
    mediaRecorder &&
    mediaRecorder.state === "recording"
  ) {

    mediaRecorder.pause();
  }
}


function stopMediaRecording() {

  if (
    mediaRecorder &&
    mediaRecorder.state !== "inactive"
  ) {

    mediaRecorder.stop();
  }
}


let blocks = [
  "Apertura",
  "Presentación",
  "Conversación",
  "Canción",
  "Cierre"
];


let marks = [];


/* ==========================================
   TIEMPO
========================================== */

function formatTime(totalSeconds) {

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;


  return [
    hours,
    minutes,
    seconds
  ]
    .map(
      value =>
        String(value).padStart(2, "0")
    )
    .join(":");
}


function updateTimer() {

  timerElement.textContent =
    formatTime(elapsedSeconds);
}


/* ==========================================
   GRABACIÓN
========================================== */

async function startRecording() {

  if (running) return;

  /*
    Si estaba finalizada, no reiniciamos.
    Para eso existe NUEVA SESIÓN.
  */

  if (finished) return;


  try {

    await startOrResumeMediaRecording();

  }
  catch (error) {

    console.error(
      "No fue posible iniciar la grabación real:",
      error
    );

    await showModal({
      title: "No fue posible iniciar la grabación",
      message:
        error.message ||
        "No fue posible iniciar la grabación.",
      type: "danger",
      confirmText: "ENTENDIDO"
    });

    return;
  }


  running = true;
  paused = false;


  timerInterval =
    setInterval(() => {

      elapsedSeconds++;

      updateTimer();

      /*
        Guardamos periódicamente
        para reducir pérdida accidental.
      */

      if (elapsedSeconds % 5 === 0) {
        saveState();
      }

    }, 1000);


  recordingStatus.textContent =
    "● GRABANDO";

  recordingStatus.classList.add("active");


  startBtn.disabled = true;

  startBtn.textContent =
    "● INICIAR";


  pauseBtn.disabled = false;

  finishBtn.disabled = false;

  markBtn.disabled = false;


  saveState();
}

function pauseRecording() {

  if (!running) return;


  clearInterval(timerInterval);

  timerInterval = null;

  running = false;

  paused = true;

  pauseMediaRecording();


  recordingStatus.textContent =
    "PAUSADO";

  recordingStatus.classList.remove("active");


  startBtn.disabled = false;

  startBtn.textContent =
    "▶ CONTINUAR";


  pauseBtn.disabled = true;

  finishBtn.disabled = false;

  markBtn.disabled = true;


  saveState();
}


function finishRecording() {

  if (
    !running &&
    !paused
  ) {
    return;
  }


  clearInterval(timerInterval);

  timerInterval = null;

  running = false;

  paused = false;

  finished = true;

  stopMediaRecording();


  recordingStatus.textContent =
    "GRABACIÓN FINALIZADA";

  recordingStatus.classList.remove("active");


  startBtn.disabled = true;

  startBtn.textContent =
    "● INICIAR";


  pauseBtn.disabled = true;

  finishBtn.disabled = true;

  markBtn.disabled = true;


  saveState();
}



/* ==========================================
   PAUTA
========================================== */

function renderPauta() {

  pautaList.innerHTML = "";


  blocks.forEach(
    (block, index) => {

      const item =
        document.createElement("div");


      item.className =
        "pauta-item";


      if (
        index < currentBlockIndex
      ) {

        item.classList.add(
          "completed"
        );

      }


      if (
        index === currentBlockIndex
      ) {

        item.classList.add(
          "active"
        );

      }


      const status =
        document.createElement("span");


      status.className =
        "pauta-status";


      if (
        index < currentBlockIndex
      ) {

        status.textContent = "✓";

      }

      else if (
        index === currentBlockIndex
      ) {

        status.textContent = "▶";

      }

      else {

        status.textContent = "○";

      }


      const name =
        document.createElement("span");


      name.textContent =
        block;


      const deleteButton =
        document.createElement("button");


      deleteButton.className =
        "delete-block";


      deleteButton.textContent =
        "×";


      deleteButton.title =
        "Eliminar bloque";


      deleteButton.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          deleteBlock(index);

        }
      );


      item.appendChild(status);

      item.appendChild(name);

      item.appendChild(
        deleteButton
      );


      item.addEventListener(
        "click",
        () => {

          currentBlockIndex =
            index;

          renderPauta();

          saveState();

        }
      );


      pautaList.appendChild(
        item
      );

    }
  );


  updateCurrentBlock();
}


function updateCurrentBlock() {

  const block =
    blocks[currentBlockIndex]
    || "Sin bloque";


  currentBlockElement.textContent =
    block;


  currentBlockBadge.textContent =
    block;
}


function nextBlock() {

  if (
    currentBlockIndex <
    blocks.length - 1
  ) {

    currentBlockIndex++;

    renderPauta();

    saveState();

  }
}


async function addBlock() {

  const name =
    await promptModal({
      title: "Agregar bloque",
      message: "Escribe el nombre del nuevo bloque de la pauta.",
      label: "NOMBRE DEL BLOQUE",
      placeholder: "Ej: Entrevista, conversación, cierre...",
      confirmText: "AGREGAR BLOQUE",
      cancelText: "CANCELAR",
      required: true,
      maxLength: 80
    });


  if (!name) return;


  const clean =
    name.trim();


  if (!clean) return;


  blocks.push(clean);


  renderPauta();

  saveState();
}


async function deleteBlock(index) {

  if (
    blocks.length <= 1
  ) {

    await showModal({
      title: "No se puede eliminar",
      message: "La pauta debe tener al menos un bloque.",
      type: "warning",
      confirmText: "ENTENDIDO"
    });

    return;
  }


  const confirmed =
    await confirmModal({
      title: "Eliminar bloque",
      message: `¿Quieres eliminar "${blocks[index]}" de la pauta?`,
      confirmText: "ELIMINAR",
      cancelText: "CANCELAR",
      danger: true
    });


  if (!confirmed) return;


  blocks.splice(index, 1);


  if (
    currentBlockIndex >=
    blocks.length
  ) {

    currentBlockIndex =
      blocks.length - 1;

  }


  if (
    index < currentBlockIndex
  ) {

    currentBlockIndex--;

  }


  renderPauta();

  saveState();
}


/* ==========================================
   MARCAS DE EDICIÓN
========================================== */

function openMarkModal() {

  if (!running) return;


  pendingMark = {

    time:
      elapsedSeconds,

    block:
      blocks[currentBlockIndex]
      || "Sin bloque"

  };


  modalMarkTime.textContent =
    formatTime(
      pendingMark.time
    );


  modalMarkBlock.textContent =
    pendingMark.block;


  markNote.value = "";


  markModal.classList.remove(
    "hidden"
  );


  setTimeout(
    () => markNote.focus(),
    50
  );
}


function closeMarkModal() {

  pendingMark = null;

  markNote.value = "";

  markModal.classList.add(
    "hidden"
  );
}


function saveMark() {

  if (!pendingMark) return;


  marks.push({

    id:
      Date.now(),

    time:
      pendingMark.time,

    block:
      pendingMark.block,

    note:
      markNote.value.trim()

  });


  closeMarkModal();

  renderMarks();

  saveState();
}


function deleteMark(id) {

  marks =
    marks.filter(
      mark => mark.id !== id
    );


  renderMarks();

  saveState();
}


function renderMarks() {

  marksList.innerHTML = "";


  markCount.textContent =
    marks.length;


  if (
    marks.length === 0
  ) {

    const empty =
      document.createElement("div");


    empty.className =
      "empty-state";


    empty.textContent =
      "Todavía no hay marcas de edición.";


    marksList.appendChild(
      empty
    );


    return;
  }


  marks.forEach(mark => {

    const item =
      document.createElement("div");


    item.className =
      "mark-entry";


    const top =
      document.createElement("div");


    top.className =
      "mark-entry-top";


    const time =
      document.createElement("span");


    time.className =
      "mark-time";


    time.textContent =
      `✂ ${formatTime(mark.time)}`;


    const block =
      document.createElement("span");


    block.className =
      "mark-block";


    block.textContent =
      mark.block;


    top.appendChild(time);

    top.appendChild(block);


    item.appendChild(top);


    if (mark.note) {

      const note =
        document.createElement("p");


      note.className =
        "mark-note";


      note.textContent =
        mark.note;


      item.appendChild(note);

    }


    const deleteButton =
      document.createElement(
        "button"
      );


    deleteButton.className =
      "delete-mark";


    deleteButton.textContent =
      "Eliminar marca";


    deleteButton.addEventListener(
      "click",
      () =>
        deleteMark(mark.id)
    );


    item.appendChild(
      deleteButton
    );


    marksList.appendChild(
      item
    );

  });
}


/* ==========================================
   GUARDADO AUTOMÁTICO
========================================== */

function saveState() {

  const data = {

    episodeNumber:
      episodeNumber.value,

    episodeTitle:
      episodeTitle.value,

    episodeDate:
      episodeDate.value,

    episodeNotes:
      episodeNotes.value,

    elapsedSeconds,

    paused,

    finished,

    blocks,

    marks,

    currentBlockIndex

  };


  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );


  showSaved();
}


function loadState() {

  const stored =
    localStorage.getItem(
      STORAGE_KEY
    );


  if (!stored) {

    setToday();

    return;
  }


  try {

    const data =
      JSON.parse(stored);


    episodeNumber.value =
      data.episodeNumber
      || "98";


    episodeTitle.value =
      data.episodeTitle
      || "";


    episodeDate.value =
      data.episodeDate
      || "";


    episodeNotes.value =
      data.episodeNotes
      || "";


    elapsedSeconds =
      Number(
        data.elapsedSeconds
      ) || 0;


    paused =
      Boolean(data.paused);


    finished =
      Boolean(data.finished);


    if (
      Array.isArray(data.blocks) &&
      data.blocks.length
    ) {

      blocks =
        data.blocks;

    }


    if (
      Array.isArray(data.marks)
    ) {

      marks =
        data.marks;

    }


    currentBlockIndex =
      Number(
        data.currentBlockIndex
      ) || 0;


    if (
      currentBlockIndex >=
      blocks.length
    ) {

      currentBlockIndex = 0;

    }


    /*
      Nunca retomamos automáticamente
      un temporizador después de recargar.
    */

    running = false;


    if (finished) {

      recordingStatus.textContent =
        "GRABACIÓN FINALIZADA";


      startBtn.disabled = true;

      pauseBtn.disabled = true;

      finishBtn.disabled = true;

      markBtn.disabled = true;

    }

    else if (
      elapsedSeconds > 0
    ) {

      paused = true;


      recordingStatus.textContent =
        "PAUSADO";


      startBtn.disabled = false;

      startBtn.textContent =
        "▶ CONTINUAR";


      pauseBtn.disabled = true;

      finishBtn.disabled = false;

      markBtn.disabled = true;

    }

  }

  catch (error) {

    console.error(
      "No se pudo cargar Studio:",
      error
    );


    setToday();

  }
}


function showSaved() {

  saveStatus.textContent =
    "● Guardando...";


  saveStatus.style.color =
    "#858b96";


  clearTimeout(
    showSaved.timeout
  );


  showSaved.timeout =
    setTimeout(() => {

      saveStatus.textContent =
        "● Guardado";

      saveStatus.style.color =
        "#52d273";

    }, 500);
}


/* ==========================================
   FECHA
========================================== */

function setToday() {

  if (
    episodeDate.value
  ) {
    return;
  }


  const today =
    new Date();


  const localDate =
    new Date(
      today.getTime() -
      today.getTimezoneOffset()
      * 60000
    );


  episodeDate.value =
    localDate
      .toISOString()
      .split("T")[0];
}


/* ==========================================
   CAMBIOS DE DATOS
========================================== */

function dataChanged() {

  saveState();
}


episodeNumber.addEventListener(
  "input",
  dataChanged
);


episodeTitle.addEventListener(
  "input",
  dataChanged
);


episodeDate.addEventListener(
  "change",
  dataChanged
);


episodeNotes.addEventListener(
  "input",
  dataChanged
);


/* ==========================================
   EVENTOS
========================================== */

startBtn.addEventListener(
  "click",
  () => {

    startRecording()
      .catch(error => {

        console.error(
          "Error inesperado al iniciar grabación:",
          error
        );
      });
  }
);


pauseBtn.addEventListener(
  "click",
  pauseRecording
);


finishBtn.addEventListener(
  "click",
  finishRecording
);


nextBlockBtn.addEventListener(
  "click",
  nextBlock
);


addBlockBtn.addEventListener(
  "click",
  addBlock
);


markBtn.addEventListener(
  "click",
  openMarkModal
);


saveMarkBtn.addEventListener(
  "click",
  saveMark
);


cancelMarkBtn.addEventListener(
  "click",
  closeMarkModal
);


markModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      markModal
    ) {

      closeMarkModal();

    }

  }
);


/* ATAJOS */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape" &&
      !markModal.classList.contains(
        "hidden"
      )
    ) {

      closeMarkModal();

    }


    if (
      event.key === "Enter" &&
      event.ctrlKey &&
      !markModal.classList.contains(
        "hidden"
      )
    ) {

      saveMark();

    }

  }
);


window.addEventListener(
  "beforeunload",
  revokeRecordingUrl
);


/* ==========================================
   INICIO
========================================== */

loadState();

setToday();

updateTimer();

renderPauta();

renderMarks();

saveState();