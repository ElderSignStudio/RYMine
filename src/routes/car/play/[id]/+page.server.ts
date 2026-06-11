import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Resolve the album by id against the parent layout's already-loaded wishlist.
// SvelteKit caches the layout load so we don't re-read the file here.
export const load: PageServerLoad = async ({ params, parent }) => {
	const { albums } = await parent();
	const album = albums.find((a) => a.id === params.id);
	if (!album) {
		throw error(404, 'Album not found in the local wishlist.');
	}
	return { album };
};
