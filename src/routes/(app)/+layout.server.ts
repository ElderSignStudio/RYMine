import { CAN_SEND_PUBLISH, IS_LOCAL } from '$lib/server/appMode';
import { loadWishlistData } from '$lib/server/wishlist';
import type { SyncPreview, SyncSession } from '$lib/server/syncStore';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const wishlist = await loadWishlistData();

	// Full-sync sessions are a local-only workflow backed by data/sync-session.json.
	// A readonly host has no such file — and on Cloudflare no filesystem at all —
	// so both the call and the `node:fs`-backed module import are kept behind the
	// mode check. The `import type` above is erased at compile time and pulls in
	// nothing at runtime.
	let syncSession: (SyncSession & { preview: SyncPreview }) | null = null;
	if (IS_LOCAL) {
		const { computePreview, readSyncSession } = await import('$lib/server/syncStore');
		const session = await readSyncSession();
		if (session) {
			syncSession = { ...session, preview: computePreview(session, wishlist.albums) };
		}
	}

	// Boolean only — never expose the publish URL or token to the client.
	return { ...wishlist, syncSession, canPublish: CAN_SEND_PUBLISH };
};
