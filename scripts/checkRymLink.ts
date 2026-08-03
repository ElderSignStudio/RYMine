// Conversion checks for the iOS Chrome handoff helpers ($lib/rymLink).
//
// Deliberately a plain tsx script rather than a test framework — the project
// has no test runner and these are pure string functions. Run with:
//
//   npm run check:rymlink

import assert from 'node:assert/strict';
import { chromeSchemeUrl, isRymUrl, rymHref } from '../src/lib/rymLink.ts';

let passed = 0;
function check(name: string, fn: () => void): void {
	fn();
	passed += 1;
	console.log('  ✓ ' + name);
}

console.log('rymLink conversions\n');

check('https album URL → googlechromes://', () => {
	assert.equal(
		chromeSchemeUrl('https://rateyourmusic.com/release/album/alcest/spiritual-instinct'),
		'googlechromes://rateyourmusic.com/release/album/alcest/spiritual-instinct'
	);
});

check('https EP URL → googlechromes://', () => {
	assert.equal(
		chromeSchemeUrl('https://rateyourmusic.com/release/ep/burial/untrue'),
		'googlechromes://rateyourmusic.com/release/ep/burial/untrue'
	);
});

check('https mixtape URL → googlechromes://', () => {
	assert.equal(
		chromeSchemeUrl('https://rateyourmusic.com/release/mixtape/artist/slug'),
		'googlechromes://rateyourmusic.com/release/mixtape/artist/slug'
	);
});

check('http URL → googlechrome:// (no trailing s)', () => {
	assert.equal(
		chromeSchemeUrl('http://rateyourmusic.com/release/album/artist/slug'),
		'googlechrome://rateyourmusic.com/release/album/artist/slug'
	);
});

check('query string and hash are preserved', () => {
	assert.equal(
		chromeSchemeUrl('https://rateyourmusic.com/release/album/a/b?page=2&sort=date#reviews'),
		'googlechromes://rateyourmusic.com/release/album/a/b?page=2&sort=date#reviews'
	);
});

check('percent-encoded non-ASCII slugs survive byte-for-byte', () => {
	const url = 'https://rateyourmusic.com/release/album/lamp/%E3%82%86%E3%82%81';
	assert.equal(
		chromeSchemeUrl(url),
		'googlechromes://rateyourmusic.com/release/album/lamp/%E3%82%86%E3%82%81'
	);
});

check('trailing slash is preserved', () => {
	assert.equal(
		chromeSchemeUrl('https://rateyourmusic.com/release/album/a/b/'),
		'googlechromes://rateyourmusic.com/release/album/a/b/'
	);
});

check('non-http scheme is returned unchanged', () => {
	assert.equal(chromeSchemeUrl('spotify:album:1234'), 'spotify:album:1234');
	assert.equal(
		chromeSchemeUrl('music://music.apple.com/album/1'),
		'music://music.apple.com/album/1'
	);
});

console.log('\nisRymUrl host matching\n');

check('rateyourmusic.com and www. are RYM', () => {
	assert.equal(isRymUrl('https://rateyourmusic.com/release/album/a/b'), true);
	assert.equal(isRymUrl('https://www.rateyourmusic.com/release/album/a/b'), true);
	assert.equal(isRymUrl('http://rateyourmusic.com/'), true);
});

check('other hosts are not RYM', () => {
	assert.equal(isRymUrl('https://open.spotify.com/album/123'), false);
	assert.equal(isRymUrl('https://music.apple.com/album/1'), false);
	assert.equal(isRymUrl('https://youtube.com/watch?v=1'), false);
	assert.equal(isRymUrl('https://artist.bandcamp.com/album/x'), false);
});

check('lookalike hosts are not RYM', () => {
	assert.equal(isRymUrl('https://rateyourmusic.com.evil.test/release/album/a/b'), false);
	assert.equal(isRymUrl('https://notrateyourmusic.com/release/album/a/b'), false);
});

check('malformed and relative URLs are not RYM', () => {
	assert.equal(isRymUrl('/album/abc123'), false);
	assert.equal(isRymUrl('not a url'), false);
	assert.equal(isRymUrl(''), false);
});

console.log('\nrymHref — the value actually used as an href\n');

check('iOS + RYM URL → Chrome scheme', () => {
	assert.equal(
		rymHref('https://rateyourmusic.com/release/album/a/b', true),
		'googlechromes://rateyourmusic.com/release/album/a/b'
	);
});

check('non-iOS + RYM URL → unchanged', () => {
	assert.equal(
		rymHref('https://rateyourmusic.com/release/album/a/b', false),
		'https://rateyourmusic.com/release/album/a/b'
	);
});

check('iOS + non-RYM URL → unchanged (Spotify/Apple/YouTube/Bandcamp untouched)', () => {
	assert.equal(
		rymHref('https://open.spotify.com/album/123', true),
		'https://open.spotify.com/album/123'
	);
	assert.equal(rymHref('https://music.apple.com/album/1', true), 'https://music.apple.com/album/1');
	assert.equal(rymHref('https://youtube.com/watch?v=1', true), 'https://youtube.com/watch?v=1');
	assert.equal(
		rymHref('https://artist.bandcamp.com/album/x', true),
		'https://artist.bandcamp.com/album/x'
	);
});

check('iOS + internal RYMine link → unchanged', () => {
	assert.equal(rymHref('/album/abc123', true), '/album/abc123');
	assert.equal(rymHref('/car/list?view=deck', true), '/car/list?view=deck');
});

console.log(`\n${passed} checks passed.`);
