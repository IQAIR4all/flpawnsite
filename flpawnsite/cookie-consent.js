(function () {
  'use strict';
  var key = 'fp_cookie_consent_v1';
  var choice = null;
  try { choice = localStorage.getItem(key); } catch (error) { /* Ask again when storage is unavailable. */ }
  if (choice !== 'accepted' && choice !== 'rejected') choice = null;

  var banner = document.createElement('section');
  banner.className = 'cookie-consent';
  banner.setAttribute('aria-label', 'Cookie preferences');
  banner.hidden = !!choice;
  banner.innerHTML = '<p>Optional analytics cookies are off unless you accept. You can reject them and still use this site. <a href="privacy-policy.html">Privacy Policy</a></p>' +
    '<div class="cookie-consent__actions"><button type="button" data-choice="accepted">Accept</button><button type="button" data-choice="rejected">Reject</button></div>';
  document.body.appendChild(banner);

  // Only explicitly marked optional scripts may run after consent. Never add an
  // unguarded analytics loader to a page. There is no tracker configured today.
  function enableOptionalScripts() {
    document.querySelectorAll('script[type="text/plain"][data-cookie-consent="analytics"]').forEach(function (placeholder) {
      var script = document.createElement('script');
      Array.from(placeholder.attributes).forEach(function (attribute) {
        if (attribute.name !== 'type' && attribute.name !== 'data-cookie-consent') {
          script.setAttribute(attribute.name, attribute.value);
        }
      });
      script.textContent = placeholder.textContent;
      placeholder.replaceWith(script);
    });
  }

  var settings = document.createElement('button');
  settings.type = 'button';
  settings.className = 'cookie-settings';
  settings.textContent = 'Cookie settings';
  settings.addEventListener('click', function () {
    banner.hidden = false;
    banner.querySelector('button').focus();
  });
  var footer = document.querySelector('.footer__bottom, .reel-footer');
  (footer || document.body).appendChild(settings);

  banner.querySelectorAll('button[data-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      var previous = choice;
      choice = button.getAttribute('data-choice');
      try { localStorage.setItem(key, choice); } catch (error) { /* Honor the choice for this page. */ }
      banner.hidden = true;
      if (choice === 'accepted') enableOptionalScripts();
      // A reload stops any optional scripts already running after withdrawal.
      if (previous === 'accepted' && choice === 'rejected') window.location.reload();
      else settings.focus();
    });
  });
  if (choice === 'accepted') enableOptionalScripts();
})();
