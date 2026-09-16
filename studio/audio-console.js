/* =========================================================
   RADIO CONEXIÓN STUDIO
   CONSOLA DE AUDIO V7

   Canales:
   - Micrófono
   - Música con playlist + crossfade automático
   - Cortina
========================================================= */

import {
  /* Micrófono */
  getMicrophones,
  startMicrophone,
  stopMicrophone,
  isMicrophoneActive,
  setMicrophoneVolume,
  setMicrophoneMuted,
  getMicrophoneLevel,
  getMicrophoneDecibels,

  /* Música */
  loadMusicFile,
  addMusicFiles,
  selectMusicTrack,
  nextMusicTrack,
  previousMusicTrack,
  removeMusicTrack,
  clearMusicPlaylist,
  getMusicPlaylistState,
  playMusic,
  pauseMusic,
  stopMusic,
  seekMusic,
  setMusicVolume,
  setMusicMuted,
  getMusicLevel,
  getMusicDecibels,
  getMusicState,
  getMusicAudioElement,

  /* Auto-ducking */
  updateAutoDucking,

  /* Master */
  setMasterVolume,
  setMasterMuted,
  getMasterLevel,
  getMasterDecibels,
  getMasterState,

  /* Cortina */
  loadCurtainFile,
  playCurtain,
  pauseCurtain,
  stopCurtain,
  seekCurtain,
  setCurtainVolume,
  setCurtainMuted,
  getCurtainLevel,
  getCurtainDecibels,
  getCurtainState,
  getCurtainAudioElement
} from "./audio-engine.js";


/* =========================================================
   ESTADO
========================================================= */

let meterAnimationFrame = null;

let lastMusicPlaylistIndex = -1;
let lastMusicTransitioning = false;
let lastMusicAudioElement = null;

let microphoneActive = false;
let microphoneMuted = false;
let currentDeviceId = "";

let musicMuted = false;
let musicFileName = "";

let curtainMuted = false;
let curtainFileName = "";

let masterMuted = false;

const DEFAULT_MIC_GAIN_PERCENT = 100;
const DEFAULT_MUSIC_VOLUME_PERCENT = 70;
const DEFAULT_CURTAIN_VOLUME_PERCENT = 35;
const DEFAULT_MASTER_VOLUME_PERCENT = 100;


/* =========================================================
   ELEMENTOS
========================================================= */

function getElements() {

  return {

    /* Estado general */

    status:
      document.getElementById(
        "audioEngineStatus"
      ),

    message:
      document.getElementById(
        "audioConsoleMessage"
      ),


    /* Micrófono */

    deviceSelect:
      document.getElementById(
        "microphoneDevice"
      ),

    microphoneActivateButton:
      document.getElementById(
        "microphoneActivateBtn"
      ),

    microphoneMuteButton:
      document.getElementById(
        "microphoneMuteBtn"
      ),

    microphoneGain:
      document.getElementById(
        "microphoneGain"
      ),

    microphoneGainValue:
      document.getElementById(
        "microphoneGainValue"
      ),

    microphoneMeterFill:
      document.getElementById(
        "microphoneMeterFill"
      ),

    microphoneDecibels:
      document.getElementById(
        "microphoneDb"
      ),

    microphoneDeviceName:
      document.getElementById(
        "microphoneDeviceName"
      ),


    /* Música */

    musicFileInput:
      document.getElementById(
        "musicFileInput"
      ),

    musicLoadButton:
      document.getElementById(
        "musicLoadBtn"
      ),

    musicPlayButton:
      document.getElementById(
        "musicPlayBtn"
      ),

    musicStopButton:
      document.getElementById(
        "musicStopBtn"
      ),

    musicMuteButton:
      document.getElementById(
        "musicMuteBtn"
      ),

    musicVolume:
      document.getElementById(
        "musicVolume"
      ),

    musicVolumeValue:
      document.getElementById(
        "musicVolumeValue"
      ),

    musicMeterFill:
      document.getElementById(
        "musicMeterFill"
      ),

    musicDecibels:
      document.getElementById(
        "musicDb"
      ),

    musicTrackName:
      document.getElementById(
        "musicTrackName"
      ),

    musicProgress:
      document.getElementById(
        "musicProgress"
      ),

    musicCurrentTime:
      document.getElementById(
        "musicCurrentTime"
      ),

    musicDuration:
      document.getElementById(
        "musicDuration"
      ),

    musicPreviousButton:
      document.getElementById(
        "musicPreviousBtn"
      ),

    musicNextButton:
      document.getElementById(
        "musicNextBtn"
      ),

    musicClearButton:
      document.getElementById(
        "musicClearBtn"
      ),

    musicPlaylist:
      document.getElementById(
        "musicPlaylist"
      ),

    musicPlaylistCount:
      document.getElementById(
        "musicPlaylistCount"
      ),


    /* Master */

    masterMuteButton:
      document.getElementById(
        "masterMuteBtn"
      ),

    masterVolume:
      document.getElementById(
        "masterVolume"
      ),

    masterVolumeValue:
      document.getElementById(
        "masterVolumeValue"
      ),

    masterMeterFill:
      document.getElementById(
        "masterMeterFill"
      ),

    masterDecibels:
      document.getElementById(
        "masterDb"
      ),


    /* Cortina */

    curtainFileInput:
      document.getElementById(
        "curtainFileInput"
      ),

    curtainLoadButton:
      document.getElementById(
        "curtainLoadBtn"
      ),

    curtainPlayButton:
      document.getElementById(
        "curtainPlayBtn"
      ),

    curtainStopButton:
      document.getElementById(
        "curtainStopBtn"
      ),

    curtainMuteButton:
      document.getElementById(
        "curtainMuteBtn"
      ),

    curtainVolume:
      document.getElementById(
        "curtainVolume"
      ),

    curtainVolumeValue:
      document.getElementById(
        "curtainVolumeValue"
      ),

    curtainMeterFill:
      document.getElementById(
        "curtainMeterFill"
      ),

    curtainDecibels:
      document.getElementById(
        "curtainDb"
      ),

    curtainTrackName:
      document.getElementById(
        "curtainTrackName"
      ),

    curtainProgress:
      document.getElementById(
        "curtainProgress"
      ),

    curtainCurrentTime:
      document.getElementById(
        "curtainCurrentTime"
      ),

    curtainDuration:
      document.getElementById(
        "curtainDuration"
      )

  };

}


