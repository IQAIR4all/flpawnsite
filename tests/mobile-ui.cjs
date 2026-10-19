// Run with NODE_PATH pointing to installed playwright: node --test tests/mobile-ui.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
test('mobile contact actions, menu, consent and desktop visibility', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'mobile.test') return route.abort();
      const file = path.join(__dirname, '../flpawnsite', url.pathname === '/' ? 'index.html' : url.pathname);
      if (!fs.existsSync(file)) return route.abort();
      const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html';
      return route.fulfill({ body: fs.readFileSync(file), contentType });
    });
    await page.goto('http://mobile.test/');
    for (const width of [320, 375, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.locator('.mobile-actions').isVisible(), false);
    }
    await page.getByRole('button', {name: 'Reject', exact: true}).click();
    for (const width of [320, 375, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.locator('.mobile-actions').isVisible(), true);
      assert.equal(await page.locator('.hero__locs').isVisible(), true);
      assert.equal(await page.locator('#brand-film').evaluate(el => el.previousElementSibling.id), 'loan-request');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      await page.locator('.mobile-actions button').first().click();
      assert.equal(await page.locator('#storeChooser').evaluate(el => el.open), true);
      assert.equal(await page.locator('#storeChooser a').first().getAttribute('href'), 'tel:+19543537296');
      await page.keyboard.press('Escape');
      await page.getByRole('button', {name: 'Directions', exact: true}).click();
      assert.match(await page.locator('#storeChooser a').first().getAttribute('href'), /destination=1944/);
      await page.locator('#storeChooser button').click();
      await page.getByRole('button', {name: 'Open menu', exact: true}).click();
      assert.equal(await page.locator('.nav__menu-btn').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.nav__menu-btn').getAttribute('aria-expanded'), 'false');
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.locator('.mobile-actions').isVisible(), false);
    assert.equal(await page.locator('.mobile-hero-action').isVisible(), false);
    assert.equal(await page.locator('.nav__links').isVisible(), true);
    assert.equal(await page.locator('#brand-film').evaluate(el => el.nextElementSibling.id), 'services');
  } finally { await browser.close(); }
});
