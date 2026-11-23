// Run with NODE_PATH pointing to installed playwright: node --test tests/homepage-promo.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../flpawnsite');
const key = 'fp_black_friday_promo_seen_v1';
async function setup(options = {}) {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const context = await browser.newContext({ viewport: options.viewport || { width: 1280, height: 800 } });
  if (options.blockStorage) await context.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage disabled'); } });
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'promo.test') return route.abort();
    if (options.stallAnalytics && url.pathname === '/_vercel/insights/script.js') return;
    if (options.failImage && url.pathname.endsWith('black-friday-popup.png')) return route.abort();
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!fs.existsSync(file)) return route.abort();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
  });
  const page = await context.newPage();
  await page.goto('http://promo.test/', { waitUntil: options.stallAnalytics ? 'commit' : 'load' });
  return { browser, page };
}

test('homepage popup displays once per session, focuses close, and restores browsing', async () => {
  const { browser, page } = await setup();
  try {
    const popup = page.getByRole('dialog', { name: 'Florida Pawn Black Friday promotion' });
    await popup.waitFor({ state: 'visible' });
    assert.equal(await popup.locator('img').evaluate(img => img.naturalWidth), 800);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('fp_black_friday_promo_seen_v1')), '1');
    assert.equal(await page.getByRole('button', { name: 'Close promotion' }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement === document.body || document.activeElement.closest('#homepage-promo') !== null), true);
    await page.getByRole('button', { name: 'Close promotion' }).click();
    await popup.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('homepage-promo-open')), false);
    await page.goto('http://promo.test/services.html');
    assert.equal(await page.locator('#homepage-promo').count(), 0);
    await page.goto('http://promo.test/');
    assert.equal(await popup.isVisible(), false);
    await page.reload();
    assert.equal(await popup.isVisible(), false);
  } finally { await browser.close(); }
});

for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 844 }, { width: 844, height: 375 }, { width: 1280, height: 800 }]) {
  test(`image and close control fit ${viewport.width}x${viewport.height}; Escape and backdrop dismiss`, async () => {
    const { browser, page } = await setup({ viewport });
    try {
      await page.locator('#homepage-promo[open]').waitFor();
      for (const selector of ['#homepage-promo', '#homepage-promo img', '#homepage-promo button']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${selector} outside viewport`);
      }
      assert.equal(await page.locator('#homepage-promo').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await page.keyboard.press('Escape');
      await page.locator('#homepage-promo').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => !document.documentElement.classList.contains('homepage-promo-open'));
      assert.equal(await page.locator('#homepage-promo').isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('homepage-promo-open')), false);
      await page.evaluate(key => sessionStorage.removeItem(key), key);
      await page.reload();
      await page.locator('#homepage-promo[open]').waitFor();
      await page.mouse.click(2, 2);
      await page.locator('#homepage-promo').waitFor({ state: 'hidden' });
    } finally { await browser.close(); }
  });
}

test('disabled session storage does not break showing or dismissing', async () => {
  const { browser, page } = await setup({ blockStorage: true });
  try {
    await page.locator('#homepage-promo[open]').waitFor();
    await page.getByRole('button', { name: 'Close promotion' }).click();
    assert.equal(await page.locator('#homepage-promo').isVisible(), false);
  } finally { await browser.close(); }
});

test('failed promotional image leaves the homepage usable', async () => {
  const { browser, page } = await setup({ failImage: true });
  try {
    assert.equal(await page.locator('#homepage-promo').isVisible(), false);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('fp_black_friday_promo_seen_v1')), null);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('homepage-promo-open')), false);
  } finally { await browser.close(); }
});

test('only the deployed homepage includes popup assets', () => {
  for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const marker of ['homepage-promo.css', 'id="homepage-promo"']) {
      assert.equal(html.includes(marker), file === 'index.html', `${file}: ${marker}`);
    }
  }
});

test('popup does not wait for the analytics script to finish loading', async () => {
  const { browser, page } = await setup({ stallAnalytics: true });
  try {
    await page.locator('#homepage-promo[open]').waitFor({ timeout: 3000 });
    await page.getByRole('button', { name: 'Close promotion' }).click();
    assert.equal(await page.locator('#homepage-promo').isVisible(), false);
  } finally { await browser.close(); }
});