/* =========================================================
   UTILIDADES
========================================================= */

function formatTime(seconds) {

  const safeSeconds =
    Number.isFinite(seconds)
      ? Math.max(0, seconds)
      : 0;


  const minutes =
    Math.floor(
      safeSeconds / 60
    );


  const remainingSeconds =
    Math.floor(
      safeSeconds % 60
    );


  return (
    `${minutes}:` +
    String(
      remainingSeconds
    ).padStart(
      2,
      "0"
    )
  );

}


/* =========================================================
   MENSAJES
========================================================= */

function setMessage(
  text = "",
  state = ""
) {

  const {
    message
  } = getElements();


  if (!message) {
    return;
  }


  message.textContent =
    text;


  if (state) {

    message.dataset.state =
      state;

  }
  else {

    delete message.dataset.state;

  }

}


/* =========================================================
   ESTADO GENERAL
========================================================= */

function updateEngineStatus() {

  const {
    status
  } = getElements();


  if (!status) {
    return;
  }


  const musicState =
    getMusicState();

  const curtainState =
    getCurtainState();


  const active =
    isMicrophoneActive() ||
    musicState.loaded ||
    curtainState.loaded;


  status.classList.toggle(
    "active",
    active
  );


  status.textContent =
    active
      ? "MOTOR DE AUDIO ACTIVO"
      : "MOTOR DE AUDIO EN ESPERA";

}


/* =========================================================
   MICRÓFONO — INTERFAZ
========================================================= */

function updateMicrophoneInterface() {

  const {
    microphoneActivateButton,
    microphoneMuteButton,
    deviceSelect,
    microphoneDeviceName
  } = getElements();


  microphoneActive =
    isMicrophoneActive();


  if (
    microphoneActivateButton
  ) {

    microphoneActivateButton
      .classList.toggle(
        "active",
        microphoneActive
      );


    microphoneActivateButton
      .textContent =
        microphoneActive
          ? "✓ MICRÓFONO ACTIVO"
          : "ACTIVAR MICRÓFONO";

  }


  if (
    microphoneMuteButton
  ) {

    microphoneMuteButton.disabled =
      !microphoneActive;


    microphoneMuteButton
      .classList.toggle(
        "muted",
        microphoneMuted
      );


    microphoneMuteButton
      .textContent =
        microphoneMuted
          ? "ACTIVAR"
          : "MUTE";

  }


  if (deviceSelect) {

    deviceSelect.disabled =
      microphoneActive;

  }


  if (
    microphoneDeviceName &&
    !microphoneActive
  ) {

    microphoneDeviceName
      .textContent =
        "Micrófono";

  }


  updateEngineStatus();

}


/* =========================================================
   MICRÓFONOS DISPONIBLES
========================================================= */

async function populateMicrophones(
  preferredDeviceId = ""
) {

  const {
    deviceSelect
  } = getElements();


  if (!deviceSelect) {
    return;
  }


  try {

    const microphones =
      await getMicrophones();


    deviceSelect.innerHTML =
      "";


    if (!microphones.length) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        "";


      option.textContent =
        "Micrófono predeterminado";


      deviceSelect.appendChild(
        option
      );


      return;

    }


    microphones.forEach(
      (
        device,
        index
      ) => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          device.deviceId;


        option.textContent =
          device.label ||
          `Micrófono ${index + 1}`;


        deviceSelect.appendChild(
          option
        );

      }
    );


    const wantedDeviceId =
      preferredDeviceId ||
      currentDeviceId;


    if (
      wantedDeviceId &&
      microphones.some(
        device =>
          device.deviceId ===
          wantedDeviceId
      )
    ) {

      deviceSelect.value =
        wantedDeviceId;

    }

  }
  catch (error) {

    console.error(
      "No fue posible consultar los micrófonos:",
      error
    );


    deviceSelect.innerHTML =
      '<option value="">Micrófono predeterminado</option>';

  }

}


/* =========================================================
   NOMBRE DEL MICRÓFONO
========================================================= */

function updateDeviceName() {

  const {
    deviceSelect,
    microphoneDeviceName
  } = getElements();


  if (
    !deviceSelect ||
    !microphoneDeviceName
  ) {
    return;
  }


  const selectedOption =
    deviceSelect.options[
      deviceSelect.selectedIndex
    ];


  microphoneDeviceName.textContent =
    selectedOption?.textContent ||
    "Micrófono";

}


/* =========================================================
   ACTIVAR / DESACTIVAR MICRÓFONO
========================================================= */

async function activateMicrophone() {

  const {
    microphoneActivateButton,
    deviceSelect
  } = getElements();


  if (microphoneActive) {

    stopMicrophone();

    microphoneActive =
      false;

    microphoneMuted =
      false;


    setMicrophoneMuted(
      false
    );


    updateMicrophoneInterface();


    setMessage(
      "Micrófono desactivado."
    );


    return;

  }


  if (
    microphoneActivateButton
  ) {

    microphoneActivateButton.disabled =
      true;


    microphoneActivateButton.textContent =
      "ACTIVANDO...";

  }


  setMessage(
    "Solicitando acceso al micrófono..."
  );


  try {

    const selectedDeviceId =
      deviceSelect?.value ||
      "";


    const result =
      await startMicrophone(
        selectedDeviceId
      );


    microphoneActive =
      true;

    microphoneMuted =
      false;


    setMicrophoneMuted(
      false
    );


    currentDeviceId =
      result.deviceId ||
      selectedDeviceId ||
      "";


    /*
     * Después de obtener permiso,
     * los navegadores normalmente
     * entregan los nombres reales
     * de los dispositivos.
     */

    await populateMicrophones(
      currentDeviceId
    );


    updateDeviceName();

    updateMicrophoneInterface();


    setMessage(
      "Micrófono conectado. El medidor ya está recibiendo audio.",
      "ok"
    );

  }
  catch (error) {

    console.error(
      "Error activando micrófono:",
      error
    );


    microphoneActive =
      false;

    microphoneMuted =
      false;


    updateMicrophoneInterface();


    let message =
      "No fue posible activar el micrófono.";


    if (
      error?.name ===
      "NotAllowedError"
    ) {

      message =
        "El navegador no tiene permiso para usar el micrófono. Revisa el permiso del sitio.";

    }
    else if (
      error?.name ===
      "NotFoundError"
    ) {

      message =
        "No se encontró ningún micrófono disponible.";

    }
    else if (
      error?.name ===
      "NotReadableError"
    ) {

      message =
        "El micrófono está siendo utilizado por otra aplicación o no puede abrirse.";

    }
    else if (
      error?.name ===
      "OverconstrainedError"
    ) {

      message =
        "El micrófono seleccionado ya no está disponible. Selecciona otro dispositivo.";

    }


    setMessage(
      message,
      "error"
    );

  }
  finally {

    if (
      microphoneActivateButton
    ) {

      microphoneActivateButton.disabled =
        false;

    }


    updateMicrophoneInterface();

  }

}


