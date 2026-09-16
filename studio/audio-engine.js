/* ========================================================= RADIO
CONEXIÓN STUDIO AUDIO ENGINE V10

Canales actuales: - Micrófono - Música con playlist + crossfade automático - Cortina - Master

Program de grabación con protección de picos para MediaRecorder.
========================================================= */

/* =========================================================
   MASTER V6
========================================================= */

let masterGain = null;
let masterAnalyser = null;

let masterVolume = 1;
let masterMuted = false;

/*
 * El MASTER controla la salida audible de Música y Cortina.
 * El micrófono NO se conecta a esta salida para evitar eco/acople.
 * Más adelante el micrófono se sumará a un bus de grabación
 * independiente que podrá reutilizar el nivel del MASTER.
 */

/* =========================================================
   PROGRAM · BUS DE GRABACIÓN V9
========================================================= */

let programGain = null;
let programAnalyser = null;
let programLimiter = null;
let programDestination = null;

/* ========================================================= AUDIO
CONTEXT ========================================================= */

let audioContext = null;

/* ========================================================= MICRÓFONO
========================================================= */

let microphoneStream = null; let microphoneSource = null; let
microphoneGain = null; let microphoneAnalyser = null;

let microphoneMuted = false; let microphoneVolume = 1;

/* =========================================================
   MÚSICA V5 · PLAYLIST + CROSSFADE A/B
========================================================= */

const MUSIC_CROSSFADE_SECONDS = 5;

let musicAudioA = null;
let musicAudioB = null;

let musicSourceA = null;
let musicSourceB = null;

let musicFadeGainA = null;
let musicFadeGainB = null;

let musicGain = null;
let musicAnalyser = null;

let musicActiveSlot = "A";
let musicTransitioning = false;
let musicTransitionPromise = null;
let musicTransitionGeneration = 0;
let musicAutoAdvanceEnabled = true;

let musicObjectUrl = null;

let musicVolume = 0.7;
let musicMuted = false;

/* =========================================================
   AUTO-DUCKING V10 · SOLO MÚSICA
========================================================= */

const AUTO_DUCK_THRESHOLD_DB = -38;
const AUTO_DUCK_RELEASE_DB = -44;
const AUTO_DUCK_GAIN = Math.pow(10, -12 / 20);
const AUTO_DUCK_ATTACK_SECONDS = 0.12;
const AUTO_DUCK_RELEASE_SECONDS = 0.9;
const AUTO_DUCK_HOLD_MS = 320;

let autoDuckEnabled = true;
let autoDuckActive = false;
let autoDuckLastVoiceAt = 0;

let musicPlaylist = [];
let musicPlaylistIndex = -1;
let musicPlaylistId = 0;

/* ========================================================= CORTINA
========================================================= */

let curtainAudioElement = null; let curtainSource = null; let
curtainGain = null; let curtainAnalyser = null;

let curtainObjectUrl = null;

let curtainVolume = 0.35; let curtainMuted = false;

/* ========================================================= AUDIO
CONTEXT ========================================================= */

async function ensureAudioContext() {

if (!audioContext) {

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {

      throw new Error(
        "Este navegador no admite Web Audio API."
      );

    }

    audioContext =
      new AudioContextClass();

}

if ( audioContext.state === "suspended" ) {

    await audioContext.resume();

}

return audioContext;

}

/* =========================================================
   CREAR / ACTUALIZAR MASTER
========================================================= */

function ensureMasterBus() {
  if (!audioContext) {
    throw new Error(
      "El AudioContext debe estar activo antes de crear el Master."
    );
  }

  if (!masterGain) {
    masterGain = audioContext.createGain();
  }

  if (!masterAnalyser) {
    masterAnalyser = audioContext.createAnalyser();
    masterAnalyser.fftSize = 2048;
    masterAnalyser.smoothingTimeConstant = 0.72;
  }

  try {
    masterGain.disconnect();
  }
  catch (error) {
    /* Puede no estar conectado todavía. */
  }

  try {
    masterAnalyser.disconnect();
  }
  catch (error) {
    /* Puede no estar conectado todavía. */
  }

  masterGain.connect(masterAnalyser);
  masterAnalyser.connect(audioContext.destination);

  updateMasterGain();

  return masterGain;
}


function connectNodeToMaster(node) {

  if (!node) {
    throw new Error("Se necesita un nodo de audio para conectarlo al Master.");
  }

  ensureMasterBus();

  node.connect(masterGain);

  return node;
}


function updateMasterGain() {
  if (!masterGain) { return; }

  const target =
    masterMuted ? 0 : masterVolume;

  if (audioContext) {
    const now = audioContext.currentTime;

    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(target, now);
  }
  else {
    masterGain.gain.value = target;
  }
}


function setMasterVolume(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return;
  }

  masterVolume =
    Math.max(
      0,
      Math.min(1, number)
    );

  updateMasterGain();
}


function setMasterMuted(muted) {
  masterMuted = Boolean(muted);
  updateMasterGain();
}


function toggleMasterMute() {
  setMasterMuted(!masterMuted);
  return masterMuted;
}


/* =========================================================
   NIVEL MASTER
========================================================= */

function getMasterRms() {
  if (!masterAnalyser) {
    return 0;
  }

  const data =
    new Uint8Array(
      masterAnalyser.fftSize
    );

  masterAnalyser.getByteTimeDomainData(data);

  let sumSquares = 0;

  for (
    let index = 0;
    index < data.length;
    index += 1
  ) {
    const normalized =
      (data[index] - 128) / 128;

    sumSquares +=
      normalized * normalized;
  }

  return Math.sqrt(
    sumSquares / data.length
  );
}


function getMasterLevel() {
  const rms = getMasterRms();
  return Math.min(1, rms * 3);
}


function getMasterDecibels() {
  const rms = getMasterRms();

  if (rms <= 0) {
    return -Infinity;
  }

  return 20 * Math.log10(rms);
}


function getMasterState() {
  return {
    ready:
      Boolean(
        masterGain &&
        masterAnalyser
      ),

    volume:
      masterVolume,

    muted:
      masterMuted
  };
}


/* =========================================================
   CREAR / ACTUALIZAR PROGRAM
========================================================= */

