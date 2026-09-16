/**
 * RADIO CONEXIÓN STUDIO
 * Modal System V1
 *
 * Sistema centralizado para:
 * - Avisos
 * - Confirmaciones
 * - Solicitud de texto
 * - Toasts
 *
 * No utiliza alert(), confirm() ni prompt().
 */

const RC_MODAL_ID = "rcStudioModal";
const RC_TOAST_CONTAINER_ID = "rcStudioToastContainer";

let modalResolve = null;
let previousActiveElement = null;

/* =========================================================
   UTILIDADES
   ========================================================= */

function ensureModalSystem() {
  if (!document.getElementById(RC_MODAL_ID)) {
    createModalStructure();
  }

  if (!document.getElementById(RC_TOAST_CONTAINER_ID)) {
    createToastContainer();
  }
}

function createModalStructure() {
  const modal = document.createElement("div");

  modal.id = RC_MODAL_ID;
  modal.className = "rc-modal";
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <div class="rc-modal__backdrop" data-rc-modal-cancel></div>

    <div
      class="rc-modal__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rcModalTitle"
      aria-describedby="rcModalMessage"
    >
      <button
        class="rc-modal__close"
        type="button"
        aria-label="Cerrar"
        data-rc-modal-cancel
      >
        <span aria-hidden="true">×</span>
      </button>

      <div class="rc-modal__brand">
        <div class="rc-modal__brand-mark">RC</div>

        <div class="rc-modal__brand-copy">
          <span>RADIO CONEXIÓN</span>
          <small>STUDIO</small>
        </div>
      </div>

      <div class="rc-modal__icon" id="rcModalIcon" aria-hidden="true">
        <span id="rcModalIconContent">✓</span>
      </div>

      <div class="rc-modal__content">
        <p class="rc-modal__eyebrow" id="rcModalEyebrow">
          RADIO CONEXIÓN STUDIO
        </p>

        <h2 class="rc-modal__title" id="rcModalTitle">
          Aviso
        </h2>

        <p class="rc-modal__message" id="rcModalMessage"></p>

        <div
          class="rc-modal__input-wrap"
          id="rcModalInputWrap"
          hidden
        >
          <label
            class="rc-modal__label"
            id="rcModalInputLabel"
            for="rcModalInput"
          >
            Nombre
          </label>

          <input
            class="rc-modal__input"
            id="rcModalInput"
            type="text"
            autocomplete="off"
          />

          <p
            class="rc-modal__input-error"
            id="rcModalInputError"
            hidden
          ></p>
        </div>
      </div>

      <div class="rc-modal__actions">
        <button
          class="rc-modal__button rc-modal__button--secondary"
          id="rcModalCancelButton"
          type="button"
        >
          Cancelar
        </button>

        <button
          class="rc-modal__button rc-modal__button--primary"
          id="rcModalConfirmButton"
          type="button"
        >
          Aceptar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cancelElements = modal.querySelectorAll("[data-rc-modal-cancel]");
  const cancelButton = modal.querySelector("#rcModalCancelButton");
  const confirmButton = modal.querySelector("#rcModalConfirmButton");
  const input = modal.querySelector("#rcModalInput");

  cancelElements.forEach((element) => {
    element.addEventListener("click", () => {
      closeModal(false);
    });
  });

  cancelButton.addEventListener("click", () => {
    closeModal(false);
  });

  confirmButton.addEventListener("click", () => {
    handleModalConfirm();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleModalConfirm();
    }
  });

  modal.addEventListener("keydown", handleModalKeydown);
}

function createToastContainer() {
  const container = document.createElement("div");

  container.id = RC_TOAST_CONTAINER_ID;
  container.className = "rc-toast-container";
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-atomic", "false");

  document.body.appendChild(container);
}

/* =========================================================
   CONTROL DEL MODAL
   ========================================================= */

function getModalElements() {
  const modal = document.getElementById(RC_MODAL_ID);

  return {
    modal,
    dialog: modal.querySelector(".rc-modal__dialog"),
    icon: modal.querySelector("#rcModalIcon"),
    iconContent: modal.querySelector("#rcModalIconContent"),
    eyebrow: modal.querySelector("#rcModalEyebrow"),
    title: modal.querySelector("#rcModalTitle"),
    message: modal.querySelector("#rcModalMessage"),
    inputWrap: modal.querySelector("#rcModalInputWrap"),
    inputLabel: modal.querySelector("#rcModalInputLabel"),
    input: modal.querySelector("#rcModalInput"),
    inputError: modal.querySelector("#rcModalInputError"),
    cancelButton: modal.querySelector("#rcModalCancelButton"),
    confirmButton: modal.querySelector("#rcModalConfirmButton")
  };
}

