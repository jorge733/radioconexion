/* =========================================================
   Radio Conexión · Editor del boletín
   Se usa en el portal de suscriptores y en el Studio.
   Cada página entrega sus clases (campos, botones, estados)
   para que el editor se vea como el resto de la página.
   ========================================================= */

const MAX_NOTICIAS = 6;
const BORRADOR = 'radioConexionBoletinBorrador';
const CAMPOS_NOTICIA = ['title', 'summary', 'url', 'image', 'source'];
const ESTADOS_ENVIO = { draft: 'Borrador', scheduled: 'Programado', queued: 'En cola', sending: 'Enviándose', sent: 'Enviado', failed: 'Falló', canceled: 'Cancelado' };

const CLASES_PREDETERMINADAS = {
  campo: 'field',
  boton: 'btn btn-ghost',
  botonPequeno: 'btn btn-ghost btn-sm',
  botonPrincipal: 'btn btn-primary',
  acciones: 'actions',
  estado: 'status',
  etiqueta: 'field-label',
  nota: 'muted small',
  fila: 'admin-row',
  lista: 'admin-list',
  vacio: 'empty-msg'
};

let contador = 0;

/**
 * Monta el editor dentro de `root`.
 * @param {HTMLElement} root
 * @param {{ llamarApi: (url: string, payload: any, method?: string) => Promise<any>, correo: () => string, clases?: object, confirmar?: (texto: string) => Promise<boolean> | boolean }} opciones
 * @returns {{ iniciar: () => void }}
 */
