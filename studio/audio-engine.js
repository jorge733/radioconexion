/* =========================================================
   RADIO CONEXIÓN STUDIO
   AUDIO ENGINE V2

   Canales actuales:
   - Micrófono
   - Música

   Próximamente:
   - Cortina
   - Soundpad
   - Master
   - Grabación
========================================================= */


/* =========================================================
   AUDIO CONTEXT
========================================================= */

let audioContext = null;


/* =========================================================
   MICRÓFONO
========================================================= */

let microphoneStream = null;
let microphoneSource = null;
let microphoneGain = null;
let microphoneAnalyser = null;

let microphoneMuted = false;
let microphoneVolume = 1;


/* =========================================================
   MÚSICA
========================================================= */

let musicAudioElement = null;
let musicSource = null;
let musicGain = null;
let musicAnalyser = null;

let musicObjectUrl = null;

let musicVolume = 0.7;
let musicMuted = false;


/* =========================================================
   AUDIO CONTEXT
========================================================= */

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


  if (
    audioContext.state ===
    "suspended"
  ) {

    await audioContext.resume();

  }


  return audioContext;

}


/* =========================================================
   MICRÓFONOS DISPONIBLES
========================================================= */

async function getMicrophones() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.enumerateDevices
  ) {

    throw new Error(
      "El navegador no permite consultar dispositivos de audio."
    );

  }


  const devices =
    await navigator.mediaDevices
      .enumerateDevices();


  return devices.filter(
    device =>
      device.kind ===
      "audioinput"
  );

}


/* =========================================================
   DETENER MICRÓFONO
========================================================= */

function stopMicrophone() {

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


/* =========================================================
   ACTIVAR MICRÓFONO
========================================================= */

async function startMicrophone(
  deviceId = ""
) {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "El navegador no permite acceder al micrófono."
    );

  }


  const context =
    await ensureAudioContext();


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


  microphoneStream =
    await navigator.mediaDevices
      .getUserMedia({
        audio: audioConstraints,
        video: false
      });


  microphoneSource =
    context.createMediaStreamSource(
      microphoneStream
    );


  microphoneGain =
    context.createGain();


  microphoneAnalyser =
    context.createAnalyser();


  microphoneAnalyser.fftSize =
    2048;

  microphoneAnalyser.smoothingTimeConstant =
    0.72;


  updateMicrophoneGain();


  /*
   * IMPORTANTE:
   *
   * El micrófono NO se conecta todavía
   * a context.destination.
   *
   * De esa forma evitamos escuchar
   * nuestra propia voz por los parlantes
   * y provocar eco o acople.
   */

  microphoneSource.connect(
    microphoneGain
  );

  microphoneGain.connect(
    microphoneAnalyser
  );


  const audioTrack =
    microphoneStream
      .getAudioTracks()[0];


  return {

    stream:
      microphoneStream,

    deviceId:
      audioTrack
        ?.getSettings()
        ?.deviceId || deviceId

  };

}


/* =========================================================
   GANANCIA DEL MICRÓFONO
========================================================= */

function updateMicrophoneGain() {

  if (!microphoneGain) {
    return;
  }


  microphoneGain.gain.value =
    microphoneMuted
      ? 0
      : microphoneVolume;

}


function setMicrophoneVolume(
  value
) {

  const number =
    Number(value);


  if (!Number.isFinite(number)) {
    return;
  }


  microphoneVolume =
    Math.max(
      0,
      Math.min(
        2,
        number
      )
    );


  updateMicrophoneGain();

}


function setMicrophoneMuted(
  muted
) {

  microphoneMuted =
    Boolean(muted);


  updateMicrophoneGain();

}


function toggleMicrophoneMute() {

  setMicrophoneMuted(
    !microphoneMuted
  );


  return microphoneMuted;

}


/* =========================================================
   NIVEL DEL MICRÓFONO
========================================================= */