function resetModalState() {
  const elements = getModalElements();

  elements.modal.classList.remove(
    "rc-modal--alert",
    "rc-modal--confirm",
    "rc-modal--prompt",
    "rc-modal--danger",
    "rc-modal--warning",
    "rc-modal--success",
    "rc-modal--info"
  );

  elements.icon.className = "rc-modal__icon";

  elements.eyebrow.textContent = "RADIO CONEXIÓN STUDIO";
  elements.title.textContent = "Aviso";
  elements.message.textContent = "";

  elements.inputWrap.hidden = true;
  elements.inputLabel.textContent = "Nombre";
  elements.input.value = "";
  elements.input.placeholder = "";
  elements.input.maxLength = 500;

  elements.inputError.hidden = true;
  elements.inputError.textContent = "";
  elements.input.classList.remove("rc-modal__input--error");

  elements.cancelButton.hidden = false;
  elements.cancelButton.textContent = "Cancelar";

  elements.confirmButton.textContent = "Aceptar";
  elements.confirmButton.className =
    "rc-modal__button rc-modal__button--primary";

  delete elements.modal.dataset.modalType;
  delete elements.modal.dataset.required;
}

function getIconForType(type) {
  switch (type) {
    case "success":
      return "✓";

    case "danger":
      return "!";

    case "warning":
      return "!";

    case "info":
    default:
      return "i";
  }
}

function openModal(options = {}) {
  ensureModalSystem();
  resetModalState();

  const elements = getModalElements();

  const {
    mode = "alert",
    type = "info",
    eyebrow = "RADIO CONEXIÓN STUDIO",
    title = "Aviso",
    message = "",
    confirmText = "Aceptar",
    cancelText = "Cancelar",
    showCancel = mode !== "alert",
    danger = false,
    label = "Nombre",
    placeholder = "",
    defaultValue = "",
    required = false,
    maxLength = 500
  } = options;

  previousActiveElement = document.activeElement;

  elements.modal.dataset.modalType = mode;
  elements.modal.dataset.required = required ? "true" : "false";

  elements.modal.classList.add(`rc-modal--${mode}`);

  const visualType = danger ? "danger" : type;

  elements.modal.classList.add(`rc-modal--${visualType}`);
  elements.icon.classList.add(`rc-modal__icon--${visualType}`);

  elements.iconContent.textContent = getIconForType(visualType);
  elements.eyebrow.textContent = eyebrow;
  elements.title.textContent = title;
  elements.message.textContent = message;

  elements.confirmButton.textContent = confirmText;
  elements.cancelButton.textContent = cancelText;
  elements.cancelButton.hidden = !showCancel;

  if (danger) {
    elements.confirmButton.className =
      "rc-modal__button rc-modal__button--danger";
  }

  if (mode === "prompt") {
    elements.inputWrap.hidden = false;
    elements.inputLabel.textContent = label;
    elements.input.placeholder = placeholder;
    elements.input.value = defaultValue;
    elements.input.maxLength = maxLength;
  }

  elements.modal.classList.add("rc-modal--visible");
  elements.modal.setAttribute("aria-hidden", "false");

  document.documentElement.classList.add("rc-modal-open");

  requestAnimationFrame(() => {
    if (mode === "prompt") {
      elements.input.focus();
      elements.input.select();
    } else {
      elements.confirmButton.focus();
    }
  });

  return new Promise((resolve) => {
    modalResolve = resolve;
  });
}

function handleModalConfirm() {
  const elements = getModalElements();
  const mode = elements.modal.dataset.modalType;

  if (mode === "prompt") {
    const value = elements.input.value.trim();
    const required = elements.modal.dataset.required === "true";

    if (required && !value) {
      elements.inputError.textContent =
        "Completa este campo para continuar.";

      elements.inputError.hidden = false;
      elements.input.classList.add("rc-modal__input--error");
      elements.input.focus();

      return;
    }

    closeModal(value);
    return;
  }

  closeModal(true);
}

