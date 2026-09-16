import {
  ensureAudioContext,
  getAudioContext,
  connectNodeToMaster,
  connectNodeToProgram
} from "./audio-engine.js";

import {
  showModal,
  confirmModal
} from "./modal.js";


/* =========================================================
   RADIO CONEXIÓN STUDIO
   SOUNDPAD V3 · MASTER + PROGRAM
========================================================= */


/* =========================================================
   ELEMENTOS
========================================================= */

const soundpadGrid =
  document.getElementById("soundpadGrid");

const soundpadVolume =
  document.getElementById("soundpadVolume");

const soundpadVolumeValue =
  document.getElementById("soundpadVolumeValue");

const soundpadPlayingCount =
  document.getElementById("soundpadPlayingCount");

const soundpadNowPlaying =
  document.getElementById("soundpadNowPlaying");

const soundpadNowPlayingText =
  document.getElementById("soundpadNowPlayingText");

const stopAllSoundsBtn =
  document.getElementById("stopAllSoundsBtn");

const addSoundBtn =
  document.getElementById("addSoundBtn");


/* MODAL */

const soundModal =
  document.getElementById("soundModal");

const soundName =
  document.getElementById("soundName");

const soundCategory =
  document.getElementById("soundCategory");

const soundFile =
  document.getElementById("soundFile");

const cancelSoundBtn =
  document.getElementById("cancelSoundBtn");

const saveSoundBtn =
  document.getElementById("saveSoundBtn");


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const SOUNDPAD_VOLUME_KEY =
  "radioConexionSoundpadVolume";


/*
  Los archivos seleccionados desde el computador utilizan
  Object URLs del navegador.

  Por seguridad del navegador, esos archivos no pueden
  recuperarse automáticamente después de cerrar o recargar
  la página.

  En una siguiente versión podremos guardar los audios
  permanentemente mediante Firebase Storage.
*/


/* =========================================================
   SONIDOS
========================================================= */

let soundpadSounds = [

  {
    id: "jingle",
    name: "Jingle Radio Conexión",
    category: "JINGLE",
    icon: "🎙️",
    url: null,
    custom: false
  },

  {
    id: "cortina",
    name: "Cortina",
    category: "MÚSICA",
    icon: "🎵",
    url: null,
    custom: false
  },

  {
    id: "separador",
    name: "Separador",
    category: "IDENTIFICACIÓN",
    icon: "📻",
    url: null,
    custom: false
  },

  {
    id: "aplausos",
    name: "Aplausos",
    category: "EFECTO",
    icon: "👏",
    url: null,
    custom: false
  },

  {
    id: "efecto",
    name: "Efecto",
    category: "EFECTO",
    icon: "✨",
    url: null,
    custom: false
  }

];


/*
  Map con los audios que están reproduciéndose.

  Permite que Jingle + Cortina + Efecto puedan sonar
  simultáneamente.
*/

const activeSounds =
  new Map();


let soundpadBusGain = null;

let masterVolume = 0.8;


/*
  Cuando hacemos clic sobre uno de los pads predeterminados
  que todavía no tiene audio, recordamos qué pad estamos
  configurando.
*/

let soundBeingAssigned = null;


/* =========================================================
   UTILIDADES
========================================================= */

