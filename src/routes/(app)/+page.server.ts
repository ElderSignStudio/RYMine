import { fail } from '@sveltejs/kit';
import { processImport } from '$lib/server/import';
import { parseWishlistHtml } from '$lib/server/parseWishlistHtml';
import { readWishlistFile } from '$lib/server/wishlistStore';
import {
	computePreview,
	deleteSyncSession,
	finalizeSyncSession,
	readSyncSession,
	startSyncSession
} from '$lib/server/syncStore';
import type { WishlistFile } from '$lib/server/wishlistStore';
import { writeWishlistFile } from '$lib/server/wishlistStore';
import type { Actions } from './$types';

// All page data (albums, sync session, …) is loaded by the (app) layout.
// This route only owns the form actions for the home page (which are also
// reachable from sibling routes via `action="/?/<name>"`).

export const actions: Actions = {
	import: async ({ request }) => {
		const formData = await request.formData();
		const files = formData
			.getAll('files')
			.filter((f): f is File => f instanceof File && f.size > 0);

		if (files.length === 0) {
			return fail(400, { error: 'No files selected.', files: 0, errors: [] as string[] });
		}

		const errors: string[] = [];
		const parsedByUrl = new Map<string, ReturnType<typeof parseWishlistHtml>[number]>();
		let parsedCount = 0;

		for (const file of files) {
			try {
				const html = await file.text();
				if (!/<html|<body|<table|<div/i.test(html)) {
					errors.push(`${file.name}: doesn't look like HTML.`);
					continue;
				}
				const albums = parseWishlistHtml(html);
				if (albums.length === 0) {
					errors.push(`${file.name}: no albums found.`);
					continue;
				}
				parsedCount += albums.length;
				for (const a of albums) {
					if (!parsedByUrl.has(a.url)) parsedByUrl.set(a.url, a);
				}
			} catch (err) {
				errors.push(`${file.name}: ${err instanceof Error ? err.message : 'parse error'}`);
			}
		}

		const incoming = [...parsedByUrl.values()];
		if (incoming.length === 0) {
			return fail(422, {
				error: 'No albums could be extracted from the selected files.',
				files: files.length,
				errors
			});
		}

		const outcome = await processImport(incoming);

		return {
			success: true as const,
			files: files.length,
			parsed: parsedCount,
			added: outcome.added,
			updated: outcome.updated,
			unchanged: outcome.unchanged,
			duplicates: outcome.duplicates,
			datesRefreshed: outcome.datesRefreshed,
			coversRefreshed: outcome.coversRefreshed,
			artistsRefreshed: outcome.artistsRefreshed,
			total: outcome.total,
			syncActive: outcome.sync.active,
			errors
		};
	},

	startSync: async () => {
		const existing = await readSyncSession();
		if (existing) {
			return fail(409, { error: 'A sync session is already active.' });
		}
		const current = (await readWishlistFile())?.albums ?? [];
		const session = await startSyncSession(current);
		return {
			syncStarted: true as const,
			syncId: session.syncId,
			initialCount: current.length
		};
	},

	finishSync: async () => {
		const session = await readSyncSession();
		if (!session) {
			return fail(400, { error: 'No active sync session to finish.' });
		}
		if (session.pageCount === 0 || session.seenUrls.length === 0) {
			return fail(400, {
				error:
					'Sync has not seen any albums yet. Import at least one wishlist page, or cancel the sync.'
			});
		}

		const current = (await readWishlistFile())?.albums ?? [];
		const preview = computePreview(session, current);
		const finalAlbums = finalizeSyncSession(session, current);

		const now = new Date().toISOString();
		const next: WishlistFile = { lastScrapedAt: now, source: 'rym', albums: finalAlbums };
		await writeWishlistFile(next);
		await deleteSyncSession();

		return {
			syncFinished: true as const,
			added: preview.added,
			updated: preview.updated,
			unchanged: preview.unchanged,
			removed: preview.removed,
			total: preview.total,
			pageCount: preview.pageCount,
			initialCount: preview.initialCount,
			removalPct: preview.removalPct
		};
	},

	cancelSync: async () => {
		const session = await readSyncSession();
		if (!session) {
			return fail(400, { error: 'No active sync session to cancel.' });
		}
		await deleteSyncSession();
		return {
			syncCancelled: true as const,
			pageCount: session.pageCount,
			seenCount: session.seenUrls.length
		};
	}
};
