<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatWishlistDate } from '$lib/dates';
	import { starString } from '$lib/stars';
	import {
		STREAMING_ORDER,
		STREAMING_SERVICES,
		appHref,
		hasAnyStreamingLink
	} from '$lib/streaming';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const album = $derived(data.album);

	// Prefer detail-page primary/secondary genres when enrichment has filled
	// them in; otherwise fall back to the flat wishlist-row `genres` list so
	// the page still has something meaningful to show pre-enrichment.
	const primaryGenres = $derived(
		album.primaryGenres && album.primaryGenres.length > 0 ? album.primaryGenres : album.genres
	);
	const secondaryGenres = $derived(album.secondaryGenres ?? []);
	const descriptors = $derived(album.descriptors ?? []);

	const coverSrc = $derived(album.largeCoverUrl ?? album.coverUrl);
	const isEnriched = $derived(Boolean(album.enrichedAt));
	const myStars = $derived(starString(album.myRating));
	const showStreaming = $derived(hasAnyStreamingLink(album.streamingLinks));

	// When the user comes back from a RYM tab after running the enrich
	// bookmarklet, re-fetch so the new fields appear without a manual reload.
	$effect(() => {
		function onFocus() {
			invalidateAll();
		}
		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	});
</script>

<svelte:head>
	<title>{album.artist} — {album.title} · RYMScraper</title>
</svelte:head>

