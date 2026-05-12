import path from 'node:path';

try {
	process.loadEnvFile('.env');
} catch {
	// .env is optional
}

const ROOT = process.cwd();

export const paths = {
	dataDir: path.join(ROOT, 'data'),
	authDir: path.join(ROOT, 'data', 'auth'),
	profileDir: path.join(ROOT, 'data', 'auth', 'profile'),
	wishlistFile: path.join(ROOT, 'data', 'wishlist.json'),
	debugDir: path.join(ROOT, 'data', 'debug')
};

export type BrowserChannel = 'chrome' | 'chrome-beta' | 'msedge' | 'msedge-beta' | undefined;

export type ScraperConfig = {
	wishlistUrl: string;
	loginUrl: string;
	channel: BrowserChannel;
	headless: boolean;
	maxPages: number;
	minDelayMs: number;
	maxDelayMs: number;
	challengeWaitMs: number;
	debug: boolean;
};

function bool(env: string | undefined, fallback: boolean): boolean {
	if (env === undefined || env === '') return fallback;
	return /^(1|true|yes|on)$/i.test(env);
}

function int(env: string | undefined, fallback: number): number {
	if (env === undefined) return fallback;
	const n = Number.parseInt(env, 10);
	return Number.isFinite(n) ? n : fallback;
}

function channel(env: string | undefined): BrowserChannel {
	const v = env?.trim().toLowerCase();
	if (!v) return undefined;
	if (v === 'chrome' || v === 'chrome-beta' || v === 'msedge' || v === 'msedge-beta') {
		return v;
	}
	return undefined;
}

export function readScraperConfig(): ScraperConfig {
	const wishlistUrl = process.env.RYM_WISHLIST_URL?.trim();
	if (!wishlistUrl) {
		throw new Error(
			'RYM_WISHLIST_URL is not set. Create a .env file with RYM_WISHLIST_URL=<your wishlist URL>.'
		);
	}

	return {
		wishlistUrl,
		loginUrl: process.env.RYM_LOGIN_URL?.trim() || 'https://rateyourmusic.com/',
		channel: channel(process.env.RYM_BROWSER_CHANNEL),
		// Default to headed so the user can solve any Cloudflare interactive
		// challenge in the same window the scraper is using.
		headless: bool(process.env.RYM_HEADLESS, false),
		maxPages: int(process.env.RYM_MAX_PAGES, 100),
		minDelayMs: int(process.env.RYM_MIN_DELAY_MS, 3500),
		maxDelayMs: int(process.env.RYM_MAX_DELAY_MS, 7500),
		challengeWaitMs: int(process.env.RYM_CHALLENGE_WAIT_MS, 120_000),
		debug: bool(process.env.RYM_DEBUG, false)
	};
}
