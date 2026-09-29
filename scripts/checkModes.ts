// Deployment-mode checks: boots the real adapter-node build under each
// supported environment and asserts how it behaves.
//
// These are integration checks rather than unit tests because the behaviour
// under test IS the environment wiring — appMode.ts reads process.env once at
// module load and can refuse to boot, which no amount of function-level
// testing would exercise.
//
// Requires a current build:  npm run build
// Run with:                  npm run check:modes
//
// Nothing here writes to data/. Servers bind high loopback ports so the
// LaunchAgent on :3000 is never disturbed.

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';

let passed = 0;
function ok(name: string): void {
	passed += 1;
	console.log('  ✓ ' + name);
}

const BASE_PORT = 39400;
let portCursor = 0;
function nextPort(): number {
	return BASE_PORT + portCursor++;
}

type Booted = { proc: ChildProcess; url: string };

/** Start `node build` with the given env. Resolves once /api/health answers. */
async function boot(env: Record<string, string>): Promise<Booted> {
	const port = nextPort();
	const url = `http://127.0.0.1:${port}`;
	const proc = spawn('node', ['build'], {
		env: {
			...process.env,
			// Start from a clean slate so the developer's own .env-ish shell
			// values can't leak into a case and quietly invalidate it.
			RYMINE_MODE: undefined,
			RYMINE_VIEWER_PASSWORD: undefined,
			RYMINE_PUBLIC_VIEWER: undefined,
			RYMINE_REMOTE_DATA_URL: undefined,
			RYMINE_GITHUB_TOKEN: undefined,
			RYMINE_PUBLISH_TOKEN: undefined,
			HOST: '127.0.0.1',
			PORT: String(port),
			ORIGIN: url,
			...env
		} as NodeJS.ProcessEnv,
		stdio: ['ignore', 'pipe', 'pipe']
	});

	const deadline = Date.now() + 15_000;
	for (;;) {
		if (proc.exitCode !== null) throw new Error(`server exited early (code ${proc.exitCode})`);
		try {
			const res = await fetch(`${url}/api/health`);
			if (res.ok) return { proc, url };
		} catch {
			/* not up yet */
		}
		if (Date.now() > deadline) {
			proc.kill('SIGKILL');
			throw new Error('server did not become healthy in time');
		}
		await new Promise((r) => setTimeout(r, 150));
	}
}

function stop(b: Booted): void {
	b.proc.kill('SIGKILL');
}

