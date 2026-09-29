// Checks for the album filtering pipeline, with emphasis on the Release Year
// axis and how it combines with the existing genre / descriptor / search /
// On Deck constraints.
//
// Same style as checkRymLink.ts — a plain tsx script rather than a test
// framework, since these are pure functions over plain objects. Run with:
//
//   npm run check:filters

import assert from 'node:assert/strict';
import {
	buildFiltersURL,
	DEFAULT_FILTERS,
	filterAlbums,
	hasAnyFilter,
	parseFilters,
	withChanges,
	type AlbumFilters
} from '../src/lib/filters.ts';
import {
	albumReleaseYear,
	descriptorCounts,
	genreCounts,
	isValidReleaseYear,
	yearCounts
} from '../src/lib/genres.ts';
import type { WishlistAlbum } from '../src/lib/types.ts';

let passed = 0;
function check(name: string, fn: () => void): void {
	fn();
	passed += 1;
	console.log('  ✓ ' + name);
}

function album(partial: Partial<WishlistAlbum> & { title: string }): WishlistAlbum {
	return {
		artist: 'Artist',
		url: 'https://rateyourmusic.com/release/album/a/' + partial.title,
		genres: [],
		...partial
	};
}

// A small fixture that exercises every combination we care about.
const ALBUMS: WishlistAlbum[] = [
	album({ title: 'ambient-2026-a', year: 2026, genres: ['Ambient'], descriptors: ['Atmospheric'] }),
	album({ title: 'ambient-2026-b', year: 2026, genres: ['Ambient'], descriptors: ['Lush'] }),
	album({ title: 'metal-2026', year: 2026, genres: ['Black Metal'], descriptors: ['Atmospheric'] }),
	album({ title: 'ambient-2025', year: 2025, genres: ['Ambient'], descriptors: ['Atmospheric'] }),
	album({ title: 'triphop-1997', year: 1997, genres: ['Trip Hop'], descriptors: ['Nocturnal'] }),
	album({ title: 'undated', genres: ['Ambient'], descriptors: ['Atmospheric'] }),
	album({ title: 'ondeck-2024', year: 2024, genres: ['Zeuhl'], onDeck: true })
];

const titles = (rows: WishlistAlbum[]) => rows.map((r) => r.title).sort();

console.log('year extraction\n');

check('isValidReleaseYear accepts plausible integer years', () => {
	assert.equal(isValidReleaseYear(2026), true);
	assert.equal(isValidReleaseYear(1973), true);
	assert.equal(isValidReleaseYear(1000), true);
	assert.equal(isValidReleaseYear(9999), true);
});

check('isValidReleaseYear rejects junk (undefined, null, NaN, 0, floats, strings)', () => {
	for (const bad of [undefined, null, NaN, 0, -5, 1999.5, '2026', '', {}, []]) {
		assert.equal(isValidReleaseYear(bad), false, `expected ${JSON.stringify(bad)} to be invalid`);
	}
});

check('albumReleaseYear returns null for albums with no usable year', () => {
	assert.equal(albumReleaseYear(album({ title: 'x', year: 2026 })), 2026);
	assert.equal(albumReleaseYear(album({ title: 'x' })), null);
	assert.equal(albumReleaseYear(album({ title: 'x', year: NaN })), null);
	assert.equal(albumReleaseYear(album({ title: 'x', year: 0 })), null);
});

check('yearCounts is newest → oldest, with no bogus options', () => {
	const counts = yearCounts(ALBUMS);
	assert.deepEqual(
		counts.map((c) => c.year),
		[2026, 2025, 2024, 1997]
	);
	assert.deepEqual(counts[0], { year: 2026, count: 3 });
	// The undated album contributes no option at all.
	assert.equal(
		counts.some((c) => !Number.isInteger(c.year)),
		false
	);
});

console.log('\nsingle-year selection\n');

check('no year selected → albums from all years, including undated', () => {
	assert.equal(filterAlbums(ALBUMS, {}).length, ALBUMS.length);
	assert.equal(filterAlbums(ALBUMS, { year: null }).length, ALBUMS.length);
});

check('selecting a year restricts to that year only', () => {
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: 2026 })), [
		'ambient-2026-a',
		'ambient-2026-b',
		'metal-2026'
	]);
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: 1997 })), ['triphop-1997']);
});

check('selecting another year replaces rather than adds', () => {
	const f = withChanges(DEFAULT_FILTERS, { year: 2026 });
	const next = withChanges(f, { year: 2025 });
	assert.equal(next.year, 2025);
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: next.year })), ['ambient-2025']);
});

check('undated albums never appear under a specific year', () => {
	for (const y of [2026, 2025, 2024, 1997]) {
		assert.equal(
			filterAlbums(ALBUMS, { year: y }).some((a) => a.title === 'undated'),
			false
		);
	}
});

console.log('\ncombining year with the other axes\n');

check('year + genre', () => {
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: 2026, genre: 'Ambient' })), [
		'ambient-2026-a',
		'ambient-2026-b'
	]);
});

check('year + descriptor', () => {
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: 2026, descriptor: 'Atmospheric' })), [
		'ambient-2026-a',
		'metal-2026'
	]);
});

check('year + genre + descriptor (all must hold)', () => {
	assert.deepEqual(
		titles(filterAlbums(ALBUMS, { year: 2026, genre: 'Black Metal', descriptor: 'Atmospheric' })),
		['metal-2026']
	);
	assert.deepEqual(
		titles(filterAlbums(ALBUMS, { year: 2025, genre: 'Black Metal', descriptor: 'Atmospheric' })),
		[]
	);
});

check('year + search (search operates within the year-filtered set)', () => {
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: 2026, query: 'ambient' })), [
		'ambient-2026-a',
		'ambient-2026-b'
	]);
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: 2025, query: 'metal' })), []);
});

