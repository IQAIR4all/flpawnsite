// Run with NODE_PATH pointing to installed playwright: node --test tests/gtm.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '../flpawnsite');
const container = 'GTM-KN29LHSR';
const key = 'fp_cookie_consent_v1';
async function setup() {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const context = await browser.newContext();
  const requests = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'www.googletagmanager.com') {
      requests.push(url.href);
      return route.fulfill({ contentType: 'text/javascript', body: 'window.gtmTestLoaded = true;' });
    }
    if (url.hostname !== 'gtm.test') return route.abort();
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!fs.existsSync(file)) return route.abort();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
  });
  return { browser, context, requests, page: await context.newPage() };
}

test('all published pages request exactly the uploaded GTM container only after acceptance', async () => {
  const { browser, page, requests } = await setup();
  try {
    for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
      await page.goto(`http://gtm.test/${file}`);
      await page.evaluate(key => localStorage.clear(), key);
      await page.reload();
      // The homepage promotion must not obstruct the consent controls under test.
      await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(el => el.close()));
      const before = requests.length;
      assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0, file);
      assert.equal(await page.locator('iframe[src*="googletagmanager.com"]').count(), 0, file);
      await page.locator('[data-choice="rejected"]').click();
      assert.equal(requests.length, before, file);
      await page.locator('.cookie-settings').click();
      await page.locator('[data-choice="accepted"]').click();
      await page.waitForFunction(() => window.gtmTestLoaded === true);
      assert.equal(requests.length, before + 1, file);
      assert.equal(requests.at(-1), `https://www.googletagmanager.com/gtm.js?id=${container}`, file);
      const consent = await page.evaluate(() => dataLayer.filter(row => row[0] === 'consent').map(row => [row[1], row[2]]));
      assert.deepEqual(consent, [
        ['default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }],
        ['update', { analytics_storage: 'granted' }],
      ], file);
      await page.locator('.cookie-settings').click();
      await page.locator('[data-choice="accepted"]').click();
      assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 1, file);
      await page.evaluate(() => localStorage.clear());
    }
  } finally { await browser.close(); }
});

test('returning choice, withdrawal and disabled storage honor tracking controls', async () => {
  const { browser, page, requests, context } = await setup();
  try {
    await page.goto('http://gtm.test/blog.html');
    await page.locator('[data-choice="accepted"]').click();
    await page.waitForFunction(() => window.gtmTestLoaded === true);
    await page.reload();
    await page.waitForFunction(() => window.gtmTestLoaded === true);
    assert.equal(requests.length, 2);
    await page.locator('.cookie-settings').click();
    await Promise.all([page.waitForEvent('load'), page.locator('[data-choice="rejected"]').click()]);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), 'rejected');
    assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
    assert.equal(requests.length, 2);
    await page.reload();
    assert.equal(requests.length, 2);
    await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
    await page.reload();
    await page.locator('[data-choice="rejected"]').click();
    assert.equal(requests.length, 2);
    await page.locator('.cookie-settings').click();
    await page.locator('[data-choice="accepted"]').click();
    await page.waitForFunction(() => window.gtmTestLoaded === true);
    assert.equal(requests.length, 3);
  } finally { await browser.close(); }
});
