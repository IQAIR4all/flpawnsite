# Spanish and Haitian Creole pages

The 19 published, non-blog English HTML pages in `flpawnsite/` are the source of truth. Blogs (including their listing) remain English. The similarly named files outside that directory are not the Vercel project root.

## Updating translations

1. Update the English source page.
2. Update `es.json` and `ht.json`. Keys are exact, trimmed English text; values are the corresponding translations. Keep amounts, rates, loan conditions, addresses, phone numbers and product names intact. Keep split inline text coherent when read as one sentence.
3. Run `npm ci` at the repository root, then `npm run localize`.
4. Run `npm run test:languages` and `node --test tests/*.cjs` with Playwright Chromium installed (`npx playwright install chromium`). Review desktop/mobile previews and obtain fluent-speaker review, especially of financial and legal language.
5. Commit the source, dictionaries, generated locale HTML, generated small runtime UI dictionary, and sitemap together. Do not hand-edit generated locale pages.

Generation is offline and fails on missing translations. There are no translation API keys, paid translation scripts, runtime model calls, or automatic language redirects. Crawlers and visitors receive complete static HTML. Each page has a self-canonical, reciprocal en/es/ht and x-default alternates, and links to the equivalent page in each language. `/es/` and `/ht/` are the homepages. Blog links explicitly lead back to English.

The initial dictionaries are AI-generated drafts (OpenAI GPT-4.1 via Vercel AI Gateway) and have not been certified by a professional translator or legal counsel. The Terms notice is not a substitute for review. Review the Spanish and Haitian Creole Terms, privacy policy, FAQ, rates, fees, grace periods, forfeiture rules, and firearm restrictions before merging. Existing English business statements are translated as supplied, not independently fact-checked. Text embedded in existing promotional artwork is still English.

The shared cookie-consent implementation uses a small generated UI dictionary, keeps the original accepted/rejected storage values and consent gates, and links to the same-language privacy page. The language links are standard keyboard-accessible anchors, display native language names, and remain functional with JavaScript disabled. No browser-language guessing or forced redirection is used.
