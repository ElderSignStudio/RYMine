// URL-backed filter state for the album list. Storing filters in the URL gives
// us three things for free:
//   1. Pressing the browser Back button after opening an album restores the
//      previous list state (filters, sort, search) without any extra plumbing.
//   2. Reloading the page keeps the user where they were.
//   3. The URL can be bookmarked or shared (cosy little wishlist link).
//
// Layout + page components both read from `page.url.searchParams` and write
// through `buildFiltersURL` + `goto(..., { replaceState })`. There is no
// separate reactive store for these fields — the URL itself is the source of
// truth.

import { albumHasDescriptor, albumHasGenre } from './genres';
import type { WishlistAlbum } from './types';

export type AlbumSort = 'artist' | 'year' | 'added' | 'rymRating' | 'myRating';
export type SortDir = 'asc' | 'desc';

export interface AlbumFilters {
	genre: string | null;
	descriptor: string | null;
	query: string;
	sort: AlbumSort;
	dir: SortDir;
}

const ALL_SORTS: readonly AlbumSort[] = [
	'artist',
	'year',
	'added',
	'rymRating',
	'myRating'
] as const;

export const DEFAULT_FILTERS: AlbumFilters = {
	genre: null,
	descriptor: null,
	query: '',
	sort: 'artist',
	dir: 'asc'
};

export function parseFilters(sp: URLSearchParams): AlbumFilters {
	const sort = sp.get('sort');
	const dir = sp.get('dir');
	return {
		genre: sp.get('g') || null,
		descriptor: sp.get('d') || null,
		query: sp.get('q') ?? '',
		sort: (ALL_SORTS as readonly string[]).includes(sort ?? '')
			? (sort as AlbumSort)
			: DEFAULT_FILTERS.sort,
		dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_FILTERS.dir
	};
}

/**
 * Build a URL string with only the params that differ from defaults set,
 * keeping the bar visually tidy and the URL shareable.
 */
export function buildFiltersURL(filters: AlbumFilters, base: string = '/'): string {
	const sp = new URLSearchParams();
	if (filters.genre) sp.set('g', filters.genre);
	if (filters.descriptor) sp.set('d', filters.descriptor);
	if (filters.query) sp.set('q', filters.query);
	if (filters.sort !== DEFAULT_FILTERS.sort) sp.set('sort', filters.sort);
	if (filters.dir !== DEFAULT_FILTERS.dir) sp.set('dir', filters.dir);
	const qs = sp.toString();
	return qs ? `${base}?${qs}` : base;
}

export function withChanges(current: AlbumFilters, changes: Partial<AlbumFilters>): AlbumFilters {
	return { ...current, ...changes };
}

export function hasAnyFilter(f: AlbumFilters): boolean {
	return Boolean(f.genre || f.descriptor || f.query);
}

export function matchesQuery(album: WishlistAlbum, q: string): boolean {
	if (!q) return true;
	const needle = q.toLowerCase();
	return album.title.toLowerCase().includes(needle) || album.artist.toLowerCase().includes(needle);
}

/**
 * Apply any subset of the three filter axes. The omitted ones act as wildcards
 * so we can compute "albums matching descriptor+query" to drive the genre
 * sidebar's narrowing (and vice versa) without copy/pasting filter logic.
 *
 * Generic over the album row type so the page can pass a richer view (with
 * `id` etc.) and get the same view type back, not a stripped `WishlistAlbum`.
 */
export function filterAlbums<T extends WishlistAlbum>(
	albums: T[],
	opts: { genre?: string | null; descriptor?: string | null; query?: string }
): T[] {
	const query = (opts.query ?? '').trim();
	return albums.filter((a) => {
		if (opts.genre && !albumHasGenre(a, opts.genre)) return false;
		if (opts.descriptor && !albumHasDescriptor(a, opts.descriptor)) return false;
		if (query && !matchesQuery(a, query)) return false;
		return true;
	});
}