/* =========================================================
   MUTE DEL MICRÓFONO
========================================================= */

function toggleMicrophoneMuteUI() {

  if (!microphoneActive) {
    return;
  }


  microphoneMuted =
    !microphoneMuted;


  setMicrophoneMuted(
    microphoneMuted
  );


  updateMicrophoneInterface();


  setMessage(
    microphoneMuted
      ? "Micrófono silenciado."
      : "Micrófono nuevamente activo.",
    microphoneMuted
      ? ""
      : "ok"
  );

}


/* =========================================================
   GANANCIA DEL MICRÓFONO
========================================================= */

function updateMicrophoneGainUI() {

  const {
    microphoneGain,
    microphoneGainValue
  } = getElements();


  if (!microphoneGain) {
    return;
  }


  const rawValue =
    Number(
      microphoneGain.value
    );


  const percentage =
    Number.isFinite(
      rawValue
    )
      ? Math.max(
          0,
          Math.min(
            200,
            rawValue
          )
        )
      : DEFAULT_MIC_GAIN_PERCENT;


  setMicrophoneVolume(
    percentage / 100
  );


  if (
    microphoneGainValue
  ) {

    microphoneGainValue.textContent =
      `${Math.round(
        percentage
      )}%`;

  }

}


/* =========================================================
   CAMBIO DE MICRÓFONO
========================================================= */

function handleDeviceSelectChange() {

  const {
    deviceSelect
  } = getElements();


  if (!deviceSelect) {
    return;
  }


  currentDeviceId =
    deviceSelect.value ||
    "";


  updateDeviceName();

}


/* =========================================================
   CAMBIO DE DISPOSITIVOS DEL SISTEMA
========================================================= */

async function handleSystemDeviceChange() {

  if (microphoneActive) {
    return;
  }


  await populateMicrophones(
    currentDeviceId
  );


  updateDeviceName();

}


/* =========================================================
   MÚSICA — PLAYLIST
========================================================= */

function syncCurrentMusicName() {

  const playlistState =
    getMusicPlaylistState();

  const currentTrack =
    playlistState.tracks[
      playlistState.currentIndex
    ];

  musicFileName =
    currentTrack?.name ||
    "";

}


function renderMusicPlaylist() {

  const {
    musicPlaylist,
    musicPlaylistCount,
    musicPreviousButton,
    musicNextButton,
    musicClearButton
  } = getElements();

  const playlistState =
    getMusicPlaylistState();

  if (musicPlaylistCount) {

    musicPlaylistCount.textContent =
      playlistState.count === 1
        ? "1 canción"
        : `${playlistState.count} canciones`;

  }

  if (musicPreviousButton) {

    musicPreviousButton.disabled =
      !playlistState.hasPrevious;

  }

  if (musicNextButton) {

    musicNextButton.disabled =
      !playlistState.hasNext;

  }

  if (musicClearButton) {

    musicClearButton.disabled =
      playlistState.count === 0;

  }

  if (!musicPlaylist) {
    return;
  }

  musicPlaylist.innerHTML = "";

  if (playlistState.count === 0) {

    const empty =
      document.createElement("div");

    empty.className =
      "music-playlist-empty";

    empty.textContent =
      "No hay canciones en la playlist.";

    musicPlaylist.appendChild(empty);

    return;

  }

  playlistState.tracks.forEach(
    track => {

      const row =
        document.createElement("div");

      row.className =
        "music-playlist-item";

      row.classList.toggle(
        "active",
        track.selected
      );

      row.dataset.index =
        String(track.index);


      const selectButton =
        document.createElement("button");

      selectButton.type =
        "button";

      selectButton.className =
        "music-playlist-select";

      selectButton.dataset.action =
        "select";

      selectButton.dataset.index =
        String(track.index);

      selectButton.textContent =
        `${track.index + 1}. ${track.name}`;


      const duration =
        document.createElement("span");

      duration.className =
        "music-playlist-duration";

      duration.textContent =
        track.duration > 0
          ? formatTime(track.duration)
          : "—";


      const removeButton =
        document.createElement("button");

      removeButton.type =
        "button";

      removeButton.className =
        "music-playlist-remove";

      removeButton.dataset.action =
        "remove";

      removeButton.dataset.index =
        String(track.index);

      removeButton.setAttribute(
        "aria-label",
        `Eliminar ${track.name}`
      );

      removeButton.title =
        "Eliminar de la playlist";

      removeButton.textContent =
        "×";


      row.appendChild(
        selectButton
      );

      row.appendChild(
        duration
      );

      row.appendChild(
        removeButton
      );

      musicPlaylist.appendChild(
        row
      );

    }
  );

}


async function handleMusicPlaylistClick(
  event
) {

  const button =
    event.target.closest(
      "button[data-action]"
    );

  if (!button) {
    return;
  }

  const index =
    Number(
      button.dataset.index
    );

  if (!Number.isInteger(index)) {
    return;
  }

  try {

    if (
      button.dataset.action ===
      "select"
    ) {

      const result =
        await selectMusicTrack(
          index
        );

      musicFileName =
        result.name;

      updateMusicInterface();

      setMessage(
        `Transición a: ${result.name}`,
        "ok"
      );

    }
    else if (
      button.dataset.action ===
      "remove"
    ) {

      await removeMusicTrack(
        index
      );

      syncCurrentMusicName();

      updateMusicInterface();

      setMessage(
        "Canción eliminada de la playlist."
      );

    }

  }
  catch (error) {

    console.error(
      "Error administrando playlist:",
      error
    );

    setMessage(
      error?.message ||
      "No fue posible actualizar la playlist.",
      "error"
    );

  }

}