function ensureProgramBus() {
  if (!audioContext) {
    throw new Error(
      "El AudioContext debe estar activo antes de crear el bus Program."
    );
  }

  if (!programGain) {
    programGain = audioContext.createGain();

    /*
      Dejamos 1 dB de margen antes del limitador.
      Esto evita trabajar permanentemente contra 0 dBFS.
    */
    programGain.gain.value =
      Math.pow(10, -1 / 20);
  }

  if (!programAnalyser) {
    programAnalyser = audioContext.createAnalyser();
    programAnalyser.fftSize = 2048;
    programAnalyser.smoothingTimeConstant = 0.72;
  }

  if (!programLimiter) {
    programLimiter =
      audioContext.createDynamicsCompressor();

    /*
      Limitador de seguridad del Program.

      No busca "aplastar" ni normalizar la mezcla:
      solamente controla los picos cuando coinciden
      voz + música + cortina + Soundpad.
    */
    programLimiter.threshold.value = -3;
    programLimiter.knee.value = 0;
    programLimiter.ratio.value = 20;
    programLimiter.attack.value = 0.003;
    programLimiter.release.value = 0.18;
  }

  if (!programDestination) {
    programDestination =
      audioContext.createMediaStreamDestination();
  }

  try {
    programGain.disconnect();
  }
  catch (error) {
    /* Puede no estar conectado todavía. */
  }

  try {
    programAnalyser.disconnect();
  }
  catch (error) {
    /* Puede no estar conectado todavía. */
  }

  try {
    programLimiter.disconnect();
  }
  catch (error) {
    /* Puede no estar conectado todavía. */
  }

  /*
    Cadena de grabación:

    Canales
      → Program Gain (-1 dB de margen)
      → Analyser
      → Limitador de picos
      → MediaRecorder
  */
  programGain.connect(programAnalyser);
  programAnalyser.connect(programLimiter);
  programLimiter.connect(programDestination);

  return programGain;
}

function connectNodeToProgram(node) {
  if (!node) {
    throw new Error("Se necesita un nodo de audio para conectarlo al Program.");
  }

  ensureProgramBus();
  node.connect(programGain);
  return node;
}

function getProgramStream() {
  return programDestination?.stream || null;
}

function getProgramState() {
  return {
    ready: Boolean(programGain && programAnalyser && programLimiter && programDestination),
    hasStream: Boolean(programDestination?.stream)
  };
}

/* ========================================================= MICRÓFONOS
DISPONIBLES ========================================================= */

async function getMicrophones() {

if ( !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices
) {

    throw new Error(
      "El navegador no permite consultar dispositivos de audio."
    );

}

const devices = await navigator.mediaDevices .enumerateDevices();

return devices.filter( device => device.kind === "audioinput" );

}

/* ========================================================= DETENER
MICRÓFONO ========================================================= */

function stopMicrophone() {

setAutoDuckActive(false);

if (microphoneSource) {

    try {
      microphoneSource.disconnect();
    }
    catch (error) {
      console.warn(
        "No fue posible desconectar la fuente del micrófono:",
        error
      );
    }

    microphoneSource = null;

}

if (microphoneGain) {

    try {
      microphoneGain.disconnect();
    }
    catch (error) {
      console.warn(
        "No fue posible desconectar la ganancia del micrófono:",
        error
      );
    }

    microphoneGain = null;

}

if (microphoneAnalyser) {

    try {
      microphoneAnalyser.disconnect();
    }
    catch (error) {
      console.warn(
        "No fue posible desconectar el analizador del micrófono:",
        error
      );
    }

    microphoneAnalyser = null;

}

if (microphoneStream) {

    microphoneStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    microphoneStream = null;

}

}

/* ========================================================= ACTIVAR
MICRÓFONO ========================================================= */

async function startMicrophone( deviceId = "" ) {

if ( !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia ) {

    throw new Error(
      "El navegador no permite acceder al micrófono."
    );

}

const context = await ensureAudioContext();

stopMicrophone();

const audioConstraints = {

    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false

};

if (deviceId) {

    audioConstraints.deviceId = {
      exact: deviceId
    };

}

microphoneStream = await navigator.mediaDevices .getUserMedia({ audio:
audioConstraints, video: false });

microphoneSource = context.createMediaStreamSource( microphoneStream );

microphoneGain = context.createGain();

microphoneAnalyser = context.createAnalyser();

microphoneAnalyser.fftSize = 2048;

microphoneAnalyser.smoothingTimeConstant = 0.72;

updateMicrophoneGain();

/* IMPORTANTE: El micrófono NO se conecta todavía * a
context.destination. De esa forma evitamos escuchar * nuestra propia voz
por los parlantes * y provocar eco o acople. */

microphoneSource.connect( microphoneGain );

microphoneGain.connect( microphoneAnalyser );

/* V8: el micrófono entra al Program, pero NO al Master/parlantes. */
ensureProgramBus();
microphoneAnalyser.connect( programGain );

const audioTrack = microphoneStream .getAudioTracks()[0];

return {

    stream:
      microphoneStream,

    deviceId:
      audioTrack
        ?.getSettings()
        ?.deviceId || deviceId

};

}

/* ========================================================= GANANCIA
DEL MICRÓFONO =========================================================
*/

function updateMicrophoneGain() {

if (!microphoneGain) { return; }

microphoneGain.gain.value = microphoneMuted ? 0 : microphoneVolume;

}

function setMicrophoneVolume( value ) {

const number = Number(value);

if (!Number.isFinite(number)) { return; }

microphoneVolume = Math.max( 0, Math.min( 2, number ) );

updateMicrophoneGain();

}

function setMicrophoneMuted( muted ) {

microphoneMuted = Boolean(muted);

if (microphoneMuted) {
  setAutoDuckActive(false);
}

updateMicrophoneGain();

}

function toggleMicrophoneMute() {

setMicrophoneMuted( !microphoneMuted );

return microphoneMuted;

}

/* ========================================================= NIVEL DEL
MICRÓFONO ========================================================= */

function getMicrophoneRms() {

if (!microphoneAnalyser) { return 0; }

const data = new Uint8Array( microphoneAnalyser .fftSize );

microphoneAnalyser .getByteTimeDomainData( data );

let sumSquares = 0;

for ( let index = 0; index < data.length; index += 1 ) {

    const normalized =
      (
        data[index] -
        128
      ) /
      128;


    sumSquares +=
      normalized *
      normalized;

}

return Math.sqrt( sumSquares / data.length );

}

