// Server-side cache for the readonly viewer's remote wishlist source.
//
// In readonly mode (`RYMINE_MODE=readonly`) with `RYMINE_REMOTE_DATA_URL`
// set, every page render would otherwise hit GitHub. The in-memory cache
// here keeps fetches to at most one per `RYMINE_REMOTE_DATA_CACHE_SECONDS`
// (default 300s) and serves the cached copy in between. If a refresh fails
// (network blip, GitHub 5xx, transient validation failure) we serve the
// stale cached copy rather than crashing the viewer — that's the
// stale-while-error pattern.
//
// State is process-local: a Render restart wipes the cache, but on the next
// request we fetch and re-cache. That's fine — the source of truth is the
// remote URL, the cache is a latency / rate-limit optimisation.

import { REMOTE_DATA_CACHE_SECONDS, REMOTE_DATA_URL } from './appMode';
import { validatePublishPayload } from './publish';
import type { WishlistFile } from './wishlistStore';

type CacheEntry = {
	url: string;
	data: WishlistFile;
	fetchedAt: number; // ms epoch
};

// Module-level cache — single instance per process. Pinned to URL so a
// configuration swap (rare in production) invalidates automatically.
let cache: CacheEntry | null = null;

// Backoff between successive FAILED fetch attempts so a slow GitHub doesn't
// get hammered when the cache is empty and traffic is high. Only updated
// when fetch + validate fails; successful refresh leaves it untouched so
// the next stale-TTL request still triggers a fresh fetch.
let lastFailedAt = 0;
const MIN_RETRY_INTERVAL_MS = 5_000;

export type RemoteFetchOutcome = {
	data: WishlistFile | null;
	fromCache: boolean;
	cacheAgeSeconds: number | null;
	error?: string;
};

export async function fetchRemoteWishlist(): Promise<RemoteFetchOutcome> {
	if (!REMOTE_DATA_URL) {
		return { data: null, fromCache: false, cacheAgeSeconds: null };
	}

	const now = Date.now();

	// Fast path: cache is fresh.
	if (cache && cache.url === REMOTE_DATA_URL) {
		const ageMs = now - cache.fetchedAt;
		if (ageMs < REMOTE_DATA_CACHE_SECONDS * 1000) {
			return {
				data: cache.data,
				fromCache: true,
				cacheAgeSeconds: Math.floor(ageMs / 1000)
			};
		}
	}

	// Failure backoff: don't hammer GitHub when the last fetch failed and the
	// cache is still warm-but-stale. Successful refreshes leave lastFailedAt
	// at 0, so this branch never fires on the happy path.
	if (lastFailedAt > 0 && now - lastFailedAt < MIN_RETRY_INTERVAL_MS) {
		if (cache && cache.url === REMOTE_DATA_URL) {
			return {
				data: cache.data,
				fromCache: true,
				cacheAgeSeconds: Math.floor((now - cache.fetchedAt) / 1000)
			};
		}
		return { data: null, fromCache: false, cacheAgeSeconds: null };
	}

	// Slow path: fetch + validate + cache.
	try {
		const res = await fetch(REMOTE_DATA_URL, {
			// Bypass any intermediate caches between us and GitHub — our own
			// in-memory layer is the only cache we want to govern.
			headers: { 'cache-control': 'no-cache' }
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const raw = await res.json();
		const validated = validatePublishPayload(raw);
		if (!validated.ok) {
			throw new Error(`Invalid remote payload: ${validated.error}`);
		}
		cache = { url: REMOTE_DATA_URL, data: validated.data, fetchedAt: now };
		lastFailedAt = 0; // success clears the failure timer
		return { data: validated.data, fromCache: false, cacheAgeSeconds: 0 };
	} catch (err) {
		// Stale-while-error.
		lastFailedAt = now;
		const message = err instanceof Error ? err.message : String(err);
		if (cache && cache.url === REMOTE_DATA_URL) {
			return {
				data: cache.data,
				fromCache: true,
				cacheAgeSeconds: Math.floor((now - cache.fetchedAt) / 1000),
				error: message
			};
		}
		return { data: null, fromCache: false, cacheAgeSeconds: null, error: message };
	}
}

/**
 * Status helper for /api/health and similar — does NOT fetch. If you want
 * the cache to be populated, call fetchRemoteWishlist() first.
 */
export function getRemoteCacheStatus(): {
	hasCachedData: boolean;
	cacheAgeSeconds: number | null;
} {
	if (!cache || !REMOTE_DATA_URL || cache.url !== REMOTE_DATA_URL) {
		return { hasCachedData: false, cacheAgeSeconds: null };
	}
	return {
		hasCachedData: true,
		cacheAgeSeconds: Math.floor((Date.now() - cache.fetchedAt) / 1000)
	};
}

/** Test-only / admin: drop the in-memory cache so the next call refetches. */
export function clearRemoteCache(): void {
	cache = null;
	lastFailedAt = 0;
}
