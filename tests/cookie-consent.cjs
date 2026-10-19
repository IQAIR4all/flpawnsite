// Run with: NODE_PATH=<directory containing jsdom> node --test tests/cookie-consent.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '../flpawnsite');
const source = fs.readFileSync(path.join(root, 'cookie-consent.js'), 'utf8');
function setup(choice, blocked = false) {
  const dom = new JSDOM('<body><footer class="footer__bottom"></footer><script type="text/plain" data-cookie-consent="analytics">window.tracked = true;</script></body>', { url: 'https://example.test/', runScripts: 'dangerously' });
  if (choice) dom.window.localStorage.setItem('fp_cookie_consent_v1', choice);
  // The old notice must not count as opt-in consent.
  dom.window.localStorage.setItem('fp_cookie_ok', '1');
  if (blocked) Object.defineProperty(dom.window, 'localStorage', { get() { throw new Error('blocked'); } });
  dom.window.eval(source);
  return dom.window;
}
test('new visitor: no analytics, equal accept/reject choices and privacy link', () => {
  const w = setup();
  assert.equal(w.document.querySelector('.cookie-consent').hidden, false);
  assert.equal(w.tracked, undefined);
  assert.equal(w.document.querySelectorAll('button[data-choice]').length, 2);
  assert.equal(w.document.querySelector('.cookie-consent a').getAttribute('href'), 'privacy-policy.html');
});
for (const choice of ['accepted', 'rejected']) {
  test(choice + ' is remembered and only acceptance activates optional scripts', () => {
    const w = setup();
    w.document.querySelector('[data-choice="' + choice + '"]').click();
    assert.equal(w.localStorage.getItem('fp_cookie_consent_v1'), choice);
    assert.equal(w.document.querySelector('.cookie-consent').hidden, true);
    assert.equal(w.tracked, choice === 'accepted' ? true : undefined);
    const returning = setup(choice);
    assert.equal(returning.document.querySelector('.cookie-consent').hidden, true);
    assert.equal(returning.tracked, choice === 'accepted' ? true : undefined);
    returning.document.querySelector('.cookie-settings').click();
    assert.equal(returning.document.querySelector('.cookie-consent').hidden, false);
    assert.equal(returning.document.activeElement.getAttribute('data-choice'), 'accepted');
  });
}
test('blocked storage still allows rejecting without tracking', () => {
  const w = setup(null, true);
  w.document.querySelector('[data-choice="rejected"]').click();
  assert.equal(w.tracked, undefined);
  assert.equal(w.document.querySelector('.cookie-consent').hidden, true);
});
test('invalid stored choice asks again without tracking', () => {
  const w = setup('invalid');
  assert.equal(w.tracked, undefined);
  assert.equal(w.document.querySelector('.cookie-consent').hidden, false);
});
test('every published page includes shared assets and no legacy notice or active analytics', () => {
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
    const doc = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8')).window.document;
    assert.equal(doc.querySelectorAll('script[src="cookie-consent.js"]').length, 1, file);
    assert.equal(doc.querySelectorAll('link[href="cookie-consent.css"]').length, 0, file);
    assert.equal(doc.querySelectorAll('#cookie-banner, [onclick="dismissCookie()"]').length, 0, file);
    for (const script of doc.scripts) {
      assert.doesNotMatch(script.src + script.textContent, /googletagmanager|google-analytics|gtag\(/i, file);
    }
  }
});

test('deferred consent script installs matching styles before displaying the banner', () => {
  const w = setup();
  const styles = w.document.querySelector('style[data-cookie-consent-styles]');
  assert.ok(styles);
  assert.equal(styles.textContent, fs.readFileSync(path.join(root, 'cookie-consent.css'), 'utf8'));
  assert.equal(w.document.querySelector('.cookie-consent').hidden, false);
});