function getMicrophoneLevel() {

const rms = getMicrophoneRms();

return Math.min( 1, rms * 4 );

}

function getMicrophoneDecibels() {

const rms = getMicrophoneRms();

if (rms <= 0) {

    return -Infinity;

}

return 20 * Math.log10(rms);

}

/* ========================================================= ESTADO DEL
MICRÓFONO ========================================================= */

function isMicrophoneActive() {

if (!microphoneStream) { return false; }

return microphoneStream .getAudioTracks() .some( track =>
track.readyState === "live" );

}

/* =========================================================
   CANAL DE MÚSICA V5
========================================================= */

function getActiveMusicAudio() {
  return musicActiveSlot === "A" ? musicAudioA : musicAudioB;
}

function getStandbyMusicAudio() {
  return musicActiveSlot === "A" ? musicAudioB : musicAudioA;
}

function getActiveMusicFadeGain() {
  return musicActiveSlot === "A" ? musicFadeGainA : musicFadeGainB;
}

function getStandbyMusicFadeGain() {
  return musicActiveSlot === "A" ? musicFadeGainB : musicFadeGainA;
}

function safeSetAudioTime(audio, seconds = 0) {
  if (!audio) { return; }

  try {
    audio.currentTime = seconds;
  }
  catch (error) {
    console.warn("No fue posible cambiar la posición de la música:", error);
  }
}

function stopAndUnloadMusicAudio(audio) {
  if (!audio) { return; }

  audio.pause();
  safeSetAudioTime(audio, 0);

  try {
    audio.removeAttribute("src");
    audio.load();
  }
  catch (error) {
    console.warn("No fue posible limpiar un reproductor de música:", error);
  }
}

function setFadeGainImmediately(gainNode, value) {
  if (!gainNode || !audioContext) { return; }

  const now = audioContext.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(value, now);
}

function getMusicTargetGain() {
  if (musicMuted) {
    return 0;
  }

  return (
    musicVolume *
    (autoDuckEnabled && autoDuckActive
      ? AUTO_DUCK_GAIN
      : 1)
  );
}


function applyMusicMasterGain(
  transitionSeconds = 0
) {
  if (!musicGain) { return; }

  const target = getMusicTargetGain();

  if (!audioContext) {
    musicGain.gain.value = target;
    return;
  }

  const now = audioContext.currentTime;
  const duration =
    Math.max(0, Number(transitionSeconds) || 0);

  musicGain.gain.cancelScheduledValues(now);

  /*
    Conservamos el valor instantáneo para que el cambio
    de ducking no produzca saltos ni clicks.
  */
  musicGain.gain.setValueAtTime(
    musicGain.gain.value,
    now
  );

  if (duration > 0) {
    musicGain.gain.linearRampToValueAtTime(
      target,
      now + duration
    );
  }
  else {
    musicGain.gain.setValueAtTime(
      target,
      now
    );
  }
}


function setAutoDuckActive(active) {
  const nextActive =
    Boolean(active) && autoDuckEnabled;

  if (nextActive === autoDuckActive) {
    return autoDuckActive;
  }

  autoDuckActive = nextActive;

  applyMusicMasterGain(
    autoDuckActive
      ? AUTO_DUCK_ATTACK_SECONDS
      : AUTO_DUCK_RELEASE_SECONDS
  );

  return autoDuckActive;
}


function setAutoDuckEnabled(enabled) {
  autoDuckEnabled = Boolean(enabled);

  if (!autoDuckEnabled) {
    autoDuckActive = false;
    applyMusicMasterGain(
      AUTO_DUCK_RELEASE_SECONDS
    );
  }

  return autoDuckEnabled;
}


function updateAutoDucking(
  microphoneDb = -Infinity
) {
  if (
    !autoDuckEnabled ||
    microphoneMuted ||
    !isMicrophoneActive()
  ) {
    if (autoDuckActive) {
      setAutoDuckActive(false);
    }

    return autoDuckActive;
  }

  const db = Number(microphoneDb);
  const now = performance.now();

  if (
    Number.isFinite(db) &&
    db >= AUTO_DUCK_THRESHOLD_DB
  ) {
    autoDuckLastVoiceAt = now;

    if (!autoDuckActive) {
      setAutoDuckActive(true);
    }

    return autoDuckActive;
  }

  if (
    autoDuckActive &&
    (
      !Number.isFinite(db) ||
      db <= AUTO_DUCK_RELEASE_DB
    ) &&
    now - autoDuckLastVoiceAt >=
      AUTO_DUCK_HOLD_MS
  ) {
    setAutoDuckActive(false);
  }

  return autoDuckActive;
}


function getAutoDuckState() {
  return {
    enabled: autoDuckEnabled,
    active: autoDuckActive,
    reductionDb: 12,
    thresholdDb: AUTO_DUCK_THRESHOLD_DB,
    releaseDb: AUTO_DUCK_RELEASE_DB
  };
}

function attachMusicAutomationListeners(audio) {
  if (!audio || audio.dataset.radioConexionV5Bound === "1") {
    return;
  }

  audio.dataset.radioConexionV5Bound = "1";

  audio.addEventListener("timeupdate", () => {
    if (!musicAutoAdvanceEnabled || musicTransitioning) {
      return;
    }

    if (audio !== getActiveMusicAudio()) {
      return;
    }

    const duration = Number(audio.duration);
    const currentTime = Number(audio.currentTime);

    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !Number.isFinite(currentTime)
    ) {
      return;
    }

    const remaining = duration - currentTime;

    if (
      remaining <= MUSIC_CROSSFADE_SECONDS &&
      remaining > 0 &&
      musicPlaylistIndex >= 0 &&
      musicPlaylistIndex < musicPlaylist.length - 1
    ) {
      crossfadeToMusicIndex(
        musicPlaylistIndex + 1,
        MUSIC_CROSSFADE_SECONDS
      ).catch(error => {
        console.error("Error durante el crossfade automático:", error);
      });
    }
  });

  audio.addEventListener("ended", () => {
    if (audio !== getActiveMusicAudio()) {
      return;
    }

    if (
      musicAutoAdvanceEnabled &&
      !musicTransitioning &&
      musicPlaylistIndex >= 0 &&
      musicPlaylistIndex < musicPlaylist.length - 1
    ) {
      crossfadeToMusicIndex(
        musicPlaylistIndex + 1,
        0
      ).catch(error => {
        console.error("Error al avanzar automáticamente la playlist:", error);
      });
    }
  });
}

