import { buildBookmarkletHref, buildBookmarkletSource } from '$lib/server/bookmarklet';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const endpoint = `${url.origin}/api/import`;
	return {
		endpoint,
		origin: url.origin,
		source: buildBookmarkletSource(endpoint),
		href: buildBookmarkletHref(endpoint)
	};
};