/** Boot expecting FAILURE; resolves with the captured stderr. */
async function bootExpectingExit(env: Record<string, string>): Promise<string> {
	const port = nextPort();
	const proc = spawn('node', ['build'], {
		env: {
			...process.env,
			RYMINE_MODE: undefined,
			RYMINE_VIEWER_PASSWORD: undefined,
			RYMINE_PUBLIC_VIEWER: undefined,
			HOST: '127.0.0.1',
			PORT: String(port),
			ORIGIN: `http://127.0.0.1:${port}`,
			...env
		} as NodeJS.ProcessEnv,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	let stderr = '';
	proc.stderr?.on('data', (c) => (stderr += String(c)));
	const code: number | null = await new Promise((resolve) => {
		const t = setTimeout(() => {
			proc.kill('SIGKILL');
			resolve(null);
		}, 15_000);
		proc.on('exit', (c) => {
			clearTimeout(t);
			resolve(c);
		});
	});
	assert.notEqual(code, 0, 'expected the server to refuse to boot');
	return stderr;
}

async function status(url: string, path: string, init?: RequestInit): Promise<number> {
	const res = await fetch(url + path, { redirect: 'manual', ...init });
	return res.status;
}

async function main(): Promise<void> {
	console.log('readonly — password gated (current Render configuration)\n');
	{
		const b = await boot({ RYMINE_MODE: 'readonly', RYMINE_VIEWER_PASSWORD: 'hunter2' });
		try {
			const health = await (await fetch(`${b.url}/api/health`)).json();
			assert.equal(health.mode, 'readonly');
			ok('boots with a password and reports readonly');

			assert.equal(await status(b.url, '/'), 303);
			assert.equal(await status(b.url, '/car'), 303);
			ok('anonymous visitors are redirected to /login');

			assert.equal(await status(b.url, '/api/health'), 200);
			ok('/api/health stays public for uptime probes');

			assert.equal(await status(b.url, '/queue'), 403);
			assert.equal(await status(b.url, '/bookmarklet'), 403);
			ok('write-only routes are blocked');
		} finally {
			stop(b);
		}
	}

	console.log('\nreadonly — public viewer (planned Cloudflare configuration)\n');
	{
		const b = await boot({ RYMINE_MODE: 'readonly', RYMINE_PUBLIC_VIEWER: '1' });
		try {
			const health = await (await fetch(`${b.url}/api/health`)).json();
			assert.equal(health.mode, 'readonly');
			ok('boots with no password at all');

			assert.equal(await status(b.url, '/'), 200);
			assert.equal(await status(b.url, '/car'), 200);
			ok('browse and Car Mode are served without a login');

			assert.equal(await status(b.url, '/login'), 303);
			ok('/login redirects away — there is no gate to pass');

			// The security core: public READ must not imply any write.
			assert.equal(await status(b.url, '/queue'), 403);
			assert.equal(await status(b.url, '/bookmarklet'), 403);
			assert.equal(await status(b.url, '/api/import', { method: 'POST' }), 403);
			assert.equal(await status(b.url, '/api/enrich', { method: 'POST' }), 403);
			ok('write-only routes and write APIs remain blocked');

			assert.equal(
				await status(b.url, '/?/toggleOnDeck', {
					method: 'POST',
					headers: { origin: b.url, 'content-type': 'application/x-www-form-urlencoded' },
					body: ''
				}),
				403
			);
			assert.equal(
				await status(b.url, '/?/publish', {
					method: 'POST',
					headers: { origin: b.url, 'content-type': 'application/x-www-form-urlencoded' },
					body: ''
				}),
				403
			);
			ok('On Deck and Publish form actions are rejected');

			// No publish token configured → the receiver presents as absent.
			assert.equal(await status(b.url, '/api/publish', { method: 'POST' }), 404);
			ok('/api/publish reports 404 with no write credentials configured');

			const body = await (await fetch(b.url)).text();
			assert.equal(body.includes('>Publish<'), false, 'publish button must not render');
			assert.equal(body.includes('>Logout<'), false, 'logout button is meaningless when public');
			ok('no Publish or Logout controls are rendered');
		} finally {
			stop(b);
		}
	}

	console.log('\nreadonly — misconfigured\n');
	{
		const stderr = await bootExpectingExit({ RYMINE_MODE: 'readonly' });
		assert.match(stderr, /RYMINE_VIEWER_PASSWORD|RYMINE_PUBLIC_VIEWER/);
		ok('refuses to boot with neither a password nor an explicit public opt-in');
	}

	console.log('\nlocal — full writable app\n');
	{
		const b = await boot({ RYMINE_MODE: 'local' });
		try {
			const health = await (await fetch(`${b.url}/api/health`)).json();
			assert.equal(health.mode, 'local');
			ok('boots with no password and reports local');

			assert.equal(await status(b.url, '/'), 200);
			assert.equal(await status(b.url, '/queue'), 200);
			assert.equal(await status(b.url, '/bookmarklet'), 200);
			ok('browse and the local-only workflow routes are reachable');

			assert.equal(await status(b.url, '/login'), 303);
			ok('/login redirects away in local mode');

			// Local is the writer, so the publish RECEIVER should look absent.
			assert.equal(await status(b.url, '/api/publish', { method: 'POST' }), 404);
			ok('/api/publish is hidden on the local writer');
		} finally {
			stop(b);
		}
	}

	console.log('\nremote wishlist loading path\n');
	{
		// Point the readonly viewer at a served fixture rather than GitHub, so
		// the check is hermetic and never touches the network.
		const fixture = {
			lastScrapedAt: '2026-01-02T03:04:05.000Z',
			source: 'rym',
			albums: [
				{
					artist: 'Stars of the Lid',
					title: 'The Tired Sounds Of',
					year: 2001,
					url: 'https://rateyourmusic.com/release/album/stars-of-the-lid/the-tired-sounds-of',
					genres: ['Ambient']
				}
			]
		};
		const fixturePort = nextPort();
		const { createServer } = await import('node:http');
		const fixtureServer = createServer((_req, res) => {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify(fixture));
		});
		await new Promise<void>((r) => fixtureServer.listen(fixturePort, '127.0.0.1', r));

		const b = await boot({
			RYMINE_MODE: 'readonly',
			RYMINE_PUBLIC_VIEWER: '1',
			RYMINE_REMOTE_DATA_URL: `http://127.0.0.1:${fixturePort}/wishlist.json`
		});
		try {
			const health = await (await fetch(`${b.url}/api/health`)).json();
			assert.equal(health.dataSource, 'remote-url');
			assert.equal(health.albumCount, 1);
			assert.equal(health.lastScrapedAt, fixture.lastScrapedAt);
			ok('readonly reads its wishlist from the remote URL, not the filesystem');

			const body = await (await fetch(b.url)).text();
			assert.equal(body.includes('Stars of the Lid'), true);
			ok('remote albums render in the browse UI');
		} finally {
			stop(b);
			await new Promise<void>((r) => fixtureServer.close(() => r()));
		}
	}

	console.log(`\n${passed} checks passed.`);
}

main().catch((err) => {
	console.error('\n✗ ' + (err instanceof Error ? err.message : String(err)));
	process.exit(1);
});
