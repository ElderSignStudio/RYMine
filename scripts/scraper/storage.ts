import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { WishlistAlbum } from '../../src/lib/types.ts';
import { paths } from './config.ts';

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

export async function ensureDirs(): Promise<void> {
	await mkdir(paths.dataDir, { recursive: true });
	await mkdir(paths.authDir, { recursive: true });
	await mkdir(paths.profileDir, { recursive: true });
}

export async function loadWishlist(): Promise<WishlistFile | null> {
	if (!existsSync(paths.wishlistFile)) return null;
	try {
		const raw = await readFile(paths.wishlistFile, 'utf-8');
		const parsed = JSON.parse(raw) as WishlistFile;
		if (!Array.isArray(parsed.albums)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export async function saveWishlist(data: WishlistFile): Promise<void> {
	await ensureDirs();
	const tmp = paths.wishlistFile + '.tmp';
	await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
	await rename(tmp, paths.wishlistFile);
}

export class AlbumStore {
	private byUrl = new Map<string, WishlistAlbum>();

	constructor(existing: WishlistAlbum[] = []) {
		for (const album of existing) {
			this.byUrl.set(normalizeUrl(album.url), album);
		}
	}

	get size(): number {
		return this.byUrl.size;
	}

	has(url: string): boolean {
		return this.byUrl.has(normalizeUrl(url));
	}

	add(album: WishlistAlbum): 'added' | 'duplicate' {
		const key = normalizeUrl(album.url);
		if (this.byUrl.has(key)) return 'duplicate';
		this.byUrl.set(key, { ...album, url: key });
		return 'added';
	}

	values(): WishlistAlbum[] {
		return [...this.byUrl.values()].sort((a, b) => a.artist.localeCompare(b.artist));
	}
}

export async function writeDebugDump(name: string, content: string): Promise<string> {
	await mkdir(paths.debugDir, { recursive: true });
	const file = path.join(paths.debugDir, name);
	await writeFile(file, content, 'utf-8');
	return file;
}
