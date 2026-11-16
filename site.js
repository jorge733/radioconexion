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
      .filter(el => !el.closest('[data-no-reveal]'))
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

  // Sintonizador de páginas: cada sección del menú es una emisora del dial.
  // Se arma con los enlaces del menú principal y aparece al final de todas las páginas.
  // Los botones de presintonía son enlaces normales (accesibles con teclado); el dial es un extra.
  const navLinks = [...document.querySelectorAll('#nav-menu a')];
  const main = document.getElementById('contenido');
  if (main && navLinks.length) {
    const FREQS = [89.5, 94.3, 99.1, 104.3, 106.9];
    const stations = navLinks.slice(0, FREQS.length).map((link, i) => ({
      href: link.getAttribute('href'), label: link.textContent.trim(), freq: FREQS[i],
      current: link.getAttribute('aria-current') === 'page'
    }));
    const here = stations.find(st => st.current);
    const startFreq = here ? here.freq : 88;
    const pos = f => `${((f - 88) / 20 * 100).toFixed(1)}%`;
    const section = document.createElement('section');
    section.className = 'section station-dial';
    section.setAttribute('aria-labelledby', 'station-dial-title');
    section.innerHTML = `
      <div class="wrap">
        <p class="eyebrow" id="station-dial-title">Cambia de emisora</p>
        <div class="tuner tuner--tabs tuner--pages">
          <div class="tuner__screen tuner__screen--compact" aria-hidden="true">
            <div class="tuner__readout">
              <span class="tuner__band">FM</span>
              <span class="tuner__freq" data-tuner-freq>${startFreq.toFixed(1)}</span>
              <span class="tuner__mhz">MHz</span>
              <span class="tuner__now" data-tuner-name></span>
              <span class="tuner__signal"><i></i><i></i><i></i><i></i></span>
            </div>
            <canvas class="tuner__static" width="160" height="40"></canvas>
          </div>
          <div class="tuner__dial" aria-hidden="true">
            <div class="tuner__scale">${[88, 92, 96, 100, 104, 108].map(f => `<span style="--pos:${pos(f)}">${f}</span>`).join('')}${stations.map(st => `<span class="tuner__mark" style="--pos:${pos(st.freq)}"></span>`).join('')}</div>
            <input class="tuner__range" type="range" min="88" max="108" step="0.1" value="${startFreq}" tabindex="-1">
          </div>
          <nav class="tabs--presets" aria-labelledby="station-dial-title" style="--presets:${stations.length}">
            ${stations.map(st => `<a class="preset" href="${st.href}"${st.current ? ' aria-current="page"' : ''}><span class="preset__freq" aria-hidden="true">${st.freq}</span><span class="preset__name">${st.label}</span></a>`).join('')}
          </nav>
        </div>
      </div>`;
    main.appendChild(section);

    const tuner = section.querySelector('.tuner');
    const range = tuner.querySelector('.tuner__range');
    const freqOut = tuner.querySelector('[data-tuner-freq]');
    const nameOut = tuner.querySelector('[data-tuner-name]');
    const canvas = tuner.querySelector('.tuner__static');
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(canvas.width, canvas.height);
    let noise = 0, frame = 0, glide = 0, active = false;

    // La estática solo se anima mientras se mueve la aguja; en reposo queda un cuadro fijo.
    const drawStatic = () => {
      frame = 0;
      if (noise < 0.02) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i + 1] = data[i + 2] = Math.random() * 255;
        data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      if (active && !reduceMotion) frame = requestAnimationFrame(drawStatic);
    };
    const nearest = () => {
      const freq = Number(range.value);
      return stations.reduce((best, st) => (Math.abs(st.freq - freq) < Math.abs(best.freq - freq) ? st : best));
    };
    const update = () => {
      const freq = Number(range.value);
      const near = nearest();
      const signal = Math.max(0, 1 - Math.abs(near.freq - freq) / 1.8);
      noise = 1 - signal;
      freqOut.textContent = freq.toFixed(1);
      nameOut.textContent = signal > 0.3 ? near.label : 'Sin señal';
      tuner.style.setProperty('--signal', signal.toFixed(3));
      tuner.dataset.bars = String(Math.round(signal * 4));
      if (!frame) drawStatic();
    };
    // Desliza la aguja hasta la emisora y, al llegar, abre esa página
    const tuneAndGo = station => {
      cancelAnimationFrame(glide);
      const go = () => { if (!station.current) window.location.href = station.href; };
      const start = Number(range.value);
      if (reduceMotion || Math.abs(start - station.freq) < 0.05) { range.value = station.freq; active = false; update(); go(); return; }
      active = true;
      const t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / 550);
        range.value = (start + (station.freq - start) * (1 - Math.pow(1 - k, 3))).toFixed(1);
        update();
        if (k < 1) glide = requestAnimationFrame(step);
        else { active = false; go(); }
      };
      glide = requestAnimationFrame(step);
    };

    range.addEventListener('pointerdown', () => { active = true; cancelAnimationFrame(glide); update(); });
    range.addEventListener('input', () => { active = true; cancelAnimationFrame(glide); update(); });
    const snap = () => tuneAndGo(nearest());
    range.addEventListener('pointerup', snap);
    range.addEventListener('touchend', snap, { passive: true });
    tuner.querySelectorAll('.preset').forEach((link, i) => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      tuneAndGo(stations[i]);
    }));

    tuner.classList.add('is-ready');
    update();
  }

  // Enlaces externos seguros
  document.querySelectorAll('a[target="_blank"]').forEach(link => {
    const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', [...rel].join(' '));
  });
})();