<article class="card overflow-hidden border border-base-300/70 bg-base-200/40 shadow-sm">
	<!-- Header strip with Back -->
	<div class="flex flex-wrap items-center gap-2 border-b border-base-300/70 px-4 py-2.5 sm:px-5">
		<a
			href="/"
			class="btn gap-1 btn-ghost transition btn-sm hover:-translate-x-0.5"
			aria-label="Back to album list"
		>
			← Back to list
		</a>
		<span class="ml-1 truncate text-xs text-base-content/50" title={album.url}>
			{album.url.replace(/^https?:\/\//, '')}
		</span>
		<a
			href={album.url}
			target="_blank"
			rel="noopener noreferrer"
			class="ml-auto shrink-0 text-xs text-base-content/40 transition hover:text-primary"
			aria-label="Open on Rate Your Music"
			title="Open on Rate Your Music"
		>
			↗
		</a>
	</div>

	<!-- Detail body: large cover + info side-by-side on desktop, stacked on mobile -->
	<div class="grid gap-6 p-5 sm:grid-cols-[minmax(180px,240px)_1fr] sm:p-6">
		<div class="flex justify-center sm:block">
			<div
				class="relative aspect-square w-full max-w-[240px] overflow-hidden rounded-lg bg-base-300/40 shadow-md"
			>
				<span
					class="absolute inset-0 flex items-center justify-center text-4xl text-base-content/30"
					aria-hidden="true"
				>
					♪
				</span>
				{#if coverSrc}
					<img
						src={coverSrc}
						alt=""
						referrerpolicy="no-referrer"
						loading="eager"
						decoding="async"
						class="relative h-full w-full object-cover"
					/>
				{/if}
			</div>
		</div>

		<div class="min-w-0 space-y-4">
			<div class="space-y-1">
				<p class="text-sm font-medium text-base-content/70">{album.artist}</p>
				<h1 class="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
					<em class="not-italic">{album.title}</em>
					{#if album.year}
						<span class="ml-1 text-xl font-normal text-base-content/50">({album.year})</span>
					{/if}
				</h1>
			</div>

			<!-- Ratings strip -->
			<div class="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
				{#if typeof album.rymRating === 'number'}
					<span class="font-medium" title="RYM average rating">
						★ {album.rymRating.toFixed(2)}
						<span class="ml-1 text-xs text-base-content/50">RYM avg</span>
					</span>
				{/if}
				{#if myStars}
					<span title="Your RYM rating" class="font-medium text-primary">
						<span class="tracking-wide select-none" aria-hidden="true">{myStars}</span>
						<span class="ml-2 text-xs font-normal text-base-content/55">
							your rating ({(album.myRating as number).toFixed(1).replace(/\.0$/, '')}/5)
						</span>
					</span>
				{:else if isEnriched}
					<span class="text-xs text-base-content/40">not rated by you</span>
				{/if}
			</div>

			<!-- Streaming services -->
			{#if showStreaming && album.streamingLinks}
				<div>
					<h2 class="mb-1 text-xs font-semibold tracking-wider text-base-content/60 uppercase">
						Listen
					</h2>
					<div class="flex flex-wrap gap-2">
						{#each STREAMING_ORDER as key (key)}
							{@const webUrl = album.streamingLinks[key]}
							{#if webUrl}
								{@const launch = appHref(key, webUrl)}
								{@const usesAppScheme = launch !== webUrl}
								<a
									href={launch}
									target="_blank"
									rel="noopener noreferrer"
									class="btn gap-2 border-base-300/70 transition btn-outline btn-sm hover:-translate-y-0.5 hover:bg-base-300/40"
									title={usesAppScheme
										? `Open in ${STREAMING_SERVICES[key].label} app · ${webUrl}`
										: `Open on ${STREAMING_SERVICES[key].label} · ${webUrl}`}
								>
									<span
										class="h-2 w-2 rounded-full {STREAMING_SERVICES[key].dot}"
										aria-hidden="true"
									></span>
									{STREAMING_SERVICES[key].label}
									<span class="text-xs text-base-content/40" aria-hidden="true">↗</span>
								</a>
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			{#if primaryGenres.length > 0}
				<div>
					<h2 class="mb-1 text-xs font-semibold tracking-wider text-base-content/60 uppercase">
						{album.primaryGenres && album.primaryGenres.length > 0 ? 'Primary genres' : 'Genres'}
					</h2>
					<ul class="flex flex-wrap gap-1">
						{#each primaryGenres as g (g)}
							<li class="badge badge-sm font-medium badge-neutral">{g}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if secondaryGenres.length > 0}
				<div>
					<h2 class="mb-1 text-xs font-semibold tracking-wider text-base-content/50 uppercase">
						Secondary genres
					</h2>
					<ul class="flex flex-wrap gap-1">
						{#each secondaryGenres as g (g)}
							<li class="badge badge-ghost badge-xs text-base-content/60">{g}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Descriptors as subtler tags, visually distinct from genres -->
			{#if descriptors.length > 0}
				<div>
					<h2 class="mb-1 text-xs font-semibold tracking-wider text-base-content/60 uppercase">
						Descriptors
					</h2>
					<ul class="flex flex-wrap gap-1">
						{#each descriptors as d (d)}
							<li
								class="rounded-full border border-base-300/60 bg-base-100/40 px-2 py-0.5 text-xs text-base-content/65 italic"
							>
								{d}
							</li>
						{/each}
					</ul>
				</div>
			{:else if isEnriched}
				<p class="text-xs text-base-content/40 italic">No descriptors captured yet.</p>
			{/if}

			<dl
				class="grid grid-cols-1 gap-x-6 gap-y-1 border-t border-base-300/60 pt-3 text-xs text-base-content/60 sm:grid-cols-2"
			>
				{#if album.dateAdded}
					<div>
						<dt class="inline font-medium">Added to wishlist:</dt>
						<dd class="inline">{formatWishlistDate(album.dateAdded) ?? album.dateAdded}</dd>
					</div>
				{/if}
				<div>
					<dt class="inline font-medium">Enrichment:</dt>
					<dd class="inline">
						{#if album.enrichedAt}
							{formatWishlistDate(album.enrichedAt) ?? album.enrichedAt}
						{:else}
							<span class="text-warning/80">not enriched yet</span>
						{/if}
					</dd>
				</div>
			</dl>
		</div>
	</div>

	<!-- Actions footer -->
	<div
		class="flex flex-wrap items-center gap-3 border-t border-base-300/60 bg-base-200/30 px-5 py-4 sm:px-6"
	>
		<a href="/" class="btn btn-ghost btn-sm">← Back to list</a>
		<a
			href={album.url}
			target="_blank"
			rel="noopener noreferrer"
			class="btn shadow-sm transition btn-sm btn-primary hover:-translate-y-0.5 hover:shadow-md"
		>
			Open on Rate Your Music ↗
		</a>
		<a href="/queue" class="btn btn-ghost btn-sm">Enrichment queue →</a>
	</div>

	{#if !isEnriched}
		<div
			role="status"
			class="mx-5 mb-5 alert border-info/30 bg-info/10 text-sm shadow-sm sm:mx-6 sm:mb-6"
		>
			<span>
				This album hasn't been enriched yet. Open it on RYM (button above) and click the
				<strong>✨ RYMScraper Enrich Album</strong> bookmarklet on that page. When you come back, this
				panel refreshes automatically.
			</span>
		</div>
	{/if}
</article>
