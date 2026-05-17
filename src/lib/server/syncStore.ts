import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { WishlistAlbum } from '$lib/types';
import type { ParsedAlbum } from './parseWishlistHtml';
import { normalizeUrl } from './wishlistStore';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const SESSION_PATH = path.join(DATA_DIR, 'sync-session.json');

export type SyncSession = {
	syncId: string;
	startedAt: string;
	lastUpdatedAt: string;
	pageCount: number;
	seenUrls: string[];
	initialAlbums: WishlistAlbum[];
};

export type SyncPreview = {
	added: number;
	updated: number;
	unchanged: number;
	removed: number;
	total: number;
	removalPct: number;
	initialCount: number;
	seenCount: number;
	pageCount: number;
};

export async function readSyncSession(): Promise<SyncSession | null> {
	if (!existsSync(SESSION_PATH)) return null;
	try {
		const raw = await readFile(SESSION_PATH, 'utf-8');
		const parsed = JSON.parse(raw) as SyncSession;
		if (!Array.isArray(parsed.seenUrls) || !Array.isArray(parsed.initialAlbums)) return null;
		return parsed;
	} catch {
		return null;
	}
}

async function writeSyncSession(session: SyncSession): Promise<void> {
	await mkdir(DATA_DIR, { recursive: true });
	const tmp = SESSION_PATH + '.tmp';
	await writeFile(tmp, JSON.stringify(session, null, 2) + '\n', 'utf-8');
	await rename(tmp, SESSION_PATH);
}

export async function deleteSyncSession(): Promise<void> {
	if (existsSync(SESSION_PATH)) {
		await rm(SESSION_PATH);
	}
}

export async function startSyncSession(initialAlbums: WishlistAlbum[]): Promise<SyncSession> {
	const now = new Date().toISOString();
	const session: SyncSession = {
		syncId: 's-' + Date.now().toString(36),
		startedAt: now,
		lastUpdatedAt: now,
		pageCount: 0,
		seenUrls: [],
		initialAlbums
	};
	await writeSyncSession(session);
	return session;
}

export async function recordPageImport(urls: string[]): Promise<SyncSession | null> {
	const session = await readSyncSession();
	if (!session) return null;
	const seen = new Set(session.seenUrls);
	for (const url of urls) seen.add(normalizeUrl(url));
	const updated: SyncSession = {
		...session,
		lastUpdatedAt: new Date().toISOString(),
		pageCount: session.pageCount + 1,
		seenUrls: [...seen]
	};
	await writeSyncSession(updated);
	return updated;
}

export type SyncMergeResult = {
	albums: WishlistAlbum[];
	added: number;
	updated: number;
	unchanged: number;
	datesRefreshed: number;
	total: number;
};

function genresEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function albumsDiffer(stored: WishlistAlbum, incoming: ParsedAlbum): boolean {
	if (stored.title !== incoming.title) return true;
	if (stored.artist !== incoming.artist) return true;
	if ((stored.year ?? null) !== (incoming.year ?? null)) return true;
	if (!genresEqual(stored.genres, incoming.genres)) return true;
	return false;
}

export function mergeAlbumsWithUpdate(
	existing: WishlistAlbum[],
	incoming: ParsedAlbum[],
	importedAt: string
): SyncMergeResult {
	const byUrl = new Map<string, WishlistAlbum>();
	for (const a of existing) {
		byUrl.set(normalizeUrl(a.url), a);
	}

	let added = 0;
	let updated = 0;
	let unchanged = 0;
	let datesRefreshed = 0;

	for (const inc of incoming) {
		const key = normalizeUrl(inc.url);
		const prev = byUrl.get(key);
		if (!prev) {
			byUrl.set(key, { ...inc, url: key, dateAdded: inc.dateAdded ?? importedAt });
			added += 1;
		} else if (albumsDiffer(prev, inc)) {
			byUrl.set(key, { ...inc, url: key, dateAdded: inc.dateAdded ?? prev.dateAdded });
			updated += 1;
		} else {
			// Metadata unchanged — but quietly refresh dateAdded if RYM provided
			// a real wishlist date and ours is missing/different (e.g. legacy
			// import-timestamp data). Doesn't count as "updated" in the summary.
			if (inc.dateAdded && inc.dateAdded !== prev.dateAdded) {
				byUrl.set(key, { ...prev, dateAdded: inc.dateAdded });
				datesRefreshed += 1;
			}
			unchanged += 1;
		}
	}

	const albums = [...byUrl.values()].sort((a, b) => a.artist.localeCompare(b.artist));
	return { albums, added, updated, unchanged, datesRefreshed, total: albums.length };
}

export function computePreview(session: SyncSession, current: WishlistAlbum[]): SyncPreview {
	const initialByUrl = new Map(session.initialAlbums.map((a) => [normalizeUrl(a.url), a] as const));
	const currentByUrl = new Map(current.map((a) => [normalizeUrl(a.url), a] as const));
	const seen = new Set(session.seenUrls);

	let added = 0;
	let updated = 0;
	let unchanged = 0;
	let removed = 0;

	for (const [url, cur] of currentByUrl) {
		if (!seen.has(url)) continue;
		const prev = initialByUrl.get(url);
		if (!prev) {
			added += 1;
		} else if (
			prev.title !== cur.title ||
			prev.artist !== cur.artist ||
			(prev.year ?? null) !== (cur.year ?? null) ||
			!genresEqual(prev.genres, cur.genres)
		) {
			updated += 1;
		} else {
			unchanged += 1;
		}
	}

	for (const url of initialByUrl.keys()) {
		if (!seen.has(url)) removed += 1;
	}

	const total = added + updated + unchanged;
	const initialCount = initialByUrl.size;
	const removalPct = initialCount > 0 ? Math.round((removed / initialCount) * 100) : 0;

	return {
		added,
		updated,
		unchanged,
		removed,
		total,
		removalPct,
		initialCount,
		seenCount: seen.size,
		pageCount: session.pageCount
	};
}

export function finalizeSyncSession(
	session: SyncSession,
	current: WishlistAlbum[]
): WishlistAlbum[] {
	const seen = new Set(session.seenUrls);
	return current.filter((a) => seen.has(normalizeUrl(a.url)));
}
