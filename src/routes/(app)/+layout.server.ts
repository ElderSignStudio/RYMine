import {
	computePreview,
	readSyncSession,
	type SyncPreview,
	type SyncSession
} from '$lib/server/syncStore';
import { loadWishlistData } from '$lib/server/wishlist';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const wishlist = await loadWishlistData();
	const session = await readSyncSession();
	const syncSession: (SyncSession & { preview: SyncPreview }) | null = session
		? { ...session, preview: computePreview(session, wishlist.albums) }
		: null;
	return { ...wishlist, syncSession };
};