async function ensureMusicChannel() {
  const context = await ensureAudioContext();

  if (!musicAudioA) {
    musicAudioA = new Audio();
    musicAudioA.preload = "metadata";
    attachMusicAutomationListeners(musicAudioA);
  }

  if (!musicAudioB) {
    musicAudioB = new Audio();
    musicAudioB.preload = "metadata";
    attachMusicAutomationListeners(musicAudioB);
  }

  if (!musicSourceA) {
    musicSourceA = context.createMediaElementSource(musicAudioA);
  }

  if (!musicSourceB) {
    musicSourceB = context.createMediaElementSource(musicAudioB);
  }

  if (!musicFadeGainA) {
    musicFadeGainA = context.createGain();
    musicFadeGainA.gain.value = 1;
  }

  if (!musicFadeGainB) {
    musicFadeGainB = context.createGain();
    musicFadeGainB.gain.value = 0;
  }

  if (!musicGain) {
    musicGain = context.createGain();
  }

  if (!musicAnalyser) {
    musicAnalyser = context.createAnalyser();
    musicAnalyser.fftSize = 2048;
    musicAnalyser.smoothingTimeConstant = 0.72;
  }

  try { musicSourceA.disconnect(); } catch (error) {}
  try { musicSourceB.disconnect(); } catch (error) {}
  try { musicFadeGainA.disconnect(); } catch (error) {}
  try { musicFadeGainB.disconnect(); } catch (error) {}
  try { musicGain.disconnect(); } catch (error) {}
  try { musicAnalyser.disconnect(); } catch (error) {}

  musicSourceA.connect(musicFadeGainA);
  musicSourceB.connect(musicFadeGainB);

  musicFadeGainA.connect(musicGain);
  musicFadeGainB.connect(musicGain);

  musicGain.connect(musicAnalyser);

  /*
   * V6: Música ya no va directamente a los parlantes.
   * Entra al bus MASTER.
   */
  ensureMasterBus();
  musicAnalyser.connect(masterGain);

  /* V8: la misma señal post-volumen/crossfade alimenta Program. */
  ensureProgramBus();
  musicAnalyser.connect(programGain);

  applyMusicMasterGain();

  return getActiveMusicAudio();
}


/* =========================================================
   PLAYLIST / CARGA DE MÚSICA
========================================================= */

function validateMusicFile(file) {
  if (!(file instanceof File)) {
    throw new Error("Debes seleccionar un archivo de audio válido.");
  }

  if (file.type && !file.type.startsWith("audio/")) {
    throw new Error(
      `El archivo "${file.name}" no parece ser un archivo de audio.`
    );
  }
}

function createMusicPlaylistItem(file) {
  validateMusicFile(file);

  musicPlaylistId += 1;

  return {
    id: `music-${Date.now()}-${musicPlaylistId}`,
    name: file.name,
    file,
    url: URL.createObjectURL(file),
    duration: 0
  };
}

function revokeMusicPlaylistItem(item) {
  if (!item?.url) { return; }

  try {
    URL.revokeObjectURL(item.url);
  }
  catch (error) {
    console.warn(
      "No fue posible liberar el archivo de música:",
      error
    );
  }
}

function waitForMusicMetadata(audio, item, index) {
  return new Promise((resolve, reject) => {
    const handleLoaded = () => {
      cleanup();

      item.duration =
        Number.isFinite(audio.duration)
          ? audio.duration
          : 0;

      resolve({
        id: item.id,
        index,
        name: item.name,
        duration: item.duration
      });
    };

    const handleError = () => {
      cleanup();

      reject(
        new Error(
          `El navegador no pudo cargar "${item.name}".`
        )
      );
    };

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("error", handleError);
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("error", handleError);
  });
}

async function prepareMusicAudio(audio, index) {
  const numericIndex = Number(index);

  if (
    !Number.isInteger(numericIndex) ||
    numericIndex < 0 ||
    numericIndex >= musicPlaylist.length
  ) {
    throw new Error(
      "La canción seleccionada no existe en la playlist."
    );
  }

  await ensureMusicChannel();

  const item = musicPlaylist[numericIndex];

  audio.pause();
  audio.src = item.url;
  safeSetAudioTime(audio, 0);
  audio.load();

  const result = await waitForMusicMetadata(
    audio,
    item,
    numericIndex
  );

  return result;
}

async function loadMusicPlaylistIndex(index) {
  const numericIndex = Number(index);

  if (
    !Number.isInteger(numericIndex) ||
    numericIndex < 0 ||
    numericIndex >= musicPlaylist.length
  ) {
    throw new Error(
      "La canción seleccionada no existe en la playlist."
    );
  }

  await ensureMusicChannel();

  musicTransitionGeneration += 1;
  musicTransitioning = false;
  musicTransitionPromise = null;

  const activeAudio = getActiveMusicAudio();
  const standbyAudio = getStandbyMusicAudio();

  activeAudio.pause();
  standbyAudio.pause();

  setFadeGainImmediately(getActiveMusicFadeGain(), 1);
  setFadeGainImmediately(getStandbyMusicFadeGain(), 0);

  stopAndUnloadMusicAudio(standbyAudio);

  const result = await prepareMusicAudio(
    activeAudio,
    numericIndex
  );

  musicPlaylistIndex = numericIndex;
  musicObjectUrl = musicPlaylist[numericIndex].url;

  return result;
}


/* Compatibilidad: una sola canción reemplaza la playlist. */
async function loadMusicFile(file) {
  clearMusicPlaylist();

  const item = createMusicPlaylistItem(file);
  musicPlaylist.push(item);

  return loadMusicPlaylistIndex(0);
}


/* Añade una o varias canciones sin borrar las existentes. */
async function addMusicFiles(files) {
  const incoming = Array.from(files || []);

  if (incoming.length === 0) {
    throw new Error(
      "Debes seleccionar al menos un archivo de audio."
    );
  }

  const newItems =
    incoming.map(file => createMusicPlaylistItem(file));

  const playlistWasEmpty =
    musicPlaylist.length === 0;

  musicPlaylist.push(...newItems);

  if (playlistWasEmpty) {
    await loadMusicPlaylistIndex(0);
  }

  return getMusicPlaylistState();
}


