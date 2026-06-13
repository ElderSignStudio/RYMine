import type { WishlistAlbum } from '$lib/types';
import { albumIdFromUrl } from '$lib/albumId';
import { mockAlbums, mockLastScrapedAt } from '$lib/mockData';
import { IS_READONLY, REMOTE_DATA_URL } from './appMode';
import { fetchRemoteWishlist } from './remoteData';
import { readWishlistFile } from './wishlistStore';

// Album shape used by the UI: the stored album plus a stable local ID so
// routes like /album/[id] don't need to deal with URL-encoded RYM paths.
export type WishlistAlbumView = WishlistAlbum & { id: string };

// Where the on-screen data actually came from. Surfaced via /api/health so
// you can confirm the readonly viewer is pulling from the right source after
// a deploy. The UI doesn't render this directly.
export type DataSource = 'local-file' | 'remote-url' | 'mock' | 'empty';

export type WishlistData = {
	albums: WishlistAlbumView[];
	lastScrapedAt: string;
	// 'rym' vs 'mock' kept for the existing "mock data" badge in the UI.
	// The `dataSource` field below is the more operationally precise label.
	source: 'rym' | 'mock';
	dataSource: DataSource;
	cacheAgeSeconds: number | null;
};

function attachIds(albums: WishlistAlbum[]): WishlistAlbumView[] {
	return albums.map((a) => ({ ...a, id: albumIdFromUrl(a.url) }));
}

export async function loadWishlistData(): Promise<WishlistData> {
	// Readonly + remote URL configured: data of record lives on the public
	// GitHub raw URL. Cache + stale-while-error handled inside fetchRemote.
	if (IS_READONLY && REMOTE_DATA_URL) {
		const remote = await fetchRemoteWishlist();
		if (remote.data && remote.data.albums.length > 0) {
			return {
				albums: attachIds(remote.data.albums),
				lastScrapedAt: remote.data.lastScrapedAt,
				source: 'rym',
				dataSource: 'remote-url',
				cacheAgeSeconds: remote.cacheAgeSeconds
			};
		}
		// Remote reachable but empty (e.g. fresh data repo with []), OR remote
		// unreachable on cold start with no cache. Either way, surface a real
		// empty state rather than mock data — mock would lie about what the
		// hosted viewer is actually seeing.
		return {
			albums: [],
			lastScrapedAt: remote.data?.lastScrapedAt ?? '',
			source: 'rym',
			dataSource: 'empty',
			cacheAgeSeconds: remote.cacheAgeSeconds
		};
	}

	// Default path: filesystem. Used by local writable mode and by readonly
	// instances that haven't yet been given a remote URL (legacy setup).
	const file = await readWishlistFile();
	if (file && file.albums.length > 0) {
		return {
			albums: attachIds(file.albums),
			lastScrapedAt: file.lastScrapedAt,
			source: 'rym',
			dataSource: 'local-file',
			cacheAgeSeconds: null
		};
	}

	// In readonly without a remote URL and no file, fall back to "empty" —
	// don't show mock data on a hosted viewer.
	if (IS_READONLY) {
		return {
			albums: [],
			lastScrapedAt: '',
			source: 'rym',
			dataSource: 'empty',
			cacheAgeSeconds: null
		};
	}

	// Local mode dev convenience: when there's nothing on disk we show a
	// mock library so a fresh checkout has something to look at.
	return {
		albums: attachIds(mockAlbums),
		lastScrapedAt: mockLastScrapedAt,
		source: 'mock',
		dataSource: 'mock',
		cacheAgeSeconds: null
	};
}
