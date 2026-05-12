import { fail } from '@sveltejs/kit';
import { parseWishlistHtml } from '$lib/server/parseWishlistHtml';
import { loadWishlistData } from '$lib/server/wishlist';
import {
	mergeAlbums,
	readWishlistFile,
	writeWishlistFile,
	type WishlistFile
} from '$lib/server/wishlistStore';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return loadWishlistData();
};

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

		const existing = (await readWishlistFile())?.albums ?? [];
		const now = new Date().toISOString();
		const { albums, result } = mergeAlbums(existing, incoming, now);

		const next: WishlistFile = {
			lastScrapedAt: now,
			source: 'rym',
			albums
		};
		await writeWishlistFile(next);

		return {
			success: true as const,
			files: files.length,
			parsed: parsedCount,
			added: result.added,
			duplicates: result.duplicates,
			total: result.total,
			errors
		};
	}
};
