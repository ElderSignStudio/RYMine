// Publish pipeline shared between sender (local) and receiver (hosted).
//
//   - validatePublishPayload() rejects obviously malformed payloads BEFORE we
//     touch the on-disk wishlist file, so a bad publish can never empty out
//     the hosted viewer.
//   - publishToRemote() runs only on the local writable instance: read the
//     local wishlist, POST it to the configured remote URL with the bearer
//     token, return a typed result.

import type { WishlistAlbum } from '$lib/types';
import { CAN_SEND_PUBLISH, PUBLISH_URL, publishTokenForSending } from './appMode';
import { readWishlistFile, type WishlistFile } from './wishlistStore';

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

export type PublishOutcome =
	| { ok: true; albums: number; publishedAt: string }
	| { ok: false; error: string; status?: number };

/**
 * Reads the local wishlist and POSTs it to the configured remote endpoint.
 * The token never leaves this server-side function — UI and client JS only
 * see the typed result.
 */
export async function publishToRemote(): Promise<PublishOutcome> {
	if (!CAN_SEND_PUBLISH) {
		return {
			ok: false,
			error:
				'Publish is not configured. Set RYMINE_PUBLISH_URL and RYMINE_PUBLISH_TOKEN in the local app .env, then restart.'
		};
	}

	const local = await readWishlistFile();
	if (!local) {
		return {
			ok: false,
			error: 'No local wishlist to publish (data/wishlist.json missing or invalid).'
		};
	}

	let response: Response;
	try {
		response = await fetch(PUBLISH_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${publishTokenForSending()}`
			},
			body: JSON.stringify(local)
		});
	} catch (err) {
		return {
			ok: false,
			error: `Network error reaching ${PUBLISH_URL}: ${err instanceof Error ? err.message : String(err)}`
		};
	}

	if (response.status === 401 || response.status === 403) {
		return {
			ok: false,
			status: response.status,
			error:
				'Hosted viewer rejected the publish token (HTTP ' +
				response.status +
				'). Check RYMINE_PUBLISH_TOKEN matches on both sides.'
		};
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return {
			ok: false,
			status: response.status,
			error: `Hosted viewer returned non-JSON (HTTP ${response.status}).`
		};
	}

	if (!response.ok) {
		const message =
			body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
				? body.error
				: `HTTP ${response.status}`;
		return { ok: false, status: response.status, error: `Publish failed: ${message}` };
	}

	const okBody = body as { ok?: boolean; albums?: number; publishedAt?: string; error?: string };
	if (!okBody.ok) {
		return { ok: false, error: okBody.error ?? 'Hosted viewer returned ok=false.' };
	}

	return {
		ok: true,
		albums: typeof okBody.albums === 'number' ? okBody.albums : local.albums.length,
		publishedAt:
			typeof okBody.publishedAt === 'string' ? okBody.publishedAt : new Date().toISOString()
	};
}