function createSoundId() {

  return (
    "sound-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}


function getSoundById(id) {

  return soundpadSounds.find(
    sound => sound.id === id
  );
}


function getCategoryIcon(category) {

  switch (
    category.toLowerCase()
  ) {

    case "jingle":
      return "🎙️";

    case "cortina":
      return "🎵";

    case "separador":
      return "📻";

    case "efecto":
      return "✨";

    default:
      return "🎧";
  }
}


function getCategoryLabel(category) {

  switch (
    category.toLowerCase()
  ) {

    case "jingle":
      return "JINGLE";

    case "cortina":
      return "CORTINA";

    case "separador":
      return "SEPARADOR";

    case "efecto":
      return "EFECTO";

    default:
      return "AUDIO";
  }
}


/* =========================================================
   BUS DE AUDIO DEL SOUNDPAD
========================================================= */

function ensureSoundpadBus() {

  ensureAudioContext();

  const context =
    getAudioContext();


  if (!context) {

    throw new Error(
      "No fue posible iniciar el motor de audio."
    );
  }


  if (!soundpadBusGain) {

    soundpadBusGain =
      context.createGain();


    soundpadBusGain.gain.value =
      masterVolume;


    connectNodeToMaster(
      soundpadBusGain
    );

    connectNodeToProgram(
      soundpadBusGain
    );
  }


  return soundpadBusGain;
}


function applySoundpadBusVolume() {

  if (!soundpadBusGain) return;


  const context =
    getAudioContext();


  if (!context) return;


  soundpadBusGain.gain.setValueAtTime(
    masterVolume,
    context.currentTime
  );
}


/* =========================================================
   VOLUMEN
========================================================= */

function loadSoundpadVolume() {

  const stored =
    localStorage.getItem(
      SOUNDPAD_VOLUME_KEY
    );


  if (stored !== null) {

    const value =
      Number(stored);


    if (
      !Number.isNaN(value) &&
      value >= 0 &&
      value <= 100
    ) {

      soundpadVolume.value =
        String(value);

      masterVolume =
        value / 100;
    }
  }


  updateVolumeDisplay();
}


function updateVolumeDisplay() {

  const value =
    Number(
      soundpadVolume.value
    );


  masterVolume =
    value / 100;


  soundpadVolumeValue.textContent =
    `${value}%`;


  applySoundpadBusVolume();


  localStorage.setItem(
    SOUNDPAD_VOLUME_KEY,
    String(value)
  );
}


/* =========================================================
   ESTADO VISUAL
========================================================= */

function updateSoundpadStatus() {

  const activeIds =
    Array.from(
      activeSounds.keys()
    );


  const count =
    activeIds.length;


  soundpadPlayingCount.textContent =
    count === 1
      ? "1 reproduciendo"
      : `${count} reproduciendo`;


  soundpadPlayingCount.classList.toggle(
    "active",
    count > 0
  );


  stopAllSoundsBtn.disabled =
    count === 0;


  soundpadNowPlaying.classList.toggle(
    "active",
    count > 0
  );


  if (count === 0) {

    soundpadNowPlayingText.textContent =
      "Ningún audio reproduciéndose";

    return;
  }


  const names =
    activeIds
      .map(id => {

        const sound =
          getSoundById(id);

        return sound
          ? sound.name
          : null;

      })
      .filter(Boolean);


  soundpadNowPlayingText.textContent =
    names.join(" · ");
}


/* =========================================================
   RENDER SOUNDPAD
========================================================= */

function renderSoundpad() {

  soundpadGrid.innerHTML = "";


  soundpadSounds.forEach(
    sound => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "sound-button";


      if (sound.custom) {

        button.classList.add(
          "custom-sound"
        );
      }


      if (
        activeSounds.has(
          sound.id
        )
      ) {

        button.classList.add(
          "playing"
        );
      }


      button.dataset.soundId =
        sound.id;


      /* ICONO */

      const icon =
        document.createElement(
          "span"
        );


      icon.className =
        "sound-button-icon";


      icon.textContent =
        sound.icon;


      /* CONTENIDO */

      const content =
        document.createElement(
          "span"
        );


      content.className =
        "sound-button-content";


      const title =
        document.createElement(
          "strong"
        );


      title.textContent =
        sound.name;


      const category =
        document.createElement(
          "small"
        );


      if (sound.url) {

        category.textContent =
          sound.category;
      }

      else {

        category.textContent =
          `${sound.category} · CARGAR AUDIO`;
      }


      content.appendChild(
        title
      );


      content.appendChild(
        category
      );


      /* PLAY / STOP */

      const state =
        document.createElement(
          "span"
        );


      state.className =
        "sound-button-state";


      if (
        activeSounds.has(
          sound.id
        )
      ) {

        state.textContent =
          "■";
      }

      else if (sound.url) {

        state.textContent =
          "▶";
      }

      else {

        state.textContent =
          "+";
      }


      button.appendChild(
        icon
      );


      button.appendChild(
        content
      );


      button.appendChild(
        state
      );


      /*
        Los sonidos agregados por el usuario pueden eliminarse.
      */

      if (sound.custom) {

        const deleteButton =
          document.createElement(
            "span"
          );


        deleteButton.className =
          "sound-delete-button";


        deleteButton.textContent =
          "×";


        deleteButton.title =
          "Eliminar sonido";


        deleteButton.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            deleteSound(
              sound.id
            );

          }
        );


        button.appendChild(
          deleteButton
        );
      }


      button.addEventListener(
        "click",
        () => {

          handleSoundButton(
            sound.id
          );

        }
      );


      soundpadGrid.appendChild(
        button
      );

    }
  );


  /*
    Botón Agregar sonido.
  */

  const addButton =
    document.createElement(
      "button"
    );


  addButton.type =
    "button";


  addButton.id =
    "addSoundBtn";


  addButton.className =
    "sound-button sound-button-add";


  addButton.innerHTML = `
    <span class="sound-button-icon">
      ＋
    </span>

    <span class="sound-button-content">
      <strong>
        Agregar sonido
      </strong>

      <small>
        PERSONALIZAR
      </small>
    </span>
  `;


  addButton.addEventListener(
    "click",
    openAddSoundModal
  );


  soundpadGrid.appendChild(
    addButton
  );


  updateSoundpadStatus();
}


