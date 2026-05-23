import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { WishlistAlbum } from '$lib/types';

// RYMINE_DATA_PATH lets the hosted readonly viewer point at a persistent
// disk mount (e.g. /var/data/wishlist.json on Render). Local development and
// the launcher continue to use ./data/wishlist.json by default — no env var
// needed for that. We resolve relative paths against cwd so the env value
// can be either absolute (production) or relative (a custom local layout).
const ROOT = process.cwd();
export const WISHLIST_PATH = process.env.RYMINE_DATA_PATH
	? path.resolve(ROOT, process.env.RYMINE_DATA_PATH)
	: path.join(ROOT, 'data', 'wishlist.json');
const DATA_DIR = path.dirname(WISHLIST_PATH);

export type WishlistFile = {
	lastScrapedAt: string;
	source: 'rym';
	albums: WishlistAlbum[];
};

export function normalizeUrl(url: string): string {
	try {
		const u = new URL(url);
		u.hash = '';
		u.search = '';
		u.pathname = u.pathname.replace(/\/+$/, '');
		u.hostname = u.hostname.toLowerCase();
		return u.toString();
	} catch {
		return url;
	}
}

export async function readWishlistFile(): Promise<WishlistFile | null> {
	if (!existsSync(WISHLIST_PATH)) return null;
	try {
		const raw = await readFile(WISHLIST_PATH, 'utf-8');
		const parsed = JSON.parse(raw) as WishlistFile;
		if (!Array.isArray(parsed.albums)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export async function writeWishlistFile(data: WishlistFile): Promise<void> {
	await mkdir(DATA_DIR, { recursive: true });
	const tmp = WISHLIST_PATH + '.tmp';
	await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
	await rename(tmp, WISHLIST_PATH);
}

export type MergeResult = {
	added: number;
	duplicates: number;
	datesRefreshed: number;
	coversRefreshed: number;
	artistsRefreshed: number;
	total: number;
};

export function mergeAlbums(
	existing: WishlistAlbum[],
	incoming: (Omit<WishlistAlbum, 'dateAdded'> & { dateAdded?: string })[],
	importedAt: string
): { albums: WishlistAlbum[]; result: MergeResult } {
	const byUrl = new Map<string, WishlistAlbum>();
	for (const a of existing) {
		byUrl.set(normalizeUrl(a.url), a);
	}

	let added = 0;
	let duplicates = 0;
	let datesRefreshed = 0;
	let coversRefreshed = 0;
	let artistsRefreshed = 0;
	for (const a of incoming) {
		const key = normalizeUrl(a.url);
		const prev = byUrl.get(key);
		if (prev) {
			duplicates += 1;
			// Even in merge-only mode, silently refresh dateAdded / coverUrl /
			// artist if the bookmarklet supplied fresh values. Title / year /
			// genres are still left alone — those only update during a Full
			// Sync. The `artist` refresh covers multi-artist collab albums
			// that used to be truncated to the first anchor's text.
			let next = prev;
			if (a.artist && a.artist !== prev.artist) {
				next = { ...next, artist: a.artist };
				artistsRefreshed += 1;
			}
			if (a.dateAdded && a.dateAdded !== prev.dateAdded) {
				next = { ...next, dateAdded: a.dateAdded };
				datesRefreshed += 1;
			}
			if (a.coverUrl && a.coverUrl !== prev.coverUrl) {
				next = { ...next, coverUrl: a.coverUrl };
				coversRefreshed += 1;
			}
			if (next !== prev) byUrl.set(key, next);
			continue;
		}
		// Prefer the RYM-extracted wishlist date when present; fall back to the
		// import timestamp for albums whose date couldn't be parsed.
		byUrl.set(key, { ...a, url: key, dateAdded: a.dateAdded ?? importedAt });
		added += 1;
	}

	const albums = [...byUrl.values()].sort((a, b) => a.artist.localeCompare(b.artist));
	return {
		albums,
		result: {
			added,
			duplicates,
			datesRefreshed,
			coversRefreshed,
			artistsRefreshed,
			total: albums.length
		}
	};
}
