# Publishing to a GitHub data repo

The recommended way to keep the hosted readonly viewer in sync with your
local wishlist. Pushes the JSON to a public GitHub repo via the Contents
API; the readonly viewer reads it from the raw URL. The data lives outside
Render, so free-tier sleep/restart no longer empties the viewer.

## Architecture

```
Local writable RYMine                              Hosted readonly RYMine
─────────────────────                              ──────────────────────
[Publish button] ──── GitHub Contents API ──────► [reads raw URL ────────► UI]
                                                        ▲
                                                   in-memory cache
                                                  (300s default TTL)
```

The local app holds the GitHub token. Render does **not** hold the GitHub
token — the data repo is public, so reads need no credential.

## Set up the data repo

Already done for ElderSignStudio's setup:

- Owner: `ElderSignStudio`
- Repo: `RYMineData`
- Branch: `main`
- File: `data/wishlist.json`

If you're starting from scratch: create a **public** repo, commit a seed
file at `data/wishlist.json`:

```json
{
	"source": "rym",
	"lastScrapedAt": null,
	"albums": []
}
```

## Create a fine-grained GitHub PAT

1. GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token.
2. Token name: e.g. `rymine-publish`.
3. Expiration: your call (90 days is a reasonable default — calendar a
   rotation reminder).
4. **Repository access**: _Only select repositories_ → pick your data repo.
   This token must NOT have access to your other repos.
5. **Permissions** → Repository permissions → set **Contents** to
   `Read and write`. Leave every other permission as the default
   "No access".
6. Generate, copy the token (starts with `github_pat_...`), and paste it
   into your local `.env` as `RYMINE_GITHUB_TOKEN`. Never commit it.

> **Never** put this token in Render's env or share it with the hosted
> instance. The hosted instance only reads the public raw URL — no token
> needed.

## Configure your local `.env`

```
RYMINE_MODE=local
RYMINE_PUBLISH_BACKEND=github
RYMINE_GITHUB_OWNER=ElderSignStudio
RYMINE_GITHUB_REPO=RYMineData
RYMINE_GITHUB_BRANCH=main
RYMINE_GITHUB_PATH=data/wishlist.json
RYMINE_GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxx
```

(If you leave `RYMINE_PUBLISH_BACKEND` unset, it auto-resolves to `github`
once the four GitHub vars are present, so the explicit declaration is
documentation rather than necessity.)

Restart the local app (`npm run build && npm start` or the launcher). The
**Publish** button appears in the header as before — same control, new
destination.

## How publishing works

1. You click **Publish** in the header.
2. Local server reads `data/wishlist.json` (as before).
3. Local server hits `GET /repos/<owner>/<repo>/contents/<path>?ref=<branch>`
   to grab the current file's SHA.
4. Local server PUTs the new content (base64-encoded) with that SHA in the
   body. GitHub creates a commit titled **"Update RYMine wishlist data"**.
5. UI banner: _Published N albums to ElderSignStudio/RYMineData_ with a
   small `GitHub` tag and the commit timestamp.

The GitHub token never leaves your laptop — it lives in `.env`, gets read
inside the server-side publish action, and goes straight into the
`Authorization: Bearer …` header of the `fetch()` call.

## Configure the hosted readonly viewer

On Render, set (replacing the legacy `RYMINE_PUBLISH_TOKEN` if you want to
fully retire it):

```
RYMINE_MODE=readonly
RYMINE_VIEWER_PASSWORD=<viewer password>
RYMINE_REMOTE_DATA_URL=https://raw.githubusercontent.com/ElderSignStudio/RYMineData/main/data/wishlist.json
RYMINE_REMOTE_DATA_CACHE_SECONDS=300
HOST=0.0.0.0
ORIGIN=https://<your-service>.onrender.com
```

That's it. No GitHub token, no persistent disk needed. Restart the service.

## Verify

```
curl https://<your-service>.onrender.com/api/health
```

Expected:

```json
{
	"ok": true,
	"name": "rymine",
	"mode": "readonly",
	"dataSource": "remote-url",
	"cacheAgeSeconds": 0,
	"remoteUrlConfigured": true,
	"publishBackend": "none",
	"hasData": true,
	"albumCount": 234,
	"lastScrapedAt": "2026-06-01T..."
}
```

`dataSource: "remote-url"` confirms Render is reading from GitHub. After
your next publish from the local app, the next request that lands beyond
the cache TTL will pull the new commit; `cacheAgeSeconds` shows you how
stale the in-memory copy is.

## Troubleshooting

**Publish → "GitHub rejected the token (HTTP 401)" / "(HTTP 403)"**

Either the token expired, the token doesn't have **Contents: read/write**
on this repo, or the repo selection on the fine-grained token doesn't
include this repo. Regenerate the token with the right scope.

**Publish → "Failed to read current file SHA from GitHub: GET contents
returned HTTP 404"**

The file at `RYMINE_GITHUB_PATH` doesn't exist yet on `RYMINE_GITHUB_BRANCH`.
Commit the seed JSON manually (one-time), or change the path / branch to
match where you do want to write. Publish will create-rather-than-update
on a clean 404 — but anything else (network, auth) needs investigation.

**Publish → "GitHub publish failed: 409 sha is required"**

Race condition: someone (you, in another tab; or the SHA fetch was stale)
changed the file between the GET and the PUT. Retry the publish.

**Hosted viewer → `dataSource: "empty"` even though the repo has data**

Either `RYMINE_REMOTE_DATA_URL` isn't set on Render, the URL is wrong, or
the JSON at that URL failed validation (check it parses + has `source`,
`lastScrapedAt`, `albums[]`). The viewer never falls back to mock data in
readonly — that's intentional, so "empty" really means "unreachable or
malformed."

**Hosted viewer → stale data after a publish**

Wait up to `RYMINE_REMOTE_DATA_CACHE_SECONDS` (default 300s) for the next
fetch. To force a fresh fetch immediately, restart the Render service. To
make this faster by default, lower the env value.

## Rotating the GitHub token

1. Generate a new fine-grained PAT (same scope as above).
2. Paste into local `.env` as `RYMINE_GITHUB_TOKEN`.
3. Restart the local app.
4. Delete the old token in GitHub's PAT settings.

Render doesn't have the token, so nothing to rotate there.

## Legacy Render direct-publish

The old `RYMINE_PUBLISH_URL` + `RYMINE_PUBLISH_TOKEN` flow still works
exactly as before. If `RYMINE_PUBLISH_BACKEND` is unset and only the
Render vars are present, the Publish button uses the Render backend. Set
`RYMINE_PUBLISH_BACKEND=render` to force the legacy backend even if both
sets of vars are present. The `/api/publish` endpoint on the hosted
viewer still accepts bearer-token POSTs.

This is kept as a safety net during transition. Once GitHub is verified
working in production for a while, you can drop `RYMINE_PUBLISH_TOKEN`
from Render and stop using `/api/publish`.
