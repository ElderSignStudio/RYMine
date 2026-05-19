import { error } from '@sveltejs/kit';
import { loadWishlistData } from '$lib/server/wishlist';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const data = await loadWishlistData();
	const album = data.albums.find((a) => a.id === params.id);
	if (!album) {
		error(404, 'Album not found in your local wishlist.');
	}
	return { album, source: data.source };
};
