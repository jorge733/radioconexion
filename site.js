(() => {
  const root = document.documentElement;

  // Menú móvil
  const menu = document.getElementById('nav-menu');
  const toggle = document.getElementById('menu-toggle');
  if (menu && toggle) {
    const setMenu = open => {
      menu.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };
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
      if (window.innerWidth > 860 && menu.classList.contains('nav-open')) setMenu(false);
    });
  }

  // Modo claro/oscuro: preferencia guardada o, si no hay, la del sistema.
  // El script en línea del <head> ya aplicó la clase antes de pintar la página.
  const themeButton = document.getElementById('dark-mode-toggle');
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch (error) { return null; }
  };
  const applyTheme = dark => {
    root.classList.toggle('dark', dark);
    if (themeButton) {
      themeButton.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
      themeButton.setAttribute('aria-pressed', String(dark));
    }
  };
  const stored = savedTheme();
  applyTheme(stored ? stored === 'dark' : Boolean(systemDark?.matches));
  systemDark?.addEventListener?.('change', event => {
    if (!savedTheme()) applyTheme(event.matches);
  });
  themeButton?.addEventListener('click', () => {
    const dark = !root.classList.contains('dark');
    applyTheme(dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (error) {}
  });

  // Año del pie de página
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  // Sombra del encabezado al desplazarse
  const header = document.getElementById('main-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Aparición de bloques al entrar en pantalla
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const selectors = [
      'main .section .section-head',
      'main .section .split > *',
      'main .section .card:not(.weather-card)',
      'main .section .weather-card',
      'main .section .cta-band',
      'main .section .check-list li',
      'main .section .prose',
      'main .section .pull-quote',
      'main .section .signature',
      '.site-footer__grid > *'
    ];
    const targets = [...new Set(document.querySelectorAll(selectors.join(',')))]
      // Evita animar dos veces un bloque cuyo contenedor ya aparece
      .filter((el, _, all) => !all.some(other => other !== el && other.contains(el)));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(el => {
      // Escalonado entre hermanos (p. ej., tarjetas de una retícula)
      const siblings = [...el.parentElement.children].filter(child => targets.includes(child));
      const index = siblings.indexOf(el);
      if (index > 0) el.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 0.08}s`);
      el.classList.add('reveal');
      observer.observe(el);
    });
  }

  // Enlaces externos seguros
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', [...rel].join(' '));
  });
})();
