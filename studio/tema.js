/* Radio Conexión Studio · modo claro u oscuro (misma clave "theme" que el sitio) */
(function () {
  var root = document.documentElement;
  var button = document.getElementById('studioThemeToggle');
  var meta = document.querySelector('meta[name="theme-color"]');

  function sync() {
    var dark = root.classList.contains('dark');
    if (button) {
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
    }
    if (meta) meta.setAttribute('content', dark ? '#121614' : '#f7f3ea');
  }

  if (button) {
    button.addEventListener('click', function () {
      var dark = root.classList.toggle('dark');
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (error) {}
      sync();
    });
  }

  // Si la persona no eligió un modo, sigue al sistema.
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
      var saved = null;
      try { saved = localStorage.getItem('theme'); } catch (error) {}
      if (saved) return;
      root.classList.toggle('dark', event.matches);
      sync();
    });
  } catch (error) {}

  sync();
})();