export function montarEditorBoletin(root, { llamarApi, correo, clases = {}, confirmar = texto => window.confirm(texto) }) {
  const c = { ...CLASES_PREDETERMINADAS, ...clases };
  const p = `nb${++contador}`;
  root.classList.add('nb-editor');
  root.innerHTML = `
    <form class="nb-layout" novalidate>
      <div class="nb-fields">
        <div class="${c.campo}"><label for="${p}-asunto">Asunto</label><input id="${p}-asunto" name="subject" type="text" maxlength="120" required placeholder="Ej.: Cinco buenas noticias para empezar la semana"></div>
        <div class="${c.campo}"><label for="${p}-preheader">Texto de vista previa <span class="nb-optional">(opcional)</span></label><input id="${p}-preheader" name="preheader" type="text" maxlength="160" placeholder="Lo que se ve junto al asunto en la bandeja de entrada"></div>
        <div class="${c.campo}"><label for="${p}-intro">Introducción <span class="nb-optional">(opcional)</span></label><textarea id="${p}-intro" name="intro" rows="3" maxlength="2000" placeholder="Un saludo breve para abrir el boletín."></textarea></div>

        <fieldset class="nb-group">
          <legend>Noticias <span class="nb-optional">(de 1 a 6)</span></legend>
          <div class="nb-items"></div>
          <button type="button" class="${c.botonPequeno}" data-nb="agregar">+ Agregar noticia</button>
        </fieldset>

        <div class="${c.campo}"><label for="${p}-cierre">Despedida <span class="nb-optional">(opcional)</span></label><textarea id="${p}-cierre" name="closing" rows="2" maxlength="800" placeholder="Ej.: Gracias por leernos. ¡Nos vemos la próxima semana!"></textarea></div>

        <fieldset class="nb-group nb-when">
          <legend>¿Cuándo enviarlo?</legend>
          <label><input type="radio" name="${p}-cuando" value="ahora" checked> Enviar ahora</label>
          <label><input type="radio" name="${p}-cuando" value="programar"> Programar</label>
          <div class="${c.campo}" data-nb="fecha-campo" hidden><label for="${p}-fecha">Fecha y hora (según la hora de este dispositivo)</label><input id="${p}-fecha" type="datetime-local"></div>
        </fieldset>

        <div class="${c.acciones} nb-actions">
          <button type="button" class="${c.boton}" data-nb="vista">Actualizar vista previa</button>
          <button type="button" class="${c.boton}" data-nb="prueba">Enviarme una prueba</button>
          <button type="submit" class="${c.botonPrincipal}" data-nb="enviar">Enviar a todos</button>
        </div>
        <p class="${c.estado}" data-nb="estado" role="status" aria-live="polite"></p>
      </div>
      <div class="nb-preview">
        <span class="${c.etiqueta}">Vista previa</span>
        <iframe title="Vista previa del boletín" sandbox=""></iframe>
      </div>
    </form>
    <div class="nb-history">
      <div class="nb-history__head"><span class="${c.etiqueta}">Últimos envíos</span><button type="button" class="${c.botonPequeno}" data-nb="historial">Actualizar</button></div>
      <div class="${c.lista}" data-nb="lista"></div>
    </div>`;

  const q = selector => root.querySelector(selector);
  const form = q('form');
  const itemsBox = q('.nb-items');
  const preview = q('iframe');
  const estado = q('[data-nb="estado"]');
  const fecha = q(`#${p}-fecha`);
  const botonEnviar = q('[data-nb="enviar"]');
  const botonAgregar = q('[data-nb="agregar"]');
  let vistaTimer = null;

  const setStatus = (text, state = '') => { estado.textContent = text; estado.dataset.state = state; };
  const programado = () => q(`input[name="${p}-cuando"]:checked`).value === 'programar';

  function crearCampo(labelText, name, { type = 'text', rows = 0, maxLength = 160, placeholder = '' } = {}) {
    const field = document.createElement('div');
    field.className = c.campo;
    const id = `${p}-${name}-${Math.random().toString(36).slice(2, 9)}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement(rows ? 'textarea' : 'input');
    if (rows) input.rows = rows; else input.type = type;
    Object.assign(input, { id, name, maxLength, placeholder });
    if (type === 'url') input.inputMode = 'url';
    field.append(label, input);
    return field;
  }

  function numerarNoticias() {
    [...itemsBox.children].forEach((item, index) => {
      item.querySelector('.nb-item__head strong').textContent = `Noticia ${index + 1}`;
      item.querySelector('.nb-item__head button').hidden = itemsBox.children.length === 1;
    });
    botonAgregar.hidden = itemsBox.children.length >= MAX_NOTICIAS;
  }

  function agregarNoticia(data = {}) {
    if (itemsBox.children.length >= MAX_NOTICIAS) return;
    const item = document.createElement('div');
    item.className = 'nb-item';
    const head = document.createElement('div');
    head.className = 'nb-item__head';
    const title = document.createElement('strong');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = c.botonPequeno;
    remove.textContent = 'Quitar';
    remove.addEventListener('click', () => { item.remove(); numerarNoticias(); programarVistaPrevia(); });
    head.append(title, remove);
    item.append(
      head,
      crearCampo('Título', 'title', { maxLength: 160, placeholder: 'Titular de la noticia' }),
      crearCampo('Resumen', 'summary', { rows: 3, maxLength: 900, placeholder: 'Dos o tres frases que cuenten lo esencial.' }),
      crearCampo('Enlace a la noticia', 'url', { type: 'url', maxLength: 600, placeholder: 'https://…' }),
      crearCampo('Imagen (enlace, opcional)', 'image', { type: 'url', maxLength: 600, placeholder: 'https://…/foto.jpg' }),
      crearCampo('Fuente (opcional)', 'source', { maxLength: 60, placeholder: 'Ej.: BBC Mundo' })
    );
    CAMPOS_NOTICIA.forEach(key => { if (data[key]) item.querySelector(`[name="${key}"]`).value = data[key]; });
    itemsBox.appendChild(item);
    numerarNoticias();
  }

  function leerBoletin() {
    const valor = name => form.elements[name].value.trim();
    return {
      subject: valor('subject'),
      preheader: valor('preheader'),
      intro: valor('intro'),
      closing: valor('closing'),
      items: [...itemsBox.children].map(item => Object.fromEntries(
        CAMPOS_NOTICIA.map(key => [key, item.querySelector(`[name="${key}"]`).value.trim()])
      ))
    };
  }

  function guardarBorrador() {
    try { localStorage.setItem(BORRADOR, JSON.stringify(leerBoletin())); } catch (error) {}
  }

  function cargarBorrador() {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(BORRADOR) || 'null'); } catch (error) {}
    itemsBox.replaceChildren();
    ['subject', 'preheader', 'intro', 'closing'].forEach(name => { form.elements[name].value = draft?.[name] || ''; });
    (draft?.items?.length ? draft.items : [{}]).slice(0, MAX_NOTICIAS).forEach(agregarNoticia);
  }

  async function actualizarVistaPrevia({ quiet = false } = {}) {
    const newsletter = leerBoletin();
    if (!newsletter.subject || !newsletter.items.some(item => item.title)) {
      if (!quiet) setStatus('Escribe el asunto y al menos el título de una noticia para ver la vista previa.', 'error');
      return false;
    }
    try {
      const { html } = await llamarApi('/api/newsletter', { action: 'preview', newsletter });
      preview.srcdoc = html;
      if (!quiet) setStatus('');
      return true;
    } catch (error) {
      setStatus(error.message || 'No pudimos generar la vista previa.', 'error');
      return false;
    }
  }

  function programarVistaPrevia() {
    guardarBorrador();
    clearTimeout(vistaTimer);
    vistaTimer = setTimeout(() => actualizarVistaPrevia({ quiet: true }), 900);
  }

  function fechaProgramada() {
    if (!programado()) return null;
    if (!fecha.value) throw new Error('Elige la fecha y hora del envío.');
    const date = new Date(fecha.value);
    if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() + 2 * 60 * 1000) throw new Error('Elige una fecha y hora al menos 2 minutos en el futuro.');
    return date;
  }

  async function cargarHistorial() {
    const list = q('[data-nb="lista"]');
    const nota = text => { const p = document.createElement('p'); p.className = c.vacio; p.textContent = text; return p; };
    try {
      const { broadcasts = [] } = await llamarApi('/api/newsletter', { action: 'history' });
      if (!broadcasts.length) return list.replaceChildren(nota('Aún no se ha enviado ningún boletín.'));
      list.replaceChildren(...broadcasts.map(item => {
        const row = document.createElement('div');
        row.className = `${c.fila} nb-history__row`;
        const name = document.createElement('span');
        name.textContent = item.name || 'Boletín';
        const meta = document.createElement('span');
        meta.className = c.nota;
        const date = item.sentAt || item.scheduledAt || item.createdAt;
        meta.textContent = [ESTADOS_ENVIO[item.status] || item.status, date ? new Date(date).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : ''].filter(Boolean).join(' · ');
        row.append(name, meta);
        return row;
      }));
    } catch (error) {
      list.replaceChildren(nota(error.message || 'No pudimos cargar el historial.'));
    }
  }

  botonAgregar.addEventListener('click', () => { agregarNoticia(); programarVistaPrevia(); itemsBox.lastElementChild?.querySelector('input')?.focus(); });
  form.addEventListener('input', programarVistaPrevia);
  q('[data-nb="vista"]').addEventListener('click', () => actualizarVistaPrevia());
  q('[data-nb="historial"]').addEventListener('click', cargarHistorial);
  root.querySelectorAll(`input[name="${p}-cuando"]`).forEach(radio => radio.addEventListener('change', () => {
    q('[data-nb="fecha-campo"]').hidden = !programado();
    botonEnviar.textContent = programado() ? 'Programar envío' : 'Enviar a todos';
  }));

  q('[data-nb="prueba"]').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    setStatus('Enviando prueba…');
    try {
      await llamarApi('/api/newsletter', { action: 'test', newsletter: leerBoletin() });
      setStatus(`Prueba enviada a ${correo()}. Revisa tu bandeja de entrada.`, 'ok');
    } catch (error) {
      setStatus(error.message || 'No pudimos enviar la prueba.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    let scheduledAt;
    try { scheduledAt = fechaProgramada(); } catch (error) { return setStatus(error.message, 'error'); }
    const newsletter = leerBoletin();
    if (!(await actualizarVistaPrevia())) return;
    const when = scheduledAt ? `el ${scheduledAt.toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })}` : 'ahora mismo';
    if (!(await confirmar(`¿Enviar «${newsletter.subject}» a todas las personas suscritas ${when}? No se puede deshacer.`))) return;
    botonEnviar.disabled = true;
    setStatus(scheduledAt ? 'Programando el envío…' : 'Enviando el boletín…');
    try {
      await llamarApi('/api/newsletter', { action: 'send', newsletter, scheduledAt: scheduledAt?.toISOString() || null });
      setStatus(scheduledAt ? `Boletín programado para ${when.replace(/^el /, '')}.` : 'Boletín enviado. Resend lo está entregando a las personas suscritas.', 'ok');
      try { localStorage.removeItem(BORRADOR); } catch (error) {}
      cargarBorrador();
      preview.srcdoc = '';
      cargarHistorial();
    } catch (error) {
      setStatus(error.message || 'No pudimos enviar el boletín.', 'error');
    } finally {
      botonEnviar.disabled = false;
    }
  });

  cargarBorrador();
  let iniciado = false;
  return {
    // Carga el borrador guardado, la vista previa y el historial (una vez por sesión).
    iniciar() {
      cargarBorrador();
      actualizarVistaPrevia({ quiet: true });
      if (!iniciado) cargarHistorial();
      iniciado = true;
    }
  };
}
