/* =========================================================
   RADIO CONEXIÓN STUDIO
   CONSOLA DE AUDIO V1
   Control de micrófono real
========================================================= */

import {
  getMicrophones,
  startMicrophone,
  stopMicrophone,
  isMicrophoneActive,
  setMicrophoneVolume,
  setMicrophoneMuted,
  getMicrophoneLevel,
  getMicrophoneDecibels
} from "./audio-engine.js";


/* =========================================================
   ESTADO
========================================================= */

let meterAnimationFrame = null;
let microphoneActive = false;
let microphoneMuted = false;
let currentDeviceId = "";

const DEFAULT_GAIN_PERCENT = 100;


/* =========================================================
   ELEMENTOS
========================================================= */

function getElements() {

  return {
    status:
      document.getElementById(
        "audioEngineStatus"
      ),

    deviceSelect:
      document.getElementById(
        "microphoneDevice"
      ),

    activateButton:
      document.getElementById(
        "microphoneActivateBtn"
      ),

    muteButton:
      document.getElementById(
        "microphoneMuteBtn"
      ),

    gain:
      document.getElementById(
        "microphoneGain"
      ),

    gainValue:
      document.getElementById(
        "microphoneGainValue"
      ),

    meterFill:
      document.getElementById(
        "microphoneMeterFill"
      ),

    decibels:
      document.getElementById(
        "microphoneDb"
      ),

    deviceName:
      document.getElementById(
        "microphoneDeviceName"
      ),

    message:
      document.getElementById(
        "audioConsoleMessage"
      )
  };

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

  message.textContent = text;

  if (state) {
    message.dataset.state = state;
  }
  else {
    delete message.dataset.state;
  }

}


/* =========================================================
   ESTADO VISUAL
========================================================= */

function updateInterface() {

  const {
    status,
    activateButton,
    muteButton,
    deviceSelect,
    deviceName
  } = getElements();

  microphoneActive =
    isMicrophoneActive();

  if (status) {

    status.classList.toggle(
      "active",
      microphoneActive
    );

    status.textContent =
      microphoneActive
        ? "MOTOR DE AUDIO ACTIVO"
        : "MOTOR DE AUDIO EN ESPERA";

  }


  if (activateButton) {

    activateButton.classList.toggle(
      "active",
      microphoneActive
    );

    activateButton.textContent =
      microphoneActive
        ? "✓ MICRÓFONO ACTIVO"
        : "ACTIVAR MICRÓFONO";

  }


  if (muteButton) {

    muteButton.disabled =
      !microphoneActive;

    muteButton.classList.toggle(
      "muted",
      microphoneMuted
    );

    muteButton.textContent =
      microphoneMuted
        ? "ACTIVAR"
        : "MUTE";

  }


  if (deviceSelect) {

    deviceSelect.disabled =
      microphoneActive;

  }


  if (
    deviceName &&
    !microphoneActive
  ) {

    deviceName.textContent =
      "Micrófono";

  }

}


/* =========================================================
   DISPOSITIVOS
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

  let microphones = [];

  try {

    microphones =
      await getMicrophones();

  }
  catch (error) {

    console.error(
      "No fue posible consultar los micrófonos:",
      error
    );

    deviceSelect.innerHTML =
      '<option value="">Micrófono predeterminado</option>';

    return;

  }


  deviceSelect.innerHTML = "";


  if (
    microphones.length === 0
  ) {

    const option =
      document.createElement(
        "option"
      );

    option.value = "";

    option.textContent =
      "Micrófono predeterminado";

    deviceSelect.appendChild(
      option
    );

    return;

  }


  microphones.forEach(
    (device, index) => {

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


/* =========================================================
   NOMBRE DEL DISPOSITIVO
========================================================= */

function updateDeviceName() {

  const {
    deviceSelect,
    deviceName
  } = getElements();

  if (
    !deviceSelect ||
    !deviceName
  ) {
    return;
  }

  const selectedOption =
    deviceSelect.options[
      deviceSelect.selectedIndex
    ];

  deviceName.textContent =
    selectedOption?.textContent ||
    "Micrófono";

}


/* =========================================================
   MEDIDOR
========================================================= */

function stopMeter() {

  if (
    meterAnimationFrame !== null
  ) {

    cancelAnimationFrame(
      meterAnimationFrame
    );

    meterAnimationFrame = null;

  }


  const {
    meterFill,
    decibels
  } = getElements();


  if (meterFill) {
    meterFill.style.width =
      "0%";
  }


  if (decibels) {
    decibels.textContent =
      "— dB";
  }

}


