// GET /api/health — public health probe for monitors (Render, uptime checks)
// and a sanity ping to confirm a fresh publish landed.
//
// Returns JSON only. No secrets, no env values, no file paths. Reachable
// without auth in readonly mode — wired through PUBLIC paths in the hook so
// uptime checkers don't need a session cookie.

import { json } from '@sveltejs/kit';
import { APP_MODE } from '$lib/server/appMode';
import { readWishlistFile } from '$lib/server/wishlistStore';
import type { RequestHandler } from './$types';

// Read once at module load. We don't want to import package.json directly
// (bundler quirks); the build pipeline can inject this via define later if
// desired, but for now a static label is enough for the health payload.
const APP_NAME = 'rymine';

export const GET: RequestHandler = async () => {
	const wishlist = await readWishlistFile();
	return json({
		ok: true,
		name: APP_NAME,
		mode: APP_MODE,
		hasData: wishlist !== null,
		albumCount: wishlist?.albums.length ?? 0,
		lastScrapedAt: wishlist?.lastScrapedAt ?? null
	});
};