/* =========================================================
   CLIC EN UN PAD
========================================================= */

function handleSoundButton(id) {

  const sound =
    getSoundById(id);


  if (!sound) return;


  /*
    Si ya está reproduciéndose,
    el mismo botón lo detiene.
  */

  if (
    activeSounds.has(id)
  ) {

    stopSound(id);

    return;
  }


  /*
    Si todavía no tiene archivo,
    abrimos el modal para asignarlo.
  */

  if (!sound.url) {

    openAssignSoundModal(
      sound
    );

    return;
  }


  playSound(id);
}


/* =========================================================
   REPRODUCCIÓN
========================================================= */

async function playSound(id) {

  const sound =
    getSoundById(id);


  if (
    !sound ||
    !sound.url
  ) {

    return;
  }


  /*
    Creamos un reproductor independiente para cada sonido.

    Gracias a esto pueden reproducirse varios sonidos
    simultáneamente.
  */

  const audio =
    new Audio(
      sound.url
    );


  audio.preload =
    "auto";


  try {

    const context =
      getAudioContext() ||
      await ensureAudioContext();


    if (
      context.state ===
      "suspended"
    ) {

      await context.resume();
    }


    const source =
      context.createMediaElementSource(
        audio
      );


    source.connect(
      ensureSoundpadBus()
    );


    activeSounds.set(
      id,
      {
        audio,
        source
      }
    );

  }
  catch (error) {

    console.error(
      "No se pudo conectar el Soundpad al Master:",
      error
    );


    await showModal({
      title: "No se pudo preparar el audio",
      message: `No se pudo preparar "${sound.name}" para la consola de audio.`,
      type: "danger",
      confirmText: "ENTENDIDO"
    });

    return;
  }


  audio.addEventListener(
    "ended",
    async () => {

      const active =
        activeSounds.get(id);


      if (active?.source) {

        try {
          active.source.disconnect();
        }
        catch (error) {
          console.warn(error);
        }
      }


      activeSounds.delete(
        id
      );

      renderSoundpad();

    }
  );


  audio.addEventListener(
    "error",
    async () => {

      const active =
        activeSounds.get(id);


      if (active?.source) {

        try {
          active.source.disconnect();
        }
        catch (disconnectError) {
          console.warn(disconnectError);
        }
      }


      activeSounds.delete(
        id
      );


      renderSoundpad();


      await showModal({
        title: "No se pudo reproducir el audio",
        message: `No se pudo reproducir "${sound.name}".`,
        type: "danger",
        confirmText: "ENTENDIDO"
      });

    }
  );


  const playPromise =
    audio.play();


  if (
    playPromise !== undefined
  ) {

    playPromise
      .then(() => {

        renderSoundpad();

      })
      .catch(async error => {

        console.error(
          "No se pudo reproducir el audio:",
          error
        );


        const active =
          activeSounds.get(id);


        if (active?.source) {

          try {
            active.source.disconnect();
          }
          catch (disconnectError) {
            console.warn(disconnectError);
          }
        }


        activeSounds.delete(
          id
        );


        renderSoundpad();


        await showModal({
          title: "El navegador no pudo reproducir el audio",
          message: `El navegador no pudo reproducir "${sound.name}".`,
          type: "danger",
          confirmText: "ENTENDIDO"
        });

      });

  }


  renderSoundpad();
}


