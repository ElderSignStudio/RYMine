<script lang="ts">
	import { mockAlbums, mockLastScrapedAt } from '$lib/mockData';
	import { formatLastScraped, genreCounts } from '$lib/genres';

	let genreFilter = $state('');
	let selectedGenre = $state<string | null>(null);

	const allGenres = $derived(genreCounts(mockAlbums));

	const visibleGenres = $derived(
		allGenres.filter((g) => g.name.toLowerCase().includes(genreFilter.trim().toLowerCase()))
	);

	const visibleAlbums = $derived(
		(selectedGenre ? mockAlbums.filter((a) => a.genres.includes(selectedGenre!)) : mockAlbums)
			.slice()
			.sort((a, b) => a.artist.localeCompare(b.artist))
	);

	function selectGenre(name: string) {
		selectedGenre = selectedGenre === name ? null : name;
	}
</script>

<div class="flex min-h-screen flex-col bg-base-100 text-base-content">
	<!-- Top bar -->
	<header
		class="sticky top-0 z-20 border-b border-base-300/70 bg-base-200/80 backdrop-blur supports-backdrop-filter:bg-base-200/60"
	>
		<div class="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
			<div class="flex items-center gap-2">
				<span class="text-2xl" aria-hidden="true">🎚️</span>
				<div class="leading-tight">
					<h1 class="text-lg font-semibold tracking-tight sm:text-xl">RYMScraper</h1>
					<p class="hidden text-xs text-base-content/60 sm:block">
						a cozy little wishlist, sorted by mood
					</p>
				</div>
			</div>

			<div class="ml-auto flex items-center gap-3">
				<span class="hidden text-xs text-base-content/60 md:inline">
					last scraped: <span class="font-medium text-base-content/80"
						>{formatLastScraped(mockLastScrapedAt)}</span
					>
				</span>
				<button
					type="button"
					class="btn shadow-sm transition btn-sm btn-primary hover:-translate-y-0.5 hover:shadow-md sm:btn-md"
					disabled
					title="Scraping not implemented yet"
				>
					Scrape Wishlist
				</button>
			</div>
		</div>
	</header>

	<!-- Main two-pane layout -->
	<main class="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row">
		<!-- Left: genres -->
		<aside
			class="scrollbar-soft card w-full shrink-0 overflow-hidden border border-base-300/70 bg-base-200/60 shadow-sm lg:sticky lg:top-21 lg:max-h-[calc(100vh-6.5rem)] lg:w-72"
		>
			<div class="border-b border-base-300/70 p-4">
				<div class="mb-2 flex items-baseline justify-between">
					<h2 class="text-sm font-semibold tracking-wider text-base-content/70 uppercase">
						Genres
					</h2>
					<span class="text-xs text-base-content/50">{allGenres.length} total</span>
				</div>
				<label class="input-bordered input input-sm flex items-center gap-2 bg-base-100/70">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="h-4 w-4 opacity-60"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="7" />
						<path d="m21 21-4.3-4.3" />
					</svg>
					<input
						type="text"
						bind:value={genreFilter}
						placeholder="Filter genres…"
						class="grow bg-transparent outline-none"
						aria-label="Filter genres"
					/>
				</label>
			</div>

			<ul class="scrollbar-soft max-h-[60vh] overflow-y-auto p-2 lg:max-h-none">
				{#each visibleGenres as genre (genre.name)}
					<li>
						<button
							type="button"
							onclick={() => selectGenre(genre.name)}
							class="group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150
								hover:bg-base-300/60
								{selectedGenre === genre.name
								? 'bg-primary/15 text-primary-content/90 ring-1 ring-primary/30'
								: ''}"
						>
							<span class="truncate font-medium">{genre.name}</span>
							<span
								class="badge badge-ghost badge-sm transition group-hover:badge-neutral"
								aria-label="{genre.count} albums"
							>
								{genre.count}
							</span>
						</button>
					</li>
				{:else}
					<li class="px-3 py-6 text-center text-sm text-base-content/50">No genres match.</li>
				{/each}
			</ul>
		</aside>

		<!-- Right: albums -->
		<section class="card flex-1 overflow-hidden border border-base-300/70 bg-base-200/40 shadow-sm">
			<div
				class="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-300/70 p-4"
			>
				<div>
					<h2 class="text-base font-semibold tracking-tight sm:text-lg">
						{selectedGenre ?? 'All albums'}
					</h2>
					<p class="text-xs text-base-content/60">
						{visibleAlbums.length}
						{visibleAlbums.length === 1 ? 'album' : 'albums'}
						{selectedGenre ? 'in this genre' : 'in wishlist'}
					</p>
				</div>
				{#if selectedGenre}
					<button type="button" class="btn btn-ghost btn-xs" onclick={() => (selectedGenre = null)}>
						Clear filter
					</button>
				{/if}
			</div>

			<ul class="divide-y divide-base-300/60">
				{#each visibleAlbums as album (album.url)}
					<li>
						<a
							href={album.url}
							target="_blank"
							rel="noopener noreferrer"
							class="group flex items-baseline justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-base-300/40"
						>
							<span class="min-w-0">
								<span class="block truncate text-sm font-medium sm:text-[0.95rem]">
									<span class="text-base-content/90">{album.artist}</span>
									<span class="text-base-content/40"> — </span>
									<span class="text-base-content italic">{album.title}</span>
									{#if album.year}
										<span class="ml-1 text-base-content/50">({album.year})</span>
									{/if}
								</span>
								<span class="mt-1 flex flex-wrap gap-1">
									{#each album.genres as g (g)}
										<button
											type="button"
											class="badge badge-ghost badge-xs transition hover:badge-primary"
											onclick={(e) => {
												e.preventDefault();
												selectGenre(g);
											}}
										>
											{g}
										</button>
									{/each}
								</span>
							</span>
							<span
								class="shrink-0 self-center text-xs text-base-content/30 transition group-hover:text-primary"
								aria-hidden="true">↗</span
							>
						</a>
					</li>
				{:else}
					<li class="px-4 py-10 text-center text-sm text-base-content/50">
						No albums to show yet.
					</li>
				{/each}
			</ul>
		</section>
	</main>

	<footer class="border-t border-base-300/60 py-3 text-center text-xs text-base-content/40">
		local-only · mock data · scraper coming soon
	</footer>
</div>
