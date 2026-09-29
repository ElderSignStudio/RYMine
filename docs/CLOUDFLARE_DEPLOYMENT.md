# Deploying RYMine to Cloudflare Pages (public read-only viewer)

The Cloudflare deployment is a **strictly read-only, publicly viewable** copy
of RYMine. It reads its wishlist from the public RYMineData GitHub repo over
HTTPS and holds **no credentials of any kind**.

Render continues to run the password-gated viewer unchanged. Nothing in this
document requires a Render configuration change.

> **Status:** live and functionally verified — Browser Mode, all filters
> (including Release Year), album navigation, external links, On Deck display,
> Car Mode, Genres, Surprise Me, direct page loads, and iPhone use.

---

## Build settings

This is the configuration actually in use, not a suggestion.

| Setting                | Value                              |
| ---------------------- | ---------------------------------- |
| Production branch      | `cloudflare`                       |
| Framework preset       | SvelteKit                          |
| Build command          | `ADAPTER=cloudflare npm run build` |
| Build output directory | `.svelte-kit/cloudflare`           |
| Build variable         | `NODE_VERSION=22`                  |

**`ADAPTER` must be supplied explicitly in the build command.** It is what
selects `@sveltejs/adapter-cloudflare` in `svelte.config.js`; without it the
build silently produces an adapter-node bundle, which is what local dev and
Render want and what Cloudflare cannot run.

(`npm run build:cloudflare` is an equivalent shorthand used by `npm run verify`
locally. Either works — the dashboard uses the explicit form.)

`NODE_VERSION=22` is a build environment variable. The project is on Vite 8 and
`@types/node` v22, and there is no `engines` field for Cloudflare to infer from.

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

There are two separate channels, and getting them confused is what broke the
first deployment.

### Runtime — `wrangler.jsonc`, NOT the dashboard

> **Once a Pages project has a Wrangler configuration file, that file
> supersedes dashboard-set variables and bindings for Functions.**

The first deploy set these four in the dashboard only. The Worker received
none of them, fell back to `RYMINE_MODE=local`, and served 16 mock albums —
while the build-time variables kept working normally, which is what made the
cause non-obvious. They now live in [`wrangler.jsonc`](../wrangler.jsonc):

```jsonc
"vars": {
  "RYMINE_MODE": "readonly",
  "RYMINE_PUBLIC_VIEWER": "1",
  "RYMINE_REMOTE_DATA_URL": "https://raw.githubusercontent.com/ElderSignStudio/RYMineData/main/data/wishlist.json",
  "RYMINE_REMOTE_DATA_CACHE_SECONDS": "300"
}
```

All four are non-secret: a mode flag, a boolean, the public RYMineData raw URL,
and a cache TTL. Committing them is deliberate — the deployment's runtime
configuration is then reproducible and reviewable.

### Build-time — the dashboard

```
ADAPTER=cloudflare      (also in the build command; see above)
NODE_VERSION=22
```

These must stay in the dashboard. `vars` reach the Worker, not the build, so
moving them into `wrangler.jsonc` would do nothing.

Cloudflare supplies `CF_PAGES_COMMIT_SHA` automatically and the build picks it
up for the version label. Nothing to configure.

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

- `"mode": "readonly"` — if this says `local`, the Worker is not receiving its
  runtime variables. Check the `vars` block in `wrangler.jsonc` first (dashboard
  variables do not apply once that file exists), then `nodejs_compat` and the
  compatibility date.
- `"dataSource": "remote-url"` — if this says `empty` or `mock`,
  `RYMINE_REMOTE_DATA_URL` is missing or unreachable.
- `"commit"` — should match the deployed commit in the Cloudflare dashboard.

---

## Local preview

```sh
npm run build:cloudflare
npx wrangler pages dev .svelte-kit/cloudflare
```

No `--binding` flags needed — `wrangler pages dev` reads the same `vars` block
the deployment uses, which makes this a faithful check of the runtime config.

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
