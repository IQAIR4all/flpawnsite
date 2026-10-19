// Run with: NODE_PATH=<directory containing jsdom> node --test tests/reel.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../flpawnsite/index.html'), 'utf8');
function setup() {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const w = dom.window;
  const timers = new Map();
  let id = 0;
  w.setInterval = fn => { timers.set(++id, fn); return id; };
  w.clearInterval = id => timers.delete(id);
  w.eval([...w.document.scripts].find(s => s.textContent.includes('const FP_S=')).textContent);
  return {
    w, timers,
    el: id => w.document.getElementById(id),
    handler(selector, attr = 'onclick') { w.eval(w.document.querySelector(selector).getAttribute(attr)); },
    advance(ticks) { for (let i = 0; i < ticks; i++) for (const fn of [...timers.values()]) fn(); }
  };
}
test('playback visits all four images, finishes, and replays', () => {
  const p = setup();
  try {
    const original = p.el('fpImg');
    p.handler('#fpStartOv');
    for (const [ticks, image, label] of [[71, 'process', 'HOW IT WORKS'], [80, 'expertise', 'WHY WE PAY MORE'], [80, 'closing', 'GET STARTED']]) {
      p.advance(ticks);
      assert.equal(p.el('fpImg'), original);
      assert.equal(original.getAttribute('src'), `images/reel-${image}.jpg`);
      assert.equal(p.el('fpTagLbl').textContent, label);
    }
    p.advance(80);
    assert.equal(p.el('fpTime').textContent, '00:30');
    assert.equal(p.timers.size, 0);
    assert.equal(p.el('fpEndOv').style.display, 'flex');
    p.handler('#fpEndOv');
    assert.equal(original.getAttribute('src'), 'images/reel-story.jpg');
    assert.equal(p.timers.size, 1);
  } finally { p.w.close(); }
});
test('scene buttons, navigation boundaries, restart and scrubbing work', () => {
  const p = setup();
  try {
    p.handler('[aria-label="Next scene"]');
    assert.equal(p.el('fpTagLbl').textContent, 'HOW IT WORKS');
    p.handler('[aria-label="Previous scene"]');
    p.handler('[aria-label="Previous scene"]');
    assert.equal(p.el('fpTagLbl').textContent, 'OUR STORY');
    p.handler('#fpCards button:nth-child(4)');
    p.handler('[aria-label="Next scene"]');
    assert.equal(p.el('fpTagLbl').textContent, 'GET STARTED');
    p.handler('[aria-label="Restart"]');
    assert.equal(p.el('fpTime').textContent, '00:00');
    p.handler('#fpPlayBtn');
    p.handler('#fpScrub', 'onpointerdown');
    assert.equal(p.timers.size, 0);
    p.el('fpScrub').value = '16';
    const input = p.el('fpScrub');
    p.w.Function(input.getAttribute('oninput')).call(input);
    assert.equal(p.el('fpTagLbl').textContent, 'WHY WE PAY MORE');
    p.advance(20);
    assert.equal(p.el('fpTime').textContent, '00:16');
    p.handler('#fpPlayBtn');
    assert.equal(p.timers.size, 1);
    p.advance(10);
    assert.equal(p.el('fpTime').textContent, '00:17');
  } finally { p.w.close(); }
});
