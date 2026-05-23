// Server hook — first stop for every request. Two jobs in readonly mode:
//
//   1. Inject `appMode` + `isAuthenticated` into event.locals so loads and
//      endpoints can read them (and the root layout can ship them to the
//      client for UI gating).
//
//   2. In readonly mode, gate the routes:
//        - GET to anything except /login or static assets → redirect to /login
//          when not authenticated.
//        - Any non-GET (POST/PUT/DELETE/PATCH) outside of /login + /logout
//          rejects with 403. Defense in depth alongside per-endpoint
//          assertWritableMode() calls.
//        - Write-only routes (bookmarklet setup, queue, write APIs) are
//          blocked outright with 403 since they have no meaningful read mode.
//
// Local mode lets everything through unchanged.

import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { APP_MODE, IS_READONLY } from '$lib/server/appMode';
import { isAuthenticated } from '$lib/server/auth';

// Paths that have no read-only equivalent — they exist to drive writes.
const WRITE_ONLY_ROUTES = ['/bookmarklet', '/queue', '/api/import', '/api/enrich'];

// Public paths reachable without a session (login form + its asset deps).
const PUBLIC_ROUTES = ['/login', '/logout'];

// Paths exempt from the readonly POST/PUT/DELETE block. /api/publish is the
// one accepted write surface on a readonly instance — it has its own bearer
// token auth (see src/routes/api/publish/+server.ts) and is the channel the
// local writable instance uses to push fresh data.
const READONLY_WRITE_ALLOWLIST = ['/api/publish'];

function isStaticAsset(path: string): boolean {
	if (path.startsWith('/_app/')) return true; // SvelteKit bundled JS/CSS
	return /\.(png|jpe?g|gif|svg|ico|webp|woff2?|css|js|map|txt)$/i.test(path);
}

function isPublic(path: string): boolean {
	if (PUBLIC_ROUTES.includes(path)) return true;
	return isStaticAsset(path);
}

function isWriteOnlyRoute(path: string): boolean {
	return WRITE_ONLY_ROUTES.some((p) => path === p || path.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.appMode = APP_MODE;
	event.locals.isAuthenticated = await isAuthenticated(event.cookies);

	if (!IS_READONLY) {
		return resolve(event);
	}

	const path = event.url.pathname;
	const method = event.request.method;

	// Block write-only routes outright. These have no useful read view.
	// We block regardless of auth state — a logged-in viewer of a readonly
	// instance still has no business with /bookmarklet or /api/import.
	if (isWriteOnlyRoute(path)) {
		return new Response('Not available in read-only mode.', {
			status: 403,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	// Any state-changing method outside login/logout/publish is rejected. The
	// login form + the logout endpoint + the publish endpoint are the only
	// legitimate POSTs in readonly. /api/publish authenticates itself with a
	// separate bearer token, so the session-cookie check below skips it too.
	const isWriteMethod = method !== 'GET' && method !== 'HEAD';
	if (isWriteMethod && !PUBLIC_ROUTES.includes(path) && !READONLY_WRITE_ALLOWLIST.includes(path)) {
		return new Response('Read-only mode: writes are disabled.', {
			status: 403,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	// /api/publish uses its own bearer-token auth — bypass the session-cookie
	// redirect so the local sender can hit it without first "logging in".
	if (READONLY_WRITE_ALLOWLIST.includes(path)) {
		return resolve(event);
	}

	// Unauthenticated browser hits get bounced to /login, preserving where
	// they were trying to go.
	if (!event.locals.isAuthenticated && !isPublic(path)) {
		const target = event.url.pathname + event.url.search;
		throw redirect(303, '/login?from=' + encodeURIComponent(target));
	}

	return resolve(event);
};
