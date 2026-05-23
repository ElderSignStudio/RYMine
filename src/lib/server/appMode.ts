// Central server-side switch between the two runtime personalities of RYMine:
//
//   - 'local'    — the original behavior. Single-user macOS launcher,
//                  bookmarklets work, imports + sync work, no login.
//   - 'readonly' — browse-only. Intended for a hosted instance. Requires a
//                  password to view anything; all write endpoints reject with
//                  403 regardless of cookie state.
//
// Mode is set via the RYMINE_MODE environment variable. Default is 'local'.
// In 'readonly' mode the RYMINE_VIEWER_PASSWORD env var must also be set; we
// fail fast at module load with a clear error otherwise.
//
// All server code that performs writes (form actions, API POSTs) should call
// assertWritableMode() near the top — defense in depth alongside the hook.

import { error } from '@sveltejs/kit';

export type AppMode = 'local' | 'readonly';

function parseMode(raw: string | undefined): AppMode {
	const v = (raw ?? 'local').toLowerCase().trim();
	if (v === 'local' || v === 'readonly') return v;
	throw new Error(
		`RYMINE_MODE must be 'local' or 'readonly' (got '${raw}'). Edit your env and restart.`
	);
}

export const APP_MODE: AppMode = parseMode(process.env.RYMINE_MODE);
export const IS_LOCAL = APP_MODE === 'local';
export const IS_READONLY = APP_MODE === 'readonly';

const VIEWER_PASSWORD = process.env.RYMINE_VIEWER_PASSWORD ?? '';

if (IS_READONLY && VIEWER_PASSWORD.length === 0) {
	throw new Error(
		"RYMINE_MODE=readonly requires RYMINE_VIEWER_PASSWORD to be set. Either switch to RYMINE_MODE=local or provide a password — refusing to boot without one so the app isn't accidentally exposed."
	);
}

/**
 * Constant-time string comparison. Plain === can leak the password length /
 * matching-prefix length via timing. crypto.timingSafeEqual requires equal
 * lengths, so we hash both sides to a fixed-length digest first.
 */
export async function verifyPassword(submitted: string): Promise<boolean> {
	if (!IS_READONLY) return true; // no password gate in local mode
	if (typeof submitted !== 'string' || submitted.length === 0) return false;
	const { createHash, timingSafeEqual } = await import('node:crypto');
	const a = createHash('sha256').update(submitted).digest();
	const b = createHash('sha256').update(VIEWER_PASSWORD).digest();
	return timingSafeEqual(a, b);
}

/**
 * Returns the canonical session token for the current password. The token is
 * an HMAC of a fixed namespace string keyed by the password, so:
 *   - signing requires server-side knowledge of the password,
 *   - changing RYMINE_VIEWER_PASSWORD invalidates all outstanding cookies,
 *   - no database / in-memory session store is needed.
 */
export async function expectedSessionToken(): Promise<string> {
	const { createHmac } = await import('node:crypto');
	return createHmac('sha256', VIEWER_PASSWORD).update('rymine.viewer.v1').digest('hex');
}

/**
 * Throws a 403 if the app is in readonly mode. Call at the top of every write
 * endpoint / form action. The error is caught by SvelteKit and turned into a
 * normal 403 response.
 */
export function assertWritableMode(): void {
	if (IS_READONLY) {
		throw error(403, 'This RYMine instance is read-only — writes are disabled.');
	}
}
