## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# RYMine — Claude Code Guidelines

## Project Overview

RYMine is a personal utility for organizing and exploring my Rate Your Music
wishlist by genre.

The core UX goal is:

> “I wake up wanting a certain kind of music, and immediately see which albums in my wishlist match that mood or genre.”

Examples: Ambient, Progressive Folk, Zeuhl, Berlin School, Viking Metal,
Cosmic Americana, Progressive Electronic.

This should feel like a cozy personal music library, not a corporate
productivity tool.

The app is NOT intended to:

- mirror RYM
- scrape aggressively
- become a public service
- support multiple users
- become a social platform

It is a personal archival/discovery utility. The hosted copy is public to
read, but it is still a library of one.

---

# Architecture

One codebase, two runtime personalities, selected at boot by `RYMINE_MODE`
(see `src/lib/server/appMode.ts`).

## Local — `RYMINE_MODE=local`

The full writable application. Runs on my Mac via a LaunchAgent
(`npm run svc:*`, see `docs/MACOS_LAUNCHAGENT.md`) or `npm run dev`.

- scraping (Playwright), wishlist import, album enrichment (bookmarklets)
- On Deck editing, full-sync sessions
- publishing to the RYMineData repo
- holds the GitHub write token
- reads and writes `data/wishlist.json` on the local filesystem

## Hosted — `RYMINE_MODE=readonly`

A strictly read-only viewer. Browser Mode, Car Mode, and PWA install all work;
nothing can be modified.

- reads its wishlist from the **public RYMineData GitHub repo** over HTTPS
- no filesystem writes, no bookmarklets, no publishing
- **Render** currently hosts production (adapter-node, viewer password)
- a **Cloudflare Pages** migration is in progress (adapter-cloudflare, public)

## Data flow

```
local RYMine  ──publish──▶  RYMineData (public GitHub repo)
                                  │
                                  ▼  raw.githubusercontent.com
                            hosted RYMine (read-only)
```

Local is the only writer. Hosted is a reader, always.

---

# Deployment branches

| Branch                 | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `main`                 | canonical latest working code                  |
| `production`           | deployment branch watched by Render            |
| `cloudflare-migration` | temporary Cloudflare migration development     |
| `cloudflare`           | future deployment branch watched by Cloudflare |

Feature work happens on feature branches and lands on `main`. Never commit
directly to a deployment branch; merge into it deliberately.

---

# Security rules (IMPORTANT)

- Hosted deployments are **read-only**. This is enforced in layers: the route
  blocklist and non-GET/HEAD block in `src/hooks.server.ts`, plus
  `assertWritableMode()` at every write entry point.
- The **GitHub write token must NEVER be present in a hosted deployment.**
  Not on Render, not on Cloudflare, not in any build output.
- Only local RYMine may publish to or otherwise modify RYMineData.
- `CAN_SEND_PUBLISH` is `IS_LOCAL && backend !== 'none'`, so the publish path
  and its UI simply do not exist in readonly mode.
- Public read access (`RYMINE_PUBLIC_VIEWER=1`) removes the login gate only.
  It must never relax a write protection.

See `docs/CLOUDFLARE_DEPLOYMENT.md` and `docs/RENDER_DEPLOYMENT.md` for the
per-host environment variables, and `.env.example` for the full list.

---

# Tech Stack

- SvelteKit (latest) + Svelte 5 runes
- TypeScript
- Tailwind CSS + DaisyUI
- Playwright (scraper only)

Storage: local JSON files. The hosted copy reads a published JSON file from
GitHub. No database.

Adapters: `adapter-node` by default (local + Render), `adapter-cloudflare`
when `ADAPTER=cloudflare` is set at build time.

---

# UI / UX Direction

Visual direction:

- cozy music library
- warm and pleasant
- clean and readable
- slightly atmospheric
- music nerd / collector energy
- not corporate
- not overly futuristic
- not visually noisy

Use a pleasant DaisyUI theme.

Animations and visual niceness are welcome IF simple, stable, easy to
maintain, and low-drama.

Avoid over-engineering, complex animation systems, excessive polish work, and
fragile UI abstractions.

Prefer subtle hover effects, smooth transitions, pleasant spacing, readable
typography, and lightweight enhancements.

## Surfaces

- **Browser Mode** — sidebar of Genres / Descriptors / Release Year with
  album counts and bidirectional faceting; album list with search, sorting,
  On Deck, and album detail pages.
- **Car Mode** (`/car`) — deliberately calm, large-touch-target UI for use
  while driving. Keep it low-density. Changes to the full app should not leak
  into it.

---

# Data Model

`src/lib/types.ts` is the source of truth for `WishlistAlbum`. It carries the
scraped basics (artist, title, year, url, genres) plus enrichment fields
(ratings, descriptors, primary/secondary genres, streaming links, covers) and
the local-only On Deck marker.

Keep it additive: new optional fields should flow through import, enrichment,
sync, and publish without those pipelines needing to know about them.

---

# Scraping Rules (VERY IMPORTANT)

The scraper must scrape ONLY my own Rate Your Music wishlist, and only from
local mode.

The scraper must:

- run locally only
- use Playwright
- use saved authenticated browser sessions
- scrape slowly and respectfully
- use randomized delays between pages/actions
- avoid parallel requests
- cache aggressively
- save progress frequently
- skip already-scraped albums when possible
- stop immediately if blocked or rate-limited

The scraper must NOT:

- scrape charts
- scrape unrelated pages
- scrape other users
- run continuously
- use datacenter proxies
- attempt to bypass anti-bot protections
- hammer the site

Behave as gently and human-like as reasonably possible.

---

# Development Philosophy

Prefer:

- simple maintainable code
- readable files
- straightforward logic
- small reusable components
- incremental progress

Avoid:

- premature abstractions
- unnecessary complexity
- cleverness
- large dependency chains

Build one feature at a time.

## Before considering a change done

```sh
npm run verify   # check + lint + focused checks + build
```

Individually: `npm run check`, `npm run lint`, `npm run build`, and the
focused check scripts (`npm run check:filters`, `npm run check:rymlink`,
`npm run check:modes`).

When touching anything hosted, also build the Cloudflare target:

```sh
ADAPTER=cloudflare npm run build
```

Then explain briefly: what changed, why, and any tradeoffs.

---

# Important Notes

This project is intended to be fun, lightweight, useful daily, and easy to
evolve gradually.

Do not turn it into an enterprise application.
