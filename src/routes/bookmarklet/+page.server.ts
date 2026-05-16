import { buildBookmarkletHref, buildBookmarkletSource } from '$lib/server/bookmarklet';
import type { PageServerLoad } from './$types';

// This app is local-only over plain HTTP loopback. SvelteKit's `url.origin`
// sometimes reports https (depending on adapter / proxy headers), so we
// reconstruct the origin from the host alone and force the http scheme.
// Any change here breaks the bookmarklet's hard-coded endpoint URL.
export const load: PageServerLoad = ({ url }) => {
	const origin = `http://${url.host}`;
	const endpoint = `${origin}/api/import`;
	return {
		endpoint,
		origin,
		source: buildBookmarkletSource(endpoint),
		href: buildBookmarkletHref(endpoint)
	};
};
