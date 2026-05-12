import { existsSync, readdirSync } from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'playwright';

import { paths, readScraperConfig, type ScraperConfig } from './config.ts';
import { humanPause, sleep } from './delays.ts';
import {
	detectBlock,
	detectLoginState,
	extractAlbumsFromWishlistPage,
	findNextPageHref,
	type ExtractedAlbum
} from './extract.ts';
import { log } from './logger.ts';
import {
	AlbumStore,
	ensureDirs,
	loadWishlist,
	saveWishlist,
	writeDebugDump,
	type WishlistFile
} from './storage.ts';

async function scrape() {
	const config = readScraperConfig();
	await ensureDirs();

	if (!existsSync(paths.profileDir) || readdirSync(paths.profileDir).length === 0) {
		throw new Error(
			`No browser profile at ${paths.profileDir}. Run \`npm run scrape:login\` first.`
		);
	}

	const previous = await loadWishlist();
	const store = new AlbumStore(previous?.albums ?? []);
	log.info(`Starting with ${store.size} previously-saved albums.`);

	log.info(
		`Launching ${config.channel ?? 'chromium'} (${config.headless ? 'headless' : 'headed'}) with persistent profile…`
	);
	const context = await chromium.launchPersistentContext(paths.profileDir, {
		channel: config.channel,
		headless: config.headless,
		viewport: { width: 1280, height: 900 }
	});

	let stoppedReason: string | null = null;
	try {
		await runPagination({ context, config, store });
	} catch (err) {
		stoppedReason = `error: ${err instanceof Error ? err.message : String(err)}`;
		log.error('Scrape interrupted:', err);
	} finally {
		await persist(store);
		// Closing the persistent context flushes profile state to disk —
		// any fresh Cloudflare clearance cookie obtained mid-run is preserved.
		await context.close().catch(() => {});
	}

	log.info(`Final saved album count: ${store.size}`);
	if (stoppedReason) {
		log.warn(`Stopped early: ${stoppedReason}`);
		process.exit(1);
	}
}

async function runPagination(args: {
	context: BrowserContext;
	config: ScraperConfig;
	store: AlbumStore;
}) {
	const { context, config, store } = args;
	const page = context.pages()[0] ?? (await context.newPage());

	log.info(`Navigating to wishlist: ${config.wishlistUrl}`);
	await page.goto(config.wishlistUrl, { waitUntil: 'domcontentloaded' });
	await waitForChallengeIfPresent(page, config);

	const loginState = await detectLoginState(page);
	if (!loginState.loggedIn) {
		throw new Error(
			'Not logged in (no logout link detected). Re-run `npm run scrape:login` to refresh the profile.'
		);
	}
	log.info(`Logged in as: ${loginState.username ?? '(unknown)'}`);

	let pageNum = 1;
	let currentUrl: string | null = page.url();

	while (currentUrl && pageNum <= config.maxPages) {
		log.info(`Page ${pageNum}: ${currentUrl}`);

		await page.waitForLoadState('networkidle').catch(() => {});
		await waitForChallengeIfPresent(page, config);

		const extracted = await extractAlbumsFromWishlistPage(page);
		if (config.debug) {
			const html = await page.content();
			const file = await writeDebugDump(`page-${pageNum}.html`, html);
			log.info(`[debug] dumped HTML to ${file}`);
		}

		if (extracted.length === 0) {
			log.warn(
				'No albums extracted on this page — selectors may be off, or pagination is exhausted.'
			);
			if (config.debug || pageNum === 1) {
				const html = await page.content();
				const file = await writeDebugDump(`empty-page-${pageNum}.html`, html);
				log.warn(`Dumped page HTML for inspection: ${file}`);
			}
			break;
		}

		const summary = absorb(store, extracted);
		log.info(`  +${summary.added} new / ${summary.duplicates} dup (total saved: ${store.size})`);

		await persist(store);

		const next = await findNextPageHref(page, currentUrl);
		if (!next) {
			log.info('No next-page link found. Reached end of wishlist.');
			break;
		}

		const pauseMs = await humanPause(config.minDelayMs, config.maxDelayMs);
		log.info(`  …pausing ${pauseMs}ms before next page`);

		await page.goto(next, { waitUntil: 'domcontentloaded' });
		currentUrl = page.url();
		pageNum += 1;
	}

	if (pageNum > config.maxPages) {
		log.warn(`Hit RYM_MAX_PAGES safety cap (${config.maxPages}).`);
	}
}

async function waitForChallengeIfPresent(page: Page, config: ScraperConfig): Promise<void> {
	const initial = await detectBlock(page);
	if (!initial.blocked) return;

	if (config.headless) {
		throw new Error(
			`Cloudflare/anti-bot challenge detected on ${page.url()} (${initial.reason}). ` +
				`Re-run with RYM_HEADLESS=false so you can solve it interactively, ` +
				`or run \`npm run scrape:login\` first to warm the profile.`
		);
	}

	log.warn(
		`Cloudflare-style challenge detected on ${page.url()}. ` +
			`Solve it manually in the browser window. Waiting up to ${Math.round(config.challengeWaitMs / 1000)}s…`
	);

	const deadline = Date.now() + config.challengeWaitMs;
	while (Date.now() < deadline) {
		await sleep(2000);
		const current = await detectBlock(page);
		if (!current.blocked) {
			log.info('Challenge cleared. Continuing.');
			return;
		}
	}

	throw new Error(`Challenge still present after ${config.challengeWaitMs}ms — giving up.`);
}

function absorb(
	store: AlbumStore,
	extracted: ExtractedAlbum[]
): { added: number; duplicates: number } {
	let added = 0;
	let duplicates = 0;
	const nowIso = new Date().toISOString();
	for (const album of extracted) {
		const result = store.add({
			artist: album.artist,
			title: album.title,
			year: album.year,
			url: album.url,
			genres: album.genres,
			dateAdded: album.dateAdded ?? nowIso
		});
		if (result === 'added') added += 1;
		else duplicates += 1;
	}
	return { added, duplicates };
}

async function persist(store: AlbumStore): Promise<void> {
	const file: WishlistFile = {
		lastScrapedAt: new Date().toISOString(),
		source: 'rym',
		albums: store.values()
	};
	await saveWishlist(file);
}

scrape().catch((err) => {
	log.error('Fatal:', err);
	process.exit(1);
});