/* =========================================================
   DETENER UN SONIDO
========================================================= */

function stopSound(id) {

  const active =
    activeSounds.get(id);


  if (!active) return;


  active.audio.pause();


  try {

    active.audio.currentTime = 0;

  }
  catch (error) {

    console.warn(
      "No se pudo reiniciar el audio:",
      error
    );
  }


  try {

    active.source.disconnect();

  }
  catch (error) {

    console.warn(
      "No se pudo desconectar el audio:",
      error
    );
  }


  activeSounds.delete(id);


  renderSoundpad();
}


/* =========================================================
   DETENER TODO
========================================================= */

function stopAllSounds() {

  activeSounds.forEach(
    active => {

      active.audio.pause();


      try {

        active.audio.currentTime = 0;

      }
      catch (error) {

        console.warn(
          "No se pudo reiniciar un audio:",
          error
        );
      }


      try {

        active.source.disconnect();

      }
      catch (error) {

        console.warn(
          "No se pudo desconectar un audio:",
          error
        );
      }

    }
  );


  activeSounds.clear();


  renderSoundpad();
}


/* =========================================================
   MODAL
========================================================= */

function resetSoundModal() {

  soundName.value = "";

  soundCategory.value =
    "jingle";

  soundFile.value = "";

  soundBeingAssigned =
    null;


  saveSoundBtn.textContent =
    "AGREGAR";
}


function openAddSoundModal() {

  resetSoundModal();


  document.getElementById(
    "soundModalTitle"
  ).textContent =
    "Agregar sonido";


  soundModal.classList.remove(
    "hidden"
  );


  setTimeout(
    () => soundName.focus(),
    50
  );
}


function openAssignSoundModal(
  sound
) {

  resetSoundModal();


  soundBeingAssigned =
    sound.id;


  document.getElementById(
    "soundModalTitle"
  ).textContent =
    `Cargar ${sound.name}`;


  soundName.value =
    sound.name;


  /*
    Intentamos seleccionar una categoría coherente.
  */

  if (
    sound.id === "jingle"
  ) {

    soundCategory.value =
      "jingle";
  }

  else if (
    sound.id === "cortina"
  ) {

    soundCategory.value =
      "cortina";
  }

  else if (
    sound.id === "separador"
  ) {

    soundCategory.value =
      "separador";
  }

  else {

    soundCategory.value =
      "efecto";
  }


  saveSoundBtn.textContent =
    "CARGAR AUDIO";


  soundModal.classList.remove(
    "hidden"
  );


  setTimeout(
    () => soundFile.focus(),
    50
  );
}


function closeSoundModal() {

  soundModal.classList.add(
    "hidden"
  );


  resetSoundModal();
}


/* =========================================================
   GUARDAR / ASIGNAR AUDIO
========================================================= */

async function saveSound() {

  const file =
    soundFile.files[0];


  if (!file) {

    await showModal({
      title: "Falta seleccionar un audio",
      message: "Selecciona un archivo de audio antes de continuar.",
      type: "warning",
      confirmText: "ENTENDIDO"
    });

    return;
  }


  /*
    Validamos el archivo.

    Algunos navegadores pueden entregar type vacío,
    por eso no bloqueamos esos archivos.
  */

  if (
    file.type &&
    !file.type.startsWith("audio/") &&
    !/\.mp3$/i.test(file.name)
  ) {

    await showModal({
      title: "Archivo no válido",
      message: "El archivo seleccionado no parece ser un audio.",
      type: "warning",
      confirmText: "ENTENDIDO"
    });

    return;
  }


  const objectURL =
    URL.createObjectURL(
      file
    );


  /*
    ASIGNAR A UN PAD EXISTENTE
  */

  if (soundBeingAssigned) {

    const sound =
      getSoundById(
        soundBeingAssigned
      );


    if (!sound) {

      URL.revokeObjectURL(
        objectURL
      );

      closeSoundModal();

      return;
    }


    /*
      Liberamos el archivo anterior
      si había uno.
    */

    if (sound.url) {

      stopSound(
        sound.id
      );


      URL.revokeObjectURL(
        sound.url
      );
    }


    sound.url =
      objectURL;


    sound.fileName =
      file.name;


    const cleanName =
      soundName.value.trim();


    if (cleanName) {

      sound.name =
        cleanName;
    }


    sound.category =
      getCategoryLabel(
        soundCategory.value
      );


    sound.icon =
      getCategoryIcon(
        soundCategory.value
      );


    closeSoundModal();

    renderSoundpad();

    return;
  }


  /*
    CREAR UN NUEVO PAD
  */

  const cleanName =
    soundName.value.trim();


  const newSound = {

    id:
      createSoundId(),

    name:
      cleanName ||
      file.name.replace(
        /\.[^/.]+$/,
        ""
      ),

    category:
      getCategoryLabel(
        soundCategory.value
      ),

    icon:
      getCategoryIcon(
        soundCategory.value
      ),

    url:
      objectURL,

    fileName:
      file.name,

    custom:
      true

  };


  soundpadSounds.push(
    newSound
  );


  closeSoundModal();

  renderSoundpad();
}