/* =========================================================
   CROSSFADE
========================================================= */

async function crossfadeToMusicIndex(
  targetIndex,
  requestedSeconds = MUSIC_CROSSFADE_SECONDS
) {
  const numericIndex = Number(targetIndex);

  if (
    !Number.isInteger(numericIndex) ||
    numericIndex < 0 ||
    numericIndex >= musicPlaylist.length
  ) {
    return null;
  }

  if (musicTransitioning) {
    return musicTransitionPromise;
  }

  if (numericIndex === musicPlaylistIndex) {
    return {
      id: musicPlaylist[numericIndex].id,
      index: numericIndex,
      name: musicPlaylist[numericIndex].name,
      duration: musicPlaylist[numericIndex].duration
    };
  }

  musicTransitioning = true;
  const transitionGeneration = ++musicTransitionGeneration;

  musicTransitionPromise = (async () => {
    const context = await ensureAudioContext();
    await ensureMusicChannel();

    const outgoingAudio = getActiveMusicAudio();
    const incomingAudio = getStandbyMusicAudio();

    const outgoingGain = getActiveMusicFadeGain();
    const incomingGain = getStandbyMusicFadeGain();

    const result = await prepareMusicAudio(
      incomingAudio,
      numericIndex
    );

    if (transitionGeneration !== musicTransitionGeneration) {
      incomingAudio.pause();
      safeSetAudioTime(incomingAudio, 0);
      return null;
    }

    const outgoingWasPlaying =
      outgoingAudio &&
      !outgoingAudio.paused &&
      !outgoingAudio.ended;

    let fadeSeconds =
      Math.max(0, Number(requestedSeconds) || 0);

    if (outgoingWasPlaying) {
      const remaining =
        Number.isFinite(outgoingAudio.duration)
          ? Math.max(
              0,
              outgoingAudio.duration - outgoingAudio.currentTime
            )
          : fadeSeconds;

      fadeSeconds =
        Math.min(fadeSeconds, remaining);
    }
    else {
      fadeSeconds = 0;
    }

    const now = context.currentTime;
    const masterTarget = getMusicTargetGain();

    applyMusicMasterGain();

    incomingGain.gain.cancelScheduledValues(now);
    incomingGain.gain.setValueAtTime(0, now);

    outgoingGain.gain.cancelScheduledValues(now);
    outgoingGain.gain.setValueAtTime(
      outgoingWasPlaying ? 1 : 0,
      now
    );

    await incomingAudio.play();

    if (transitionGeneration !== musicTransitionGeneration) {
      incomingAudio.pause();
      safeSetAudioTime(incomingAudio, 0);
      return null;
    }

    if (fadeSeconds > 0) {
      incomingGain.gain.linearRampToValueAtTime(
        1,
        now + fadeSeconds
      );

      outgoingGain.gain.linearRampToValueAtTime(
        0,
        now + fadeSeconds
      );

      await new Promise(resolve => {
        window.setTimeout(
          resolve,
          Math.ceil(fadeSeconds * 1000) + 40
        );
      });

      if (transitionGeneration !== musicTransitionGeneration) {
        incomingAudio.pause();
        safeSetAudioTime(incomingAudio, 0);
        return null;
      }
    }
    else {
      incomingGain.gain.setValueAtTime(1, now);
      outgoingGain.gain.setValueAtTime(0, now);
    }

    outgoingAudio.pause();
    safeSetAudioTime(outgoingAudio, 0);

    musicActiveSlot =
      musicActiveSlot === "A" ? "B" : "A";

    musicPlaylistIndex = numericIndex;
    musicObjectUrl = musicPlaylist[numericIndex].url;

    setFadeGainImmediately(
      getActiveMusicFadeGain(),
      1
    );

    setFadeGainImmediately(
      getStandbyMusicFadeGain(),
      0
    );

    return result;
  })();

  try {
    return await musicTransitionPromise;
  }
  finally {
    musicTransitioning = false;
    musicTransitionPromise = null;
  }
}


async function selectMusicTrack(index) {
  const activeAudio = getActiveMusicAudio();

  if (
    activeAudio &&
    !activeAudio.paused &&
    !activeAudio.ended &&
    musicPlaylistIndex >= 0
  ) {
    return crossfadeToMusicIndex(
      index,
      MUSIC_CROSSFADE_SECONDS
    );
  }

  return loadMusicPlaylistIndex(index);
}


async function nextMusicTrack() {
  if (musicPlaylist.length === 0) {
    throw new Error(
      "La playlist de música está vacía."
    );
  }

  if (musicPlaylistIndex >= musicPlaylist.length - 1) {
    return null;
  }

  const activeAudio = getActiveMusicAudio();

  if (
    activeAudio &&
    !activeAudio.paused &&
    !activeAudio.ended
  ) {
    return crossfadeToMusicIndex(
      musicPlaylistIndex + 1,
      MUSIC_CROSSFADE_SECONDS
    );
  }

  return loadMusicPlaylistIndex(
    musicPlaylistIndex + 1
  );
}


async function previousMusicTrack() {
  if (musicPlaylist.length === 0) {
    throw new Error(
      "La playlist de música está vacía."
    );
  }

  if (musicPlaylistIndex <= 0) {
    return null;
  }

  const activeAudio = getActiveMusicAudio();

  if (
    activeAudio &&
    !activeAudio.paused &&
    !activeAudio.ended
  ) {
    return crossfadeToMusicIndex(
      musicPlaylistIndex - 1,
      MUSIC_CROSSFADE_SECONDS
    );
  }

  return loadMusicPlaylistIndex(
    musicPlaylistIndex - 1
  );
}