async function handlePreviousMusicTrack() {

  try {

    const result =
      await previousMusicTrack();

    if (!result) {
      return;
    }

    musicFileName =
      result.name;

    updateMusicInterface();

    setMessage(
      `Transición a canción anterior: ${result.name}`,
      "ok"
    );

  }
  catch (error) {

    console.error(
      "Error seleccionando canción anterior:",
      error
    );

    setMessage(
      error?.message ||
      "No fue posible seleccionar la canción anterior.",
      "error"
    );

  }

}


async function handleNextMusicTrack() {

  try {

    const result =
      await nextMusicTrack();

    if (!result) {
      return;
    }

    musicFileName =
      result.name;

    updateMusicInterface();

    setMessage(
      `Transición a siguiente canción: ${result.name}`,
      "ok"
    );

  }
  catch (error) {

    console.error(
      "Error seleccionando siguiente canción:",
      error
    );

    setMessage(
      error?.message ||
      "No fue posible seleccionar la siguiente canción.",
      "error"
    );

  }

}


function handleClearMusicPlaylist() {

  clearMusicPlaylist();

  musicFileName =
    "";

  musicMuted =
    false;

  setMusicMuted(
    false
  );

  updateMusicInterface();

  setMessage(
    "Playlist de música vaciada."
  );

}


/* =========================================================
   MÚSICA — INTERFAZ
========================================================= */

function updateMusicInterface() {

  const {
    musicPlayButton,
    musicStopButton,
    musicMuteButton,
    musicTrackName,
    musicProgress,
    musicCurrentTime,
    musicDuration
  } = getElements();


  const state =
    getMusicState();

  syncCurrentMusicName();

  renderMusicPlaylist();


  if (
    musicTrackName
  ) {

    musicTrackName.textContent =
      musicFileName ||
      "Sin canción cargada";

  }


  if (
    musicPlayButton
  ) {

    musicPlayButton.disabled =
      !state.loaded;


    musicPlayButton.textContent =
      state.playing
        ? "❚❚ PAUSA"
        : "▶ PLAY";

  }


  if (
    musicStopButton
  ) {

    musicStopButton.disabled =
      !state.loaded;

  }


  if (
    musicMuteButton
  ) {

    musicMuteButton.disabled =
      !state.loaded;


    musicMuteButton.classList.toggle(
      "muted",
      musicMuted
    );


    musicMuteButton.textContent =
      musicMuted
        ? "ACTIVAR"
        : "MUTE";

  }


  if (
    musicProgress
  ) {

    musicProgress.disabled =
      !state.loaded;


    musicProgress.max =
      state.duration > 0
        ? state.duration
        : 1;


    if (
      document.activeElement !==
      musicProgress
    ) {

      musicProgress.value =
        state.currentTime;

    }

  }


  if (
    musicCurrentTime
  ) {

    musicCurrentTime.textContent =
      formatTime(
        state.currentTime
      );

  }


  if (
    musicDuration
  ) {

    musicDuration.textContent =
      formatTime(
        state.duration
      );

  }


  updateEngineStatus();

}


/* =========================================================
   ABRIR SELECTOR DE ARCHIVO
========================================================= */

function openMusicPicker() {

  const {
    musicFileInput
  } = getElements();


  if (!musicFileInput) {
    return;
  }


  musicFileInput.multiple =
    true;

  musicFileInput.click();

}


/* =========================================================
   CARGAR CANCIONES
========================================================= */

async function handleMusicFile(
  event
) {

  const files =
    Array.from(
      event.target.files ||
      []
    );

  if (!files.length) {
    return;
  }

  setMessage(
    files.length === 1
      ? "Agregando canción..."
      : `Agregando ${files.length} canciones...`
  );

  try {

    const previousCount =
      getMusicPlaylistState()
        .count;

    await addMusicFiles(
      files
    );

    syncCurrentMusicName();

    musicMuted =
      false;

    setMusicMuted(
      false
    );

    updateMusicInterface();

    const playlistState =
      getMusicPlaylistState();

    setMessage(
      files.length === 1
        ? `Canción agregada. Playlist: ${playlistState.count} canción${playlistState.count === 1 ? "" : "es"}.`
        : `${files.length} canciones agregadas. Playlist: ${playlistState.count} canciones.`,
      "ok"
    );

    /*
     * Si ya había música reproduciéndose,
     * addMusicFiles no reemplaza ni interrumpe
     * la canción actual.
     */
    if (previousCount > 0) {
      updateMusicInterface();
    }

  }
  catch (error) {

    console.error(
      "Error cargando música:",
      error
    );

    syncCurrentMusicName();

    updateMusicInterface();

    setMessage(
      error?.message ||
      "No fue posible agregar las canciones.",
      "error"
    );

  }
  finally {

    event.target.value =
      "";

  }

}


/* =========================================================
   PLAY / PAUSA
========================================================= */

async function toggleMusicPlayback() {

  const state =
    getMusicState();


  if (!state.loaded) {

    setMessage(
      "Primero debes cargar una canción.",
      "error"
    );


    return;

  }


  try {

    if (state.playing) {

      pauseMusic();


      setMessage(
        "Música en pausa."
      );

    }
    else {

      await playMusic();


      setMessage(
        "Reproduciendo música.",
        "ok"
      );

    }


    updateMusicInterface();

  }
  catch (error) {

    console.error(
      "Error reproduciendo música:",
      error
    );


    setMessage(
      error?.message ||
      "No fue posible reproducir la canción.",
      "error"
    );

  }

}


/* =========================================================
   STOP
========================================================= */

function handleMusicStop() {

  stopMusic();


  updateMusicInterface();


  setMessage(
    "Música detenida."
  );

}


/* =========================================================
   MUTE MÚSICA
========================================================= */

