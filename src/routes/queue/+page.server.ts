import type { WishlistAlbum } from '$lib/types';
import { loadWishlistData, type WishlistAlbumView } from '$lib/server/wishlist';
import type { PageServerLoad } from './$types';

// `enrichedAt` is the authoritative signal: it's set whenever the bookmarklet
// successfully ran on the release page. Some releases legitimately have no
// descriptors / no secondary genres / no average rating on RYM, so we don't
// keep nagging the user about them — re-running wouldn't change anything.
// The row-level "missing X" chips on the page are still informational.
function isUnenriched(a: WishlistAlbum): boolean {
	return !a.enrichedAt;
}

export const load: PageServerLoad = async () => {
	const data = await loadWishlistData();
	const all = data.albums;
	const unenriched = all.filter(isUnenriched);
	// Sort: albums never enriched first, then by artist for stable ordering.
	unenriched.sort((a, b) => {
		const aEnriched = a.enrichedAt ? 1 : 0;
		const bEnriched = b.enrichedAt ? 1 : 0;
		if (aEnriched !== bEnriched) return aEnriched - bEnriched;
		return a.artist.localeCompare(b.artist);
	});

	// "Recently enriched" — top 5 by enrichedAt desc.
	const recentlyEnriched: WishlistAlbumView[] = all
		.filter((a) => a.enrichedAt)
		.slice()
		.sort((a, b) => (b.enrichedAt ?? '').localeCompare(a.enrichedAt ?? ''))
		.slice(0, 5);

	return {
		total: all.length,
		unenriched,
		recentlyEnriched,
		source: data.source
	};
};