function renderMeter() {

  if (
    !microphoneActive ||
    !isMicrophoneActive()
  ) {

    stopMeter();
    updateInterface();

    return;

  }


  const {
    meterFill,
    decibels
  } = getElements();


  const level =
    getMicrophoneLevel();

  const db =
    getMicrophoneDecibels();


  if (meterFill) {

    const percentage =
      Math.max(
        0,
        Math.min(
          100,
          level * 100
        )
      );

    meterFill.style.width =
      `${percentage}%`;

  }


  if (decibels) {

    if (
      Number.isFinite(db)
    ) {

      decibels.textContent =
        `${Math.round(db)} dB`;

    }
    else {

      decibels.textContent =
        "— dB";

    }

  }


  meterAnimationFrame =
    requestAnimationFrame(
      renderMeter
    );

}


function startMeter() {

  stopMeter();

  meterAnimationFrame =
    requestAnimationFrame(
      renderMeter
    );

}


/* =========================================================
   ACTIVAR MICRÓFONO
========================================================= */

async function activateMicrophone() {

  const {
    activateButton,
    deviceSelect
  } = getElements();


  if (microphoneActive) {

    stopMicrophone();

    microphoneActive = false;
    microphoneMuted = false;

    setMicrophoneMuted(false);

    stopMeter();

    updateInterface();

    setMessage(
      "Micrófono desactivado."
    );

    return;

  }


  if (activateButton) {

    activateButton.disabled =
      true;

    activateButton.textContent =
      "ACTIVANDO...";

  }


  setMessage(
    "Solicitando acceso al micrófono..."
  );


  try {

    const selectedDeviceId =
      deviceSelect?.value || "";

    const result =
      await startMicrophone(
        selectedDeviceId
      );


    microphoneActive = true;
    microphoneMuted = false;

    setMicrophoneMuted(false);


    currentDeviceId =
      result.deviceId ||
      selectedDeviceId ||
      "";


    /*
     * Después de obtener permiso,
     * los navegadores normalmente
     * revelan los nombres reales
     * de los dispositivos.
     */

    await populateMicrophones(
      currentDeviceId
    );


    updateDeviceName();

    updateInterface();

    startMeter();


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


    microphoneActive = false;
    microphoneMuted = false;

    stopMeter();

    updateInterface();


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

    if (activateButton) {

      activateButton.disabled =
        false;

    }

    updateInterface();

  }

}


/* =========================================================
   MUTE
========================================================= */

function toggleMute() {

  if (
    !microphoneActive
  ) {
    return;
  }


  microphoneMuted =
    !microphoneMuted;


  setMicrophoneMuted(
    microphoneMuted
  );


  updateInterface();


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
   GANANCIA
========================================================= */

function updateGain() {

  const {
    gain,
    gainValue
  } = getElements();


  if (!gain) {
    return;
  }


  const percentage =
    Number(
      gain.value
    );


  const safePercentage =
    Number.isFinite(
      percentage
    )
      ? Math.max(
          0,
          Math.min(
            200,
            percentage
          )
        )
      : DEFAULT_GAIN_PERCENT;


  const gainValueNumber =
    safePercentage /
    100;


  setMicrophoneVolume(
    gainValueNumber
  );


  if (gainValue) {

    gainValue.textContent =
      `${Math.round(
        safePercentage
      )}%`;

  }

}


/* =========================================================
   CAMBIO DE DISPOSITIVO
========================================================= */

function handleDeviceChange() {

  const {
    deviceSelect
  } = getElements();


  if (!deviceSelect) {
    return;
  }


  currentDeviceId =
    deviceSelect.value || "";


  updateDeviceName();

}


/* =========================================================
   CAMBIO DE DISPOSITIVOS DEL SISTEMA
========================================================= */

async function handleDeviceChangeEvent() {

  if (
    microphoneActive
  ) {
    return;
  }


  await populateMicrophones(
    currentDeviceId
  );

  updateDeviceName();

}


/* =========================================================
   INICIALIZACIÓN
========================================================= */

async function initializeAudioConsole() {

  const {
    activateButton,
    muteButton,
    gain,
    deviceSelect
  } = getElements();


  /*
   * Si todavía no existe el HTML
   * de la consola, simplemente
   * no hacemos nada.
   */

  if (
    !activateButton ||
    !muteButton ||
    !gain ||
    !deviceSelect
  ) {

    return;

  }


  activateButton.addEventListener(
    "click",
    activateMicrophone
  );


  muteButton.addEventListener(
    "click",
    toggleMute
  );


  gain.addEventListener(
    "input",
    updateGain
  );


  deviceSelect.addEventListener(
    "change",
    handleDeviceChange
  );


  updateGain();

  updateInterface();


  try {

    await populateMicrophones();

    updateDeviceName();

  }
  catch (error) {

    console.error(
      "Error inicializando consola de audio:",
      error
    );

  }


  if (
    navigator.mediaDevices &&
    typeof navigator.mediaDevices
      .addEventListener ===
      "function"
  ) {

    navigator.mediaDevices
      .addEventListener(
        "devicechange",
        handleDeviceChangeEvent
      );

  }

}


/* =========================================================
   LIMPIEZA
========================================================= */

function cleanupAudioConsole() {

  stopMeter();

  stopMicrophone();

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