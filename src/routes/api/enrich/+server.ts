import { json } from '@sveltejs/kit';
import { assertWritableMode } from '$lib/server/appMode';
import { applyEnrichmentToAlbum, validateEnrichmentPayload } from '$lib/server/enrich';
import {
	normalizeUrl,
	readWishlistFile,
	writeWishlistFile,
	type WishlistFile
} from '$lib/server/wishlistStore';
import type { RequestHandler } from './$types';

const CORS_HEADERS: Record<string, string> = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'POST, OPTIONS',
	'access-control-allow-headers': 'content-type',
	'access-control-max-age': '86400'
};

export const OPTIONS: RequestHandler = () => {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const POST: RequestHandler = async ({ request }) => {
	assertWritableMode();
	let payload: unknown;
	try {
		payload = JSON.parse(await request.text());
	} catch {
		return json(
			{ ok: false, error: 'Body is not valid JSON.' },
			{ status: 400, headers: CORS_HEADERS }
		);
	}

	const v = validateEnrichmentPayload(payload);
	if (!v.ok) {
		return json({ ok: false, error: v.error }, { status: 400, headers: CORS_HEADERS });
	}

	const file = await readWishlistFile();
	if (!file || file.albums.length === 0) {
		return json(
			{
				ok: false,
				error:
					'Local wishlist is empty. Import your wishlist first (click the RYMine Import bookmarklet on each wishlist page).'
			},
			{ status: 404, headers: CORS_HEADERS }
		);
	}

	const target = normalizeUrl(v.input.url);
	const idx = file.albums.findIndex((a) => normalizeUrl(a.url) === target);
	if (idx === -1) {
		return json(
			{
				ok: false,
				error:
					"This album isn't in your local wishlist yet. Add it via the wishlist import bookmarklet first, then re-run enrichment.",
				url: v.input.url,
				normalizedUrl: target
			},
			{ status: 404, headers: CORS_HEADERS }
		);
	}

	const now = new Date().toISOString();
	const { album: enriched, fieldsUpdated } = applyEnrichmentToAlbum(file.albums[idx], v.input, now);

	const newAlbums = file.albums.slice();
	newAlbums[idx] = enriched;
	const next: WishlistFile = {
		lastScrapedAt: now,
		source: 'rym',
		albums: newAlbums
	};
	await writeWishlistFile(next);

	return json(
		{
			ok: true,
			url: enriched.url,
			artist: enriched.artist,
			title: enriched.title,
			fieldsUpdated,
			enrichedAt: now
		},
		{ status: 200, headers: CORS_HEADERS }
	);
};
