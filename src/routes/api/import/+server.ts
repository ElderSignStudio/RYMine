import { json } from '@sveltejs/kit';
import type { ParsedAlbum } from '$lib/server/parseWishlistHtml';
import {
	mergeAlbums,
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
	let payload: unknown;
	try {
		const body = await request.text();
		payload = JSON.parse(body);
	} catch {
		return json(
			{ ok: false, error: 'Body is not valid JSON.' },
			{ status: 400, headers: CORS_HEADERS }
		);
	}

	const validation = validateImportPayload(payload);
	if (!validation.ok) {
		return json({ ok: false, error: validation.error }, { status: 400, headers: CORS_HEADERS });
	}

	const existing = (await readWishlistFile())?.albums ?? [];
	const now = new Date().toISOString();
	const { albums, result } = mergeAlbums(existing, validation.albums, now);

	const next: WishlistFile = { lastScrapedAt: now, source: 'rym', albums };
	await writeWishlistFile(next);

	return json(
		{
			ok: true,
			parsed: validation.albums.length,
			added: result.added,
			duplicates: result.duplicates,
			total: result.total,
			sourceUrl: validation.sourceUrl
		},
		{ status: 200, headers: CORS_HEADERS }
	);
};

type ValidationOk = { ok: true; albums: ParsedAlbum[]; sourceUrl?: string };
type ValidationErr = { ok: false; error: string };

function validateImportPayload(payload: unknown): ValidationOk | ValidationErr {
	if (!payload || typeof payload !== 'object') {
		return { ok: false, error: 'Request body must be a JSON object.' };
	}
	const p = payload as Record<string, unknown>;
	if (!Array.isArray(p.albums)) {
		return { ok: false, error: '`albums` must be an array.' };
	}
	if (p.albums.length === 0) {
		return { ok: false, error: '`albums` is empty.' };
	}

	const albums: ParsedAlbum[] = [];
	for (let i = 0; i < p.albums.length; i++) {
		const a = p.albums[i];
		if (!a || typeof a !== 'object') {
			return { ok: false, error: `albums[${i}] is not an object.` };
		}
		const obj = a as Record<string, unknown>;
		const url = typeof obj.url === 'string' ? obj.url.trim() : '';
		const title = typeof obj.title === 'string' ? obj.title.trim() : '';
		const artist = typeof obj.artist === 'string' ? obj.artist.trim() : '';
		if (!url || !/^https?:\/\//i.test(url)) {
			return { ok: false, error: `albums[${i}].url must be an http(s) URL.` };
		}
		if (!title) return { ok: false, error: `albums[${i}].title is required.` };
		if (!artist) return { ok: false, error: `albums[${i}].artist is required.` };

		const year =
			typeof obj.year === 'number' && Number.isFinite(obj.year) && obj.year > 1000
				? Math.trunc(obj.year)
				: undefined;

		const genresRaw = Array.isArray(obj.genres) ? obj.genres : [];
		const genres = genresRaw
			.filter((g): g is string => typeof g === 'string')
			.map((g) => g.trim())
			.filter((g, idx, arr) => g.length > 0 && arr.indexOf(g) === idx);

		albums.push({ url, title, artist, year, genres });
	}

	const sourceUrl =
		typeof p.sourceUrl === 'string' && p.sourceUrl.trim() ? p.sourceUrl.trim() : undefined;

	return { ok: true, albums, sourceUrl };
}
