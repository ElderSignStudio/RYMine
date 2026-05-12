import * as cheerio from 'cheerio';
import type { WishlistAlbum } from '$lib/types';

const RELEASE_TYPES =
	/\/release\/(album|ep|single|compilation|mixtape|video|dj-mix|bootleg|unauth|comp)\//i;
const RYM_ORIGIN = 'https://rateyourmusic.com';

function norm(s: string | null | undefined): string {
	return (s ?? '').replace(/\s+/g, ' ').trim();
}

function resolveUrl(href: string): string | null {
	try {
		return new URL(href, RYM_ORIGIN).href;
	} catch {
		return null;
	}
}

export type ParsedAlbum = Omit<WishlistAlbum, 'dateAdded'>;

export function parseWishlistHtml(html: string): ParsedAlbum[] {
	const $ = cheerio.load(html);
	const found = new Map<string, ParsedAlbum>();

	$('a[href*="/release/"]').each((_, el) => {
		const href = $(el).attr('href');
		if (!href || !RELEASE_TYPES.test(href)) return;

		const url = resolveUrl(href);
		if (!url) return;
		if (found.has(url)) return;

		const title = norm($(el).text());
		if (!title) return;

		const row = $(el)
			.closest(
				'tr, li, .or_q_albumartist, .collection_table_row, .release_list_item, .ui_list_main_item'
			)
			.first();
		const scope = row.length ? row : $(el).parent();

		const artistEl = scope.find('a[href*="/artist/"]').first();
		const artist = norm(artistEl.text());
		if (!artist) return;

		const rowText = norm(scope.text());
		const yearMatch = rowText.match(/\b(19|20)\d{2}\b/);
		const year = yearMatch ? Number.parseInt(yearMatch[0], 10) : undefined;

		const genres: string[] = [];
		const genreLinks = scope.find('a[href*="/genre/"], a[href*="/genres/"]');
		if (genreLinks.length > 0) {
			genreLinks.each((__, gEl) => {
				const g = norm($(gEl).text());
				if (g && !genres.includes(g)) genres.push(g);
			});
		} else {
			scope.find('.genre').each((__, gEl) => {
				const g = norm($(gEl).text());
				if (g && !genres.includes(g)) genres.push(g);
			});
		}

		found.set(url, { url, title, artist, year, genres });
	});

	return [...found.values()];
}
