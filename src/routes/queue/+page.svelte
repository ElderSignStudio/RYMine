<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatWishlistDate } from '$lib/dates';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const unenriched = $derived(data.unenriched);
	const total = $derived(data.total);
	const enrichedCount = $derived(total - unenriched.length);

	function openNext() {
		const next = unenriched[0];
		if (!next) return;
		// User-driven, one at a time. We never auto-open multiple tabs.
		window.open(next.url, '_blank', 'noopener,noreferrer');
	}

	function missingChips(a: (typeof unenriched)[number]): string[] {
		const out: string[] = [];
		if (!a.enrichedAt) out.push('never enriched');
		if (typeof a.rymRating !== 'number') out.push('no avg rating');
		if (!a.descriptors || a.descriptors.length === 0) out.push('no descriptors');
		if (!a.secondaryGenres || a.secondaryGenres.length === 0) out.push('no secondary genres');
		return out;
	}

	// Auto-refresh when the user comes back from a RYM tab (they likely just
	// ran the enrich bookmarklet). Lighter than polling: a single refresh on
	// tab-focus is enough for this workflow.
	$effect(() => {
		function onFocus() {
			invalidateAll();
		}
		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	});
</script>

<svelte:head>
	<title>Enrichment queue · RYMine</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-base-100 text-base-content">
	<header class="border-b border-base-300/70 bg-base-200/60">
		<div class="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
			<a
				href="/"
				class="text-sm text-base-content/60 transition hover:text-primary"
				aria-label="Back to wishlist"
			>
				← Back to list
			</a>
			<div class="ml-2 leading-tight">
				<h1 class="text-lg font-semibold tracking-tight sm:text-xl">Enrichment queue</h1>
				<p class="text-xs text-base-content/60">
					{unenriched.length}
					{unenriched.length === 1 ? 'album' : 'albums'} still missing details · {enrichedCount} of {total}
					enriched
				</p>
			</div>
		</div>
	</header>

	<main class="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6">
		<!-- Workflow card -->
		<section class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
			<h2 class="mb-2 text-base font-semibold">One-album-at-a-time workflow</h2>
			<ol class="ml-5 list-decimal space-y-1.5 text-sm text-base-content/80">
				<li>
					Click <em>Open next unenriched album on RYM</em> — it opens the next album in a new tab.
				</li>
				<li>
					On that RYM page, click your <strong>✨ RYMine Enrich Album</strong> bookmarklet.
				</li>
				<li>
					Switch back to this tab. It auto-refreshes on focus; that album drops off the queue.
				</li>
				<li>Click <em>Open next</em> again and repeat.</li>
			</ol>
			<p class="mt-3 text-xs text-base-content/50">
				Nothing is auto-opened or auto-crawled. Each click opens exactly one tab.
			</p>

			<div class="mt-4 flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="btn shadow-sm transition btn-sm btn-primary hover:-translate-y-0.5 hover:shadow-md"
					onclick={openNext}
					disabled={unenriched.length === 0}
				>
					Open next unenriched album on RYM ↗
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => invalidateAll()}
					title="Refresh the queue from disk"
				>
					↻ Refresh
				</button>
				{#if unenriched.length === 0}
					<span class="text-sm text-success/80">All albums are enriched 🎉</span>
				{/if}
			</div>
		</section>

		<!-- Recently enriched -->
		{#if data.recentlyEnriched.length > 0}
			<section class="card border border-base-300/70 bg-base-200/40 p-5 shadow-sm">
				<h2 class="mb-2 text-sm font-semibold tracking-wide text-base-content/70 uppercase">
					Recently enriched
				</h2>
				<ul class="space-y-1.5">
					{#each data.recentlyEnriched as a (a.id)}
						<li class="flex items-baseline justify-between gap-3 text-sm">
							<a href="/album/{a.id}" class="min-w-0 truncate transition hover:text-primary">
								<span class="text-base-content/90">{a.artist}</span>
								<span class="text-base-content/40"> — </span>
								<span class="italic">{a.title}</span>
							</a>
							<span class="shrink-0 text-xs text-base-content/40">
								{formatWishlistDate(a.enrichedAt) ?? a.enrichedAt}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- The queue itself -->
		<section class="card overflow-hidden border border-base-300/70 bg-base-200/40 shadow-sm">
			<header
				class="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-300/70 p-4"
			>
				<div>
					<h2 class="text-base font-semibold tracking-tight">
						Missing details ({unenriched.length})
					</h2>
					<p class="text-xs text-base-content/60">
						Albums with no enrichedAt, no RYM avg rating, no descriptors, or no secondary genres.
					</p>
				</div>
			</header>

			{#if unenriched.length === 0}
				<p class="px-4 py-10 text-center text-sm text-base-content/50">
					Nothing to enrich — every album has full detail metadata.
				</p>
			{:else}
				<ul class="scrollbar-soft max-h-[60vh] divide-y divide-base-300/60 overflow-y-auto">
					{#each unenriched as a, i (a.id)}
						<li class="px-4 py-3 transition-colors duration-150 hover:bg-base-300/40">
							<div class="flex items-center gap-3">
								<span
									class="w-6 shrink-0 text-right text-xs text-base-content/40 tabular-nums"
									aria-hidden="true"
								>
									{i + 1}
								</span>
								<a
									href="/album/{a.id}"
									class="min-w-0 flex-1 truncate text-sm transition hover:text-primary"
								>
									<span class="font-medium text-base-content/90">{a.artist}</span>
									<span class="text-base-content/40"> — </span>
									<span class="italic">{a.title}</span>
									{#if a.year}
										<span class="ml-1 text-base-content/50">({a.year})</span>
									{/if}
								</a>
								<a
									href={a.url}
									target="_blank"
									rel="noopener noreferrer"
									class="shrink-0 text-xs text-base-content/40 transition hover:text-primary"
									aria-label="Open on Rate Your Music"
									title="Open this album on Rate Your Music"
								>
									↗
								</a>
							</div>
							<div class="mt-1 flex flex-wrap gap-1 pl-9">
								{#each missingChips(a) as chip (chip)}
									<span class="badge badge-ghost badge-xs text-base-content/50">{chip}</span>
								{/each}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>

	<footer class="border-t border-base-300/60 py-3 text-center text-xs text-base-content/40">
		local-only · click a row's title to see what we already know
	</footer>
</div>
