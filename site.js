(() => {
  const root = document.documentElement;

  // Menú móvil
  const menu = document.getElementById('nav-menu');
  const toggle = document.getElementById('menu-toggle');
  if (menu && toggle) {
    const setMenu = open => {
      menu.classList.toggle('nav-open', open);
      toggle.textContent = open ? '✕' : '☰';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
    };
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', 'nav-menu');
    setMenu(false);
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      setMenu(!menu.classList.contains('nav-open'));
    });
    document.addEventListener('click', event => {
      if (menu.classList.contains('nav-open') && !event.target.closest('#main-header')) setMenu(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.classList.contains('nav-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && menu.classList.contains('nav-open')) setMenu(false);
    });
  }

  // Modo claro/oscuro: preferencia guardada o, si no hay, la del sistema.
  const themeButton = document.getElementById('dark-mode-toggle');
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch (error) { return null; }
  };
  const applyTheme = dark => {
    document.body.classList.toggle('dark-mode', dark);
    if (themeButton) {
      themeButton.textContent = dark ? '☀️' : '🌙';
      themeButton.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
      themeButton.setAttribute('aria-pressed', String(dark));
    }
  };
  const stored = savedTheme();
  applyTheme(stored ? stored === 'dark' : Boolean(systemDark?.matches));
  root.classList.remove('rc-dark-preload');
  systemDark?.addEventListener?.('change', event => {
    if (!savedTheme()) applyTheme(event.matches);
  });
  if (themeButton) {
    themeButton.type = 'button';
    themeButton.title = 'Cambiar modo claro/oscuro';
    themeButton.addEventListener('click', () => {
      const dark = !document.body.classList.contains('dark-mode');
      applyTheme(dark);
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (error) {}
    });
  }

  // Accesibilidad y seguridad de enlaces
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', [...rel].join(' '));
  });
  document.querySelectorAll('iframe:not([title])').forEach(frame => {
    frame.title = 'Contenido multimedia de Radio Conexión';
  });
  document.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"])').forEach(input => {
    if (!input.labels?.length && !input.hasAttribute('aria-label')) input.setAttribute('aria-label', input.placeholder || 'Correo electrónico');
  });
})();
