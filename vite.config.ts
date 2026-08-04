import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Version + build identity are resolved here, once, at build time — never at
// runtime. That keeps `node build` free of subprocess calls and filesystem
// lookups, and means the values are baked into whatever artifact Render is
// actually serving. See src/lib/version.ts for the consuming side.

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/**
 * Commit for this build, in priority order:
 *   1. RYMINE_BUILD_COMMIT — explicit override, works on any host.
 *   2. RENDER_GIT_COMMIT   — set automatically by Render for every deploy.
 *   3. `git rev-parse`     — local dev convenience. Guarded: this is a build-
 *      time call, and any failure (no git, tarball checkout, detached state)
 *      quietly degrades to 'local' rather than breaking the build.
 */
function resolveBuildCommit(): string {
	const fromEnv = (process.env.RYMINE_BUILD_COMMIT || process.env.RENDER_GIT_COMMIT || '').trim();
	if (fromEnv) return fromEnv;

	try {
		return execSync('git rev-parse HEAD', {
			stdio: ['ignore', 'pipe', 'ignore'],
			encoding: 'utf-8'
		}).trim();
	} catch {
		return 'local';
	}
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__BUILD_COMMIT__: JSON.stringify(resolveBuildCommit()),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString())
	}
});
