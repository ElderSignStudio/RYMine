// GET /api/health — public health probe for monitors (Render, uptime checks)
// and a sanity ping to confirm a fresh publish landed.
//
// Returns JSON only. No secrets, no env values, no file paths. Reachable
// without auth in readonly mode — wired through PUBLIC paths in the hook so
// uptime checkers don't need a session cookie. Reports the resolved
// `dataSource` so you can confirm Render is pulling from GitHub after a
// redeploy, plus `cacheAgeSeconds` to spot a stuck cache.

import { json } from '@sveltejs/kit';
import { APP_MODE, PUBLISH_BACKEND, REMOTE_DATA_URL } from '$lib/server/appMode';
import { loadWishlistData } from '$lib/server/wishlist';
import type { RequestHandler } from './$types';

const APP_NAME = 'rymine';

export const GET: RequestHandler = async () => {
	const data = await loadWishlistData();
	return json({
		ok: true,
		name: APP_NAME,
		mode: APP_MODE,
		dataSource: data.dataSource,
		cacheAgeSeconds: data.cacheAgeSeconds,
		remoteUrlConfigured: REMOTE_DATA_URL.length > 0,
		// The publish backend label only matters on the local writable side,
		// but it's safe to expose either way (it's an enum, not a secret).
		publishBackend: PUBLISH_BACKEND,
		hasData: data.albums.length > 0,
		albumCount: data.albums.length,
		lastScrapedAt: data.lastScrapedAt || null
	});
};
