import type { GenreCount, WishlistAlbum } from './types';

// Pull every genre RYM associates with the album, regardless of which slot
// it came from. We use a Set per album so an album that lists the same
// genre as both primary and secondary is counted once, not twice.
function albumGenres(album: WishlistAlbum): Set<string> {
	const out = new Set<string>();
	for (const g of album.genres ?? []) out.add(g);
	for (const g of album.primaryGenres ?? []) out.add(g);
	for (const g of album.secondaryGenres ?? []) out.add(g);
	return out;
}

export function genreCounts(albums: WishlistAlbum[]): GenreCount[] {
	const counts = new Map<string, number>();
	for (const album of albums) {
		for (const genre of albumGenres(album)) {
			counts.set(genre, (counts.get(genre) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * True when the album lists this genre under any slot (primary, secondary,
 * or the flat wishlist-row list). Used by the sidebar genre filter.
 */
export function albumHasGenre(album: WishlistAlbum, genre: string): boolean {
	if (album.genres?.includes(genre)) return true;
	if (album.primaryGenres?.includes(genre)) return true;
	if (album.secondaryGenres?.includes(genre)) return true;
	return false;
}

export type DescriptorCount = { name: string; count: number };

export function descriptorCounts(albums: WishlistAlbum[]): DescriptorCount[] {
	const counts = new Map<string, number>();
	for (const album of albums) {
		if (!album.descriptors) continue;
		const seen = new Set<string>();
		for (const d of album.descriptors) {
			if (seen.has(d)) continue;
			seen.add(d);
			counts.set(d, (counts.get(d) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function albumHasDescriptor(album: WishlistAlbum, descriptor: string): boolean {
	return album.descriptors?.includes(descriptor) ?? false;
}

export function formatLastScraped(iso: string | undefined): string {
	if (!iso) return 'never';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return 'never';
	return date.toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});
}
