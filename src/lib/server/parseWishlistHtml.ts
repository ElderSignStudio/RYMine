import * as cheerio from 'cheerio';
import type { WishlistAlbum } from '$lib/types';
import { parseRymDate } from '$lib/dates';

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

export type ParsedAlbum = Pick<
	WishlistAlbum,
	'artist' | 'title' | 'year' | 'url' | 'genres' | 'dateAdded' | 'coverUrl'
>;

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
			.closest('tr, li, .collection_table_row, .release_list_item, .ui_list_main_item')
			.first();
		const scope = row.length ? row : $(el).parent();

		const artistEl = scope.find('a[href*="/artist/"]').first();
		const artist = norm(artistEl.text());
		if (!artist) return;

		const rowText = norm(scope.text());

		// Release year: prefer years in parens (RYM's convention, e.g. "(1971)")
		// so we don't accidentally pick up the wishlist-added date's year first.
		const yearParen = rowText.match(/\(((?:19|20)\d{2})\)/);
		const yearAny = yearParen ? null : rowText.match(/\b(19|20)\d{2}\b/);
		const year = yearParen
			? Number.parseInt(yearParen[1], 10)
			: yearAny
				? Number.parseInt(yearAny[0], 10)
				: undefined;

		// Wishlist-added date — RYM renders this in the "Date / Rating" column
		// as "Oct 18 2025" etc. Try specific class hooks first, fall back to a
		// regex on the row's text content.
		let dateAdded: string | undefined;
		const dateEl = scope
			.find(
				'.or_q_wishlist_date, .or_q_wishlist_date_rating, .date_added, [class*=wishlist_date], [class*=date_added]'
			)
			.first();
		if (dateEl.length > 0) {
			dateAdded = parseRymDate(norm(dateEl.text()));
		}
		if (!dateAdded) {
			dateAdded = parseRymDate(rowText);
		}

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

		// Cover art — RYM wishlist rows have one <img> in the thumb cell.
		// Prefer the explicit thumb container, then fall back to the first
		// image in the row. RYM's src is often protocol-relative
		// ("//cdn.sonemic.net/..."), so resolve against rateyourmusic.com.
		let coverUrl: string | undefined;
		const coverImg = scope.find('.or_q_thumb_album img[src], img[src]').first();
		const src = coverImg.attr('src');
		if (src) {
			const resolved = resolveUrl(src);
			if (resolved && /^https?:\/\//i.test(resolved)) coverUrl = resolved;
		}

		found.set(url, { url, title, artist, year, genres, dateAdded, coverUrl });
	});

	return [...found.values()];
}
