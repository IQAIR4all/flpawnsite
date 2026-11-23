// Run with: node --test tests/blog.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../flpawnsite');
for (const [name, title, next] of [
  ['blog-black-friday.html', 'Skip the Mall.<br>Shop Florida Pawn This Black Friday.', 'blog-pawn-loans-no-credit-check.html'],
  ['blog-pawn-loans-no-credit-check.html', 'Need Quick Cash? A Pawn Loan Requires No Credit Check', 'blog-power-tools.html'],
]) {
  const article = fs.readFileSync(path.join(root, name), 'utf8');

  test(`${name} is discoverable from the published blog and sitemap`, () => {
    const blog = fs.readFileSync(path.join(root, 'blog.html'), 'utf8');
    assert.equal(blog.split(`href="${name}"`).length - 1, 1);
    assert.ok(blog.indexOf(`href="${name}"`) < blog.indexOf(`href="${next}"`));
    const canonical = article.match(/rel="canonical" href="([^"]+)"/)[1];
    assert.equal(canonical, `https://flpawn.com/${name}`);
    assert.ok(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').includes(`<loc>${canonical}</loc>`));
  });

  test(`${name} has a main landmark, title, and valid internal page links`, () => {
    assert.match(article, /<main><article/);
    const heading = article.match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<\/?span[^>]*>/g, '');
    assert.equal(heading, title);
    assert.equal((article.match(/<h1>/g) || []).length, 1);
    assert.match(article, /<title>.+<\/title>/);
    assert.match(article, /<meta name="description" content="[^"]+">/);
    for (const [, href] of article.matchAll(/href="([^"]+)"/g)) {
      if (/^(https?:|tel:|mailto:|#)/.test(href)) continue;
      assert.ok(fs.existsSync(path.join(root, href.split('#')[0])), href);
    }
    for (const page of ['location-hollywood.html', 'location-margate.html']) {
      assert.ok(article.includes(`href="${page}" class="btn-`));
    }
  });
}

test('Black Friday update includes the supplied shopping sections and navigation links', () => {
  const article = fs.readFileSync(path.join(root, 'blog-black-friday.html'), 'utf8');
  for (const section of ['bf-hero', 'compare-grid', 'savings-banner', 'item-grid', 'loc-grid', 'faq']) {
    assert.ok(article.includes(`class="${section}"`), section);
  }
  for (const page of ['pawn-loans.html', 'jewelry-diamonds.html', 'watches.html', 'electronics.html', 'power-tools.html', 'gold-silver.html', 'how-it-works.html', 'blog-pawn-loans-no-credit-check.html']) {
    assert.ok(article.includes(`href="${page}"`), page);
  }
  for (const number of ['+19549222015', '+19549742055']) {
    assert.ok(article.includes(`href="tel:${number}"`));
  }
  for (const asset of article.matchAll(/(?:src|href)="([^"#]+\.(?:css|js))"/g)) {
    if (/^(https?:|\/)/.test(asset[1])) continue;
    assert.ok(fs.existsSync(path.join(root, asset[1])), asset[1]);
  }
});

for (const name of ['blog-electronics-pawn-value.html', 'blog-watches-holiday-gift.html', 'blog-layaway-holiday.html']) {
  test(`${name} is listed once, included in the sitemap, and has valid local links and shared assets`, () => {
    const article = fs.readFileSync(path.join(root, name), 'utf8');
    const blog = fs.readFileSync(path.join(root, 'blog.html'), 'utf8');
    const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    assert.equal(blog.split(`href="${name}"`).length - 1, 1);
    assert.equal(sitemap.split(`<loc>https://flpawn.com/${name}</loc>`).length - 1, 1);
    assert.ok(article.includes(`rel="canonical" href="https://flpawn.com/${name}"`));
    assert.equal((article.match(/<h1>/g) || []).length, 1);
    assert.match(article, /<main>\s*<article/);
    for (const asset of article.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(https?:|tel:|mailto:|#|\/)/.test(asset[1])) continue;
      assert.ok(fs.existsSync(path.join(root, asset[1].split('#')[0])), asset[1]);
    }
    for (const asset of ['cookie-consent.js', '/_vercel/insights/script.js']) {
      assert.equal(article.split(`src="${asset}"`).length - 1, 1);
    }
    assert.ok(article.includes('href="blog.html"'));
    assert.ok(!article.includes('blog-black-friday-shopping.html'));
  });
}

test('no-credit-check article includes the uploaded service and statute links', () => {
  const article = fs.readFileSync(path.join(root, 'blog-pawn-loans-no-credit-check.html'), 'utf8');
  for (const name of ['pawn-loans.html', 'jewelry-diamonds.html', 'electronics.html', 'watches.html', 'gold-silver.html', 'how-it-works.html', 'services.html']) {
    assert.ok(article.includes(`href="${name}"`), name);
  }
  assert.ok(article.includes('https://www.leg.state.fl.us/statutes/'));
});


test('layaway article preserves uploaded sections and uses current location details', () => {
  const article = fs.readFileSync(path.join(root, 'blog-layaway-holiday.html'), 'utf8');
  for (const section of ['lay-hero', 'steps', 'benefit-grid', 'compare-grid', 'item-grid', 'faq', 'loc-grid']) {
    assert.ok(article.includes(`class="${section}"`), section);
  }
  for (const detail of ['tel:+19543537296', 'tel:+17549995626', 'Mon–Fri 10AM–6PM · Sat 10AM–5PM · Sun closed', 'November 2026']) {
    assert.ok(article.includes(detail), detail);
  }
  assert.ok(!article.includes('style.css'));
  assert.ok(!article.includes('November 2024'));
  assert.ok(!article.includes('nav__toggle'));
});
