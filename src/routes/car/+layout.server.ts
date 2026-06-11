// /car/* server load: just the wishlist + the current year. We re-read on
// every request rather than caching so the year flips automatically at
// midnight on Jan 1 and a fresh publish on the hosted viewer shows up
// without a restart. (The wishlist file is tiny — a couple hundred KB —
// so re-reading per request is fine.)

import { loadWishlistData } from '$lib/server/wishlist';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const wishlist = await loadWishlistData();
	return {
		...wishlist,
		currentYear: new Date().getFullYear()
	};
};
