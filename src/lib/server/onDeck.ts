// Server-side toggle for the per-album "On Deck" marker. Local-mode only —
// the form action wrapping this calls assertWritableMode() first, and the
// hook blocks the action in readonly mode anyway. The toggle reads the
// wishlist, flips the field for the matching album, and writes the whole
// file back atomically (temp + rename, via writeWishlistFile).
//
// Storage rule: when ON, both `onDeck=true` and `onDeckAt=<ISO timestamp>`
// are set. When OFF, both fields are deleted — absence is the off state, so
// no stale timestamps linger in the JSON.

import {
	normalizeUrl,
	readWishlistFile,
	writeWishlistFile,
	type WishlistFile
} from './wishlistStore';

export type OnDeckToggleResult =
	| { ok: true; url: string; onDeck: boolean; onDeckAt?: string }
	| { ok: false; error: string };

export async function toggleAlbumOnDeck(rawUrl: string): Promise<OnDeckToggleResult> {
	if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
		return { ok: false, error: 'Missing album URL.' };
	}
	const target = normalizeUrl(rawUrl);

	const file = await readWishlistFile();
	if (!file) {
		return { ok: false, error: 'No local wishlist on disk.' };
	}

	const idx = file.albums.findIndex((a) => normalizeUrl(a.url) === target);
	if (idx === -1) {
		return { ok: false, error: 'Album not found in wishlist.' };
	}

	const current = file.albums[idx];
	const nowOn = !current.onDeck;
	const next = { ...current };

	if (nowOn) {
		next.onDeck = true;
		next.onDeckAt = new Date().toISOString();
	} else {
		delete next.onDeck;
		delete next.onDeckAt;
	}

	const albums = [...file.albums];
	albums[idx] = next;
	const updated: WishlistFile = { ...file, albums };
	await writeWishlistFile(updated);

	return {
		ok: true,
		url: target,
		onDeck: nowOn,
		onDeckAt: nowOn ? next.onDeckAt : undefined
	};
}
