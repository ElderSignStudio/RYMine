// Date helpers shared by the bookmarklet/HTML extraction path and the UI.

const MONTHS: Record<string, string> = {
	Jan: '01',
	Feb: '02',
	Mar: '03',
	Apr: '04',
	May: '05',
	Jun: '06',
	Jul: '07',
	Aug: '08',
	Sep: '09',
	Oct: '10',
	Nov: '11',
	Dec: '12'
};

/**
 * RYM wishlist rows render the inclusion date as e.g. "Oct 18 2025".
 *
 * The date column is laid out as three stacked elements (month / day / year).
 * Depending on the surrounding HTML those siblings may or may not have any
 * whitespace between them in the source — so the text extracted from the DOM
 * could be either "Oct 18 2025" *or* "Oct182025". We accept zero or more
 * non-word characters (whitespace, commas, hyphens, …) between the three
 * tokens. Returns undefined if no recognisable date is found.
 */
export function parseRymDate(s: string | null | undefined): string | undefined {
	if (!s) return undefined;
	const m = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\W*(\d{1,2})\W*(\d{4})\b/);
	if (!m) return undefined;
	const month = MONTHS[m[1]];
	const day = m[2].padStart(2, '0');
	const year = m[3];
	return `${year}-${month}-${day}`;
}

/**
 * Display formatter for the wishlist-added date. Accepts:
 *   - "YYYY-MM-DD" (new RYM-extracted form)
 *   - Full ISO timestamps (legacy, from when we used to stamp import-time)
 * Returns the user-locale short form (e.g. "Oct 18, 2025") or null on bad input.
 *
 * Parses the YYYY-MM-DD prefix as a local-time date so we never display the
 * previous day due to a UTC-midnight timezone shift.
 */
export function formatWishlistDate(iso: string | undefined): string | null {
	if (!iso) return null;
	const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}
