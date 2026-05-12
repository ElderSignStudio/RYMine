import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright';

import { paths, readScraperConfig } from './config.ts';
import { ensureDirs } from './storage.ts';
import { log } from './logger.ts';

async function main() {
	let loginUrl = 'https://rateyourmusic.com/';
	let channel: ReturnType<typeof readScraperConfig>['channel'];
	try {
		const cfg = readScraperConfig();
		loginUrl = cfg.loginUrl;
		channel = cfg.channel;
	} catch {
		// .env not required for login — wishlist URL only matters when scraping
	}

	await ensureDirs();

	log.info('Opening Chromium with a persistent profile for manual RYM login…');
	log.info(`Profile directory: ${paths.profileDir}`);
	log.info('(Cookies + Cloudflare clearance will be stored here between runs.)');

	const context = await chromium.launchPersistentContext(paths.profileDir, {
		channel,
		headless: false,
		viewport: { width: 1280, height: 900 }
	});

	const page = context.pages()[0] ?? (await context.newPage());
	await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

	const rl = readline.createInterface({ input, output });
	console.log('');
	console.log('=========================================================');
	console.log(' 1. Solve any Cloudflare "verify you are human" challenge.');
	console.log(' 2. Log in to Rate Your Music.');
	console.log(' 3. Confirm you can see your username in the page header.');
	console.log(' 4. Optionally visit your wishlist once to warm the cache.');
	console.log(' 5. Then come back here and press Enter.');
	console.log(' (Press Ctrl+C to abort without saving anything new.)');
	console.log('=========================================================');
	await rl.question('Press Enter when you are logged in… ');
	rl.close();

	// Closing the persistent context flushes the profile (cookies, local
	// storage, IndexedDB, Cloudflare cf_clearance, etc.) to disk.
	await context.close();
	log.info(`Profile saved at ${paths.profileDir}`);
	log.info('You can now run: npm run scrape');
}

main().catch((err) => {
	log.error('Login flow failed:', err);
	process.exit(1);
});