function toggleMusicMuteUI() {

  const state =
    getMusicState();


  if (!state.loaded) {
    return;
  }


  musicMuted =
    !musicMuted;


  setMusicMuted(
    musicMuted
  );


  updateMusicInterface();


  setMessage(
    musicMuted
      ? "Canal Música silenciado."
      : "Canal Música nuevamente activo.",
    musicMuted
      ? ""
      : "ok"
  );

}


/* =========================================================
   VOLUMEN MÚSICA
========================================================= */

function updateMusicVolumeUI() {

  const {
    musicVolume,
    musicVolumeValue
  } = getElements();


  if (!musicVolume) {
    return;
  }


  const rawValue =
    Number(
      musicVolume.value
    );


  const percentage =
    Number.isFinite(
      rawValue
    )
      ? Math.max(
          0,
          Math.min(
            100,
            rawValue
          )
        )
      : DEFAULT_MUSIC_VOLUME_PERCENT;


  setMusicVolume(
    percentage / 100
  );


  if (
    musicVolumeValue
  ) {

    musicVolumeValue.textContent =
      `${Math.round(
        percentage
      )}%`;

  }

}


/* =========================================================
   SEEK / POSICIÓN DE CANCIÓN
========================================================= */

function handleMusicSeekInput() {

  const {
    musicProgress,
    musicCurrentTime
  } = getElements();


  if (!musicProgress) {
    return;
  }


  const value =
    Number(
      musicProgress.value
    );


  if (
    musicCurrentTime
  ) {

    musicCurrentTime.textContent =
      formatTime(
        value
      );

  }

}


function handleMusicSeekCommit() {

  const {
    musicProgress
  } = getElements();


  if (!musicProgress) {
    return;
  }


  seekMusic(
    Number(
      musicProgress.value
    )
  );


  updateMusicInterface();

}


/* =========================================================
   EVENTOS DEL ELEMENTO AUDIO
========================================================= */

function bindMusicElementEvents() {

  const audio =
    getMusicAudioElement();

  if (!audio) {
    return;
  }

  lastMusicAudioElement =
    audio;

  if (
    audio.dataset
      .radioConexionBound ===
    "true"
  ) {
    return;
  }

  audio.dataset
    .radioConexionBound =
      "true";

  const refresh =
    () => {
      syncCurrentMusicName();
      updateMusicInterface();
    };

  audio.addEventListener(
    "play",
    refresh
  );

  audio.addEventListener(
    "pause",
    refresh
  );

  audio.addEventListener(
    "ended",
    refresh
  );

  audio.addEventListener(
    "loadedmetadata",
    refresh
  );

  audio.addEventListener(
    "durationchange",
    refresh
  );

}


/* =========================================================
   SINCRONIZACIÓN V5 A/B
========================================================= */

function syncMusicV5Interface() {

  const state =
    getMusicState();

  const currentIndex =
    state.playlist?.currentIndex ??
    -1;

  const activeAudio =
    getMusicAudioElement();

  /*
   * En V5 el motor alterna entre dos reproductores.
   * Cada vez que cambia el elemento activo lo enlazamos
   * también a la interfaz, sin duplicar listeners.
   */
  if (
    activeAudio &&
    activeAudio !==
      lastMusicAudioElement
  ) {
    bindMusicElementEvents();
  }

  if (
    currentIndex !==
      lastMusicPlaylistIndex ||
    Boolean(state.transitioning) !==
      lastMusicTransitioning
  ) {

    lastMusicPlaylistIndex =
      currentIndex;

    lastMusicTransitioning =
      Boolean(
        state.transitioning
      );

    syncCurrentMusicName();
    updateMusicInterface();

  }

}


/* =========================================================
   MASTER — INTERFAZ
========================================================= */

function updateMasterInterface() {

  const {
    masterMuteButton
  } = getElements();

  const state =
    getMasterState();

  masterMuted =
    Boolean(state.muted);

  if (masterMuteButton) {

    masterMuteButton.classList.toggle(
      "muted",
      masterMuted
    );

    masterMuteButton.textContent =
      masterMuted
        ? "ACTIVAR"
        : "MUTE";

  }

}


function toggleMasterMuteUI() {

  masterMuted =
    !masterMuted;

  setMasterMuted(
    masterMuted
  );

  updateMasterInterface();

  setMessage(
    masterMuted
      ? "Salida Master silenciada."
      : "Salida Master nuevamente activa.",
    masterMuted
      ? ""
      : "ok"
  );

}


function updateMasterVolumeUI() {

  const {
    masterVolume,
    masterVolumeValue
  } = getElements();

  if (!masterVolume) {
    return;
  }

  const rawValue =
    Number(
      masterVolume.value
    );

  const percentage =
    Number.isFinite(rawValue)
      ? Math.max(
          0,
          Math.min(
            100,
            rawValue
          )
        )
      : DEFAULT_MASTER_VOLUME_PERCENT;

  setMasterVolume(
    percentage / 100
  );

  if (masterVolumeValue) {

    masterVolumeValue.textContent =
      `${Math.round(
        percentage
      )}%`;

  }

}


/* =========================================================
   CORTINA — INTERFAZ
========================================================= */

function updateCurtainInterface() {

  const {
    curtainPlayButton,
    curtainStopButton,
    curtainMuteButton,
    curtainTrackName,
    curtainProgress,
    curtainCurrentTime,
    curtainDuration
  } = getElements();


  const state =
    getCurtainState();


  if (
    curtainTrackName
  ) {

    curtainTrackName.textContent =
      curtainFileName ||
      "Sin cortina cargada";

  }


  if (
    curtainPlayButton
  ) {

    curtainPlayButton.disabled =
      !state.loaded;


    curtainPlayButton.textContent =
      state.playing
        ? "❚❚ PAUSA"
        : "▶ PLAY";

  }


  if (
    curtainStopButton
  ) {

    curtainStopButton.disabled =
      !state.loaded;

  }


  if (
    curtainMuteButton
  ) {

    curtainMuteButton.disabled =
      !state.loaded;


    curtainMuteButton.classList.toggle(
      "muted",
      curtainMuted
    );


    curtainMuteButton.textContent =
      curtainMuted
        ? "ACTIVAR"
        : "MUTE";

  }


  if (
    curtainProgress
  ) {

    curtainProgress.disabled =
      !state.loaded;


    curtainProgress.max =
      state.duration > 0
        ? state.duration
        : 1;


    if (
      document.activeElement !==
      curtainProgress
    ) {

      curtainProgress.value =
        state.currentTime;

    }

  }


  if (
    curtainCurrentTime
  ) {

    curtainCurrentTime.textContent =
      formatTime(
        state.currentTime
      );

  }


  if (
    curtainDuration
  ) {

    curtainDuration.textContent =
      formatTime(
        state.duration
      );

  }


  updateEngineStatus();

}