async function removeMusicTrack(index) {
  const numericIndex = Number(index);

  if (
    !Number.isInteger(numericIndex) ||
    numericIndex < 0 ||
    numericIndex >= musicPlaylist.length
  ) {
    return getMusicPlaylistState();
  }

  if (musicTransitioning) {
    throw new Error(
      "Espera a que termine la transición antes de eliminar una canción."
    );
  }

  const removingCurrent =
    numericIndex === musicPlaylistIndex;

  const activeWasPlaying =
    removingCurrent &&
    getActiveMusicAudio() &&
    !getActiveMusicAudio().paused &&
    !getActiveMusicAudio().ended;

  const [removed] =
    musicPlaylist.splice(numericIndex, 1);

  revokeMusicPlaylistItem(removed);

  if (musicPlaylist.length === 0) {
    stopMusic();
    stopAndUnloadMusicAudio(musicAudioA);
    stopAndUnloadMusicAudio(musicAudioB);

    musicPlaylistIndex = -1;
    musicObjectUrl = null;

    return getMusicPlaylistState();
  }

  if (numericIndex < musicPlaylistIndex) {
    musicPlaylistIndex -= 1;
  }

  if (removingCurrent) {
    const nextIndex =
      Math.min(
        numericIndex,
        musicPlaylist.length - 1
      );

    await loadMusicPlaylistIndex(nextIndex);

    if (activeWasPlaying) {
      await playMusic();
    }
  }

  return getMusicPlaylistState();
}


function clearMusicPlaylist() {
  musicTransitioning = false;
  musicTransitionPromise = null;

  if (musicAudioA) {
    stopAndUnloadMusicAudio(musicAudioA);
  }

  if (musicAudioB) {
    stopAndUnloadMusicAudio(musicAudioB);
  }

  musicPlaylist.forEach(
    item => revokeMusicPlaylistItem(item)
  );

  musicPlaylist = [];
  musicPlaylistIndex = -1;
  musicObjectUrl = null;

  if (musicFadeGainA) {
    setFadeGainImmediately(musicFadeGainA, 1);
  }

  if (musicFadeGainB) {
    setFadeGainImmediately(musicFadeGainB, 0);
  }

  musicActiveSlot = "A";
}


function getMusicPlaylistState() {
  return {
    tracks:
      musicPlaylist.map(
        (item, index) => ({
          id: item.id,
          index,
          name: item.name,
          duration: item.duration,
          selected:
            index === musicPlaylistIndex
        })
      ),

    currentIndex:
      musicPlaylistIndex,

    count:
      musicPlaylist.length,

    hasPrevious:
      musicPlaylistIndex > 0,

    hasNext:
      musicPlaylistIndex >= 0 &&
      musicPlaylistIndex < musicPlaylist.length - 1
  };
}


/* =========================================================
   REPRODUCCIÓN DE MÚSICA
========================================================= */

async function playMusic() {
  const audio = getActiveMusicAudio();

  if (!audio || !audio.src) {
    throw new Error(
      "Primero debes cargar una canción."
    );
  }

  await ensureAudioContext();
  await audio.play();
}


function pauseMusic() {
  if (musicAudioA) {
    musicAudioA.pause();
  }

  if (musicAudioB) {
    musicAudioB.pause();
  }
}


function stopMusic() {
  musicTransitionGeneration += 1;
  musicTransitioning = false;
  musicTransitionPromise = null;

  if (musicAudioA) {
    musicAudioA.pause();
    safeSetAudioTime(musicAudioA, 0);
  }

  if (musicAudioB) {
    musicAudioB.pause();
    safeSetAudioTime(musicAudioB, 0);
  }

  if (musicFadeGainA) {
    setFadeGainImmediately(
      musicFadeGainA,
      musicActiveSlot === "A" ? 1 : 0
    );
  }

  if (musicFadeGainB) {
    setFadeGainImmediately(
      musicFadeGainB,
      musicActiveSlot === "B" ? 1 : 0
    );
  }
}


/* =========================================================
   POSICIÓN DE MÚSICA
========================================================= */

function seekMusic(seconds) {
  const audio = getActiveMusicAudio();

  if (!audio) { return; }

  const duration = audio.duration;

  if (!Number.isFinite(duration) || duration <= 0) {
    return;
  }

  const value = Number(seconds);

  if (!Number.isFinite(value)) {
    return;
  }

  audio.currentTime =
    Math.max(
      0,
      Math.min(duration, value)
    );
}


/* =========================================================
   VOLUMEN DE MÚSICA
========================================================= */

function updateMusicGain() {
  applyMusicMasterGain();
}


function setMusicVolume(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return;
  }

  musicVolume =
    Math.max(
      0,
      Math.min(1, number)
    );

  updateMusicGain();
}


function setMusicMuted(muted) {
  musicMuted = Boolean(muted);
  updateMusicGain();
}


function toggleMusicMute() {
  setMusicMuted(!musicMuted);
  return musicMuted;
}


/* =========================================================
   NIVEL DE MÚSICA
========================================================= */

function getMusicRms() {
  if (!musicAnalyser) {
    return 0;
  }

  const data =
    new Uint8Array(
      musicAnalyser.fftSize
    );

  musicAnalyser.getByteTimeDomainData(data);

  let sumSquares = 0;

  for (
    let index = 0;
    index < data.length;
    index += 1
  ) {
    const normalized =
      (data[index] - 128) / 128;

    sumSquares +=
      normalized * normalized;
  }

  return Math.sqrt(
    sumSquares / data.length
  );
}


function getMusicLevel() {
  const rms = getMusicRms();
  return Math.min(1, rms * 3);
}


function getMusicDecibels() {
  const rms = getMusicRms();

  if (rms <= 0) {
    return -Infinity;
  }

  return 20 * Math.log10(rms);
}


/* =========================================================
   ESTADO DEL CANAL MÚSICA
========================================================= */

function getMusicState() {
  const audio = getActiveMusicAudio();

  if (!audio) {
    return {
      loaded: false,
      playing: false,
      paused: true,
      ended: false,
      currentTime: 0,
      duration: 0,
      volume: musicVolume,
      muted: musicMuted,
      transitioning: musicTransitioning,
      crossfadeSeconds: MUSIC_CROSSFADE_SECONDS,
      autoAdvance: musicAutoAdvanceEnabled,
      playlist: getMusicPlaylistState()
    };
  }

  return {
    loaded: Boolean(audio.src),

    playing:
      !audio.paused &&
      !audio.ended,

    paused:
      audio.paused,

    ended:
      audio.ended,

    currentTime:
      Number.isFinite(audio.currentTime)
        ? audio.currentTime
        : 0,

    duration:
      Number.isFinite(audio.duration)
        ? audio.duration
        : 0,

    volume:
      musicVolume,

    muted:
      musicMuted,

    transitioning:
      musicTransitioning,

    crossfadeSeconds:
      MUSIC_CROSSFADE_SECONDS,

    autoAdvance:
      musicAutoAdvanceEnabled,

    playlist:
      getMusicPlaylistState()
  };
}


