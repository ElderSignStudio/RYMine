# scripts/scraper/ — shelved

This was the initial Playwright-based RYM wishlist scraper. It is currently
**not wired up** (no npm scripts) because Rate Your Music sits behind a
Cloudflare "verify you are human" challenge that the headless / persistent-
profile flow couldn't reliably get past, and the project intentionally avoids
stealth plugins, proxies, and other anti-detection workarounds.

The code is kept here as a starting point if a future Playwright approach
becomes viable (e.g. an officially-supported export feature, or a different
auth model). For the current data path see the in-app
**Import HTML** flow and [src/lib/server/parseWishlistHtml.ts](../../src/lib/server/parseWishlistHtml.ts).
