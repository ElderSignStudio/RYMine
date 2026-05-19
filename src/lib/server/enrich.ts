import type { WishlistAlbum } from '$lib/types';

/**
 * The shape the enrichment bookmarklet POSTs to `/api/enrich`.
 *
 * Only `url` is required — every other field is optional. Fields the
 * bookmarklet could not extract (e.g. an unrated album whose `myRating` would
 * be 0) should be omitted from the payload entirely. We never *clear* an
 * existing stored value just because a particular run failed to extract it.
 */
export type EnrichmentInput = {
	url: string;
	largeCoverUrl?: string;
	coverUrl?: string;
	rymRating?: number;
	primaryGenres?: string[];
	secondaryGenres?: string[];
	descriptors?: string[];
	myRating?: number;
	sourceUrl?: string;
};

export type EnrichmentValidation =
	| { ok: true; input: EnrichmentInput }
	| { ok: false; error: string };

const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;

function dedup(arr: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const v of arr) {
		if (!seen.has(v)) {
			seen.add(v);
			out.push(v);
		}
	}
	return out;
}

function cleanStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const cleaned = value
		.filter((v): v is string => typeof v === 'string')
		.map((v) => v.trim())
		.filter(Boolean);
	if (cleaned.length === 0) return undefined;
	return dedup(cleaned);
}

export function validateEnrichmentPayload(raw: unknown): EnrichmentValidation {
	if (!raw || typeof raw !== 'object') {
		return { ok: false, error: 'Request body must be a JSON object.' };
	}
	const p = raw as Record<string, unknown>;

	const url = typeof p.url === 'string' ? p.url.trim() : '';
	if (!url || !HTTP_URL_RE.test(url)) {
		return { ok: false, error: '`url` must be an http(s) URL of an RYM release page.' };
	}

	const input: EnrichmentInput = { url };

	if (typeof p.largeCoverUrl === 'string') {
		const v = p.largeCoverUrl.trim();
		if (HTTP_URL_RE.test(v)) input.largeCoverUrl = v;
	}
	if (typeof p.coverUrl === 'string') {
		const v = p.coverUrl.trim();
		if (HTTP_URL_RE.test(v)) input.coverUrl = v;
	}

	// RYM ratings are in the 0–5 range. Accept floats.
	if (typeof p.rymRating === 'number' && Number.isFinite(p.rymRating)) {
		if (p.rymRating > 0 && p.rymRating <= 5) input.rymRating = p.rymRating;
	}
	if (typeof p.myRating === 'number' && Number.isFinite(p.myRating)) {
		// Treat zero / unrated as absence — never set 0.
		if (p.myRating > 0 && p.myRating <= 5) input.myRating = p.myRating;
	}

	const pri = cleanStringArray(p.primaryGenres);
	if (pri) input.primaryGenres = pri;
	const sec = cleanStringArray(p.secondaryGenres);
	if (sec) input.secondaryGenres = sec;
	const desc = cleanStringArray(p.descriptors);
	if (desc) input.descriptors = desc;

	if (typeof p.sourceUrl === 'string' && p.sourceUrl.trim()) {
		input.sourceUrl = p.sourceUrl.trim();
	}

	return { ok: true, input };
}

export type EnrichmentApplyResult = {
	album: WishlistAlbum;
	fieldsUpdated: string[];
};

function arraysShallowEqual(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

/**
 * Merges enrichment fields into an existing album.
 *
 * Conservative by design:
 * - We never clear an existing value when the payload omits a field — that
 *   way a failed extraction (e.g. RYM tweaks a class name) can't silently
 *   delete data we already collected.
 * - We preserve `genres` (the wishlist-row list). The detail page's
 *   `primaryGenres` / `secondaryGenres` live in separate fields so both
 *   are available.
 * - `enrichedAt` is always set (it's the record that this album was touched
 *   by an enrichment pass, even if nothing else changed).
 */
export function applyEnrichmentToAlbum(
	album: WishlistAlbum,
	input: EnrichmentInput,
	enrichedAt: string
): EnrichmentApplyResult {
	const updated: WishlistAlbum = { ...album };
	const fieldsUpdated: string[] = [];

	if (input.largeCoverUrl && input.largeCoverUrl !== album.largeCoverUrl) {
		updated.largeCoverUrl = input.largeCoverUrl;
		fieldsUpdated.push('largeCoverUrl');
	}
	if (input.coverUrl && input.coverUrl !== album.coverUrl) {
		updated.coverUrl = input.coverUrl;
		fieldsUpdated.push('coverUrl');
	}
	if (typeof input.rymRating === 'number' && input.rymRating !== album.rymRating) {
		updated.rymRating = input.rymRating;
		fieldsUpdated.push('rymRating');
	}
	if (input.primaryGenres && !arraysShallowEqual(input.primaryGenres, album.primaryGenres ?? [])) {
		updated.primaryGenres = input.primaryGenres;
		fieldsUpdated.push('primaryGenres');
	}
	if (
		input.secondaryGenres &&
		!arraysShallowEqual(input.secondaryGenres, album.secondaryGenres ?? [])
	) {
		updated.secondaryGenres = input.secondaryGenres;
		fieldsUpdated.push('secondaryGenres');
	}
	if (input.descriptors && !arraysShallowEqual(input.descriptors, album.descriptors ?? [])) {
		updated.descriptors = input.descriptors;
		fieldsUpdated.push('descriptors');
	}
	if (typeof input.myRating === 'number' && input.myRating !== album.myRating) {
		updated.myRating = input.myRating;
		fieldsUpdated.push('myRating');
	}

	updated.enrichedAt = enrichedAt;
	return { album: updated, fieldsUpdated };
}
