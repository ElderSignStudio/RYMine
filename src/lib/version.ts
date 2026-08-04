// Version + build identification — the "am I actually running the latest
// deploy?" answer.
//
// Two identifiers, because they answer different questions:
//   - version — the semantic version from package.json, bumped deliberately
//     via `npm run version:patch` when something is worth naming.
//   - commit  — the short git SHA, which changes on every single deploy even
//     when the semantic version didn't move. This is the one that actually
//     tells you whether Render picked up your last push.
//
// The three `__…__` values are compile-time constants injected by Vite (see
// vite.config.ts). Using `define` rather than reading package.json or shelling
// out to git at runtime means this works identically in the client bundle, the
// SSR bundle and the adapter-node output, with no fs or subprocess access
// after boot.

export type BuildInfo = {
	version: string;
	commit: string;
	buildTime: string;
};

export const APP_VERSION: string = __APP_VERSION__;
export const RAW_BUILD_COMMIT: string = __BUILD_COMMIT__;
export const BUILD_TIME: string = __BUILD_TIME__;

/**
 * Trim a commit SHA down to the ~7 characters people actually compare against
 * a GitHub or Render deploy listing. Non-SHA sentinels ('local', 'unknown')
 * pass through untouched so they stay readable.
 */
export function shortCommit(sha: string): string {
	const s = (sha ?? '').trim();
	if (!s) return 'unknown';
	return /^[0-9a-f]{7,40}$/i.test(s) ? s.slice(0, 7) : s;
}
