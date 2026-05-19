<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatWishlistDate } from '$lib/dates';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const album = $derived(data.album);

	// If the album has primary/secondary genres from enrichment, prefer those;
	// otherwise fall back to the flat wishlist-row `genres` list so the page
	// still has something meaningful to show for unenriched albums.
	const primaryGenres = $derived(
		album.primaryGenres && album.primaryGenres.length > 0 ? album.primaryGenres : album.genres
	);
	const secondaryGenres = $derived(album.secondaryGenres ?? []);
	const descriptors = $derived(album.descriptors ?? []);

	const coverSrc = $derived(album.largeCoverUrl ?? album.coverUrl);
	const isEnriched = $derived(Boolean(album.enrichedAt));

	// When the user comes back from an RYM tab after running the enrich
	// bookmarklet, refresh page data so the new fields appear without a
	// manual reload. Same focus-trigger pattern as the queue page.
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
			<span class="ml-2 truncate text-xs text-base-content/50">
				{album.artist} — {album.title}
			</span>
		</div>
	</header>

	<main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
		<article class="card overflow-hidden border border-base-300/70 bg-base-200/40 shadow-sm">
			<div class="grid gap-6 p-5 sm:grid-cols-[200px_1fr] sm:p-6">
				<!-- Cover -->
				<div class="flex justify-center sm:block">
					<div
						class="relative h-48 w-48 overflow-hidden rounded-lg bg-base-300/40 shadow-md sm:h-[200px] sm:w-[200px]"
					>
						<span
							class="absolute inset-0 flex items-center justify-center text-3xl text-base-content/30"
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

				<!-- Info -->
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

					{#if typeof album.rymRating === 'number' || typeof album.myRating === 'number'}
						<div class="flex flex-wrap items-baseline gap-3 text-sm">
							{#if typeof album.rymRating === 'number'}
								<span class="font-medium" title="RYM average rating">
									★ {album.rymRating.toFixed(2)}
									<span class="ml-1 text-xs text-base-content/50">RYM avg</span>
								</span>
							{/if}
							{#if typeof album.myRating === 'number'}
								<span class="font-medium text-primary" title="Your rating">
									★ {album.myRating}
									<span class="ml-1 text-xs text-base-content/50">your rating</span>
								</span>
							{/if}
						</div>
					{/if}

					{#if primaryGenres.length > 0}
						<div>
							<h2 class="mb-1 text-xs font-semibold tracking-wider text-base-content/60 uppercase">
								{album.primaryGenres && album.primaryGenres.length > 0
									? 'Primary genres'
									: 'Genres'}
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
									<li class="badge badge-ghost badge-sm">{g}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if descriptors.length > 0}
						<div>
							<h2 class="mb-1 text-xs font-semibold tracking-wider text-base-content/60 uppercase">
								Descriptors
							</h2>
							<p class="text-sm leading-relaxed text-base-content/75">
								{descriptors.join(', ')}
							</p>
						</div>
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

			<div
				class="flex flex-wrap items-center gap-3 border-t border-base-300/60 bg-base-200/30 px-5 py-4 sm:px-6"
			>
				<a
					href={album.url}
					target="_blank"
					rel="noopener noreferrer"
					class="btn shadow-sm transition btn-sm btn-primary hover:-translate-y-0.5 hover:shadow-md"
				>
					Open on Rate Your Music ↗
				</a>
				<a href="/queue" class="btn btn-ghost btn-sm">Enrichment queue →</a>
				<span class="ml-auto truncate text-xs text-base-content/40" title={album.url}>
					{album.url.replace(/^https?:\/\//, '')}
				</span>
			</div>

			{#if !isEnriched}
				<div
					role="status"
					class="mx-5 mb-5 alert border-info/30 bg-info/10 text-sm shadow-sm sm:mx-6 sm:mb-6"
				>
					<span>
						This album hasn't been enriched yet. Open it on RYM (button above) and click the
						<strong>✨ RYMScraper Enrich Album</strong> bookmarklet on that page. When you come back,
						this page will refresh automatically.
					</span>
				</div>
			{/if}
		</article>
	</main>

	<footer class="border-t border-base-300/60 py-3 text-center text-xs text-base-content/40">
		local-only · JSON-backed
	</footer>
</div>
