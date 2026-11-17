// Run with: NODE_PATH=<directory containing jsdom> node --test tests/analytics.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '../flpawnsite');

for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  test(`${file} loads Vercel Web Analytics once without blocking rendering`, () => {
    const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), { runScripts: 'outside-only' });
    try {
      const w = dom.window;
      const trackers = w.document.querySelectorAll('script[src="/_vercel/insights/script.js"]');
      assert.equal(trackers.length, 1);
      assert.equal(trackers[0].defer, true);
      assert.equal(trackers[0].type, '');
      assert.equal(trackers[0].parentElement, w.document.head);
      const bootstrap = trackers[0].previousElementSibling;
      assert.equal(bootstrap.tagName, 'SCRIPT');
      w.eval(bootstrap.textContent);
      w.va('event', { name: 'test' });
      assert.equal(w.vaq.length, 1);
      assert.equal(w.vaq[0][0], 'event');
      const existing = w.va;
      w.eval(bootstrap.textContent);
      assert.equal(w.va, existing);
      assert.equal(w.document.cookie, '');
    } finally { dom.window.close(); }
  });
}

test('published analytics disclosures describe the cookieless provider', () => {
  const policy = fs.readFileSync(path.join(root, 'privacy-policy.html'), 'utf8');
  assert.match(policy, /Vercel Web Analytics/);
  assert.match(policy, /does not use cookies/);
  assert.doesNotMatch(policy, /Google Analytics|retained by Google/);
});
