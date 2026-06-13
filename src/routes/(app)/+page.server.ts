import { fail } from '@sveltejs/kit';
import { assertWritableMode, CAN_SEND_PUBLISH } from '$lib/server/appMode';
import { processImport } from '$lib/server/import';
import { toggleAlbumOnDeck } from '$lib/server/onDeck';
import { publishWishlist } from '$lib/server/publish';
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
		assertWritableMode();
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
		assertWritableMode();
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
		assertWritableMode();
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
		assertWritableMode();
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
	},

	// Toggles the per-album "On Deck" marker — personal local metadata.
	// Idempotent: button reflects the new state from the writeback. Form sends
	// the album URL since that's the stable key in wishlistStore (album id in
	// the UI is derived from this URL).
	toggleOnDeck: async ({ request }) => {
		assertWritableMode();
		const form = await request.formData();
		const url = String(form.get('url') ?? '');
		const result = await toggleAlbumOnDeck(url);
		if (!result.ok) {
			return fail(400, { error: result.error });
		}
		return {
			onDeckToggled: true as const,
			url: result.url,
			onDeck: result.onDeck,
			onDeckAt: result.onDeckAt
		};
	},

	// Pushes the local wishlist file to the hosted readonly viewer. Only runs
	// in local mode (assertWritableMode + CAN_SEND_PUBLISH); the token is read
	// from env on the server and never crosses the wire to the client.
	publish: async () => {
		assertWritableMode();
		if (!CAN_SEND_PUBLISH) {
			return fail(400, {
				error:
					'Publish is not configured. Either set GitHub vars (RYMINE_GITHUB_OWNER, RYMINE_GITHUB_REPO, RYMINE_GITHUB_TOKEN) or legacy Render vars (RYMINE_PUBLISH_URL + RYMINE_PUBLISH_TOKEN) in this app .env, then restart.'
			});
		}

		const outcome = await publishWishlist();
		if (!outcome.ok) {
			return fail(outcome.status ?? 502, { error: outcome.error });
		}

		return {
			publishSuccess: true as const,
			albums: outcome.albums,
			publishedAt: outcome.publishedAt,
			// Backend-aware destination label. For GitHub: "owner/repo". For
			// Render: hostname only (no token, no path). Tokens never leave
			// the server — neither value here contains anything sensitive.
			destination: outcome.destination,
			backend: outcome.backend
		};
	}
};
