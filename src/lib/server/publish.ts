// Publish pipeline shared between sender (local) and receiver (hosted).
//
//   - validatePublishPayload() now lives in ./validateWishlist (re-exported
//     here for existing callers). It is shared with the readonly remote-data
//     fetcher, and keeping it in a pure module stops the read path importing
//     this file — and through it, node:fs.
//   - publishWishlist() runs only on the local writable instance. It reads
//     data/wishlist.json and dispatches to whichever backend the env points
//     at — GitHub Contents API (preferred) or the legacy Render /api/publish
//     direct push.

import {
	CAN_SEND_PUBLISH,
	GITHUB_CONFIG,
	PUBLISH_BACKEND,
	PUBLISH_URL,
	publishTokenForSending
} from './appMode';
import { publishToGithub } from './githubStorage';
import { readWishlistFile, type WishlistFile } from './wishlistStore';

export { validatePublishPayload } from './validateWishlist';

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
