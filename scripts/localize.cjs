// Generate static, crawlable translations. No translation API is called at build/runtime.
// Edit the English page and translation dictionaries, then run npm run localize.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const acorn = require('acorn');
const root = path.join(__dirname, '../flpawnsite');
const origin = 'https://flpawn.com';
const languages = { en: 'English', es: 'Español', ht: 'Kreyòl Ayisyen' };
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html') && !f.startsWith('blog')).sort();
const dictionaries = Object.fromEntries(['es', 'ht'].map(lang => [lang, require(`../translations/${lang}.json`)]));
const pageUrl = (file, lang) => `${origin}${lang === 'en' ? '/' : `/${lang}/`}${file === 'index.html' ? '' : file}`;
const hrefFor = (file, lang) => new URL(pageUrl(file, lang)).pathname;
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function translate(value, lang) {
  const text = value.trim();
  if (!text || !/[A-Za-z]/.test(text)) return value;
  if (!Object.hasOwn(dictionaries[lang], text)) throw new Error(`Missing ${lang} translation: ${text}`);
  return value.replace(text, dictionaries[lang][text]);
}
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(n => walk(n, fn));
    else if (value && typeof value === 'object') walk(value, fn);
  }
}
function alternates(file) {
  return Object.keys(languages).map(lang => `<link rel="alternate" hreflang="${lang}" href="${pageUrl(file, lang)}">`).join('\n') +
    `\n<link rel="alternate" hreflang="x-default" href="${pageUrl(file, 'en')}">`;
}
function selector(file, current) {
  return `<nav class="language-switcher" aria-label="${current === 'en' ? 'Language' : translate('Language', current)}">` +
    Object.entries(languages).map(([lang, label]) => `<a lang="${lang}" hreflang="${lang}" href="${hrefFor(file, lang)}"${lang === current ? ' aria-current="true"' : ''}>${label}</a>`).join(' <span aria-hidden="true">|</span> ') + '</nav>';
}
function rewriteUrl(value, lang) {
  if (!value || /^(#|tel:|mailto:|data:|javascript:)/i.test(value)) return value;
  let url;
  try { url = new URL(value, `${origin}/`); } catch { return value; }
  if (![origin, 'https://fla-pawn.com', 'http://flpawn.com', 'http://fla-pawn.com'].includes(url.origin)) return value;
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const pathname = pages.includes(file) ? hrefFor(file, lang) : url.pathname;
  return pathname + url.search + url.hash;
}
for (const file of pages) {
  const sourcePath = path.join(root, file);
  let english = fs.readFileSync(sourcePath, 'utf8');
  // Keep existing English markup intact apart from the requested navigation and SEO additions.
  english = english.replace(/<!-- language-links:start -->[\s\S]*?<!-- language-links:end -->\n?/g, '')
    .replace(/<nav class="language-switcher"[\s\S]*?<\/nav>\n?/g, '')
    .replace(/<link rel="canonical" href="[^"]+">/, `<link rel="canonical" href="${pageUrl(file, 'en')}">`)
    .replace(/(<meta property="og:url" content=")[^"]+/, `$1${pageUrl(file, 'en')}`);
  if (!/<meta\s+charset=/i.test(english)) english = english.replace('<html lang="en">', '<html lang="en">\n<meta charset="UTF-8">');
  english = english.replace('<title>', `<!-- language-links:start -->\n${alternates(file)}\n<link rel="stylesheet" href="/language-switcher.css">\n<script defer src="/language.js"></script>\n<!-- language-links:end -->\n<title>`);
  if (english.includes('<div class="util-bar"')) english = english.replace('<div class="util-bar"', selector(file, 'en') + '\n<div class="util-bar"');
  else if (english.includes('<body>')) english = english.replace('<body>', '<body>\n' + selector(file, 'en'));
  else if (english.includes('<nav class="nav"')) english = english.replace('<nav class="nav"', selector(file, 'en') + '\n<nav class="nav"');
  else throw new Error(`No language navigation insertion point: ${file}`);
  fs.writeFileSync(sourcePath, english);
  for (const lang of ['es', 'ht']) {
    const dom = new JSDOM(english);
    const d = dom.window.document;
    d.documentElement.lang = lang;
    d.querySelector('.language-switcher').outerHTML = selector(file, lang);
    const walker = d.createTreeWalker(d, 4);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest('script,style,noscript,svg,.language-switcher')) continue;
      node.textContent = translate(node.textContent, lang);
    }
    for (const el of d.querySelectorAll('*')) {
      for (const attr of ['alt', 'title', 'placeholder', 'aria-label']) {
        if (el.hasAttribute(attr) && !el.closest('.language-switcher')) el.setAttribute(attr, translate(el.getAttribute(attr), lang));
      }
    }
    for (const el of d.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]')) el.content = translate(el.content, lang);
    // Resolve assets from the site root and keep internal navigation in the chosen language.
    for (const el of d.querySelectorAll('[href],[src],[poster],[action]')) {
      if (el.closest('.language-switcher') || el.matches('link[hreflang],link[rel="canonical"]')) continue;
      for (const attr of ['href', 'src', 'poster', 'action']) if (el.hasAttribute(attr)) el.setAttribute(attr, rewriteUrl(el.getAttribute(attr), lang));
      if (el.matches('a') && /\/blog[^/]*\.html/.test(el.getAttribute('href') || '')) {
        el.setAttribute('hreflang', 'en');
        if (el.textContent.trim() === translate('Blog', lang)) el.textContent = translate('Blog (English)', lang);
      }
    }
    d.querySelector('link[rel="canonical"]').href = pageUrl(file, lang);
    const og = d.querySelector('meta[property="og:url"]');
    if (og) og.content = pageUrl(file, lang);
    for (const script of d.querySelectorAll('script')) {
      if (script.type === 'application/ld+json') {
        const data = JSON.parse(script.textContent);
        walk(data, node => {
          for (const key of ['description', 'text', 'name']) if (typeof node[key] === 'string' && Object.hasOwn(dictionaries[lang], node[key].trim())) node[key] = translate(node[key], lang);
          for (const key of ['url', '@id', 'item']) if (typeof node[key] === 'string') {
            const v = node[key];
            if (/^https?:\/\/(?:fla-pawn|flpawn)\.com/.test(v)) node[key] = origin + rewriteUrl(v, lang);
          }
          if (node['@type'] === 'WebPage') node.inLanguage = lang;
        });
        script.textContent = JSON.stringify(data).replaceAll('<', '\\u003c');
      } else if (/FP_S=|SCENES =/.test(script.textContent)) {
        const edits = [];
        walk(acorn.parse(script.textContent, { ecmaVersion: 'latest' }), node => {
          if (node.type !== 'Literal' || typeof node.value !== 'string') return;
          const replacement = Object.hasOwn(dictionaries[lang], node.value.trim()) ? translate(node.value, lang) : node.value.startsWith('images/') ? '/' + node.value : null;
          if (replacement !== null) edits.push({ start: node.start, end: node.end, value: JSON.stringify(replacement).replaceAll('<', '\\u003c') });
        });
        let code = script.textContent;
        for (const edit of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, edit.start) + edit.value + code.slice(edit.end);
        script.textContent = code;
      }
    }
    for (const el of d.querySelectorAll('[style]')) {
      if (el.style.display === 'grid' && el.style.gridTemplateColumns) el.classList.add('localized-grid');
    }
    const promotion = d.querySelector('#homepage-promo');
    if (promotion) {
      const caption = d.createElement('p');
      caption.className = 'promo-language-note';
      caption.textContent = translate('This promotional image is in English. Confirm current offers with Florida Pawn.', lang);
      promotion.appendChild(caption);
    }
    const note = d.createElement('aside');
    note.className = 'translation-notice';
    note.innerHTML = `<strong>${escape(translate('Translation notice', lang))}:</strong> ${escape(translate('Translations may contain errors. Confirm current information directly with Florida Pawn.', lang))} <a href="/${lang}/terms-and-conditions.html">${escape(translate('Read the translation notice', lang))}</a>`;
    const footer = d.querySelector('footer');
    if (footer) footer.before(note); else d.body.append(note);
    const directory = path.join(root, lang);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, file), dom.serialize() + '\n');
  }
}
// The browser needs only a small dictionary for dynamically-created UI, not the full translation catalog.
const uiKeys = ['Cookie preferences', 'Cookie settings', 'Optional analytics tags, including Google Tag Manager, are off unless you accept. You can reject them and still use this site.', 'Privacy Policy', 'Accept', 'Reject', 'Choose up to 3 JPG/PNG photos, each no larger than 1 MB.', 'Sending…', 'Your request was sent. We’ll contact you about your item.', 'We couldn’t confirm your request was sent. Please call us, or try again later.'];
const ui = Object.fromEntries(['es', 'ht'].map(lang => [lang, Object.fromEntries(uiKeys.map(text => [text, translate(text, lang)]))]));
fs.writeFileSync(path.join(root, 'language.js'), `// Generated by scripts/localize.cjs\n(function () {\n  'use strict';\n  var dictionaries = ${JSON.stringify(ui)};\n  var messages = dictionaries[document.documentElement.lang] || {};\n  window.fpText = function (text) { return messages[text] || text; };\n})();\n`);
// Preserve existing blog URLs; only non-blog pages gain translated equivalents.
const sitemapPath = path.join(root, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf8').replace(/\s*<!-- translated-pages:start -->[\s\S]*?<!-- translated-pages:end -->/g, '');
for (const file of pages) {
  const name = file === 'index.html' ? '' : file;
  sitemap = sitemap.replace(`<loc>https://fla-pawn.com/${name}</loc>`, `<loc>${pageUrl(file, 'en')}</loc>`);
  if (!sitemap.includes(`<loc>${pageUrl(file, 'en')}</loc>`)) {
    sitemap = sitemap.replace('</urlset>', `  <url><loc>${pageUrl(file, 'en')}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n</urlset>`);
  }
}
sitemap = sitemap.replace('</urlset>', `  <!-- translated-pages:start -->\n${['es', 'ht'].flatMap(lang => pages.map(file => `  <url><loc>${pageUrl(file, lang)}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`)).join('\n')}\n  <!-- translated-pages:end -->\n</urlset>`);
fs.writeFileSync(sitemapPath, sitemap);
fs.writeFileSync(path.join(root, 'robots.txt'), fs.readFileSync(path.join(root, 'robots.txt'), 'utf8').replace('https://fla-pawn.com/sitemap.xml', `${origin}/sitemap.xml`));
console.log(`Generated ${pages.length} pages per language (${pages.length * 2} translated pages).`);
