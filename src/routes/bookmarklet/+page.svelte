<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let showImportSource = $state(false);
	let showEnrichSource = $state(false);
</script>

<svelte:head>
	<title>Bookmarklets · RYMine</title>
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
				<h1 class="text-lg font-semibold tracking-tight sm:text-xl">Bookmarklets</h1>
				<p class="text-xs text-base-content/60">
					two one-click tools that run inside your real, logged-in RYM tab
				</p>
			</div>
		</div>
	</header>

	<main class="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-6 sm:px-6">
		<!-- ───────────── IMPORT BOOKMARKLET ───────────── -->
		<section class="space-y-4">
			<header class="space-y-1">
				<h2 class="text-lg font-semibold tracking-tight">Wishlist import</h2>
				<p class="text-sm text-base-content/60">
					Run this on each <em>wishlist page</em>. It scoops up every album row on the page and
					sends them to your local copy.
				</p>
			</header>

			<div class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<h3 class="mb-2 text-sm font-semibold tracking-wide text-base-content/70 uppercase">
					Install
				</h3>
				<p class="mb-4 text-sm text-base-content/70">
					Drag the button onto your browser's bookmarks bar (or right-click → "Bookmark this link"):
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<a
						href={data.importHref}
						draggable="true"
						class="btn shadow-sm transition btn-primary hover:-translate-y-0.5 hover:shadow-md"
					>
						📥 RYMine Import
					</a>
					<span class="text-xs text-base-content/50">
						(if your browser hides the bookmarks bar, enable it first:
						<kbd class="kbd kbd-xs">⌘ ⇧ B</kbd> on Mac)
					</span>
				</div>
			</div>

			<div class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<h3 class="mb-2 text-sm font-semibold tracking-wide text-base-content/70 uppercase">
					Use it
				</h3>
				<p class="mb-3 text-sm text-base-content/70">Two flavors:</p>

				<h4 class="mb-1 text-sm font-semibold tracking-tight">
					Casual add (merge-only, the default)
				</h4>
				<ol class="mb-4 ml-5 list-decimal space-y-1.5 text-sm text-base-content/80">
					<li>Make sure this local app is running.</li>
					<li>
						Open your RYM wishlist, e.g.
						<code class="rounded bg-base-300/60 px-1.5 py-0.5"
							>https://rateyourmusic.com/collection/&lt;you&gt;/wishlist</code
						>.
					</li>
					<li>Click <em>RYMine Import</em>.</li>
					<li>
						New albums show up locally. Existing albums get their date / cover quietly refreshed.
						Albums you removed on RYM <strong>stay</strong> until you do a Full Sync.
					</li>
				</ol>

				<h4 class="mb-1 text-sm font-semibold tracking-tight">
					Full sync (reflects removals — do this occasionally)
				</h4>
				<ol class="ml-5 list-decimal space-y-1.5 text-sm text-base-content/80">
					<li>
						In <a href="/" class="link link-primary">this app</a>, click <em>Start Full Sync</em>.
					</li>
					<li>
						Click the bookmarklet on <strong>every</strong> page of your wishlist (page 1 → Next → page
						2 → …).
					</li>
					<li>
						Back in this app, click <em>Finish Full Sync</em> and confirm the preview of additions and
						removals.
					</li>
					<li>If interrupted, click <em>Cancel Sync</em> — nothing is removed.</li>
				</ol>
			</div>

			<div class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<h3 class="mb-2 text-sm font-semibold tracking-wide text-base-content/70 uppercase">
					Endpoint
				</h3>
				<code
					class="block w-full truncate rounded bg-base-300/60 px-3 py-2 text-sm font-medium"
					title={data.importEndpoint}
				>
					POST {data.importEndpoint}
				</code>
			</div>

			<div class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<button
					type="button"
					class="flex w-full items-center justify-between text-left text-sm font-medium text-base-content/80 transition hover:text-primary"
					onclick={() => (showImportSource = !showImportSource)}
				>
					<span>{showImportSource ? 'Hide' : 'Show'} import bookmarklet source</span>
					<span aria-hidden="true">{showImportSource ? '▾' : '▸'}</span>
				</button>
				{#if showImportSource}
					<p class="mt-3 text-xs text-base-content/60">
						This is what runs inside your browser when you click the bookmarklet.
					</p>
					<pre
						class="scrollbar-soft mt-2 max-h-96 overflow-auto rounded bg-base-300/40 p-3 text-xs leading-snug"><code
							>{data.importSource}</code
						></pre>
				{/if}
			</div>
		</section>

		<!-- ───────────── ENRICH BOOKMARKLET ───────────── -->
		<section class="space-y-4">
			<header class="space-y-1">
				<h2 class="text-lg font-semibold tracking-tight">Album-page enrichment</h2>
				<p class="text-sm text-base-content/60">
					Run this on a single <em>release page</em> to pull in the bigger cover, the RYM average, primary
					&amp; secondary genres, descriptors, and your own rating (if you've rated it).
				</p>
			</header>

			<div class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<h3 class="mb-2 text-sm font-semibold tracking-wide text-base-content/70 uppercase">
					Install
				</h3>
				<p class="mb-4 text-sm text-base-content/70">
					Drag the button onto your bookmarks bar — it sits next to the import one:
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<a
						href={data.enrichHref}
						draggable="true"
						class="btn shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
					>
						✨ RYMine Enrich Album
					</a>
					<span class="text-xs text-base-content/50">Only runs on rateyourmusic.com/release/…</span>
				</div>
			</div>

			<div class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<h3 class="mb-2 text-sm font-semibold tracking-wide text-base-content/70 uppercase">
					Use it
				</h3>
				<ol class="ml-5 list-decimal space-y-1.5 text-sm text-base-content/80">
					<li>
						Open an album you have in your wishlist (e.g.
						<code class="rounded bg-base-300/60 px-1.5 py-0.5"
							>https://rateyourmusic.com/release/album/&lt;artist&gt;/&lt;slug&gt;/</code
						>).
					</li>
					<li>Click <em>RYMine Enrich Album</em>.</li>
					<li>
						The alert tells you which fields were updated. Existing wishlist-row data (genres,
						dates, the small cover) is preserved — the enrichment fields live in their own slots.
					</li>
					<li>
						If the album <strong>isn't</strong> in your local wishlist yet, you'll get a clear error.
						Run the import bookmarklet on the wishlist page that lists it first, then come back and enrich.
					</li>
				</ol>
			</div>

			<div class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<h3 class="mb-2 text-sm font-semibold tracking-wide text-base-content/70 uppercase">
					Endpoint
				</h3>
				<code
					class="block w-full truncate rounded bg-base-300/60 px-3 py-2 text-sm font-medium"
					title={data.enrichEndpoint}
				>
					POST {data.enrichEndpoint}
				</code>
			</div>

			<div class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<button
					type="button"
					class="flex w-full items-center justify-between text-left text-sm font-medium text-base-content/80 transition hover:text-primary"
					onclick={() => (showEnrichSource = !showEnrichSource)}
				>
					<span>{showEnrichSource ? 'Hide' : 'Show'} enrich bookmarklet source</span>
					<span aria-hidden="true">{showEnrichSource ? '▾' : '▸'}</span>
				</button>
				{#if showEnrichSource}
					<p class="mt-3 text-xs text-base-content/60">
						This runs inside your browser when you click the enrich bookmarklet. The selectors are
						heuristic — RYM occasionally renames classes; if a field stops being extracted, the code
						falls through to other patterns rather than silently overwriting good data.
					</p>
					<pre
						class="scrollbar-soft mt-2 max-h-96 overflow-auto rounded bg-base-300/40 p-3 text-xs leading-snug"><code
							>{data.enrichSource}</code
						></pre>
				{/if}
			</div>
		</section>

		<!-- ───────────── TROUBLESHOOTING ───────────── -->
		<section class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
			<h2 class="mb-2 text-base font-semibold">Troubleshooting</h2>
			<ul class="ml-5 list-disc space-y-2 text-sm text-base-content/70">
				<li>
					<strong>"could not reach the local app"</strong> — make sure the server is running and
					that
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">{data.origin}</code> matches the URL
					you generated the bookmarklet on. If the port changes, revisit
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">/bookmarklet</code> and re-drag.
				</li>
				<li>
					<strong>"open a rateyourmusic.com release/album page first"</strong> — the enrich
					bookmarklet only runs on
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">/release/…</code>
					URLs.
				</li>
				<li>
					<strong>"This album isn't in your local wishlist yet"</strong> — import it via the wishlist-page
					bookmarklet first, then re-enrich.
				</li>
				<li>
					<strong>https → http mixed-content blocking</strong> — modern Chrome/Firefox/Safari treat
					<code class="rounded bg-base-300/60 px-1.5 py-0.5">http://localhost</code> as a secure context.
					Older Safari versions are stricter; use Chrome or Firefox if you hit this.
				</li>
			</ul>
		</section>
	</main>

	<footer class="border-t border-base-300/60 py-3 text-center text-xs text-base-content/40">
		local-only · JSON-backed · same DOM your real browser is already showing
	</footer>
</div>
