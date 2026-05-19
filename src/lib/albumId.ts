// Deterministic stable ID for an album, derived from its normalized URL.
//
// FNV-1a 32-bit, base36-encoded → ~6 character IDs. With ~225 albums today
// (and headroom for many thousands), collision probability is effectively
// zero. The function is pure JS so it works identically server-side (in the
// SvelteKit load function) and in the browser, but in practice we only call
// it on the server when shaping the page data.

export function albumIdFromUrl(normalizedUrl: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < normalizedUrl.length; i++) {
		h ^= normalizedUrl.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(36).padStart(7, '0');
}