check('year + On Deck', () => {
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: 2024, onDeck: true })), ['ondeck-2024']);
	assert.deepEqual(titles(filterAlbums(ALBUMS, { year: 2026, onDeck: true })), []);
});

check('clearing the year restores the other constraints unchanged', () => {
	const withYear = filterAlbums(ALBUMS, { year: 2026, genre: 'Ambient' });
	const cleared = filterAlbums(ALBUMS, { year: null, genre: 'Ambient' });
	assert.equal(withYear.length, 2);
	// 'undated' is Ambient too, so clearing the year brings it back.
	assert.deepEqual(titles(cleared), [
		'ambient-2025',
		'ambient-2026-a',
		'ambient-2026-b',
		'undated'
	]);
});

console.log('\nfacet counts under a year constraint\n');

check('genre counts respect the selected year', () => {
	const all = genreCounts(filterAlbums(ALBUMS, {}));
	assert.equal(all.find((g) => g.name === 'Ambient')?.count, 4);
	assert.equal(all.find((g) => g.name === 'Trip Hop')?.count, 1);

	const in2026 = genreCounts(filterAlbums(ALBUMS, { year: 2026 }));
	assert.equal(in2026.find((g) => g.name === 'Ambient')?.count, 2);
	// Trip Hop has no 2026 albums, so it drops out of the facet entirely.
	assert.equal(
		in2026.some((g) => g.name === 'Trip Hop'),
		false
	);
});

check('descriptor counts respect the selected year', () => {
	const all = descriptorCounts(filterAlbums(ALBUMS, {}));
	assert.equal(all.find((d) => d.name === 'Atmospheric')?.count, 4);

	const in2026 = descriptorCounts(filterAlbums(ALBUMS, { year: 2026 }));
	assert.equal(in2026.find((d) => d.name === 'Atmospheric')?.count, 2);
	assert.equal(
		in2026.some((d) => d.name === 'Nocturnal'),
		false
	);
});

check('descriptor counts respect year + genre together', () => {
	const scoped = descriptorCounts(filterAlbums(ALBUMS, { year: 2026, genre: 'Ambient' }));
	assert.deepEqual(scoped.map((d) => d.name).sort(), ['Atmospheric', 'Lush']);
	assert.equal(scoped.find((d) => d.name === 'Atmospheric')?.count, 1);
});

check('year facet respects the selected genre (bidirectional faceting)', () => {
	// Mirrors the sidebar: the year list omits its own axis but honours genre.
	const forAmbient = yearCounts(filterAlbums(ALBUMS, { genre: 'Ambient' }));
	assert.deepEqual(
		forAmbient.map((c) => c.year),
		[2026, 2025]
	);
	const forZeuhl = yearCounts(filterAlbums(ALBUMS, { genre: 'Zeuhl' }));
	assert.deepEqual(
		forZeuhl.map((c) => c.year),
		[2024]
	);
});

console.log('\nURL round-trip (filter persistence through album-detail navigation)\n');

function roundTrip(f: AlbumFilters): AlbumFilters {
	const url = buildFiltersURL(f);
	const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
	return parseFilters(new URLSearchParams(qs));
}

check('year survives a build → parse round-trip', () => {
	const f = withChanges(DEFAULT_FILTERS, { year: 2026 });
	assert.equal(roundTrip(f).year, 2026);
});

check('year + genre + descriptor all survive together (the Back-button case)', () => {
	const f = withChanges(DEFAULT_FILTERS, {
		year: 2026,
		genre: 'Ambient',
		descriptor: 'Atmospheric'
	});
	const back = roundTrip(f);
	assert.equal(back.year, 2026);
	assert.equal(back.genre, 'Ambient');
	assert.equal(back.descriptor, 'Atmospheric');
});

check('year persists alongside search, On Deck and sort', () => {
	const f = withChanges(DEFAULT_FILTERS, {
		year: 2025,
		query: 'eno',
		onDeck: true,
		sort: 'year',
		dir: 'desc'
	});
	const back = roundTrip(f);
	assert.deepEqual(back, f);
});

check('no year → no `y` param (URLs stay tidy)', () => {
	assert.equal(buildFiltersURL(DEFAULT_FILTERS), '/');
	assert.equal(buildFiltersURL(withChanges(DEFAULT_FILTERS, { year: 2026 })), '/?y=2026');
});

check('malformed ?y= degrades to no year filter', () => {
	for (const bad of ['abc', '', '0', '-5', 'NaN', '12', '99999']) {
		assert.equal(
			parseFilters(new URLSearchParams(`y=${bad}`)).year,
			null,
			`expected ?y=${bad} to parse as null`
		);
	}
	// A valid year with trailing junk still parses via parseInt — acceptable,
	// and still lands on a real year rather than a broken filter.
	assert.equal(parseFilters(new URLSearchParams('y=2026')).year, 2026);
});

check('hasAnyFilter reports a year-only selection', () => {
	assert.equal(hasAnyFilter(DEFAULT_FILTERS), false);
	assert.equal(hasAnyFilter(withChanges(DEFAULT_FILTERS, { year: 2026 })), true);
	assert.equal(hasAnyFilter(withChanges(DEFAULT_FILTERS, { year: null })), false);
});

check('sorting is independent of the year filter', () => {
	// Filtering to one year leaves the sort field untouched.
	const f = withChanges(DEFAULT_FILTERS, { year: 2026, sort: 'year', dir: 'desc' });
	const cleared = withChanges(f, { year: null });
	assert.equal(cleared.sort, 'year');
	assert.equal(cleared.dir, 'desc');
});

console.log(`\n${passed} checks passed.`);
