// GitHub Contents API publish backend. We hit the REST API directly with
// fetch() rather than pulling in @octokit — the two requests we make per
// publish (GET current SHA, PUT new content) are simple enough that the
// extra dependency is more weight than it's worth.
//
// Flow:
//   1. GET /repos/{owner}/{repo}/contents/{path}?ref={branch}
//      → { sha: "..." } for the existing file. 404 if the file doesn't
//        exist; we'll create it with no `sha` in the PUT body.
//   2. PUT /repos/{owner}/{repo}/contents/{path}
//      body: { message, branch, content (base64), sha? }
//      → { commit: { sha, html_url, ... } }
//
// Token stays in this module's call frame — never returned to the caller's
// result, never logged, never sent to the client.

import { GITHUB_CONFIG, githubTokenForSending } from './appMode';
import type { WishlistFile } from './wishlistStore';

// API base. Defaults to the public github.com host but can be overridden
// for GitHub Enterprise (e.g. `https://github.acme.example/api/v3`) or for
// local-development against a mock server. Strip any trailing slash so we
// can compose paths without worrying about double slashes.
const API_BASE = (process.env.RYMINE_GITHUB_API_BASE ?? 'https://api.github.com').replace(
	/\/+$/,
	''
);
const COMMIT_MESSAGE = 'Update RYMine wishlist data';

export type GithubPublishOutcome =
	| {
			ok: true;
			albums: number;
			publishedAt: string;
			commitSha: string;
			commitUrl: string;
	  }
	| { ok: false; error: string; status?: number };

function authHeaders(): Record<string, string> {
	return {
		accept: 'application/vnd.github+json',
		authorization: `Bearer ${githubTokenForSending()}`,
		'x-github-api-version': '2022-11-28',
		// GitHub's API will 403 unauthenticated requests without a User-Agent.
		'user-agent': 'rymine-app'
	};
}

function contentsUrl(): string {
	const { owner, repo, path } = GITHUB_CONFIG;
	const ownerEnc = encodeURIComponent(owner);
	const repoEnc = encodeURIComponent(repo);
	// Encode each path segment but keep the slashes — GitHub matches on path.
	const pathEnc = path.split('/').map(encodeURIComponent).join('/');
	return `${API_BASE}/repos/${ownerEnc}/${repoEnc}/contents/${pathEnc}`;
}

async function getCurrentSha(branch: string): Promise<string | null> {
	const url = `${contentsUrl()}?ref=${encodeURIComponent(branch)}`;
	const res = await fetch(url, { headers: authHeaders() });
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`GET contents returned HTTP ${res.status}`);
	}
	const body = (await res.json()) as { sha?: string };
	return typeof body.sha === 'string' ? body.sha : null;
}

export async function publishToGithub(file: WishlistFile): Promise<GithubPublishOutcome> {
	const { owner, repo, branch, path } = GITHUB_CONFIG;
	if (!owner || !repo || !path || !githubTokenForSending()) {
		return {
			ok: false,
			error:
				'GitHub publish is not configured. Set RYMINE_GITHUB_OWNER, RYMINE_GITHUB_REPO, RYMINE_GITHUB_PATH, and RYMINE_GITHUB_TOKEN in the local .env.'
		};
	}

	// Step 1: read the current SHA so the PUT updates the existing file rather
	// than racing into a "sha mismatch" conflict. 404 means the file doesn't
	// exist yet — we'll create it without a SHA.
	let sha: string | null;
	try {
		sha = await getCurrentSha(branch);
	} catch (err) {
		return {
			ok: false,
			error: `Failed to read current file SHA from GitHub: ${err instanceof Error ? err.message : String(err)}`
		};
	}

	// Step 2: PUT the new content. JSON is pretty-printed for readable diffs
	// in the data repo.
	const json = JSON.stringify(file, null, 2) + '\n';
	const content = Buffer.from(json, 'utf-8').toString('base64');
	const body: Record<string, unknown> = {
		message: COMMIT_MESSAGE,
		branch,
		content
	};
	if (sha) body.sha = sha;

	let response: Response;
	try {
		response = await fetch(contentsUrl(), {
			method: 'PUT',
			headers: { ...authHeaders(), 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch (err) {
		return {
			ok: false,
			error: `Network error reaching GitHub: ${err instanceof Error ? err.message : String(err)}`
		};
	}

	if (response.status === 401 || response.status === 403) {
		return {
			ok: false,
			status: response.status,
			error: `GitHub rejected the token (HTTP ${response.status}). Confirm RYMINE_GITHUB_TOKEN is a fine-grained PAT with Contents: read/write on ${owner}/${repo}.`
		};
	}

	let result: unknown;
	try {
		result = await response.json();
	} catch {
		return {
			ok: false,
			status: response.status,
			error: `GitHub returned non-JSON (HTTP ${response.status}).`
		};
	}

	if (!response.ok) {
		const msg =
			result &&
			typeof result === 'object' &&
			'message' in result &&
			typeof (result as { message?: unknown }).message === 'string'
				? (result as { message: string }).message
				: `HTTP ${response.status}`;
		return { ok: false, status: response.status, error: `GitHub publish failed: ${msg}` };
	}

	const r = result as { commit?: { sha?: string; html_url?: string } };
	return {
		ok: true,
		albums: file.albums.length,
		publishedAt: new Date().toISOString(),
		commitSha: r.commit?.sha ?? '',
		commitUrl: r.commit?.html_url ?? ''
	};
}
