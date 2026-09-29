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

export type YearCount = { year: number; count: number };

/**
 * Is this a release year we can filter on?
 *
 * Scraped data is not guaranteed clean — `year` can be missing entirely, or
 * arrive as null, NaN, 0, a float, or a string. Every year the UI offers and
 * every year the URL accepts goes through here, so none of that junk can
 * become a filter option or a bogus chip.
 *
 * The 1000–9999 range is a loose sanity bound, deliberately not tied to the
 * current year — this keeps working as albums from future years appear.
 */
export function isValidReleaseYear(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999;
}

/** The album's release year, or null when it doesn't have a usable one. */
export function albumReleaseYear(album: WishlistAlbum): number | null {
	return isValidReleaseYear(album.year) ? album.year : null;
}

/**
 * Release-year facet counts, newest first. Albums without a usable year are
 * skipped entirely, so they never produce an option — but note they are NOT
 * excluded from the album list unless a year is actually selected (see
 * `filterAlbums`).
 */
export function yearCounts(albums: WishlistAlbum[]): YearCount[] {
	const counts = new Map<number, number>();
	for (const album of albums) {
		const year = albumReleaseYear(album);
		if (year === null) continue;
		counts.set(year, (counts.get(year) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([year, count]) => ({ year, count }))
		.sort((a, b) => b.year - a.year);
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
