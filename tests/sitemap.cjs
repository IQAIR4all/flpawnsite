// Run with NODE_PATH pointing to jsdom: node --test tests/sitemap.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '../flpawnsite');
const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
for (const name of pages) {
  test(`${name} has one visible sitemap link in its footer`, () => {
    const dom = new JSDOM(fs.readFileSync(path.join(root, name), 'utf8'));
    try {
      const links = dom.window.document.querySelectorAll('footer a[href="sitemap.html"]');
      assert.equal(links.length, 1);
      assert.equal(links[0].textContent, 'Sitemap');
      assert.equal(links[0].closest('[hidden]'), null);
    } finally { dom.window.close(); }
  });
}
test('human-readable sitemap covers every public HTML page and has valid destinations', () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'sitemap.html'), 'utf8'));
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelector('link[rel="canonical"]').href, 'https://flpawn.com/sitemap.html');
    const links = [...doc.querySelectorAll('main a')];
    for (const name of pages.filter(name => name !== 'sitemap.html')) {
      assert.ok(links.some(a => a.getAttribute('href') === name), name);
    }
    for (const a of links) {
      const [name, fragment] = a.getAttribute('href').split('#');
      assert.ok(fs.existsSync(path.join(root, name)), name);
      if (fragment) {
        const target = new JSDOM(fs.readFileSync(path.join(root, name), 'utf8'));
        try { assert.ok(target.window.document.getElementById(fragment), `${name}#${fragment}`); }
        finally { target.window.close(); }
      }
    }
    assert.equal(doc.querySelectorAll('main section').length, 5);
    assert.ok(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').includes('<loc>https://flpawn.com/sitemap.html</loc>'));
  } finally { dom.window.close(); }
});