function getMicrophoneRms() {

  if (!microphoneAnalyser) {
    return 0;
  }


  const data =
    new Uint8Array(
      microphoneAnalyser
        .fftSize
    );


  microphoneAnalyser
    .getByteTimeDomainData(
      data
    );


  let sumSquares = 0;


  for (
    let index = 0;
    index < data.length;
    index += 1
  ) {

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


  return Math.sqrt(
    sumSquares /
    data.length
  );

}


function getMicrophoneLevel() {

  const rms =
    getMicrophoneRms();


  return Math.min(
    1,
    rms * 4
  );

}


function getMicrophoneDecibels() {

  const rms =
    getMicrophoneRms();


  if (rms <= 0) {

    return -Infinity;

  }


  return 20 *
    Math.log10(rms);

}


/* =========================================================
   ESTADO DEL MICRÓFONO
========================================================= */

function isMicrophoneActive() {

  if (!microphoneStream) {
    return false;
  }


  return microphoneStream
    .getAudioTracks()
    .some(
      track =>
        track.readyState ===
        "live"
    );

}


/* =========================================================
   CREAR CANAL DE MÚSICA
========================================================= */

async function ensureMusicChannel() {

  const context =
    await ensureAudioContext();


  if (!musicAudioElement) {

    musicAudioElement =
      new Audio();


    musicAudioElement.preload =
      "metadata";


    musicAudioElement.crossOrigin =
      "anonymous";

  }


  if (!musicSource) {

    musicSource =
      context
        .createMediaElementSource(
          musicAudioElement
        );

  }


  if (!musicGain) {

    musicGain =
      context.createGain();

  }


  if (!musicAnalyser) {

    musicAnalyser =
      context.createAnalyser();


    musicAnalyser.fftSize =
      2048;


    musicAnalyser
      .smoothingTimeConstant =
      0.72;

  }


  /*
   * Cadena del canal:
   *
   * Archivo
   *   ↓
   * Gain
   *   ↓
   * Analyser
   *   ↓
   * Parlantes
   *
   * Más adelante, en vez de ir
   * directamente a destination,
   * todos los canales pasarán por
   * el MASTER.
   */

  try {
    musicSource.disconnect();
  }
  catch (error) {
    // Puede no estar conectado todavía.
  }


  try {
    musicGain.disconnect();
  }
  catch (error) {
    // Puede no estar conectado todavía.
  }


  try {
    musicAnalyser.disconnect();
  }
  catch (error) {
    // Puede no estar conectado todavía.
  }


  musicSource.connect(
    musicGain
  );


  musicGain.connect(
    musicAnalyser
  );


  musicAnalyser.connect(
    context.destination
  );


  updateMusicGain();


  return musicAudioElement;

}


/* =========================================================
   CARGAR MÚSICA
========================================================= */

async function loadMusicFile(
  file
) {

  if (!(file instanceof File)) {

    throw new Error(
      "Debes seleccionar un archivo de audio válido."
    );

  }


  if (
    file.type &&
    !file.type.startsWith(
      "audio/"
    )
  ) {

    throw new Error(
      "El archivo seleccionado no parece ser un archivo de audio."
    );

  }


  const audio =
    await ensureMusicChannel();


  /*
   * Liberamos el Object URL
   * anterior para no acumular
   * memoria en el navegador.
   */

  if (musicObjectUrl) {

    URL.revokeObjectURL(
      musicObjectUrl
    );

    musicObjectUrl = null;

  }


  musicObjectUrl =
    URL.createObjectURL(
      file
    );


  audio.pause();


  audio.src =
    musicObjectUrl;


  audio.currentTime = 0;


  audio.load();


  return new Promise(
    (resolve, reject) => {

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
   REPRODUCCIÓN DE MÚSICA
========================================================= */

async function playMusic() {

  if (
    !musicAudioElement ||
    !musicAudioElement.src
  ) {

    throw new Error(
      "Primero debes cargar una canción."
    );

  }


  await ensureAudioContext();


  await musicAudioElement.play();

}


function pauseMusic() {

  if (!musicAudioElement) {
    return;
  }


  musicAudioElement.pause();

}


function stopMusic() {

  if (!musicAudioElement) {
    return;
  }


  musicAudioElement.pause();


  try {

    musicAudioElement.currentTime =
      0;

  }
  catch (error) {

    console.warn(
      "No fue posible volver al inicio de la canción:",
      error
    );

  }

}


/* =========================================================
   POSICIÓN DE MÚSICA
========================================================= */

function seekMusic(
  seconds
) {

  if (!musicAudioElement) {
    return;
  }


  const duration =
    musicAudioElement.duration;


  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return;
  }


  const value =
    Number(seconds);


  if (!Number.isFinite(value)) {
    return;
  }


  musicAudioElement.currentTime =
    Math.max(
      0,
      Math.min(
        duration,
        value
      )
    );

}


/* =========================================================
   VOLUMEN DE MÚSICA
========================================================= */

function updateMusicGain() {

  if (!musicGain) {
    return;
  }


  musicGain.gain.value =
    musicMuted
      ? 0
      : musicVolume;

}


function setMusicVolume(
  value
) {

  const number =
    Number(value);


  if (!Number.isFinite(number)) {
    return;
  }


  musicVolume =
    Math.max(
      0,
      Math.min(
        1,
        number
      )
    );


  updateMusicGain();

}


function setMusicMuted(
  muted
) {

  musicMuted =
    Boolean(muted);


  updateMusicGain();

}


function toggleMusicMute() {

  setMusicMuted(
    !musicMuted
  );


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
      musicAnalyser
        .fftSize
    );


  musicAnalyser
    .getByteTimeDomainData(
      data
    );


  let sumSquares = 0;


  for (
    let index = 0;
    index < data.length;
    index += 1
  ) {

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


  return Math.sqrt(
    sumSquares /
    data.length
  );

}


function getMusicLevel() {

  const rms =
    getMusicRms();


  return Math.min(
    1,
    rms * 3
  );

}


function getMusicDecibels() {

  const rms =
    getMusicRms();


  if (rms <= 0) {

    return -Infinity;

  }


  return 20 *
    Math.log10(rms);

}


/* =========================================================
   INFORMACIÓN DEL CANAL MÚSICA
========================================================= */

function getMusicState() {

  if (!musicAudioElement) {

    return {
      loaded: false,
      playing: false,
      paused: true,
      ended: false,
      currentTime: 0,
      duration: 0,
      volume: musicVolume,
      muted: musicMuted
    };

  }


  return {

    loaded:
      Boolean(
        musicAudioElement.src
      ),

    playing:
      !musicAudioElement.paused &&
      !musicAudioElement.ended,

    paused:
      musicAudioElement.paused,

    ended:
      musicAudioElement.ended,

    currentTime:
      Number.isFinite(
        musicAudioElement.currentTime
      )
        ? musicAudioElement.currentTime
        : 0,

    duration:
      Number.isFinite(
        musicAudioElement.duration
      )
        ? musicAudioElement.duration
        : 0,

    volume:
      musicVolume,

    muted:
      musicMuted

  };

}


/* =========================================================
   ELEMENTO DE MÚSICA
========================================================= */

function getMusicAudioElement() {

  return musicAudioElement;

}


/* =========================================================
   GETTERS
========================================================= */

function getAudioContext() {

  return audioContext;

}


function getMicrophoneStream() {

  return microphoneStream;

}


/* =========================================================
   LIMPIEZA DEL CANAL MÚSICA
========================================================= */

function destroyMusicChannel() {

  if (musicAudioElement) {

    musicAudioElement.pause();


    musicAudioElement.removeAttribute(
      "src"
    );


    musicAudioElement.load();

  }


  if (musicSource) {

    try {
      musicSource.disconnect();
    }
    catch (error) {
      console.warn(error);
    }

  }


  if (musicGain) {

    try {
      musicGain.disconnect();
    }
    catch (error) {
      console.warn(error);
    }

  }


  if (musicAnalyser) {

    try {
      musicAnalyser.disconnect();
    }
    catch (error) {
      console.warn(error);
    }

  }


  if (musicObjectUrl) {

    URL.revokeObjectURL(
      musicObjectUrl
    );

  }


  musicAudioElement = null;
  musicSource = null;
  musicGain = null;
  musicAnalyser = null;
  musicObjectUrl = null;

}


/* =========================================================
   DESTRUIR MOTOR
========================================================= */

async function destroyAudioEngine() {

  stopMicrophone();

  destroyMusicChannel();


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


/* =========================================================
   EXPORTS
========================================================= */

export {

  /* Motor */
  ensureAudioContext,
  getAudioContext,
  destroyAudioEngine,

  /* Micrófono */
  getMicrophones,
  startMicrophone,
  stopMicrophone,
  setMicrophoneVolume,
  setMicrophoneMuted,
  toggleMicrophoneMute,
  getMicrophoneLevel,
  getMicrophoneDecibels,
  isMicrophoneActive,
  getMicrophoneStream,

  /* Música */
  loadMusicFile,
  playMusic,
  pauseMusic,
  stopMusic,
  seekMusic,
  setMusicVolume,
  setMusicMuted,
  toggleMusicMute,
  getMusicLevel,
  getMusicDecibels,
  getMusicState,
  getMusicAudioElement

};