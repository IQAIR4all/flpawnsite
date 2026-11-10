// Run with: node --test tests/blog.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../flpawnsite');
const name = 'blog-pawn-loans-no-credit-check.html';
const article = fs.readFileSync(path.join(root, name), 'utf8');

test('new article is discoverable from the published blog and sitemap', () => {
  const blog = fs.readFileSync(path.join(root, 'blog.html'), 'utf8');
  assert.equal(blog.split(`href="${name}"`).length - 1, 1);
  assert.ok(blog.indexOf(`href="${name}"`) < blog.indexOf('href="blog-power-tools.html"'));
  const canonical = article.match(/rel="canonical" href="([^"]+)"/)[1];
  assert.equal(canonical, `https://flpawn.com/${name}`);
  assert.ok(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').includes(`<loc>${canonical}</loc>`));
});

test('article has a main landmark, title, and valid internal page links', () => {
  assert.match(article, /<main><article/);
  assert.match(article, /<h1>Need Quick Cash\? A Pawn Loan Requires No Credit Check<\/h1>/);
  for (const [, href] of article.matchAll(/href="([^"]+)"/g)) {
    if (/^(https?:|tel:|mailto:|#)/.test(href)) continue;
    assert.ok(fs.existsSync(path.join(root, href.split('#')[0])), href);
  }
  for (const page of ['location-hollywood.html', 'location-margate.html']) {
    assert.ok(article.includes(`href="${page}" class="btn-`));
  }
});
