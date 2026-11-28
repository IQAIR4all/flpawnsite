// Run with NODE_PATH pointing to installed playwright: node --test tests/mca-article.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '../flpawnsite');

test('MCA article is reachable, fits small screens, and keeps its comparison scrollable', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'article.test') return route.abort();
      const file = path.join(root, url.pathname);
      if (!fs.existsSync(file)) return route.abort();
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    await page.goto('http://article.test/blog.html');
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.locator('a[href="blog-mca-vs-pawn.html"]').click();
    assert.match(page.url(), /\/blog-mca-vs-pawn.html$/);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('main article').count(), 1);
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      for (const width of [320, 375, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${colorScheme} ${width}px overflow`);
        for (const link of await page.locator('.site-header a').all()) assert.ok(await link.isVisible());
        const comparison = page.getByRole('region', { name: 'MCA and Florida Pawn loan comparison' });
        await comparison.scrollIntoViewIfNeeded();
        assert.equal(await comparison.locator('tbody tr').count(), 8);
        if (width < 540) {
          await comparison.focus();
          await comparison.evaluate(el => el.scrollLeft = 0);
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(() => document.querySelector('.table-scroll').scrollLeft > 0);
          assert.ok(await comparison.evaluate(el => el.scrollLeft > 0), 'comparison scrolls by keyboard');
        }
      }
    }
    for (const number of ['+19543537296', '+17549995626']) {
      assert.equal(await page.locator(`a[href="tel:${number}"]`).count(), 1);
    }
    await page.locator('.site-header a[href="blog.html"]').click();
    assert.match(page.url(), /\/blog.html$/);
  } finally {
    await browser.close();
  }
});