/* =========================================================
   ELEMENTO ACTIVO DE MÚSICA
========================================================= */

function getMusicAudioElement() {
  return getActiveMusicAudio();
}

/* ========================================================= CREAR CANAL
DE CORTINA ========================================================= */

async function ensureCurtainChannel() {

const context = await ensureAudioContext();

if (!curtainAudioElement) {

    curtainAudioElement =
      new Audio();


    curtainAudioElement.preload =
      "metadata";


    curtainAudioElement.crossOrigin =
      "anonymous";

}

if (!curtainSource) {

    curtainSource =
      context
        .createMediaElementSource(
          curtainAudioElement
        );

}

if (!curtainGain) {

    curtainGain =
      context.createGain();

}

if (!curtainAnalyser) {

    curtainAnalyser =
      context.createAnalyser();


    curtainAnalyser.fftSize =
      2048;


    curtainAnalyser
      .smoothingTimeConstant =
      0.72;

}

/* Cadena V6 del canal: Archivo → Gain → Analyser → MASTER → Parlantes.
El micrófono permanece fuera de la salida audible para evitar eco/acople. */

try { curtainSource.disconnect(); } catch (error) { /* Puede no estar conectado todavía. */ }

try { curtainGain.disconnect(); } catch (error) { /* Puede no estar conectado todavía. */ }

try { curtainAnalyser.disconnect(); } catch (error) { /* Puede no estar conectado todavía. */ }

curtainSource.connect( curtainGain );

curtainGain.connect( curtainAnalyser );

/*
 * V6: Cortina entra al bus MASTER.
 */
ensureMasterBus();

curtainAnalyser.connect( masterGain );

/* V8: la misma señal post-volumen alimenta Program. */
ensureProgramBus();
curtainAnalyser.connect( programGain );

updateCurtainGain();

return curtainAudioElement;

}

/* ========================================================= CARGAR
CORTINA ========================================================= */

async function loadCurtainFile( file ) {

if (!(file instanceof File)) {

    throw new Error(
      "Debes seleccionar un archivo de audio válido."
    );

}

if ( file.type && !file.type.startsWith( "audio/" ) ) {

    throw new Error(
      "El archivo seleccionado no parece ser un archivo de audio."
    );

}

const audio = await ensureCurtainChannel();

/* Liberamos el Object URL * anterior para no acumular * memoria en el
navegador. */

if (curtainObjectUrl) {

    URL.revokeObjectURL(
      curtainObjectUrl
    );

    curtainObjectUrl = null;

}

curtainObjectUrl = URL.createObjectURL( file );

audio.pause();

audio.src = curtainObjectUrl;

audio.currentTime = 0;

audio.load();

return new Promise( (resolve, reject) => {

      const handleLoaded =
        () => {

          cleanup();

          resolve({
            name:
              file.name,

            duration:
              Number.isFinite(
                audio.duration
              )
                ? audio.duration
                : 0
          });

        };


      const handleError =
        () => {

          cleanup();

          reject(
            new Error(
              "El navegador no pudo cargar este archivo de audio."
            )
          );

        };


      const cleanup =
        () => {

          audio.removeEventListener(
            "loadedmetadata",
            handleLoaded
          );


          audio.removeEventListener(
            "error",
            handleError
          );

        };


      audio.addEventListener(
        "loadedmetadata",
        handleLoaded
      );


      audio.addEventListener(
        "error",
        handleError
      );

    }

);

}

/* =========================================================
REPRODUCCIÓN DE CORTINA
========================================================= */

async function playCurtain() {

if ( !curtainAudioElement || !curtainAudioElement.src ) {

    throw new Error(
      "Primero debes cargar una cortina."
    );

}

await ensureAudioContext();

await curtainAudioElement.play();

}

function pauseCurtain() {

if (!curtainAudioElement) { return; }

curtainAudioElement.pause();

}

function stopCurtain() {

if (!curtainAudioElement) { return; }

curtainAudioElement.pause();

try {

    curtainAudioElement.currentTime =
      0;

} catch (error) {

    console.warn(
      "No fue posible volver al inicio de la cortina:",
      error
    );

}

}

/* ========================================================= POSICIÓN DE
CORTINA ========================================================= */

function seekCurtain( seconds ) {

if (!curtainAudioElement) { return; }

const duration = curtainAudioElement.duration;

if ( !Number.isFinite(duration) || duration <= 0 ) { return; }

const value = Number(seconds);

if (!Number.isFinite(value)) { return; }

curtainAudioElement.currentTime = Math.max( 0, Math.min( duration, value
) );

}

/* ========================================================= VOLUMEN DE
CORTINA ========================================================= */

function updateCurtainGain() {

if (!curtainGain) { return; }

curtainGain.gain.value = curtainMuted ? 0 : curtainVolume;

}

function setCurtainVolume( value ) {

const number = Number(value);

if (!Number.isFinite(number)) { return; }

curtainVolume = Math.max( 0, Math.min( 1, number ) );

updateCurtainGain();

}

function setCurtainMuted( muted ) {

curtainMuted = Boolean(muted);

updateCurtainGain();

}

function toggleCurtainMute() {

setCurtainMuted( !curtainMuted );

return curtainMuted;

}

/* ========================================================= NIVEL DE
CORTINA ========================================================= */

function getCurtainRms() {

if (!curtainAnalyser) { return 0; }

const data = new Uint8Array( curtainAnalyser .fftSize );

curtainAnalyser .getByteTimeDomainData( data );

let sumSquares = 0;

for ( let index = 0; index < data.length; index += 1 ) {

    const normalized =
      (
        data[index] -
        128
      ) /
      128;


    sumSquares +=
      normalized *
      normalized;

}

return Math.sqrt( sumSquares / data.length );

}

function getCurtainLevel() {

const rms = getCurtainRms();

return Math.min( 1, rms * 3 );

}

function getCurtainDecibels() {

const rms = getCurtainRms();

if (rms <= 0) {

    return -Infinity;

}

return 20 * Math.log10(rms);

}

