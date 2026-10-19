(function () {
  'use strict';
  var key = 'fp_cookie_consent_v1';
  var choice = null;
  try { choice = localStorage.getItem(key); } catch (error) { /* Ask again when storage is unavailable. */ }
  if (choice !== 'accepted' && choice !== 'rejected') choice = null;

  // Install styles before creating the banner, without blocking initial page rendering.
  var styles = document.createElement('style');
  styles.setAttribute('data-cookie-consent-styles', '');
  styles.textContent = ".cookie-consent[hidden] { display: none; }\n.cookie-consent {\n  position: fixed;\n  bottom: 0;\n  left: 0;\n  right: 0;\n  z-index: 9999;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  flex-wrap: wrap;\n  gap: 1rem;\n  max-height: 80vh;\n  overflow-y: auto;\n  padding: 1rem 1.25rem;\n  background: #1e2b3c;\n  color: #f0f4f8;\n  border-top: 2px solid #c8a84b;\n  box-shadow: 0 -2px 12px rgba(0,0,0,.3);\n  font: .9rem/1.5 Inter, sans-serif;\n}\n.cookie-consent p { margin: 0; max-width: 70ch; color: inherit; font: inherit; }\n.cookie-consent a { color: #e3c56b; text-decoration: underline; }\n.cookie-consent__actions { display: flex; flex-wrap: wrap; gap: .75rem; }\n.cookie-consent button {\n  min-width: 100px;\n  min-height: 44px;\n  padding: .6rem 1.1rem;\n  border: 1px solid #c8a84b;\n  border-radius: 4px;\n  background: #c8a84b;\n  color: #1e2b3c;\n  font: 600 .9rem/1.4 Inter, sans-serif;\n  cursor: pointer;\n}\n.cookie-settings { background: none; border: 0; padding: .65rem 0; color: #e3c56b; font: inherit; text-decoration: underline; cursor: pointer; }\n.cookie-consent button:focus-visible, .cookie-consent a:focus-visible, .cookie-settings:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }\n@media (max-width: 520px) {\n  .cookie-consent__actions { width: 100%; }\n  .cookie-consent button { flex: 1; }\n}\n";
  document.head.appendChild(styles);

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
