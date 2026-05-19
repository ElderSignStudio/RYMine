import type { WishlistAlbum } from '$lib/types';
import { albumIdFromUrl } from '$lib/albumId';
import { mockAlbums, mockLastScrapedAt } from '$lib/mockData';
import { readWishlistFile } from './wishlistStore';

// Album shape used by the UI: the stored album plus a stable local ID so
// routes like /album/[id] don't need to deal with URL-encoded RYM paths.
export type WishlistAlbumView = WishlistAlbum & { id: string };

export type WishlistData = {
	albums: WishlistAlbumView[];
	lastScrapedAt: string;
	source: 'rym' | 'mock';
};

function attachIds(albums: WishlistAlbum[]): WishlistAlbumView[] {
	return albums.map((a) => ({ ...a, id: albumIdFromUrl(a.url) }));
}

export async function loadWishlistData(): Promise<WishlistData> {
	const file = await readWishlistFile();
	if (file && file.albums.length > 0) {
		return {
			albums: attachIds(file.albums),
			lastScrapedAt: file.lastScrapedAt,
			source: 'rym'
		};
	}
	return {
		albums: attachIds(mockAlbums),
		lastScrapedAt: mockLastScrapedAt,
		source: 'mock'
	};
}
