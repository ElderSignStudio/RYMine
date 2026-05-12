import type { Page } from 'playwright';
import type { WishlistAlbum } from '../../src/lib/types.ts';

export type ExtractedAlbum = Omit<WishlistAlbum, 'dateAdded'> & { dateAdded?: string };

export async function extractAlbumsFromWishlistPage(page: Page): Promise<ExtractedAlbum[]> {
	return page.evaluate(() => {
		const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
		const RELEASE_TYPES =
			/\/release\/(album|ep|single|compilation|mixtape|video|dj-mix|bootleg|unauth|comp)\//i;

		const rows = new Map<
			string,
			{
				url: string;
				title: string;
				artist: string;
				year?: number;
				genres: string[];
			}
		>();

		const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/release/"]'));

		for (const link of links) {
			const href = link.href;
			if (!RELEASE_TYPES.test(href)) continue;

			const title = norm(link.textContent);
			if (!title) continue;

			const row =
				link.closest<HTMLElement>(
					'tr, li, .or_q_albumartist, .collection_table_row, .release_list_item, .ui_list_main_item'
				) ?? link.parentElement;

			let artist = '';
			let year: number | undefined;
			const genres: string[] = [];

			if (row) {
				const artistLink = row.querySelector<HTMLAnchorElement>('a[href*="/artist/"]');
				if (artistLink) artist = norm(artistLink.textContent);

				const rowText = norm(row.textContent);
				const yearMatch = rowText.match(/\b(19|20)\d{2}\b/);
				if (yearMatch) year = Number.parseInt(yearMatch[0], 10);

				const genreEls = row.querySelectorAll<HTMLElement>(
					'a[href*="/genre/"], a[href*="/genres/"], .genre'
				);
				for (const el of Array.from(genreEls)) {
					const g = norm(el.textContent);
					if (g && !genres.includes(g)) genres.push(g);
				}
			}

			if (!artist) continue;
			if (rows.has(href)) continue;
			rows.set(href, { url: href, title, artist, year, genres });
		}

		return Array.from(rows.values());
	});
}

export async function detectLoginState(
	page: Page
): Promise<{ loggedIn: boolean; username?: string }> {
	return page.evaluate(() => {
		const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
		const logoutLink = document.querySelector<HTMLAnchorElement>(
			'a[href*="/account/logout"], a[href*="logout"]'
		);
		if (!logoutLink) return { loggedIn: false };

		const userLink = document.querySelector<HTMLAnchorElement>(
			'a[href*="/~"], a[href*="/account/profile"], a[href*="/user/"]'
		);
		const username = userLink ? norm(userLink.textContent) : undefined;
		return { loggedIn: true, username };
	});
}

export async function detectBlock(page: Page): Promise<{ blocked: boolean; reason?: string }> {
	const status = page.url();
	const blockedKeywords =
		/(captcha|are you a human|just a moment|access denied|rate limit|too many requests|blocked)/i;

	const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
	if (blockedKeywords.test(bodyText)) {
		return { blocked: true, reason: `blocked-keywords on ${status}` };
	}
	return { blocked: false };
}

export async function findNextPageHref(page: Page, currentUrl: string): Promise<string | null> {
	return page.evaluate((current) => {
		const candidates = [
			...document.querySelectorAll<HTMLAnchorElement>('a[rel="next"]'),
			...document.querySelectorAll<HTMLAnchorElement>('a.navlinknext'),
			...Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).filter((a) =>
				/^next(\s|$|»)/i.test(a.textContent?.trim() ?? '')
			)
		];
		for (const a of candidates) {
			if (a.href && a.href !== current) return a.href;
		}
		return null;
	}, currentUrl);
}
