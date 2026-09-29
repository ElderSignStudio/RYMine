// Shape validation for a wishlist payload — the one piece of the publish
// pipeline that both the WRITER and the READER need.
//
// It lives on its own rather than inside publish.ts for a deployment reason:
// the hosted readonly viewer validates the JSON it fetches from GitHub, and
// importing it from publish.ts used to drag the entire publish sender — and
// through it `node:fs` via wishlistStore — onto the read path. On Cloudflare
// there is no filesystem, and a read-only deployment has no business bundling
// the publishing code at all.
//
// Pure functions only. No I/O, no env, no Node built-ins.

import type { WishlistAlbum } from '$lib/types';
import type { WishlistFile } from './wishlistStore';

type ValidationOk = { ok: true; data: WishlistFile };
type ValidationErr = { ok: false; error: string };

/**
 * Shape check. We only require enough to browse — artist, title, url — and
 * pass everything else through untouched. The cost of being too strict here
 * is rejecting a legitimate publish; the cost of being too lax is corrupting
 * the file on disk, which is much worse, so when we accept we accept the
 * exact shape that's already on disk locally.
 */
export function validatePublishPayload(raw: unknown): ValidationOk | ValidationErr {
	if (!raw || typeof raw !== 'object')
		return { ok: false, error: 'Payload must be a JSON object.' };
	const candidate = raw as Partial<WishlistFile>;

	if (candidate.source !== 'rym') {
		return { ok: false, error: 'Payload `source` must be "rym".' };
	}
	if (typeof candidate.lastScrapedAt !== 'string' || candidate.lastScrapedAt.length === 0) {
		return { ok: false, error: 'Payload `lastScrapedAt` must be a non-empty string.' };
	}
	if (!Array.isArray(candidate.albums)) {
		return { ok: false, error: 'Payload `albums` must be an array.' };
	}

	const albums: WishlistAlbum[] = [];
	for (let i = 0; i < candidate.albums.length; i++) {
		const a = candidate.albums[i] as Partial<WishlistAlbum> | null | undefined;
		if (!a || typeof a !== 'object') {
			return { ok: false, error: `albums[${i}] is not an object.` };
		}
		if (typeof a.artist !== 'string' || a.artist.length === 0) {
			return { ok: false, error: `albums[${i}].artist must be a non-empty string.` };
		}
		if (typeof a.title !== 'string' || a.title.length === 0) {
			return { ok: false, error: `albums[${i}].title must be a non-empty string.` };
		}
		if (typeof a.url !== 'string' || a.url.length === 0) {
			return { ok: false, error: `albums[${i}].url must be a non-empty string.` };
		}
		// Pass-through: enriched fields (rymRating, descriptors, primaryGenres,
		// secondaryGenres, streamingLinks, myRating, coverUrl, etc.) keep
		// whatever shape they had on the source disk. We trust the sender — the
		// only sender is the local writable instance we control.
		albums.push(a as WishlistAlbum);
	}

	return {
		ok: true,
		data: {
			source: 'rym',
			lastScrapedAt: candidate.lastScrapedAt,
			albums
		}
	};
}
