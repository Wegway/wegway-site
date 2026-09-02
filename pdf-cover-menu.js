/* Cover-image dropdown: click the cover to reveal "Read in browser" /
   "Download" options for the issue's PDF. */
(function () {
  function closeAll() {
    document.querySelectorAll('.pdf-cover-dropdown').forEach(function (d) {
      d.hidden = true;
    });
    document.querySelectorAll('.pdf-cover-trigger').forEach(function (t) {
      t.setAttribute('aria-expanded', 'false');
    });
  }

  document.querySelectorAll('.pdf-cover-menu').forEach(function (menu) {
    var trigger = menu.querySelector('.pdf-cover-trigger');
    var dropdown = menu.querySelector('.pdf-cover-dropdown');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      var wasHidden = dropdown.hidden;
      closeAll();
      dropdown.hidden = !wasHidden;
      trigger.setAttribute('aria-expanded', String(!wasHidden));
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.pdf-cover-menu')) closeAll();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });
})();
