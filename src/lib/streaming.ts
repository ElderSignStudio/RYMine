// Display metadata for the streaming services we surface on the detail page.
// `order` is the iteration order the UI uses; keeping it as a tuple guarantees
// the same shape on home + detail + future surfaces.

import type { StreamingLinks } from './types';

export type StreamingKey = keyof StreamingLinks;

export const STREAMING_SERVICES: Record<StreamingKey, { label: string; dot: string }> = {
	spotify: { label: 'Spotify', dot: 'bg-emerald-500' },
	appleMusic: { label: 'Apple Music', dot: 'bg-rose-500' },
	youtube: { label: 'YouTube', dot: 'bg-red-500' },
	bandcamp: { label: 'Bandcamp', dot: 'bg-cyan-500' }
};

export const STREAMING_ORDER: readonly StreamingKey[] = [
	'spotify',
	'appleMusic',
	'youtube',
	'bandcamp'
] as const;

export function hasAnyStreamingLink(links: StreamingLinks | undefined | null): boolean {
	if (!links) return false;
	return STREAMING_ORDER.some((k) => Boolean(links[k]));
}

/**
 * Convert a stored web URL into the app-scheme URL that macOS hands off to
 * the native client when installed. Falls back to the original URL when no
 * conversion applies (or pattern doesn't match) so the button is never broken.
 *
 *   Spotify     https://open.spotify.com/<type>/<id>      → spotify:<type>:<id>
 *   Apple Music https://[geo.]music.apple.com/<path>      → music://music.apple.com/<path>
 *   YouTube     (no widely-installed macOS app)           → unchanged
 *   Bandcamp    (no widely-installed macOS app)           → unchanged
 *
 * If the relevant app isn't installed the OS prompts and the user can cancel.
 * We deliberately keep the stored value as the web URL — that's the portable
 * one we can always share / open elsewhere.
 */
export function appHref(service: StreamingKey, webUrl: string | undefined): string {
	if (!webUrl) return '';
	if (service === 'spotify') {
		const m = webUrl.match(
			/\bopen\.spotify\.com\/(track|album|artist|playlist|episode|show)\/([a-zA-Z0-9]+)/i
		);
		if (m) return `spotify:${m[1]}:${m[2]}`;
	} else if (service === 'appleMusic') {
		// Apple Music's app understands music.apple.com paths but not the geo.
		// routing subdomain RYM links to. Strip it before swapping schemes.
		const normalized = webUrl.replace(
			/^https?:\/\/geo\.music\.apple\.com/i,
			'https://music.apple.com'
		);
		if (/^https?:\/\/(?:music|itunes)\.apple\.com\//i.test(normalized)) {
			return normalized.replace(/^https?:/i, 'music:');
		}
	}
	return webUrl;
}
