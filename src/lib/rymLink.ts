// Turning a Rate Your Music URL into something an iPhone can actually open.
//
// The problem: as of iOS 26, Safari renders rateyourmusic.com *release* pages
// (/release/album, /release/ep, /release/mixtape) as permanent blank pages.
// Reproduced on two separate iPhones, and it happens even when the URL is
// pasted straight into the address bar — so it is nothing to do with how
// RYMine navigates. The RYM homepage loads fine; the release pages do not.
// The same URLs open correctly in Chrome for iOS.
//
// The workaround: on iOS only, hand RYM release URLs to Chrome using its
// documented URL scheme. Chrome for iOS registers `googlechrome://` and
// `googlechromes://`, which are just http:// and https:// with the scheme
// swapped — everything after it (host, path, query, hash) is carried across
// untouched.
//
//   https://rateyourmusic.com/release/album/alcest/spiritual-instinct
//   → googlechromes://rateyourmusic.com/release/album/alcest/spiritual-instinct
//
// Scope is deliberately narrow: only rateyourmusic.com URLs are rewritten,
// and only on iOS. Spotify, Apple Music, YouTube, Bandcamp and every internal
// RYMine link keep their normal behaviour everywhere.

const RYM_HOSTS = new Set(['rateyourmusic.com', 'www.rateyourmusic.com']);

const HTTPS_SCHEME = /^https:\/\//i;
const HTTP_SCHEME = /^http:\/\//i;

/** True only for http(s) URLs pointing at rateyourmusic.com. */
export function isRymUrl(url: string): boolean {
	try {
		const u = new URL(url);
		if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
		return RYM_HOSTS.has(u.hostname.toLowerCase());
	} catch {
		return false;
	}
}

/**
 * Swap an http(s) scheme for Chrome for iOS's equivalent. We slice off just
 * the scheme rather than rebuilding via `URL`, so the path, query string and
 * hash survive byte-for-byte (RYM slugs contain percent-encoded non-ASCII
 * that a round-trip through `URL` could re-normalise).
 *
 * Anything that isn't http(s) — a `spotify:` or `music:` app URL, say — is
 * returned unchanged.
 */
export function chromeSchemeUrl(url: string): string {
	if (HTTPS_SCHEME.test(url)) return 'googlechromes://' + url.replace(HTTPS_SCHEME, '');
	if (HTTP_SCHEME.test(url)) return 'googlechrome://' + url.replace(HTTP_SCHEME, '');
	return url;
}

/**
 * The href a RYM link should use. On iOS that's the Chrome scheme; everywhere
 * else — and for any non-RYM URL — it's the original URL untouched.
 */
export function rymHref(url: string, ios: boolean): string {
	if (!ios || !isRymUrl(url)) return url;
	return chromeSchemeUrl(url);
}
