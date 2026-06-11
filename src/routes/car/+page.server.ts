// `surprise` form action: pick a random album from the wishlist (across the
// entire collection, NOT just On Deck — per spec) and 303-redirect to its
// play card. We use a form POST + 303 so the browser back-stack ends up:
//
//   /car → /car/play/<id>
//
// rather than landing on a "/car/random" URL that re-rolls on refresh /
// back navigation. The redirect's history entry replaces the form-submit
// target, so Back from the play card returns to /car cleanly.

import { error, redirect } from '@sveltejs/kit';
import { loadWishlistData } from '$lib/server/wishlist';
import type { Actions } from './$types';

export const actions: Actions = {
	surprise: async () => {
		const { albums } = await loadWishlistData();
		if (albums.length === 0) {
			throw error(404, 'No albums in the wishlist to surprise you with.');
		}
		const pick = albums[Math.floor(Math.random() * albums.length)];
		throw redirect(303, `/car/play/${pick.id}`);
	}
};
