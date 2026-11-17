// Formulario "Participa en la radio": envía la postulación a /api/participa.
(() => {
  const form = document.getElementById('participa-form');
  if (!form) return;
  const message = document.getElementById('participa-message');
  const done = document.getElementById('participa-done');
  const submit = form.querySelector('button[type="submit"]');
  const counter = form.querySelector('[data-count]');
  const DRAFT_KEY = 'participa-borrador';
  const DRAFT_FIELDS = ['type', 'idea', 'name', 'email', 'phone', 'place', 'format', 'links'];
  let startedAt = Date.now();

  const updateCount = () => { counter.textContent = form.idea.value.length; };

  // Borrador local: si la persona cierra la página, no pierde lo que escribió.
  const saveDraft = () => {
    try {
      const draft = Object.fromEntries(DRAFT_FIELDS.map(name => [name, form.elements[name].value]));
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (error) {}
  };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch (error) {} };
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (draft) DRAFT_FIELDS.forEach(name => {
      if (typeof draft[name] !== 'string' || !draft[name]) return;
      const field = form.elements[name];
      if (field instanceof RadioNodeList) {
        const option = [...field].find(input => input.value === draft[name]);
        if (option) option.checked = true;
      } else field.value = draft[name];
    });
  } catch (error) {}
  updateCount();

  form.addEventListener('input', event => {
    if (event.target.name === 'idea') updateCount();
    if (message.textContent) message.textContent = '';
    event.target.removeAttribute('aria-invalid');
    saveDraft();
  });

  // Revisa los campos en orden y lleva el foco al primero que falte.
  function check() {
    const value = name => form.elements[name].value.trim();
    const problems = [
      [!value('type'), 'type', 'Elige cómo te gustaría participar.'],
      [value('idea').length < 20, 'idea', 'Cuéntanos tu idea con un poco más de detalle (al menos 20 caracteres).'],
      [!value('name'), 'name', 'Escribe tu nombre.'],
      [!form.email.checkValidity() || !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value('email')), 'email', 'Revisa tu correo: no parece válido.'],
      [value('phone') && !/^[0-9+()\s.-]{6,30}$/.test(value('phone')), 'phone', 'Revisa tu teléfono: usa solo números, espacios y el signo +.'],
      [!value('format'), 'format', 'Elige cómo prefieres grabar.'],
      [!form.consent.checked, 'consent', 'Necesitamos tu autorización para contactarte.']
    ];
    const problem = problems.find(([failed]) => failed);
    if (!problem) return true;
    const [, name, text] = problem;
    message.textContent = text;
    const field = form.elements[name];
    const target = field instanceof RadioNodeList ? field[0] : field;
    if (!(field instanceof RadioNodeList)) target.setAttribute('aria-invalid', 'true');
    target.focus();
    return false;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    if (!check()) return;
    submit.disabled = true;
    submit.textContent = 'Enviando…';
    const payload = {
      ...Object.fromEntries(DRAFT_FIELDS.map(name => [name, form.elements[name].value.trim()])),
      consent: form.consent.checked,
      website: form.website.value,
      startedAt
    };
    try {
      const response = await fetch('/api/participa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'No pudimos enviar tu postulación. Inténtalo de nuevo en unos minutos.');
      clearDraft();
      done.querySelector('[data-done-name]').textContent = payload.name.split(' ')[0];
      done.querySelector('[data-done-email]').textContent = payload.email;
      form.hidden = true;
      done.hidden = false;
      done.focus({ preventScroll: true });
      done.closest('.card').scrollIntoView({ block: 'start' });
    } catch (error) {
      message.textContent = error instanceof TypeError ? 'No hay conexión. Revisa tu internet e inténtalo de nuevo.' : error.message;
    } finally {
      submit.disabled = false;
      submit.textContent = 'Enviar mi postulación';
    }
  });

  done.querySelector('[data-participa-again]').addEventListener('click', () => {
    // Conserva los datos de contacto y limpia la idea.
    form.idea.value = '';
    form.links.value = '';
    form.querySelectorAll('input[name="type"]').forEach(input => { input.checked = false; });
    form.consent.checked = false;
    updateCount();
    startedAt = Date.now();
    done.hidden = true;
    form.hidden = false;
    form.querySelector('input[name="type"]').focus();
  });
})();
