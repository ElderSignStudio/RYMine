// Publish pipeline shared between sender (local) and receiver (hosted).
//
//   - validatePublishPayload() rejects obviously malformed payloads BEFORE we
//     touch the on-disk wishlist file (or remote storage). Same validator is
//     reused by the readonly remote-data fetcher so a bad commit on the data
//     repo can't poison the hosted viewer either.
//   - publishWishlist() runs only on the local writable instance. It reads
//     data/wishlist.json and dispatches to whichever backend the env points
//     at — GitHub Contents API (preferred) or the legacy Render /api/publish
//     direct push.

import type { WishlistAlbum } from '$lib/types';
import {
	CAN_SEND_PUBLISH,
	GITHUB_CONFIG,
	PUBLISH_BACKEND,
	PUBLISH_URL,
	publishTokenForSending
} from './appMode';
import { publishToGithub } from './githubStorage';
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

export type PublishBackendUsed = 'github' | 'render';
export type PublishOutcome =
	| {
			ok: true;
			albums: number;
			publishedAt: string;
			backend: PublishBackendUsed;
			destination: string;
	  }
	| { ok: false; error: string; status?: number };

/**
 * Read the local wishlist file and push it through the configured backend.
 * Dispatches to GitHub or Render based on `PUBLISH_BACKEND` (env-resolved at
 * boot). The actual secrets stay inside the backend helpers — this function
 * never returns them in the outcome, never logs them.
 */
export async function publishWishlist(): Promise<PublishOutcome> {
	if (!CAN_SEND_PUBLISH) {
		return {
			ok: false,
			error:
				'Publish is not configured. Either set GitHub vars (RYMINE_GITHUB_OWNER, RYMINE_GITHUB_REPO, RYMINE_GITHUB_TOKEN) or Render vars (RYMINE_PUBLISH_URL + RYMINE_PUBLISH_TOKEN) in the local app .env, then restart.'
		};
	}

	const local = await readWishlistFile();
	if (!local) {
		return {
			ok: false,
			error: 'No local wishlist to publish (data/wishlist.json missing or invalid).'
		};
	}

	if (PUBLISH_BACKEND === 'github') {
		const result = await publishToGithub(local);
		if (!result.ok) return { ok: false, error: result.error, status: result.status };
		return {
			ok: true,
			backend: 'github',
			destination: `${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`,
			albums: result.albums,
			publishedAt: result.publishedAt
		};
	}

	// PUBLISH_BACKEND === 'render' — the legacy direct-to-Render flow. Kept as
	// a fallback until the GitHub pipeline is fully verified in production.
	return await publishToRender(local);
}

async function publishToRender(local: WishlistFile): Promise<PublishOutcome> {
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

	const destination = (() => {
		try {
			return new URL(PUBLISH_URL).host;
		} catch {
			return PUBLISH_URL;
		}
	})();

	return {
		ok: true,
		backend: 'render',
		destination,
		albums: typeof okBody.albums === 'number' ? okBody.albums : local.albums.length,
		publishedAt:
			typeof okBody.publishedAt === 'string' ? okBody.publishedAt : new Date().toISOString()
	};
}

/**
 * Back-compat alias for the previous public name. New code should call
 * publishWishlist() instead.
 * @deprecated
 */
export const publishToRemote = publishWishlist;
