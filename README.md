# RYMine

A personal browser for my [Rate Your Music](https://rateyourmusic.com) wishlist.

The idea: I wake up wanting a certain kind of music and want to see, straight
away, which albums in my wishlist match that mood — Ambient, Zeuhl, Berlin
School, Cosmic Americana, whatever it is today.

Two surfaces:

- **Browser Mode** — the full library. Filter by genre, descriptor and release
  year (all faceted, all combinable), search, sort, mark albums On Deck, and
  drill into album detail with ratings, descriptors and streaming links.
- **Car Mode** (`/car`) — a calm, large-touch-target UI for use while driving.
  Genre tiles, a Surprise Me shuffle, and a player card with one-tap links out
  to Spotify, Apple Music and RYM.

Installable as a PWA on iOS — see [docs/PWA_INSTALL.md](docs/PWA_INSTALL.md).

---

## Architecture

One codebase, two runtime personalities, chosen at boot by `RYMINE_MODE`.

```
┌──────────────────────────┐
│  Local RYMine (my Mac)   │   RYMINE_MODE=local
│  full writable app       │   scraping · import · enrichment
│                          │   On Deck editing · publishing
└───────────┬──────────────┘   holds the GitHub write token
            │ publish
            ▼
┌──────────────────────────┐
│  RYMineData (GitHub)     │   public repo, published wishlist JSON
└───────────┬──────────────┘
            │ read over HTTPS
      ┌─────┴─────┐
      ▼           ▼
┌───────────┐ ┌───────────┐
│ Cloudflare│ │  Render   │   RYMINE_MODE=readonly
│   Pages   │ │           │
│ primary,  │ │ parallel  │
│  public   │ │ fallback, │
│           │ │ password  │
└───────────┘ └───────────┘
```

**Local** is the full application and the only writer. **RYMineData** is a
separate public GitHub repo holding the published wishlist JSON — the single
source of truth for anything hosted. **Cloudflare Pages** is the primary
public read-only viewer. **Render** runs the same read-only app in parallel as
a fallback, behind a viewer password.

Both hosted deployments read the same published data. Neither can write.

### Safety boundary

> Only the local application can modify or publish data. Hosted deployments
> are strictly read-only and receive **no GitHub write credentials** — no
> token, no publish configuration, nothing capable of altering RYMineData.

This is enforced in layers, not by convention: a route blocklist and a
non-GET/HEAD block in `src/hooks.server.ts`, `assertWritableMode()` at every
write entry point, and `CAN_SEND_PUBLISH` being false in readonly by
construction, so the publish path and its UI don't exist. Public read access
on Cloudflare removes the login gate and nothing else.

`npm run check:modes` asserts all of this against a running server.

---

## Branches and deployment

```
feature branches  →  main
                      ├──  production  →  Render
                      └──  cloudflare  →  Cloudflare Pages
```

`main` is canonical — the latest known-good code. **It does not itself
deploy.** Deployment happens by merging `main` into a deployment branch, which
is what makes releasing to each host a deliberate act rather than a side
effect of landing a feature.

Never commit directly to `production` or `cloudflare`; merge into them.

---

## Local development

```sh
npm install
npm run dev          # dev server
npm run verify       # check + lint + focused checks + both build targets
```

Run as a background service on macOS (what I actually use day to day):

```sh
npm run svc:install  # then svc:start / svc:stop / svc:restart / svc:status
```

Code changes need `npm run build` **and** `npm run svc:restart` — see
[docs/MACOS_LAUNCHAGENT.md](docs/MACOS_LAUNCHAGENT.md) for why both are
required.

Configuration lives in `.env` (gitignored). `.env.example` documents every
variable and which deployment each one belongs to.

---

## Documentation

| Topic                       | Doc                                                            |
| --------------------------- | -------------------------------------------------------------- |
| Cloudflare Pages deployment | [docs/CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md) |
| Render deployment           | [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md)         |
| Publishing to RYMineData    | [docs/PUBLISH_GITHUB.md](docs/PUBLISH_GITHUB.md)               |
| macOS LaunchAgent service   | [docs/MACOS_LAUNCHAGENT.md](docs/MACOS_LAUNCHAGENT.md)         |
| Versioning and releases     | [docs/VERSIONING.md](docs/VERSIONING.md)                       |
| Installing as a PWA         | [docs/PWA_INSTALL.md](docs/PWA_INSTALL.md)                     |

Working conventions and architecture rules for this repo are in
[CLAUDE.md](CLAUDE.md).

`GET /api/health` on any instance reports its mode, data source, version and
build commit — the quickest way to confirm what a deployment is actually
running.

---

## Stack

SvelteKit (Svelte 5 runes) · TypeScript · Tailwind CSS · DaisyUI · Playwright
for the scraper. Storage is JSON files — no database. The build targets
`adapter-node` by default and `adapter-cloudflare` when `ADAPTER=cloudflare`
is set.

This is a personal utility, not a product. It is deliberately small.
