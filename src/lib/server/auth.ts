// Tiny stateless session for the readonly viewer login. Single-password,
// single-user. The cookie value is an HMAC keyed by RYMINE_VIEWER_PASSWORD
// (see expectedSessionToken in $lib/server/appMode), so:
//   - no session store needed,
//   - a password change invalidates all outstanding sessions,
//   - the cookie reveals nothing about the password.
//
// Cookie attributes: HttpOnly + SameSite=Lax. Secure flag added automatically
// in production by setting based on request scheme — left to the caller via
// the `secure` option (defaults to true).

import type { Cookies } from '@sveltejs/kit';
import { expectedSessionToken, IS_READONLY } from './appMode';

export const AUTH_COOKIE = 'rymine_session';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function isAuthenticated(cookies: Cookies): Promise<boolean> {
	// In local mode the gate is conceptually "open", but downstream code that
	// reads `locals.isAuthenticated` benefits from a stable true value.
	if (!IS_READONLY) return true;
	const got = cookies.get(AUTH_COOKIE);
	if (!got) return false;
	const expected = await expectedSessionToken();
	if (got.length !== expected.length) return false;
	const { timingSafeEqual } = await import('node:crypto');
	return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
}

export async function setSession(cookies: Cookies, opts: { secure: boolean }): Promise<void> {
	const token = await expectedSessionToken();
	cookies.set(AUTH_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: opts.secure,
		maxAge: ONE_YEAR_SECONDS
	});
}

export function clearSession(cookies: Cookies): void {
	cookies.delete(AUTH_COOKIE, { path: '/' });
}
