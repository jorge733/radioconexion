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

const newSessionBtn =
  document.getElementById("newSessionBtn");


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

function startRecording() {

  if (running) return;


  /*
    Si estaba finalizada, no reiniciamos.
    Para eso existe NUEVA SESIÓN.
  */

  if (finished) return;


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
   NUEVA SESIÓN
========================================== */

function newSession() {

  const hasWork =
    elapsedSeconds > 0 ||
    marks.length > 0;


  if (hasWork) {

    const confirmed =
      confirm(
        "¿Crear una nueva sesión?\n\n" +
        "Se reiniciará el cronómetro y " +
        "se eliminarán las marcas de edición actuales.\n\n" +
        "La pauta y los datos del episodio se conservarán."
      );


    if (!confirmed) return;
  }


  clearInterval(timerInterval);

  timerInterval = null;

  elapsedSeconds = 0;

  running = false;

  paused = false;

  finished = false;

  marks = [];

  currentBlockIndex = 0;


  updateTimer();

  renderMarks();

  renderPauta();


  recordingStatus.textContent =
    "LISTO PARA GRABAR";

  recordingStatus.classList.remove("active");


  startBtn.disabled = false;

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


function addBlock() {

  const name =
    prompt(
      "Nombre del nuevo bloque:"
    );


  if (!name) return;


  const clean =
    name.trim();


  if (!clean) return;


  blocks.push(clean);


  renderPauta();

  saveState();
}


function deleteBlock(index) {

  if (
    blocks.length <= 1
  ) {

    alert(
      "La pauta debe tener al menos un bloque."
    );

    return;
  }


  const confirmed =
    confirm(
      `¿Eliminar "${blocks[index]}" de la pauta?`
    );


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
  startRecording
);


pauseBtn.addEventListener(
  "click",
  pauseRecording
);


finishBtn.addEventListener(
  "click",
  finishRecording
);


newSessionBtn.addEventListener(
  "click",
  newSession
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


/* ==========================================
   INICIO
========================================== */

loadState();

setToday();

updateTimer();

renderPauta();

renderMarks();

saveState();