/* =========================================================
   ABRIR SELECTOR DE ARCHIVO
========================================================= */

function openCurtainPicker() {

  const {
    curtainFileInput
  } = getElements();


  if (!curtainFileInput) {
    return;
  }


  curtainFileInput.click();

}


/* =========================================================
   CARGAR CORTINA
========================================================= */

async function handleCurtainFile(
  event
) {

  const file =
    event.target
      .files?.[0];


  if (!file) {
    return;
  }


  setMessage(
    "Cargando cortina..."
  );


  try {

    stopCurtain();


    const result =
      await loadCurtainFile(
        file
      );


    curtainFileName =
      result.name;


    curtainMuted =
      false;


    setCurtainMuted(
      false
    );


    updateCurtainInterface();


    setMessage(
      `Cortina cargada: ${result.name} · ${formatTime(result.duration)}`,
      "ok"
    );

  }
  catch (error) {

    console.error(
      "Error cargando cortina:",
      error
    );


    curtainFileName =
      "";


    updateCurtainInterface();


    setMessage(
      error?.message ||
      "No fue posible cargar la cortina.",
      "error"
    );

  }
  finally {

    event.target.value =
      "";

  }

}


/* =========================================================
   PLAY / PAUSA
========================================================= */

async function toggleCurtainPlayback() {

  const state =
    getCurtainState();


  if (!state.loaded) {

    setMessage(
      "Primero debes cargar una cortina.",
      "error"
    );


    return;

  }


  try {

    if (state.playing) {

      pauseCurtain();


      setMessage(
        "Cortina en pausa."
      );

    }
    else {

      await playCurtain();


      setMessage(
        "Reproduciendo cortina.",
        "ok"
      );

    }


    updateCurtainInterface();

  }
  catch (error) {

    console.error(
      "Error reproduciendo cortina:",
      error
    );


    setMessage(
      error?.message ||
      "No fue posible reproducir la cortina.",
      "error"
    );

  }

}


/* =========================================================
   STOP
========================================================= */

function handleCurtainStop() {

  stopCurtain();


  updateCurtainInterface();


  setMessage(
    "Cortina detenida."
  );

}


/* =========================================================
   MUTE CORTINA
========================================================= */

function toggleCurtainMuteUI() {

  const state =
    getCurtainState();


  if (!state.loaded) {
    return;
  }


  curtainMuted =
    !curtainMuted;


  setCurtainMuted(
    curtainMuted
  );


  updateCurtainInterface();


  setMessage(
    curtainMuted
      ? "Canal Cortina silenciado."
      : "Canal Cortina nuevamente activo.",
    curtainMuted
      ? ""
      : "ok"
  );

}


/* =========================================================
   VOLUMEN CORTINA
========================================================= */

function updateCurtainVolumeUI() {

  const {
    curtainVolume,
    curtainVolumeValue
  } = getElements();


  if (!curtainVolume) {
    return;
  }


  const rawValue =
    Number(
      curtainVolume.value
    );


  const percentage =
    Number.isFinite(
      rawValue
    )
      ? Math.max(
          0,
          Math.min(
            100,
            rawValue
          )
        )
      : DEFAULT_MUSIC_VOLUME_PERCENT;


  setCurtainVolume(
    percentage / 100
  );


  if (
    curtainVolumeValue
  ) {

    curtainVolumeValue.textContent =
      `${Math.round(
        percentage
      )}%`;

  }

}


/* =========================================================
   SEEK / POSICIÓN DE CORTINA
========================================================= */

function handleCurtainSeekInput() {

  const {
    curtainProgress,
    curtainCurrentTime
  } = getElements();


  if (!curtainProgress) {
    return;
  }


  const value =
    Number(
      curtainProgress.value
    );


  if (
    curtainCurrentTime
  ) {

    curtainCurrentTime.textContent =
      formatTime(
        value
      );

  }

}


function handleCurtainSeekCommit() {

  const {
    curtainProgress
  } = getElements();


  if (!curtainProgress) {
    return;
  }


  seekCurtain(
    Number(
      curtainProgress.value
    )
  );


  updateCurtainInterface();

}


/* =========================================================
   EVENTOS DEL ELEMENTO AUDIO
========================================================= */

function bindCurtainElementEvents() {

  const audio =
    getCurtainAudioElement();


  if (!audio) {
    return;
  }


  if (
    audio.dataset
      .radioConexionBound ===
    "true"
  ) {
    return;
  }


  audio.dataset
    .radioConexionBound =
      "true";


  audio.addEventListener(
    "play",
    updateCurtainInterface
  );


  audio.addEventListener(
    "pause",
    updateCurtainInterface
  );


  audio.addEventListener(
    "ended",
    updateCurtainInterface
  );


  audio.addEventListener(
    "loadedmetadata",
    updateCurtainInterface
  );


  audio.addEventListener(
    "durationchange",
    updateCurtainInterface
  );

}




/* =========================================================
   MEDIDORES
========================================================= */

