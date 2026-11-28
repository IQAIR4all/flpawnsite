const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { chromium } = require('playwright');
const root = path.join(__dirname, '../flpawnsite');
const origin = 'https://flpawn.com';
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html') && !f.startsWith('blog')).sort();
const urlFor = (file, lang) => `${origin}/${lang === 'en' ? '' : `${lang}/`}${file === 'index.html' ? '' : file}`;
for (const lang of ['en', 'es', 'ht']) {
  test(`${lang}: every non-blog page has reciprocal SEO links, working language links, and shared assets`, () => {
    assert.equal(pages.length, 19);
    for (const file of pages) {
      const html = fs.readFileSync(path.join(root, lang === 'en' ? '' : lang, file), 'utf8');
      const d = new JSDOM(html).window.document;
      assert.equal(d.documentElement.lang, lang, file);
      assert.equal(d.querySelector('meta[charset]').getAttribute('charset').toLowerCase(), 'utf-8');
      assert.equal(d.querySelector('link[rel="canonical"]').href, urlFor(file, lang));
      for (const alternate of ['en', 'es', 'ht', 'x-default']) {
        assert.equal(d.querySelector(`link[rel="alternate"][hreflang="${alternate}"]`).href, urlFor(file, alternate === 'x-default' ? 'en' : alternate));
      }
      assert.equal(d.querySelectorAll('.language-switcher a').length, 3);
      assert.equal(d.querySelector('.language-switcher a[aria-current]').lang, lang);
      for (const el of d.querySelectorAll('.language-switcher a')) {
        assert.equal(el.getAttribute('href'), new URL(urlFor(file, el.lang)).pathname);
      }
      if (lang === 'en') continue;
      assert.equal(d.querySelectorAll('script[src="/language.js"]').length, 1);
      assert.equal(d.querySelectorAll('script[src="/cookie-consent.js"]').length, 1);
      assert.equal(d.querySelectorAll('script[src="/_vercel/insights/script.js"]').length, 1);
      assert.equal(d.querySelectorAll('script[type="text/plain"][data-gtm-container]').length, 1);
      assert.ok(d.querySelector('meta[name="description"]').content);
      assert.ok(d.querySelector('.translation-notice a').href.endsWith(`/${lang}/terms-and-conditions.html`));
      const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
      assert.ok(sitemap.includes(`<loc>${urlFor(file, lang)}</loc>`));
      for (const el of d.querySelectorAll('[href],[src],[poster]')) for (const attr of ['href', 'src', 'poster']) {
        const value = el.getAttribute(attr);
        if (!value || /^(#|https?:|tel:|mailto:|data:)/.test(value) || value.startsWith('/_vercel/')) continue;
        const pathname = value.split(/[?#]/)[0];
        assert.ok(pathname.startsWith('/'), `${file}: relative asset ${value}`);
        const target = path.join(root, pathname, pathname.endsWith('/') ? 'index.html' : '');
        assert.ok(fs.existsSync(target), `${lang}/${file}: missing ${value}`);
        if (el.tagName === 'A' && pages.includes(path.basename(pathname)) && !el.closest('.language-switcher')) {
          assert.ok(pathname.startsWith(`/${lang}/`), `${file}: lost language at ${value}`);
        }
      }
      for (const script of d.querySelectorAll('script[type="application/ld+json"]')) JSON.parse(script.textContent);
    }
  });
}

test('Terms notice exists in all languages and blogs have no generated translations', () => {
  for (const lang of ['es', 'ht']) {
    const translations = require(`../translations/${lang}.json`);
    const source = fs.readFileSync(path.join(root, 'terms-and-conditions.html'), 'utf8');
    const d = new JSDOM(fs.readFileSync(path.join(root, lang, 'terms-and-conditions.html'), 'utf8')).window.document;
    const heading = 'Translations and Information Accuracy';
    assert.ok(source.includes(heading));
    assert.ok(d.body.textContent.includes(translations[heading]));
    assert.equal(fs.readdirSync(path.join(root, lang)).some(f => f.startsWith('blog')), false);
  }
});

async function browserPage(contextOptions = {}) {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const trackers = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'www.googletagmanager.com') {
      trackers.push(url.href);
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    }
    if (url.hostname !== 'languages.test') return route.abort();
    const file = path.join(root, url.pathname, url.pathname.endsWith('/') ? 'index.html' : '');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.abort();
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
  });
  return { browser, page, trackers };
}

test('language links work without JavaScript, including equivalent service and legal pages', async () => {
  const { browser, page } = await browserPage({ javaScriptEnabled: false });
  try {
    await page.goto('http://languages.test/es/pawn-loans.html');
    await page.locator('.language-switcher a[lang="ht"]').click();
    assert.ok(page.url().endsWith('/ht/pawn-loans.html'));
    assert.ok((await page.locator('h1').innerText()).length > 0);
    await page.goto('http://languages.test/ht/terms-and-conditions.html');
    await page.locator('.language-switcher a[lang="es"]').click();
    assert.ok(page.url().endsWith('/es/terms-and-conditions.html'));
    await page.locator('.language-switcher a[lang="en"]').click();
    assert.ok(page.url().endsWith('/terms-and-conditions.html'));
  } finally { await browser.close(); }
});

test('translated cookie choices preserve tracking controls and language navigation', async () => {
  const { browser, page, trackers } = await browserPage();
  try {
    for (const lang of ['es', 'ht']) {
      const strings = require(`../translations/${lang}.json`);
      await page.goto(`http://languages.test/${lang}/services.html`);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      assert.equal(await page.getByRole('region', { name: strings['Cookie preferences'] }).isVisible(), true);
      assert.equal(await page.locator('.cookie-consent a').getAttribute('href'), `/${lang}/privacy-policy.html`);
      const before = trackers.length;
      assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
      await page.getByRole('button', { name: strings.Reject, exact: true }).click();
      assert.equal(trackers.length, before);
      assert.equal(await page.evaluate(() => localStorage.getItem('fp_cookie_consent_v1')), 'rejected');
      await page.getByRole('button', { name: strings['Cookie settings'], exact: true }).click();
      await page.getByRole('button', { name: strings.Accept, exact: true }).click();
      await page.waitForFunction(() => !!document.querySelector('script[src*="googletagmanager.com"]'));
      assert.equal(await page.evaluate(() => localStorage.getItem('fp_cookie_consent_v1')), 'accepted');
      await page.locator(`.language-switcher a[lang="${lang === 'es' ? 'ht' : 'es'}"]`).click();
      assert.ok(page.url().endsWith(`/${lang === 'es' ? 'ht' : 'es'}/services.html`));
    }
  } finally { await browser.close(); }
});

test('all translated pages render at mobile and desktop widths with visible language navigation', async () => {
  const { browser, page } = await browserPage();
  try {
    await page.addInitScript(() => {
      localStorage.setItem('fp_cookie_consent_v1', 'rejected');
      sessionStorage.setItem('fp_homepage_promo_seen', '1');
    });
    const overflow = [];
    for (const lang of ['es', 'ht']) for (const file of pages) {
      await page.goto(`http://languages.test/${lang}/${file}`);
      // The pre-existing promotional dialog should not obscure layout checks.
      await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(el => el.close()));
      for (const width of [320, 375, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.locator('.language-switcher a').count(), 3);
        for (const link of await page.locator('.language-switcher a').all()) assert.ok(await link.isVisible());
        if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) overflow.push(`${lang}/${file} at ${width}`);
      }
    }
    assert.deepEqual(overflow, [], 'localized page overflow');
  } finally { await browser.close(); }
});
