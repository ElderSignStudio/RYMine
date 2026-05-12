import type { WishlistAlbum } from '$lib/types';
import { mockAlbums, mockLastScrapedAt } from '$lib/mockData';
import { readWishlistFile } from './wishlistStore';

export type WishlistData = {
	albums: WishlistAlbum[];
	lastScrapedAt: string;
	source: 'rym' | 'mock';
};

export async function loadWishlistData(): Promise<WishlistData> {
	const file = await readWishlistFile();
	if (file && file.albums.length > 0) {
		return {
			albums: file.albums,
			lastScrapedAt: file.lastScrapedAt,
			source: 'rym'
		};
	}
	return {
		albums: mockAlbums,
		lastScrapedAt: mockLastScrapedAt,
		source: 'mock'
	};
}
