(function () {
  'use strict';
  var dialog = document.getElementById('homepage-promo');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var key = 'fp_black_friday_promo_seen_v1';
  try { if (sessionStorage.getItem(key)) return; } catch (error) { /* Still allow dismissal without storage. */ }

  var image = dialog.querySelector('img');
  function showPromotion() {
    if (!image.naturalWidth) return; // A missing image must never block the page.
    dialog.showModal();
    document.documentElement.classList.add('homepage-promo-open');
    try { sessionStorage.setItem(key, '1'); } catch (error) { /* Storage may be disabled. */ }
  }
  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('homepage-promo-open');
  });
  dialog.addEventListener('click', function (event) {
    if (event.target !== dialog) return;
    var bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  if (image.complete) showPromotion();
  else image.addEventListener('load', showPromotion, { once: true });
})();