/* =========================================================
   ELIMINAR SONIDO PERSONALIZADO
========================================================= */

async function deleteSound(id) {

  const sound =
    getSoundById(id);


  if (
    !sound ||
    !sound.custom
  ) {

    return;
  }


  const confirmed =
    await confirmModal({
      title: "Eliminar sonido",
      message: `¿Quieres eliminar "${sound.name}" del Soundpad?`,
      confirmText: "ELIMINAR",
      cancelText: "CANCELAR",
      danger: true
    });


  if (!confirmed) return;


  stopSound(id);


  if (sound.url) {

    URL.revokeObjectURL(
      sound.url
    );
  }


  soundpadSounds =
    soundpadSounds.filter(
      item =>
        item.id !== id
    );


  renderSoundpad();
}


/* =========================================================
   LIMPIEZA DE MEMORIA
========================================================= */

function releaseSoundpadFiles() {

  stopAllSounds();


  soundpadSounds.forEach(
    sound => {

      if (sound.url) {

        URL.revokeObjectURL(
          sound.url
        );
      }

    }
  );


  if (soundpadBusGain) {

    try {
      soundpadBusGain.disconnect();
    }
    catch (error) {
      console.warn(error);
    }


    soundpadBusGain = null;
  }
}


/* =========================================================
   EVENTOS
========================================================= */

soundpadVolume.addEventListener(
  "input",
  updateVolumeDisplay
);


stopAllSoundsBtn.addEventListener(
  "click",
  stopAllSounds
);


/*
  El addSoundBtn que viene inicialmente en HTML
  será reemplazado al hacer renderSoundpad(),
  pero dejamos este listener para que también funcione
  durante la inicialización.
*/

if (addSoundBtn) {

  addSoundBtn.addEventListener(
    "click",
    openAddSoundModal
  );
}


cancelSoundBtn.addEventListener(
  "click",
  closeSoundModal
);


saveSoundBtn.addEventListener(
  "click",
  saveSound
);


soundModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      soundModal
    ) {

      closeSoundModal();
    }

  }
);


/* =========================================================
   ATAJOS
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape" &&
      !soundModal.classList.contains(
        "hidden"
      )
    ) {

      closeSoundModal();
    }


    if (
      event.key === "Enter" &&
      event.ctrlKey &&
      !soundModal.classList.contains(
        "hidden"
      )
    ) {

      saveSound();
    }

  }
);


/* =========================================================
   INTEGRACIÓN CON NUEVA SESIÓN
========================================================= */

/*
  Studio emite "studio:newsession" únicamente después de que
  la nueva sesión fue confirmada y reiniciada correctamente.

  Si el usuario cancela la confirmación, los sonidos del
  Soundpad continúan reproduciéndose.
*/

document.addEventListener(
  "studio:newsession",
  () => {
    stopAllSounds();
  }
);


/* =========================================================
   CIERRE DE PÁGINA
========================================================= */

window.addEventListener(
  "beforeunload",
  releaseSoundpadFiles
);


/* =========================================================
   INICIO
========================================================= */

loadSoundpadVolume();

renderSoundpad();
