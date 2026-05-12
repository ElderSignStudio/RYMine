import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { WishlistAlbum } from '$lib/types';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
export const WISHLIST_PATH = path.join(DATA_DIR, 'wishlist.json');

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
	total: number;
};

export function mergeAlbums(
	existing: WishlistAlbum[],
	incoming: Omit<WishlistAlbum, 'dateAdded'>[],
	dateAdded: string
): { albums: WishlistAlbum[]; result: MergeResult } {
	const byUrl = new Map<string, WishlistAlbum>();
	for (const a of existing) {
		byUrl.set(normalizeUrl(a.url), a);
	}

	let added = 0;
	let duplicates = 0;
	for (const a of incoming) {
		const key = normalizeUrl(a.url);
		if (byUrl.has(key)) {
			duplicates += 1;
			continue;
		}
		byUrl.set(key, { ...a, url: key, dateAdded });
		added += 1;
	}

	const albums = [...byUrl.values()].sort((a, b) => a.artist.localeCompare(b.artist));
	return { albums, result: { added, duplicates, total: albums.length } };
}
