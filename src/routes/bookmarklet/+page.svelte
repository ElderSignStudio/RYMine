<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let showSource = $state(false);
</script>

<svelte:head>
	<title>Bookmarklet · RYMScraper</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-base-100 text-base-content">
	<header class="border-b border-base-300/70 bg-base-200/60">
		<div class="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
			<a
				href="/"
				class="text-sm text-base-content/60 transition hover:text-primary"
				aria-label="Back to wishlist"
			>
				← Back
			</a>
			<div class="ml-2 leading-tight">
				<h1 class="text-lg font-semibold tracking-tight sm:text-xl">Bookmarklet setup</h1>
				<p class="text-xs text-base-content/60">
					one-click import from your real, logged-in RYM tab
				</p>
			</div>
		</div>
	</header>

	<main class="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6">
		<!-- Step 1: install -->
		<section class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
			<h2 class="mb-2 text-base font-semibold">1. Add the bookmarklet to your bookmarks bar</h2>
			<p class="mb-4 text-sm text-base-content/70">
				Drag the button below onto your browser's bookmarks bar (or right-click → "Bookmark this
				link"):
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<a
					href={data.href}
					draggable="true"
					class="btn shadow-sm transition btn-primary hover:-translate-y-0.5 hover:shadow-md"
				>
					📥 RYMScraper Import
				</a>
				<span class="text-xs text-base-content/50">
					(if your browser hides the bookmarks bar, enable it first:
					<kbd class="kbd kbd-xs">⌘ ⇧ B</kbd>
					on Mac)
				</span>
			</div>
		</section>

		<!-- Step 2: usage -->
		<section class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
			<h2 class="mb-2 text-base font-semibold">2. Use it on your RYM wishlist</h2>
			<p class="mb-3 text-sm text-base-content/70">
				Two flavors of workflow — both use the same bookmarklet:
			</p>

			<h3 class="mb-1 text-sm font-semibold tracking-tight">
				Casual add (merge-only, the default)
			</h3>
			<ol class="mb-4 ml-5 list-decimal space-y-1.5 text-sm text-base-content/80">
				<li>
					Make sure this local app is running (<code class="rounded bg-base-300/60 px-1.5 py-0.5"
						>npm run dev</code
					>).
				</li>
				<li>
					In your normal browser tab, go to your RYM wishlist (e.g.
					<code class="rounded bg-base-300/60 px-1.5 py-0.5"
						>https://rateyourmusic.com/collection/&lt;you&gt;/wishlist</code
					>).
				</li>
				<li>Click the <em>RYMScraper Import</em> bookmarklet on the page(s) you care about.</li>
				<li>
					New albums show up locally. Albums you removed on RYM <strong>stay</strong> until you do a full
					sync.
				</li>
			</ol>

			<h3 class="mb-1 text-sm font-semibold tracking-tight">
				Full sync (reflects removals — do this occasionally)
			</h3>
			<ol class="ml-5 list-decimal space-y-1.5 text-sm text-base-content/80">
				<li>
					In <a href="/" class="link link-primary">this app</a>, click
					<em>Start Full Sync</em>. It takes a snapshot of your current local wishlist.
				</li>
				<li>
					In your RYM tab, click the bookmarklet on <strong>every</strong> page of your wishlist (page
					1 → click → Next → click → … through the last page). The alert will tell you how many pages
					and albums have been seen in this sync.
				</li>
				<li>
					Back in this app, click <em>Finish Full Sync</em>. You'll see a preview showing how many
					albums will be added, kept, and <strong>removed</strong>. Confirm to commit.
				</li>
				<li>
					If you miss a page or get interrupted, click <em>Cancel Sync</em> — nothing is removed.
				</li>
			</ol>
		</section>

		<!-- Step 3: endpoint -->
		<section class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
			<h2 class="mb-2 text-base font-semibold">3. Where the data goes</h2>
			<p class="text-sm text-base-content/70">
				Each click POSTs JSON to your local endpoint, which merges into
				<code class="rounded bg-base-300/60 px-1.5 py-0.5">data/wishlist.json</code>
				(deduplicated by normalized RYM URL):
			</p>
			<div class="mt-3 flex items-center gap-2">
				<code
					class="flex-1 truncate rounded bg-base-300/60 px-3 py-2 text-sm font-medium"
					title={data.endpoint}
				>
					POST {data.endpoint}
				</code>
			</div>
		</section>

		<!-- Troubleshooting -->
		<section class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
			<h2 class="mb-2 text-base font-semibold">Troubleshooting</h2>
			<ul class="ml-5 list-disc space-y-2 text-sm text-base-content/70">
				<li>
					<strong>"could not reach the local app"</strong> — make sure
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">npm run dev</code> is running and that
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">{data.origin}</code> matches the URL
					you generated this bookmarklet on. If the dev-server port changes, just revisit
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">/bookmarklet</code> and re-drag.
				</li>
				<li>
					<strong>"no albums detected"</strong> — the bookmarklet only runs on
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">rateyourmusic.com</code>. Confirm
					you're on a wishlist page that actually lists albums.
				</li>
				<li>
					<strong>Browser refuses to fetch from https → http</strong> — modern Chrome / Firefox /
					Safari treat
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">http://localhost</code>
					and <code class="rounded bg-base-300/60 px-1.5 py-0.5">127.0.0.1</code> as a secure context,
					so this should work. If you hit a "mixed content" error, try Chrome or Firefox; older Safari
					versions are stricter.
				</li>
				<li>
					<strong>Strict content-security-policy on the page</strong> — bookmarklets are normally
					exempt from CSP because they are user-initiated. If a specific RYM page blocks it, use the
					<a href="/" class="link link-primary">HTML file import</a>
					as a fallback for that page.
				</li>
			</ul>
		</section>

		<!-- Source toggle -->
		<section class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
			<button
				type="button"
				class="flex w-full items-center justify-between text-left text-sm font-medium text-base-content/80 transition hover:text-primary"
				onclick={() => (showSource = !showSource)}
			>
				<span>{showSource ? 'Hide' : 'Show'} bookmarklet source</span>
				<span aria-hidden="true">{showSource ? '▾' : '▸'}</span>
			</button>
			{#if showSource}
				<p class="mt-3 text-xs text-base-content/60">
					This is what runs inside your browser when you click the bookmarklet. Nothing else is
					injected.
				</p>
				<pre
					class="scrollbar-soft mt-2 max-h-96 overflow-auto rounded bg-base-300/40 p-3 text-xs leading-snug"><code
						>{data.source}</code
					></pre>
			{/if}
		</section>
	</main>

	<footer class="border-t border-base-300/60 py-3 text-center text-xs text-base-content/40">
		local-only · JSON-backed · same DOM your real browser is already showing
	</footer>
</div>
