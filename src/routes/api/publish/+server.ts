// POST /api/publish — receives a wishlist JSON from a local writable RYMine
// and overwrites the hosted viewer's wishlist file atomically.
//
// Auth: Authorization: Bearer <RYMINE_PUBLISH_TOKEN>. Token is verified
// constant-time; absence of token env on the server hard-rejects every
// request rather than failing open.
//
// Mode: only enabled when RYMINE_MODE=readonly AND RYMINE_PUBLISH_TOKEN is
// set (`CAN_RECEIVE_PUBLISH`). In local mode the endpoint pretends not to
// exist (404) since the local app is its own data source. The hook lets
// /api/publish through the readonly write-block so this handler runs.

import { json } from '@sveltejs/kit';
import { CAN_RECEIVE_PUBLISH, IS_READONLY, verifyPublishToken } from '$lib/server/appMode';
import { validatePublishPayload } from '$lib/server/publish';
import { writeWishlistFile } from '$lib/server/wishlistStore';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	// The local sender doesn't need a receiver endpoint on itself. Hide it.
	if (!IS_READONLY) {
		return json({ ok: false, error: 'Not found.' }, { status: 404 });
	}

	// Readonly but no token configured = the receiver was set up unsafely.
	// Refuse rather than silently accepting any publish.
	if (!CAN_RECEIVE_PUBLISH) {
		return json(
			{
				ok: false,
				error:
					'Publish endpoint not configured. Set RYMINE_PUBLISH_TOKEN on the hosted instance and restart.'
			},
			{ status: 503 }
		);
	}

	const authHeader = request.headers.get('authorization') ?? '';
	const token = authHeader.toLowerCase().startsWith('bearer ')
		? authHeader.slice('bearer '.length).trim()
		: null;

	if (!(await verifyPublishToken(token))) {
		// Don't say "wrong token" vs "missing token" — same response so a probe
		// can't tell whether the token field was present.
		return json({ ok: false, error: 'Invalid publish credentials.' }, { status: 401 });
	}

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
	}

	const v = validatePublishPayload(raw);
	if (!v.ok) {
		return json({ ok: false, error: v.error }, { status: 400 });
	}

	// Atomic write (temp file + rename) is handled inside writeWishlistFile,
	// so a crash mid-write cannot leave a half-written wishlist on disk.
	await writeWishlistFile(v.data);

	return json({
		ok: true,
		albums: v.data.albums.length,
		publishedAt: new Date().toISOString()
	});
};
