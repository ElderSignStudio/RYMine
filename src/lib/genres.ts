import type { GenreCount, WishlistAlbum } from './types';

export function genreCounts(albums: WishlistAlbum[]): GenreCount[] {
	const counts = new Map<string, number>();
	for (const album of albums) {
		for (const genre of album.genres) {
			counts.set(genre, (counts.get(genre) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => a.name.localeCompare(b.name));
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
