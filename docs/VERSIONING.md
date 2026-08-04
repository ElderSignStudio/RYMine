# Versioning and build identification

The question this answers: **is the app I'm looking at actually running my
latest push, or a stale build?**

RYMine shows two identifiers, because they answer different halves of that:

| Identifier | Example   | Changes when                    |
| ---------- | --------- | ------------------------------- |
| version    | `v0.0.1`  | you deliberately bump it        |
| commit     | `d80e3a9` | **every** deploy, bumped or not |

The commit is the one that actually settles "did Render pick up my push?".
The version is for naming releases you care about.

Displayed as:

```
RYMine v0.0.1 · build d80e3a9
```

Hovering it shows the build timestamp.

---

## Where it shows up

- **Full app** — footer, under "local-only · JSON-backed · …"
- **Car Mode** — very small line at the very bottom of every Car Mode screen
- **Enrichment queue** and **Bookmarklets** — footer
- **`GET /api/health`** — as `version`, `commit`, `buildTime`

The readonly hosted viewer uses the same footers, so it's covered by the first
two. `/api/health` needs no login, which makes it the quickest check of all.

---

## Where the values come from

**Version** — `package.json`, and nothing else. It is the single source of
truth. Read at build time in `vite.config.ts` and injected as a compile-time
constant.

**Commit** — first match wins:

1. `RYMINE_BUILD_COMMIT` — explicit override, works on any host
2. `RENDER_GIT_COMMIT` — set automatically by Render on every deploy
3. `git rev-parse HEAD` — local dev convenience
4. `local` — if git isn't available (never fails the build)

Steps 1–3 run **at build time** in `vite.config.ts`, so there are no
subprocess or filesystem calls once the server is up. `src/lib/server/buildInfo.ts`
re-reads `RYMINE_BUILD_COMMIT` / `RENDER_GIT_COMMIT` at boot and prefers them
if set, which covers redeploying an existing build.

SHAs are shortened to 7 characters for display. Sentinels like `local` pass
through unshortened.

The version string is rendered **server-side** on every request (it comes down
in the HTML via the root layout load), so a cached client bundle can't show a
stale number.

---

## Release workflow

```sh
# 1. make your changes

# 2. check everything still works
npm run verify          # check + lint + rymlink checks + build

# 3. only if this should be a named release:
npm run version:patch   # 0.0.1 → 0.0.2
npm run version:minor   # 0.0.1 → 0.1.0
npm run version:major   # 0.0.1 → 1.0.0

# 4. commit + push (npm version already committed the bump itself — see below)
git push && git push --tags

# 5. wait for Render to finish deploying

# 6. confirm the deploy
curl -s https://<your-render-host>/api/health | jq '{version, commit}'
```

`npm run release:patch` does steps 2 and 3 in one go. It deliberately stops
there — pushing and deploying stay manual.

### What `npm version` actually does

This trips people up, so, explicitly. `npm version patch` will:

1. update `version` in **`package.json`**
2. update `version` in **`package-lock.json`**
3. **create a git commit** containing both (e.g. `v0.0.2`)
4. **create a git tag** (e.g. `v0.0.2`)

It does **not** push. Nothing leaves your machine until you `git push`.

It also refuses to run with a dirty working tree, so commit your actual
changes first, then bump.

If you'd rather not have the commit and tag, use `npm version patch --no-git-tag-version`,
which edits the two files and stops.

### Bumping is optional

The version is **not** touched during a Render build, and should not be. Most
deploys don't need a version bump at all — the commit SHA already makes every
deploy distinguishable. Bump when you want a human-meaningful marker.

---

## Verifying Render is serving the newest build

The fastest check, no login needed:

```sh
curl -s https://<your-render-host>/api/health | jq '{version, commit, buildTime}'
```

Compare `commit` against what you pushed:

```sh
git rev-parse --short=7 HEAD
```

Match → Render is current. Mismatch → the deploy hasn't finished, or it
failed; check the Render dashboard's deploy log. The commit shown in Render's
deploy listing should equal the one in the health response.

You can also just look at the footer, or the bottom of any Car Mode screen.

### Caching

`/api/health` is served with `cache-control: no-store, max-age=0`, so a probe
never returns a cached answer.

There is **no service worker** in this project (`/service-worker.js` 404s), so
there is no app-shell cache that could pin an old build. The rest of the
caching picture:

| Resource            | cache-control                       |
| ------------------- | ----------------------------------- |
| HTML pages          | none — browser revalidates          |
| `/_app/immutable/*` | `public,max-age=31536000,immutable` |
| `/api/health`       | `no-store, max-age=0`               |

The immutable bundle is safe to cache forever because its filenames are
content-hashed: a new build produces new filenames, and the freshly rendered
HTML points at them. Adding "Add to Home Screen" on iOS doesn't change any of
this — without a service worker the PWA fetches like a normal browser tab.
