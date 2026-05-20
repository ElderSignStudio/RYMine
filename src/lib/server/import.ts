import type { ParsedAlbum } from './parseWishlistHtml';
import {
	mergeAlbums,
	readWishlistFile,
	writeWishlistFile,
	type WishlistFile
} from './wishlistStore';
import { mergeAlbumsWithUpdate, readSyncSession, recordPageImport } from './syncStore';

export type ImportSyncInfo =
	| { active: false }
	| { active: true; pageCount: number; totalSeen: number };

export type ImportOutcome = {
	added: number;
	updated: number;
	unchanged: number;
	duplicates: number;
	datesRefreshed: number;
	coversRefreshed: number;
	artistsRefreshed: number;
	total: number;
	sync: ImportSyncInfo;
};

/**
 * Shared entry point for both the JSON API endpoint and the HTML upload form
 * action. Branches on whether a full-sync session is currently open:
 *
 * - No session: merge-only behavior (skip duplicates, never overwrite metadata).
 * - Active session: overwrite metadata on URL collision, preserve dateAdded,
 *   and record the URLs as "seen this sync."
 */
export async function processImport(incoming: ParsedAlbum[]): Promise<ImportOutcome> {
	const existing = (await readWishlistFile())?.albums ?? [];
	const session = await readSyncSession();
	const now = new Date().toISOString();

	if (session) {
		const r = mergeAlbumsWithUpdate(existing, incoming, now);
		const next: WishlistFile = { lastScrapedAt: now, source: 'rym', albums: r.albums };
		await writeWishlistFile(next);
		const updatedSession = (await recordPageImport(incoming.map((a) => a.url))) ?? session;
		return {
			added: r.added,
			updated: r.updated,
			unchanged: r.unchanged,
			duplicates: r.updated + r.unchanged,
			datesRefreshed: r.datesRefreshed,
			coversRefreshed: r.coversRefreshed,
			// In sync mode, an artist-name change shows up as an `updated` row
			// (it's in albumsDiffer), so there's no separate refresh counter.
			artistsRefreshed: 0,
			total: r.total,
			sync: {
				active: true,
				pageCount: updatedSession.pageCount,
				totalSeen: updatedSession.seenUrls.length
			}
		};
	}

	const r = mergeAlbums(existing, incoming, now);
	const next: WishlistFile = { lastScrapedAt: now, source: 'rym', albums: r.albums };
	await writeWishlistFile(next);
	return {
		added: r.result.added,
		updated: 0,
		unchanged: 0,
		duplicates: r.result.duplicates,
		datesRefreshed: r.result.datesRefreshed,
		coversRefreshed: r.result.coversRefreshed,
		artistsRefreshed: r.result.artistsRefreshed,
		total: r.result.total,
		sync: { active: false }
	};
}