function renderMeters() {

  const {
    microphoneMeterFill,
    microphoneDecibels,

    musicMeterFill,
    musicDecibels,
    musicProgress,
    musicCurrentTime,
    musicDuration,

    masterMeterFill,
    masterDecibels,

    curtainMeterFill,
    curtainDecibels,
    curtainProgress,
    curtainCurrentTime,
    curtainDuration
  } = getElements();


  /* -------------------------
     MICRÓFONO
  ------------------------- */

  if (
    isMicrophoneActive()
  ) {

    const level =
      getMicrophoneLevel();


    const db =
      getMicrophoneDecibels();

    /*
      V7: el medidor del micrófono también alimenta
      el detector de voz del Auto-Ducking.
    */
    updateAutoDucking(db);


    if (
      microphoneMeterFill
    ) {

      microphoneMeterFill
        .style.width =
          `${Math.max(
            0,
            Math.min(
              100,
              level * 100
            )
          )}%`;

    }


    if (
      microphoneDecibels
    ) {

      microphoneDecibels
        .textContent =
          Number.isFinite(
            db
          )
            ? `${Math.round(db)} dB`
            : "— dB";

    }

  }
  else {

    updateAutoDucking(-Infinity);

    if (
      microphoneMeterFill
    ) {

      microphoneMeterFill
        .style.width =
          "0%";

    }


    if (
      microphoneDecibels
    ) {

      microphoneDecibels
        .textContent =
          "— dB";

    }

  }


  /* -------------------------
     MÚSICA
  ------------------------- */

  const musicState =
    getMusicState();

  syncMusicV5Interface();


  if (
    musicState.loaded
  ) {

    const level =
      getMusicLevel();


    const db =
      getMusicDecibels();


    if (
      musicMeterFill
    ) {

      musicMeterFill
        .style.width =
          `${Math.max(
            0,
            Math.min(
              100,
              level * 100
            )
          )}%`;

    }


    if (
      musicDecibels
    ) {

      musicDecibels
        .textContent =
          Number.isFinite(
            db
          )
            ? `${Math.round(db)} dB`
            : "— dB";

    }


    if (
      musicProgress &&
      document.activeElement !==
      musicProgress
    ) {

      musicProgress.max =
        musicState.duration > 0
          ? musicState.duration
          : 1;


      musicProgress.value =
        musicState.currentTime;

    }


    if (
      musicCurrentTime
    ) {

      musicCurrentTime.textContent =
        formatTime(
          musicState.currentTime
        );

    }


    if (
      musicDuration
    ) {

      musicDuration.textContent =
        formatTime(
          musicState.duration
        );

    }


    if (
      musicState.ended
    ) {

      updateMusicInterface();

    }

  }
  else {

    if (
      musicMeterFill
    ) {

      musicMeterFill
        .style.width =
          "0%";

    }


    if (
      musicDecibels
    ) {

      musicDecibels
        .textContent =
          "— dB";

    }

  }


  /* -------------------------
     MASTER
  ------------------------- */

  const masterState =
    getMasterState();

  if (masterState.ready) {

    const level =
      getMasterLevel();

    const db =
      getMasterDecibels();

    if (masterMeterFill) {

      masterMeterFill.style.width =
        `${Math.max(
          0,
          Math.min(
            100,
            level * 100
          )
        )}%`;

    }

    if (masterDecibels) {

      masterDecibels.textContent =
        Number.isFinite(db)
          ? `${Math.round(db)} dB`
          : "— dB";

    }

  }
  else {

    if (masterMeterFill) {
      masterMeterFill.style.width =
        "0%";
    }

    if (masterDecibels) {
      masterDecibels.textContent =
        "— dB";
    }

  }


  /* -------------------------
     CORTINA
  ------------------------- */

  const curtainState =
    getCurtainState();


  if (
    curtainState.loaded
  ) {

    const level =
      getCurtainLevel();

    const db =
      getCurtainDecibels();


    if (
      curtainMeterFill
    ) {

      curtainMeterFill
        .style.width =
          `${Math.max(
            0,
            Math.min(
              100,
              level * 100
            )
          )}%`;

    }


    if (
      curtainDecibels
    ) {

      curtainDecibels
        .textContent =
          Number.isFinite(
            db
          )
            ? `${Math.round(db)} dB`
            : "— dB";

    }


    if (
      curtainProgress &&
      document.activeElement !==
      curtainProgress
    ) {

      curtainProgress.max =
        curtainState.duration > 0
          ? curtainState.duration
          : 1;

      curtainProgress.value =
        curtainState.currentTime;

    }


    if (
      curtainCurrentTime
    ) {

      curtainCurrentTime.textContent =
        formatTime(
          curtainState.currentTime
        );

    }


    if (
      curtainDuration
    ) {

      curtainDuration.textContent =
        formatTime(
          curtainState.duration
        );

    }


    if (
      curtainState.ended
    ) {

      updateCurtainInterface();

    }

  }
  else {

    if (
      curtainMeterFill
    ) {

      curtainMeterFill
        .style.width =
          "0%";

    }


    if (
      curtainDecibels
    ) {

      curtainDecibels
        .textContent =
          "— dB";

    }

  }


  meterAnimationFrame =
    requestAnimationFrame(
      renderMeters
    );

}


/* =========================================================
   INICIAR MEDIDORES
========================================================= */

function startMeters() {

  if (
    meterAnimationFrame !==
    null
  ) {

    cancelAnimationFrame(
      meterAnimationFrame
    );

  }


  meterAnimationFrame =
    requestAnimationFrame(
      renderMeters
    );

}


/* =========================================================
   DETENER MEDIDORES
========================================================= */

function stopMeters() {

  if (
    meterAnimationFrame ===
    null
  ) {
    return;
  }


  cancelAnimationFrame(
    meterAnimationFrame
  );


  meterAnimationFrame =
    null;

}


/* =========================================================
   INICIALIZACIÓN
========================================================= */

