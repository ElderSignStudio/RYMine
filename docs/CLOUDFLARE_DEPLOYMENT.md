# Deploying RYMine to Cloudflare Pages (public read-only viewer)

The Cloudflare deployment is a **strictly read-only, publicly viewable** copy
of RYMine. It reads its wishlist from the public RYMineData GitHub repo over
HTTPS and holds **no credentials of any kind**.

Render continues to run the password-gated viewer unchanged. Nothing in this
document requires a Render configuration change.

> **Status:** not deployed yet. The build and the local `workerd` preview are
> verified; the first real deploy is still pending.

---

## Build settings

| Setting                | Value                      |
| ---------------------- | -------------------------- |
| Framework preset       | SvelteKit                  |
| Build command          | `npm run build:cloudflare` |
| Build output directory | `.svelte-kit/cloudflare`   |
| Node version           | `NODE_VERSION=22`          |

`npm run build:cloudflare` is just `ADAPTER=cloudflare vite build`. The
`ADAPTER` variable is what selects `@sveltejs/adapter-cloudflare`; without it
the build uses `adapter-node`, which is what local dev and Render want.

Set `NODE_VERSION=22` as a build environment variable. The project is on Vite 8
and `@types/node` v22, and there is no `engines` field for Cloudflare to infer
from.

Compatibility settings come from [`wrangler.jsonc`](../wrangler.jsonc) in the
repo root — `nodejs_compat` with a `compatibility_date` of `2025-09-23`. Both
matter:

- `nodejs_compat` — the readonly request path still uses `node:crypto` and
  `Buffer` in the session helpers.
- `compatibility_date >= 2025-04-01` — makes the Workers runtime populate
  `process.env` from the configured environment variables. `appMode.ts` reads
  its configuration from `process.env` at module load, so without this the app
  would silently fall back to `local` mode and serve mock data.

---

## Environment variables

Set exactly these, and nothing else:

```
RYMINE_MODE=readonly
RYMINE_PUBLIC_VIEWER=1
RYMINE_REMOTE_DATA_URL=https://raw.githubusercontent.com/<owner>/<repo>/main/data/wishlist.json
RYMINE_REMOTE_DATA_CACHE_SECONDS=300
```

Plus the build setting `NODE_VERSION=22`.

Cloudflare supplies `CF_PAGES_COMMIT_SHA` automatically; the build picks it up
for the version label. Nothing to configure.

### Never set these on Cloudflare

```
RYMINE_GITHUB_TOKEN        RYMINE_GITHUB_OWNER      RYMINE_GITHUB_REPO
RYMINE_GITHUB_BRANCH       RYMINE_GITHUB_PATH       RYMINE_PUBLISH_BACKEND
RYMINE_PUBLISH_TOKEN       RYMINE_PUBLISH_URL       RYMINE_VIEWER_PASSWORD
```

The first eight are write credentials or write configuration. Publishing must
stay exclusively local. `RYMINE_VIEWER_PASSWORD` is simply unnecessary — this
deployment is meant to be public, and `RYMINE_PUBLIC_VIEWER` takes precedence
over a password anyway.

---

## What makes it read-only

Public read access and write capability are independent. `RYMINE_PUBLIC_VIEWER=1`
removes the **login gate** and nothing else. Still fully in force:

1. **No credentials.** Publishing needs `RYMINE_GITHUB_TOKEN`; it isn't there.
   `CAN_SEND_PUBLISH` is `IS_LOCAL && backend !== 'none'`, so it is `false` and
   the publish path and its UI don't exist.
2. **Route blocklist** — `/bookmarklet`, `/queue`, `/api/import`, `/api/enrich`
   return 403 regardless of auth (`src/hooks.server.ts`).
3. **Method block** — any non-GET/HEAD outside login/logout/publish → 403.
4. **`assertWritableMode()`** throws 403 at every write entry point.
5. **`/api/publish`** reports 404 when no publish token is configured, so the
   receiver presents as absent rather than merely misconfigured.

`npm run check:modes` asserts all of this against a real server.

---

## Verifying a deploy

```sh
curl -s https://<project>.pages.dev/api/health | jq
```

Three fields matter most:

- `"mode": "readonly"` — if this says `local`, `process.env` is not reaching
  the Worker. Check `nodejs_compat` and the compatibility date.
- `"dataSource": "remote-url"` — if this says `empty` or `mock`,
  `RYMINE_REMOTE_DATA_URL` is missing or unreachable.
- `"commit"` — should match the deployed commit in the Cloudflare dashboard.

---

## Local preview

```sh
npm run build:cloudflare
npx wrangler pages dev .svelte-kit/cloudflare \
  --binding RYMINE_MODE=readonly RYMINE_PUBLIC_VIEWER=1 \
            RYMINE_REMOTE_DATA_URL=<raw github url>
```

> ⚠️ **`wrangler pages dev` loads your local `.env` into the preview Worker**,
> including `RYMINE_GITHUB_TOKEN`, and does so even with `--env-file` pointed
> elsewhere. The preview is therefore _more_ privileged than the real
> deployment — don't use it to judge whether write surfaces are properly
> disabled. `.env` is gitignored and never reaches Cloudflare. Use
> `npm run check:modes` for the credential-free behaviour.

---

## Known differences from Render

- **Different origin.** An installed PWA on `*.pages.dev` is a separate install
  with its own `localStorage`, so the saved theme won't carry over and the
  home-screen icon must be re-added. Worth setting up a custom domain before
  installing, to avoid doing it twice.
- **Per-isolate cache.** `remoteData.ts` caches in module scope. Workers run
  many short-lived isolates, so the 300s TTL is far less effective than on a
  single long-lived Render process — expect more GitHub fetches. Harmless for
  now; the Cache API is the eventual fix.
