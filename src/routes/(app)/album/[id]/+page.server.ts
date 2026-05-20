import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The (app) layout already loaded the full wishlist; we just pick the
// matching album out of `parent()` and 404 if it doesn't exist.
export const load: PageServerLoad = async ({ params, parent }) => {
	const layoutData = await parent();
	const album = layoutData.albums.find((a) => a.id === params.id);
	if (!album) {
		error(404, 'Album not found in your local wishlist.');
	}
	return { album };
};
