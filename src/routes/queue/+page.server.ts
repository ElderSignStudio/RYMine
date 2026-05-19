import type { WishlistAlbum } from '$lib/types';
import { loadWishlistData, type WishlistAlbumView } from '$lib/server/wishlist';
import type { PageServerLoad } from './$types';

// An album is "missing details" if any of these are absent. We OR the checks
// so a partial enrichment (e.g. one where descriptors were empty on RYM)
// still surfaces in the queue — that way the user can re-run the bookmarklet
// if RYM later filled the field in.
function isUnenriched(a: WishlistAlbum): boolean {
	if (!a.enrichedAt) return true;
	if (typeof a.rymRating !== 'number') return true;
	if (!a.descriptors || a.descriptors.length === 0) return true;
	if (!a.secondaryGenres || a.secondaryGenres.length === 0) return true;
	return false;
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
