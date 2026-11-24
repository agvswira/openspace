(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('openspace-theme');
  } catch {
    stored = null;
  }
  var valid = stored === 'light' || stored === 'dark' ? stored : null;
  var meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.content = valid || 'light dark';
  document.documentElement.dataset.theme =
    valid || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
})();