/* ========================================================= INFORMACIÓN
DEL CANAL CORTINA
========================================================= */

function getCurtainState() {

if (!curtainAudioElement) {

    return {
      loaded: false,
      playing: false,
      paused: true,
      ended: false,
      currentTime: 0,
      duration: 0,
      volume: curtainVolume,
      muted: curtainMuted
    };

}

return {

    loaded:
      Boolean(
        curtainAudioElement.src
      ),

    playing:
      !curtainAudioElement.paused &&
      !curtainAudioElement.ended,

    paused:
      curtainAudioElement.paused,

    ended:
      curtainAudioElement.ended,

    currentTime:
      Number.isFinite(
        curtainAudioElement.currentTime
      )
        ? curtainAudioElement.currentTime
        : 0,

    duration:
      Number.isFinite(
        curtainAudioElement.duration
      )
        ? curtainAudioElement.duration
        : 0,

    volume:
      curtainVolume,

    muted:
      curtainMuted

};

}

/* ========================================================= ELEMENTO DE
CORTINA ========================================================= */

function getCurtainAudioElement() {

return curtainAudioElement;

}

/* ========================================================= GETTERS
========================================================= */

function getAudioContext() {

return audioContext;

}

function getMicrophoneStream() {

return microphoneStream;

}

/* ========================================================= LIMPIEZA
DEL CANAL MÚSICA
========================================================= */

function destroyMusicChannel() {
  musicTransitioning = false;
  musicTransitionPromise = null;

  stopAndUnloadMusicAudio(musicAudioA);
  stopAndUnloadMusicAudio(musicAudioB);

  for (const node of [
    musicSourceA,
    musicSourceB,
    musicFadeGainA,
    musicFadeGainB,
    musicGain,
    musicAnalyser
  ]) {
    if (!node) { continue; }

    try {
      node.disconnect();
    }
    catch (error) {
      console.warn(error);
    }
  }

  musicPlaylist.forEach(
    item => revokeMusicPlaylistItem(item)
  );

  musicPlaylist = [];
  musicPlaylistIndex = -1;
  musicObjectUrl = null;

  musicAudioA = null;
  musicAudioB = null;

  musicSourceA = null;
  musicSourceB = null;

  musicFadeGainA = null;
  musicFadeGainB = null;

  musicGain = null;
  musicAnalyser = null;

  musicActiveSlot = "A";
}

/* ========================================================= LIMPIEZA
DEL CANAL CORTINA
========================================================= */

function destroyCurtainChannel() {

if (curtainAudioElement) {

    curtainAudioElement.pause();


    curtainAudioElement.removeAttribute(
      "src"
    );


    curtainAudioElement.load();

}

if (curtainSource) {

    try {
      curtainSource.disconnect();
    }
    catch (error) {
      console.warn(error);
    }

}

if (curtainGain) {

    try {
      curtainGain.disconnect();
    }
    catch (error) {
      console.warn(error);
    }

}

if (curtainAnalyser) {

    try {
      curtainAnalyser.disconnect();
    }
    catch (error) {
      console.warn(error);
    }

}

if (curtainObjectUrl) {

    URL.revokeObjectURL(
      curtainObjectUrl
    );

}

curtainAudioElement = null; curtainSource = null; curtainGain = null;
curtainAnalyser = null; curtainObjectUrl = null;

}

/* =========================================================
   LIMPIEZA DEL PROGRAM
========================================================= */

function destroyProgramBus() {
  if (programGain) {
    try { programGain.disconnect(); } catch (error) { console.warn(error); }
  }

  if (programAnalyser) {
    try { programAnalyser.disconnect(); } catch (error) { console.warn(error); }
  }

  if (programLimiter) {
    try { programLimiter.disconnect(); } catch (error) { console.warn(error); }
  }

  programGain = null;
  programAnalyser = null;
  programLimiter = null;
  programDestination = null;
}

/* =========================================================
   LIMPIEZA DEL MASTER
========================================================= */

function destroyMasterBus() {
  if (masterGain) {
    try {
      masterGain.disconnect();
    }
    catch (error) {
      console.warn(error);
    }
  }

  if (masterAnalyser) {
    try {
      masterAnalyser.disconnect();
    }
    catch (error) {
      console.warn(error);
    }
  }

  masterGain = null;
  masterAnalyser = null;
}


/* ========================================================= DESTRUIR
MOTOR ========================================================= */

async function destroyAudioEngine() {

stopMicrophone();

destroyMusicChannel();

destroyCurtainChannel();

destroyProgramBus();

destroyMasterBus();

if (audioContext) {

    try {

      await audioContext.close();

    }
    catch (error) {

      console.warn(
        "No fue posible cerrar AudioContext:",
        error
      );

    }


    audioContext = null;

}

}

/* ========================================================= EXPORTS
========================================================= */

export {

/* Motor */ ensureAudioContext, getAudioContext, destroyAudioEngine,

/* Master */ setMasterVolume, setMasterMuted, toggleMasterMute,
getMasterLevel, getMasterDecibels, getMasterState, connectNodeToMaster,

/* Program */ connectNodeToProgram, getProgramStream, getProgramState,

/* Micrófono */ getMicrophones, startMicrophone, stopMicrophone,
setMicrophoneVolume, setMicrophoneMuted, toggleMicrophoneMute,
getMicrophoneLevel, getMicrophoneDecibels, isMicrophoneActive,
getMicrophoneStream,

/* Música */ loadMusicFile, addMusicFiles, selectMusicTrack,
nextMusicTrack, previousMusicTrack, removeMusicTrack, clearMusicPlaylist,
getMusicPlaylistState, playMusic, pauseMusic, stopMusic, seekMusic,
setMusicVolume, setMusicMuted, toggleMusicMute, getMusicLevel,
getMusicDecibels, getMusicState, getMusicAudioElement,

/* Auto-ducking */ updateAutoDucking, setAutoDuckEnabled, getAutoDuckState,

/* Cortina */ loadCurtainFile, playCurtain, pauseCurtain, stopCurtain,
seekCurtain, setCurtainVolume, setCurtainMuted, toggleCurtainMute,
getCurtainLevel, getCurtainDecibels, getCurtainState,
getCurtainAudioElement

};