async function initializeAudioConsole() {

  const {
    microphoneActivateButton,
    microphoneMuteButton,
    microphoneGain,
    deviceSelect,

    musicFileInput,
    musicLoadButton,
    musicPlayButton,
    musicStopButton,
    musicMuteButton,
    musicVolume,
    musicProgress,
    musicPreviousButton,
    musicNextButton,
    musicClearButton,
    musicPlaylist,

    masterMuteButton,
    masterVolume,

    curtainFileInput,
    curtainLoadButton,
    curtainPlayButton,
    curtainStopButton,
    curtainMuteButton,
    curtainVolume,
    curtainProgress
  } = getElements();


  /*
   * El micrófono ya forma parte
   * de la Consola V1.
   *
   * Si esos elementos no existen,
   * significa que no estamos en
   * una página que tenga la consola.
   */

  if (
    !microphoneActivateButton ||
    !microphoneMuteButton ||
    !microphoneGain ||
    !deviceSelect
  ) {

    return;

  }


  /* -------------------------
     MICRÓFONO
  ------------------------- */

  microphoneActivateButton
    .addEventListener(
      "click",
      activateMicrophone
    );


  microphoneMuteButton
    .addEventListener(
      "click",
      toggleMicrophoneMuteUI
    );


  microphoneGain
    .addEventListener(
      "input",
      updateMicrophoneGainUI
    );


  deviceSelect
    .addEventListener(
      "change",
      handleDeviceSelectChange
    );


  /* -------------------------
     MÚSICA
  ------------------------- */

  if (
    musicLoadButton
  ) {

    musicLoadButton
      .addEventListener(
        "click",
        openMusicPicker
      );

  }


  if (
    musicFileInput
  ) {

    musicFileInput
      .addEventListener(
        "change",
        handleMusicFile
      );

  }


  if (
    musicPlayButton
  ) {

    musicPlayButton
      .addEventListener(
        "click",
        toggleMusicPlayback
      );

  }


  if (
    musicStopButton
  ) {

    musicStopButton
      .addEventListener(
        "click",
        handleMusicStop
      );

  }


  if (
    musicMuteButton
  ) {

    musicMuteButton
      .addEventListener(
        "click",
        toggleMusicMuteUI
      );

  }


  if (
    musicVolume
  ) {

    musicVolume
      .addEventListener(
        "input",
        updateMusicVolumeUI
      );

  }


  if (
    musicProgress
  ) {

    musicProgress
      .addEventListener(
        "input",
        handleMusicSeekInput
      );


    musicProgress
      .addEventListener(
        "change",
        handleMusicSeekCommit
      );

  }


  if (
    musicPreviousButton
  ) {

    musicPreviousButton
      .addEventListener(
        "click",
        handlePreviousMusicTrack
      );

  }


  if (
    musicNextButton
  ) {

    musicNextButton
      .addEventListener(
        "click",
        handleNextMusicTrack
      );

  }


  if (
    musicClearButton
  ) {

    musicClearButton
      .addEventListener(
        "click",
        handleClearMusicPlaylist
      );

  }


  if (
    musicPlaylist
  ) {

    musicPlaylist
      .addEventListener(
        "click",
        handleMusicPlaylistClick
      );

  }


  /* -------------------------
     MASTER
  ------------------------- */

  if (masterMuteButton) {

    masterMuteButton
      .addEventListener(
        "click",
        toggleMasterMuteUI
      );

  }

  if (masterVolume) {

    masterVolume
      .addEventListener(
        "input",
        updateMasterVolumeUI
      );

  }


  /* -------------------------
     CORTINA
  ------------------------- */

  if (
    curtainLoadButton
  ) {

    curtainLoadButton
      .addEventListener(
        "click",
        openCurtainPicker
      );

  }


  if (
    curtainFileInput
  ) {

    curtainFileInput
      .addEventListener(
        "change",
        handleCurtainFile
      );

  }


  if (
    curtainPlayButton
  ) {

    curtainPlayButton
      .addEventListener(
        "click",
        toggleCurtainPlayback
      );

  }


  if (
    curtainStopButton
  ) {

    curtainStopButton
      .addEventListener(
        "click",
        handleCurtainStop
      );

  }


  if (
    curtainMuteButton
  ) {

    curtainMuteButton
      .addEventListener(
        "click",
        toggleCurtainMuteUI
      );

  }


  if (
    curtainVolume
  ) {

    curtainVolume
      .addEventListener(
        "input",
        updateCurtainVolumeUI
      );

  }


  if (
    curtainProgress
  ) {

    curtainProgress
      .addEventListener(
        "input",
        handleCurtainSeekInput
      );

    curtainProgress
      .addEventListener(
        "change",
        handleCurtainSeekCommit
      );

  }


  /* -------------------------
     VALORES INICIALES
  ------------------------- */

  updateMicrophoneGainUI();

  updateMusicVolumeUI();

  updateMasterVolumeUI();

  updateCurtainVolumeUI();

  updateMicrophoneInterface();

  updateMusicInterface();

  updateMasterInterface();

  updateCurtainInterface();


  /* -------------------------
     DISPOSITIVOS
  ------------------------- */

  try {

    await populateMicrophones();

    updateDeviceName();

  }
  catch (error) {

    console.error(
      "Error inicializando dispositivos:",
      error
    );

  }


  if (
    navigator.mediaDevices &&
    typeof navigator
      .mediaDevices
      .addEventListener ===
      "function"
  ) {

    navigator.mediaDevices
      .addEventListener(
        "devicechange",
        handleSystemDeviceChange
      );

  }


  /*
   * El elemento <audio> interno
   * del canal Música se crea
   * cuando cargamos la primera
   * canción.
   *
   * Revisamos hasta que exista
   * y entonces enlazamos sus
   * eventos una sola vez.
   */

  /*
   * V5 usa dos reproductores internos A/B.
   * Este observador permanece activo para enlazar el
   * reproductor que vaya quedando activo después de
   * cada crossfade.
   */
  window.setInterval(
    () => {

      const audio =
        getMusicAudioElement();

      if (!audio) {
        return;
      }

      if (
        audio !==
          lastMusicAudioElement ||
        audio.dataset
          .radioConexionBound !==
          "true"
      ) {
        bindMusicElementEvents();
      }

    },
    250
  );


  const curtainBindingInterval =
    window.setInterval(
      () => {

        const audio =
          getCurtainAudioElement();


        if (!audio) {
          return;
        }


        bindCurtainElementEvents();


        window.clearInterval(
          curtainBindingInterval
        );

      },
      250
    );


  /* -------------------------
     MEDIDORES
  ------------------------- */

  startMeters();

}


/* =========================================================
   LIMPIEZA
========================================================= */

function cleanupAudioConsole() {

  stopMeters();

  stopMicrophone();

  stopMusic();

  stopCurtain();

}


/* =========================================================
   ARRANQUE
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeAudioConsole
);


window.addEventListener(
  "beforeunload",
  cleanupAudioConsole
);