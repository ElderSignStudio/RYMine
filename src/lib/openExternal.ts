// Open an external URL in a way that survives iOS PWA standalone mode.
//
// The bug: when RYMine is installed to the iPhone home screen and launched
// as a standalone PWA, an `<a href="https://…" target="_blank">` click opens
// the URL in a special in-app webview rather than Safari proper. Most pages
// load fine there, but rateyourmusic.com fronts itself with a Cloudflare
// "verify you're human" interstitial that does a JS-based redirect after
// verification — and the redirect strands the in-app webview on a blank
// page. (Same code path works perfectly in regular Safari and on desktop.)
//
// The fix: detect iOS standalone PWA (`navigator.standalone === true`) and
// switch to a top-level same-window navigation instead. Because the URL is
// outside the PWA's manifest `scope` ("/"), iOS recognises it as off-app
// and punches the navigation out to Safari, which handles Cloudflare's
// challenge correctly and lands on the RYM page. The user returns to the
// PWA via the home-screen icon (same as any other "open in Safari" link).
//
// Everywhere else — regular iOS Safari, Android PWA, desktop browsers,
// installed desktop PWAs — `target="_blank"` already works, so the helper
// no-ops and the anchor's default behaviour wins.

export function openExternal(url: string, event?: Event): void {
	if (typeof window === 'undefined' || !url) return;
	const nav = window.navigator as Navigator & { standalone?: boolean };
	if (nav.standalone === true) {
		event?.preventDefault();
		window.location.href = url;
	}
}
