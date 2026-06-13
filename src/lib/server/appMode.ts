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

// ── Publish channel — legacy Render direct-push ─────────────────────────────
// Kept fully working as a fallback while we transition to the GitHub-backed
// pipeline below. `RYMINE_PUBLISH_TOKEN` is the shared secret between local
// writable and hosted readonly. On the readonly side it gates POST
// /api/publish; on the local side it goes into the Authorization header of
// the outbound Render publish. `RYMINE_PUBLISH_URL` is only used by the
// local sender — the full URL of the hosted /api/publish endpoint.
const PUBLISH_TOKEN = process.env.RYMINE_PUBLISH_TOKEN ?? '';
export const PUBLISH_URL = process.env.RYMINE_PUBLISH_URL ?? '';

/** True iff the current process has the env to act as a publish *receiver*. */
export const CAN_RECEIVE_PUBLISH = IS_READONLY && PUBLISH_TOKEN.length > 0;

// ── Publish channel — GitHub Contents API ───────────────────────────────────
// New backend (preferred). Local writable RYMine pushes the wishlist JSON
// to a public GitHub data repo via the Contents API; the hosted readonly
// viewer reads the raw GitHub URL on the other side. This survives Render
// free-tier sleep/restart because the source of truth lives outside Render.
//
// Token must be a fine-grained PAT with `Contents: read/write` on the data
// repo. It stays SERVER-ONLY — never exported to the client, never logged.
const GITHUB_OWNER = process.env.RYMINE_GITHUB_OWNER ?? '';
const GITHUB_REPO = process.env.RYMINE_GITHUB_REPO ?? '';
const GITHUB_BRANCH = (process.env.RYMINE_GITHUB_BRANCH ?? 'main').trim() || 'main';
const GITHUB_PATH = (process.env.RYMINE_GITHUB_PATH ?? 'data/wishlist.json').trim();
const GITHUB_TOKEN = process.env.RYMINE_GITHUB_TOKEN ?? '';

export const GITHUB_CONFIG = {
	owner: GITHUB_OWNER,
	repo: GITHUB_REPO,
	branch: GITHUB_BRANCH,
	path: GITHUB_PATH
};

/** Token value for the GitHub publish backend. Server-only. */
export function githubTokenForSending(): string {
	return GITHUB_TOKEN;
}

const HAS_GITHUB_CONFIG =
	GITHUB_OWNER.length > 0 && GITHUB_REPO.length > 0 && GITHUB_TOKEN.length > 0;
const HAS_RENDER_PUBLISH_CONFIG = PUBLISH_URL.length > 0 && PUBLISH_TOKEN.length > 0;

// ── Resolved publish backend ────────────────────────────────────────────────
// Explicit override via RYMINE_PUBLISH_BACKEND wins. Otherwise: GitHub if its
// env is complete, then Render if its env is complete, else nothing. We only
// resolve in local mode — the readonly side doesn't publish.

export type PublishBackend = 'github' | 'render' | 'none';

function resolvePublishBackend(): PublishBackend {
	if (!IS_LOCAL) return 'none';
	const raw = (process.env.RYMINE_PUBLISH_BACKEND ?? '').toLowerCase().trim();
	if (raw === 'github') return 'github';
	if (raw === 'render') return 'render';
	if (raw === 'none') return 'none';
	if (raw.length > 0) {
		throw new Error(`RYMINE_PUBLISH_BACKEND must be 'github', 'render', or 'none' (got '${raw}').`);
	}
	if (HAS_GITHUB_CONFIG) return 'github';
	if (HAS_RENDER_PUBLISH_CONFIG) return 'render';
	return 'none';
}

export const PUBLISH_BACKEND: PublishBackend = resolvePublishBackend();

/** True iff the current process has the env to act as a publish *sender*. */
export const CAN_SEND_PUBLISH = IS_LOCAL && PUBLISH_BACKEND !== 'none';

// ── Remote data source (readonly side) ──────────────────────────────────────
// In readonly mode the viewer reads its wishlist JSON from this URL when
// configured. Typically the raw GitHub URL for the data repo, but any
// reachable, CORS-irrelevant (we fetch server-side), public JSON works. The
// fetched payload is validated with the same shape check used by /api/publish
// before it goes into the cache, so a bad commit can't poison the viewer.
export const REMOTE_DATA_URL = (process.env.RYMINE_REMOTE_DATA_URL ?? '').trim();

const DEFAULT_REMOTE_CACHE_SECONDS = 300;
export const REMOTE_DATA_CACHE_SECONDS = (() => {
	const raw = process.env.RYMINE_REMOTE_DATA_CACHE_SECONDS;
	if (!raw) return DEFAULT_REMOTE_CACHE_SECONDS;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n >= 0 ? n : DEFAULT_REMOTE_CACHE_SECONDS;
})();

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

/**
 * Constant-time compare of the bearer token from a request against the
 * configured publish secret. Returns false if the env isn't set (i.e. the
 * receiver hasn't been configured) — never allow a publish when there's
 * nothing to verify against.
 */
export async function verifyPublishToken(received: string | null | undefined): Promise<boolean> {
	if (!received || PUBLISH_TOKEN.length === 0) return false;
	if (received.length !== PUBLISH_TOKEN.length) return false;
	const { timingSafeEqual } = await import('node:crypto');
	return timingSafeEqual(Buffer.from(received, 'utf-8'), Buffer.from(PUBLISH_TOKEN, 'utf-8'));
}

/** Token value for outbound publish (sender side). Server-only. */
export function publishTokenForSending(): string {
	return PUBLISH_TOKEN;
}
