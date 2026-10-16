// A plain script can explain startup failures even if the module cannot load.
(() => {
  function explain() {
    const root = document.getElementById('beaches');
    if (!root || root.dataset.ready) return;
    root.replaceChildren();
    const message = document.createElement('p');
    message.textContent = location.protocol === 'file:'
      ? 'This page needs the local preview server. Open http://127.0.0.1:8000 in your browser, rather than opening index.html directly.'
      : 'The app is taking too long to start. Please reload. If this is the local preview, make sure its server is running.';
    const retry = document.createElement('button');
    retry.className = 'outline';
    retry.textContent = 'Reload Beach Cams';
    retry.addEventListener('click', () => location.reload());
    root.append(message, retry);
  }
  if (location.protocol === 'file:') explain();
  else setTimeout(explain, 15000);
})();
