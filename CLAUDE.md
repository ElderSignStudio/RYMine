## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# RYMine — Claude Code Guidelines

## Project Overview

RYMine is a personal local-only utility app for organizing and exploring my Rate Your Music wishlist by genre.

The core UX goal is:

> “I wake up wanting a certain kind of music, and immediately see which albums in my wishlist match that mood or genre.”

Examples:

- Ambient
- Progressive Folk
- Zeuhl
- Berlin School
- Viking Metal
- Cosmic Americana
- Progressive Electronic

This is intended to feel like a cozy personal music library rather than a corporate productivity tool.

The app is NOT intended to:

- mirror RYM
- scrape aggressively
- become a public service
- support multiple users
- become a social platform

This is a personal archival/discovery utility only.

---

# Current Scope

Initial version:

- scrape my own RYM wishlist
- collect album metadata and genres
- browse genres with album counts
- click genre -> show matching albums
- click album -> open RYM page
- local JSON storage only

Future possible features:

- descriptors/tags/moods
- ratings
- year filtering
- advanced search
- sorting
- descriptor combinations
- random discovery
- “mood browsing”

Do NOT implement future features unless asked.

Keep the initial version focused and simple.

---

# Tech Stack

Use:

- SvelteKit (latest)
- TypeScript
- Tailwind CSS
- DaisyUI
- Playwright

Storage:

- local JSON files only

No database for now.

---

# Important Architecture Rules

This app is LOCAL ONLY.

Do NOT:

- deploy it
- add authentication
- add cloud infrastructure
- add a backend API server
- add user accounts
- add Supabase/Firebase/etc
- add Docker
- add analytics

Keep everything local and lightweight.

The app should run comfortably on macOS through VSCode during development.

Future desktop packaging (possibly Tauri) may happen later, but do NOT implement this unless asked.

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

Animations and visual niceness are welcome IF:

- simple
- stable
- easy to maintain
- low-drama

Avoid:

- over-engineering
- complex animation systems
- excessive visual polish work
- fragile UI abstractions

Prefer:

- subtle hover effects
- smooth transitions
- pleasant spacing
- readable typography
- lightweight UI enhancements

---

# Initial UI Requirements

Main page layout:

Left sidebar:

- genre list
- alphabetical order
- album counts beside each genre
- genre search/filter input

Right panel:

- albums matching selected genre
- format:
  Artist - Album Title (Year)

Album rows:

- clickable
- open RYM page in a new tab

Top area:

- “Scrape Wishlist” button
- last scraped timestamp

Use mock data initially before implementing scraping.

---

# Data Model

Use this shape:

```ts
export type WishlistAlbum = {
	artist: string;
	title: string;
	year?: number;
	url: string;
	genres: string[];

	// future fields
	rating?: number;
	descriptors?: string[];

	dateAdded?: string;
};
```

Structure code cleanly so descriptors and ratings can be added later without major rewrites.

---

# Scraping Rules (VERY IMPORTANT)

The scraper must scrape ONLY my own Rate Your Music wishlist.

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

The scraper should behave as gently and human-like as reasonably possible.

---

# Scraper UX

Eventually, the scraper should be triggerable from inside the app UI through a button.

However:

- keep scraping logic isolated from UI
- scraper should also be runnable independently if needed
- prioritize stability and simplicity over fancy integrations

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

After significant changes:

- run `npm run check`
- run `npm run lint`

Explain briefly:

- what changed
- why it changed
- any tradeoffs made

---

# Important Notes

This project is intended to be:

- fun
- lightweight
- useful daily
- easy to evolve gradually

Do not turn it into an enterprise application.