function closeModal(result) {
  const elements = getModalElements();

  if (!elements.modal.classList.contains("rc-modal--visible")) {
    return;
  }

  elements.modal.classList.remove("rc-modal--visible");
  elements.modal.setAttribute("aria-hidden", "true");

  document.documentElement.classList.remove("rc-modal-open");

  const resolve = modalResolve;
  modalResolve = null;

  window.setTimeout(() => {
    resetModalState();
  }, 220);

  if (
    previousActiveElement &&
    typeof previousActiveElement.focus === "function"
  ) {
    previousActiveElement.focus();
  }

  previousActiveElement = null;

  if (typeof resolve === "function") {
    resolve(result);
  }
}

function handleModalKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal(false);
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const elements = getModalElements();

  const focusableElements = [
    ...elements.dialog.querySelectorAll(
      'button:not([hidden]):not([disabled]), input:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ].filter((element) => {
    return element.offsetParent !== null;
  });

  if (!focusableElements.length) {
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

/* =========================================================
   API PÚBLICA
   ========================================================= */

/**
 * Aviso informativo.
 *
 * Ejemplo:
 * await showModal({
 *   title: "Grabación finalizada",
 *   message: "El episodio está listo para escuchar.",
 *   type: "success"
 * });
 */
async function showModal(options = {}) {
  return openModal({
    ...options,
    mode: "alert",
    showCancel: false
  });
}

/**
 * Confirmación.
 *
 * Devuelve true o false.
 *
 * Ejemplo:
 * const confirmed = await confirmModal({
 *   title: "Nueva sesión",
 *   message: "¿Quieres comenzar una nueva sesión?",
 *   confirmText: "Comenzar",
 *   cancelText: "Cancelar"
 * });
 */
async function confirmModal(options = {}) {
  return openModal({
    ...options,
    mode: "confirm",
    showCancel: true
  });
}

/**
 * Solicitud de texto.
 *
 * Devuelve:
 * - string si se confirma
 * - false si se cancela
 *
 * Ejemplo:
 * const name = await promptModal({
 *   title: "Nuevo bloque",
 *   label: "Nombre del bloque",
 *   placeholder: "Ej: Conversación principal",
 *   required: true
 * });
 */
async function promptModal(options = {}) {
  return openModal({
    ...options,
    mode: "prompt",
    showCancel: true
  });
}

/**
 * Toast no bloqueante.
 *
 * type:
 * - success
 * - info
 * - warning
 * - danger
 *
 * Ejemplo:
 * toast({
 *   title: "Sonido agregado",
 *   message: "El audio está listo en el Soundpad.",
 *   type: "success"
 * });
 */
function toast(options = {}) {
  ensureModalSystem();

  const {
    title = "",
    message = "",
    type = "info",
    duration = 4200
  } = options;

  const container = document.getElementById(RC_TOAST_CONTAINER_ID);

  const toastElement = document.createElement("div");

  toastElement.className = `rc-toast rc-toast--${type}`;
  toastElement.setAttribute("role", "status");

  const icon = getIconForType(type);

  toastElement.innerHTML = `
    <div class="rc-toast__icon" aria-hidden="true">
      ${icon}
    </div>

    <div class="rc-toast__content">
      ${
        title
          ? `<strong class="rc-toast__title"></strong>`
          : ""
      }

      ${
        message
          ? `<p class="rc-toast__message"></p>`
          : ""
      }
    </div>

    <button
      class="rc-toast__close"
      type="button"
      aria-label="Cerrar notificación"
    >
      ×
    </button>
  `;

  const titleElement = toastElement.querySelector(".rc-toast__title");
  const messageElement = toastElement.querySelector(".rc-toast__message");

  if (titleElement) {
    titleElement.textContent = title;
  }

  if (messageElement) {
    messageElement.textContent = message;
  }

  const closeButton = toastElement.querySelector(".rc-toast__close");

  let removalTimer = null;

  const removeToast = () => {
    if (removalTimer) {
      window.clearTimeout(removalTimer);
      removalTimer = null;
    }

    toastElement.classList.add("rc-toast--leaving");

    window.setTimeout(() => {
      toastElement.remove();
    }, 220);
  };

  closeButton.addEventListener("click", removeToast);

  container.appendChild(toastElement);

  requestAnimationFrame(() => {
    toastElement.classList.add("rc-toast--visible");
  });

  if (duration > 0) {
    removalTimer = window.setTimeout(removeToast, duration);
  }

  return {
    element: toastElement,
    close: removeToast
  };
}

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

function initializeModalSystem() {
  ensureModalSystem();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeModalSystem,
    { once: true }
  );
} else {
  initializeModalSystem();
}

/* =========================================================
   EXPORTS
   ========================================================= */

export {
  showModal,
  confirmModal,
  promptModal,
  toast
};