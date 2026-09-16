/* =========================================================
   RADIO CONEXIÓN STUDIO
   AUDIO ENGINE V1
   Micrófono + Web Audio API
========================================================= */


/* =========================================================
   ESTADO
========================================================= */

let audioContext = null;

let microphoneStream = null;

let microphoneSource = null;

let microphoneGain = null;

let microphoneAnalyser = null;

let microphoneMuted = false;

let microphoneVolume = 1;


/* =========================================================
   CREAR AUDIO CONTEXT
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
   LISTAR MICRÓFONOS
========================================================= */

async function getMicrophones() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.enumerateDevices
  ) {

    throw new Error(
      "Este navegador no permite consultar dispositivos de audio."
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
   DETENER MICRÓFONO ACTUAL
========================================================= */

function stopMicrophone() {

  if (microphoneSource) {

    try {

      microphoneSource.disconnect();

    }
    catch {
      // Ya estaba desconectado.
    }

    microphoneSource = null;

  }

  if (microphoneGain) {

    try {

      microphoneGain.disconnect();

    }
    catch {
      // Ya estaba desconectado.
    }

    microphoneGain = null;

  }

  if (microphoneAnalyser) {

    try {

      microphoneAnalyser.disconnect();

    }
    catch {
      // Ya estaba desconectado.
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
   INICIAR MICRÓFONO
========================================================= */

async function startMicrophone(
  deviceId = ""
) {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "Este navegador no permite utilizar el micrófono."
    );

  }

  await ensureAudioContext();

  stopMicrophone();

  const audioConstraints = {

    echoCancellation:
      false,

    noiseSuppression:
      false,

    autoGainControl:
      false

  };

  if (deviceId) {

    audioConstraints.deviceId = {
      exact:
        deviceId
    };

  }

  microphoneStream =
    await navigator.mediaDevices
      .getUserMedia({
        audio:
          audioConstraints,
        video:
          false
      });

  microphoneSource =
    audioContext
      .createMediaStreamSource(
        microphoneStream
      );

  microphoneGain =
    audioContext
      .createGain();

  microphoneAnalyser =
    audioContext
      .createAnalyser();

  microphoneAnalyser.fftSize =
    2048;

  microphoneAnalyser.smoothingTimeConstant =
    0.72;

  microphoneSource.connect(
    microphoneGain
  );

  microphoneGain.connect(
    microphoneAnalyser
  );

  updateMicrophoneGain();

  return {
    stream:
      microphoneStream,

    deviceId:
      microphoneStream
        .getAudioTracks()[0]
        ?.getSettings()
        ?.deviceId || ""
  };

}


/* =========================================================
   GANANCIA MICRÓFONO
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

  const numericValue =
    Number(value);

  microphoneVolume =
    Number.isFinite(
      numericValue
    )
      ? Math.min(
          2,
          Math.max(
            0,
            numericValue
          )
        )
      : 1;

  updateMicrophoneGain();

  return microphoneVolume;

}


/* =========================================================
   MUTE
========================================================= */

function setMicrophoneMuted(
  muted
) {

  microphoneMuted =
    Boolean(muted);

  updateMicrophoneGain();

  return microphoneMuted;

}


function toggleMicrophoneMute() {

  return setMicrophoneMuted(
    !microphoneMuted
  );

}


/* =========================================================
   NIVEL DEL MICRÓFONO
========================================================= */

function getMicrophoneLevel() {

  if (
    !microphoneAnalyser
  ) {

    return 0;

  }

  const buffer =
    new Float32Array(
      microphoneAnalyser
        .fftSize
    );

  microphoneAnalyser
    .getFloatTimeDomainData(
      buffer
    );

  let sumSquares = 0;

  for (
    let index = 0;
    index < buffer.length;
    index += 1
  ) {

    const sample =
      buffer[index];

    sumSquares +=
      sample *
      sample;

  }

  const rms =
    Math.sqrt(
      sumSquares /
      buffer.length
    );

  /*
   * Convertimos el RMS a una escala
   * práctica 0–1 para el medidor visual.
   */

  const level =
    Math.min(
      1,
      rms * 4
    );

  return level;

}


/* =========================================================
   NIVEL EN DECIBELES
========================================================= */

function getMicrophoneDecibels() {

  if (
    !microphoneAnalyser
  ) {

    return -Infinity;

  }

  const buffer =
    new Float32Array(
      microphoneAnalyser
        .fftSize
    );

  microphoneAnalyser
    .getFloatTimeDomainData(
      buffer
    );

  let sumSquares = 0;

  for (
    let index = 0;
    index < buffer.length;
    index += 1
  ) {

    sumSquares +=
      buffer[index] *
      buffer[index];

  }

  const rms =
    Math.sqrt(
      sumSquares /
      buffer.length
    );

  if (
    rms <= 0.00001
  ) {

    return -Infinity;

  }

  return (
    20 *
    Math.log10(
      rms
    )
  );

}


/* =========================================================
   INFORMACIÓN
========================================================= */

function isMicrophoneActive() {

  return Boolean(
    microphoneStream &&
    microphoneStream
      .getAudioTracks()
      .some(
        track =>
          track.readyState ===
          "live"
      )
  );

}


function getAudioContext() {

  return audioContext;

}


function getMicrophoneStream() {

  return microphoneStream;

}


/* =========================================================
   CIERRE
========================================================= */

function destroyAudioEngine() {

  stopMicrophone();

  if (audioContext) {

    audioContext.close();

    audioContext = null;

  }

}


/* =========================================================
   EXPORTACIONES
========================================================= */

export {
  ensureAudioContext,
  getAudioContext,
  getMicrophones,

  startMicrophone,
  stopMicrophone,
  getMicrophoneStream,
  isMicrophoneActive,

  setMicrophoneVolume,
  setMicrophoneMuted,
  toggleMicrophoneMute,

  getMicrophoneLevel,
  getMicrophoneDecibels,

  destroyAudioEngine
};