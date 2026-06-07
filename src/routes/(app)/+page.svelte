<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formatWishlistDate } from '$lib/dates';
	import {
		type AlbumSort,
		buildFiltersURL,
		DEFAULT_FILTERS,
		filterAlbums,
		hasAnyFilter,
		parseFilters,
		withChanges
	} from '$lib/filters';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// All filter state (genre, descriptor, search, sort, dir) lives on the URL
	// so browser Back from /album/X returns here with everything intact, and
	// the URL can be bookmarked / shared.
	const filters = $derived(parseFilters(page.url.searchParams));

	// Local copy of the search input so typing feels instant. We push to the URL
	// (debounced) without rebinding the input value — that way the cursor stays
	// put and we don't fight the navigation. Initialise straight from the URL
	// rather than from the $derived `filters` (Svelte warns against capturing
	// derived state in state initialisers).
	let searchInput = $state(page.url.searchParams.get('q') ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		// External URL change (Back nav, Clear-all from sidebar) → sync the
		// input. We read `searchInput` via untrack so this effect only fires
		// when filters.query changes — without untrack, the user's own typing
		// would re-fire it and overwrite the value they just typed.
		const next = filters.query;
		if (untrack(() => searchInput) !== next) searchInput = next;
	});

	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			pushFilters({ query: searchInput });
		}, 150);
	}

	async function pushFilters(changes: Partial<typeof DEFAULT_FILTERS>) {
		const next = withChanges(filters, changes);
		await goto(buildFiltersURL(next), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	// "On Deck" writes go through a server form action — hide the toggle button
	// in readonly mode (the server also rejects with 403, so this is just UI).
	const canToggleOnDeck = $derived(data.appMode !== 'readonly');

	const visibleAlbums = $derived.by(() => {
		const base = filterAlbums(data.albums, {
			genre: filters.genre,
			descriptor: filters.descriptor,
			query: filters.query,
			onDeck: filters.onDeck
		});

		const sign = filters.dir === 'asc' ? 1 : -1;

		function compareOptionalNumber(ax: number | undefined, bx: number | undefined): number {
			if (ax === undefined && bx === undefined) return 0;
			if (ax === undefined) return 1; // missing always last
			if (bx === undefined) return -1;
			return sign * (ax - bx);
		}

		function compareOptionalISO(ax: string | undefined, bx: string | undefined): number {
			if (!ax && !bx) return 0;
			if (!ax) return 1;
			if (!bx) return -1;
			return sign * ax.localeCompare(bx);
		}

		const sorted = [...base].sort((a, b) => {
			if (filters.sort === 'artist') return sign * a.artist.localeCompare(b.artist);
			if (filters.sort === 'year') return compareOptionalNumber(a.year, b.year);
			if (filters.sort === 'rymRating') return compareOptionalNumber(a.rymRating, b.rymRating);
			if (filters.sort === 'myRating') return compareOptionalNumber(a.myRating, b.myRating);
			if (filters.sort === 'onDeckAt') return compareOptionalISO(a.onDeckAt, b.onDeckAt);
			// 'added' — ISO strings sort lexicographically == chronologically
			return compareOptionalISO(a.dateAdded, b.dateAdded);
		});
		return sorted;
	});

	function setAlbumSort(mode: AlbumSort) {
		if (filters.sort === mode) {
			pushFilters({ dir: filters.dir === 'asc' ? 'desc' : 'asc' });
		} else {
			// Sensible defaults: A→Z for artist, but newer/higher first for the rest.
			pushFilters({ sort: mode, dir: mode === 'artist' ? 'asc' : 'desc' });
		}
	}

	function sortArrow(mode: AlbumSort): string {
		if (filters.sort !== mode) return '';
		return filters.dir === 'asc' ? ' ↑' : ' ↓';
	}

	function clearAll() {
		searchInput = '';
		pushFilters({ genre: null, descriptor: null, query: '', onDeck: false });
	}

	function toggleOnDeckFilter() {
		pushFilters({ onDeck: !filters.onDeck });
	}

	function pickGenreFromBadge(g: string) {
		pushFilters({ genre: filters.genre === g ? null : g });
	}

	// Per-album visible genre split: prefer detail-page primary/secondary
	// (richer signal) and fall back to the flat wishlist-row list for albums
	// that haven't been enriched yet.
	function rowGenres(a: PageData['albums'][number]): { primary: string[]; secondary: string[] } {
		const hasEnrichedSplit =
			(a.primaryGenres && a.primaryGenres.length > 0) ||
			(a.secondaryGenres && a.secondaryGenres.length > 0);
		if (hasEnrichedSplit) {
			const primary = a.primaryGenres ?? [];
			// Secondary list minus anything already shown as primary to avoid duplicates.
			const primarySet = new Set(primary);
			const secondary = (a.secondaryGenres ?? []).filter((g) => !primarySet.has(g));
			return { primary, secondary };
		}
		return { primary: a.genres ?? [], secondary: [] };
	}
</script>

<section class="card overflow-hidden border border-base-300/70 bg-base-200/40 shadow-sm">
	<div class="flex flex-col gap-3 border-b border-base-300/70 p-4">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div class="min-w-0">
				<h2 class="text-base font-semibold tracking-tight sm:text-lg">
					{filters.genre ?? 'All albums'}
				</h2>
				<p class="text-xs text-base-content/60">
					{visibleAlbums.length}
					{visibleAlbums.length === 1 ? 'album' : 'albums'}
					{#if filters.genre || filters.descriptor || filters.query || filters.onDeck}match current
						filters{:else}in wishlist{/if}
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-1 text-xs">
				<span class="text-base-content/50">sort:</span>
				<button
					type="button"
					class="btn btn-ghost btn-xs {filters.sort === 'artist' ? 'btn-active' : ''}"
					onclick={() => setAlbumSort('artist')}
					title="Sort alphabetically by artist"
				>
					artist{sortArrow('artist')}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs {filters.sort === 'year' ? 'btn-active' : ''}"
					onclick={() => setAlbumSort('year')}
					title="Sort by release year"
				>
					year{sortArrow('year')}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs {filters.sort === 'added' ? 'btn-active' : ''}"
					onclick={() => setAlbumSort('added')}
					title="Sort by wishlist-added date"
				>
					added{sortArrow('added')}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs {filters.sort === 'rymRating' ? 'btn-active' : ''}"
					onclick={() => setAlbumSort('rymRating')}
					title="Sort by RYM average rating"
				>
					avg ★{sortArrow('rymRating')}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs {filters.sort === 'myRating' ? 'btn-active' : ''}"
					onclick={() => setAlbumSort('myRating')}
					title="Sort by your rating (unrated last)"
				>
					you ★{sortArrow('myRating')}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs {filters.sort === 'onDeckAt' ? 'btn-active' : ''}"
					onclick={() => setAlbumSort('onDeckAt')}
					title="Sort by On Deck date (most recently added first)"
				>
					deck{sortArrow('onDeckAt')}
				</button>
				<!-- On Deck filter toggle — separate from sort, visually distinct. -->
				<button
					type="button"
					class="btn gap-1 btn-xs {filters.onDeck ? 'btn-primary' : 'btn-ghost'}"
					onclick={toggleOnDeckFilter}
					title="Show only On Deck albums"
					aria-pressed={filters.onDeck}
				>
					<span aria-hidden="true">🎧</span>
					<span>On Deck</span>
				</button>
				{#if hasAnyFilter(filters)}
					<button
						type="button"
						class="btn ml-2 btn-ghost btn-xs"
						onclick={clearAll}
						title="Clear genre, descriptor, search, and On Deck"
					>
						Clear all
					</button>
				{/if}
			</div>
		</div>

		<!-- Search input — title / artist substring, case-insensitive. Combines
		     with the sidebar genre + descriptor selections via AND. -->
		<label class="input-bordered input input-sm flex w-full items-center gap-2 bg-base-100/70">
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
				type="search"
				bind:value={searchInput}
				oninput={onSearchInput}
				placeholder="Search album title or artist…"
				class="grow bg-transparent outline-none"
				aria-label="Search albums by title or artist"
			/>
			{#if searchInput}
				<button
					type="button"
					class="btn -mr-1 btn-ghost btn-xs"
					onclick={() => {
						searchInput = '';
						pushFilters({ query: '' });
					}}
					aria-label="Clear search"
					title="Clear search"
				>
					✕
				</button>
			{/if}
		</label>

		{#if filters.genre || filters.descriptor || filters.onDeck}
			<!-- Compact reminder of active filters. Hidden on mobile — the
			     sticky chip strip in the header already covers it there. -->
			<div class="hidden flex-wrap items-center gap-1.5 text-xs text-base-content/60 lg:flex">
				<span class="text-base-content/50">filters:</span>
				{#if filters.onDeck}
					<button
						type="button"
						class="badge gap-1 badge-sm badge-primary"
						onclick={() => pushFilters({ onDeck: false })}
						title="Remove On Deck filter"
					>
						<span aria-hidden="true">🎧</span> On Deck
						<span aria-hidden="true">✕</span>
					</button>
				{/if}
				{#if filters.genre}
					<button
						type="button"
						class="badge gap-1 badge-sm badge-primary"
						onclick={() => pushFilters({ genre: null })}
						title="Remove genre filter"
					>
						{filters.genre}
						<span aria-hidden="true">✕</span>
					</button>
				{/if}
				{#if filters.descriptor}
					<button
						type="button"
						class="badge gap-1 badge-sm italic badge-secondary"
						onclick={() => pushFilters({ descriptor: null })}
						title="Remove descriptor filter"
					>
						{filters.descriptor}
						<span aria-hidden="true">✕</span>
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<ul class="divide-y divide-base-300/60">
		{#each visibleAlbums as album (album.url)}
			{@const addedDisplay = formatWishlistDate(album.dateAdded)}
			{@const split = rowGenres(album)}
			<li class="group transition-colors duration-150 hover:bg-base-300/40">
				<div class="flex items-center gap-3 px-4 pt-3">
					<a
						href="/album/{album.id}"
						class="flex min-w-0 flex-1 items-center gap-3"
						title="Open local detail panel"
					>
						<span
							class="relative block h-16 w-16 shrink-0 overflow-hidden rounded bg-base-300/40 shadow-sm transition-transform group-hover:scale-[1.02]"
							aria-hidden="true"
						>
							<span
								class="absolute inset-0 flex items-center justify-center text-xl text-base-content/30"
							>
								♪
							</span>
							{#if album.coverUrl}
								<img
									src={album.coverUrl}
									alt=""
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
									class="relative h-full w-full object-cover"
								/>
							{/if}
						</span>
						<span class="min-w-0 flex-1">
							<!-- Title line — artist / title / year. Truncates on mobile if needed. -->
							<span class="block truncate text-sm font-medium sm:text-[0.95rem]">
								<span class="text-base-content/90">{album.artist}</span>
								<span class="text-base-content/40"> — </span>
								<span class="text-base-content italic">{album.title}</span>
								{#if album.year}
									<span class="ml-1 text-base-content/50">({album.year})</span>
								{/if}
							</span>
							<!-- Meta line — ratings / added. Block on mobile (its own row),
							     inline-ish on desktop (sits after the title with a leading dot
							     so it reads as one continuation). -->
							{#if typeof album.rymRating === 'number' || typeof album.myRating === 'number' || addedDisplay}
								<span
									class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs leading-tight sm:mt-0 sm:inline sm:gap-x-1"
								>
									{#if typeof album.rymRating === 'number'}
										<span class="text-base-content/55" title="RYM average rating">
											<span class="hidden sm:inline">· </span>★ {album.rymRating.toFixed(2)}
										</span>
									{/if}
									{#if typeof album.myRating === 'number'}
										<span class="font-medium text-primary/80" title="Your rating">
											<span class="hidden sm:inline">· </span>you {album.myRating}
										</span>
									{/if}
									{#if addedDisplay}
										<span class="text-base-content/40">
											<span class="hidden sm:inline">· </span>added {addedDisplay}
										</span>
									{/if}
								</span>
							{/if}
						</span>
					</a>
					{#if canToggleOnDeck}
						<!-- Per-row On Deck toggle. Form is a sibling of the album-link <a>
						     so taps don't bubble into the navigation. `class="contents"`
						     keeps the flex layout flat. use:enhance avoids a full reload
						     and re-fetches the wishlist so the icon flips in place. -->
						<form method="POST" action="/?/toggleOnDeck" class="contents" use:enhance>
							<input type="hidden" name="url" value={album.url} />
							<button
								type="submit"
								class="btn btn-square shrink-0 self-center btn-sm {album.onDeck
									? 'btn-primary'
									: 'text-base-content/40 btn-ghost hover:text-primary'}"
								aria-pressed={album.onDeck ? 'true' : 'false'}
								aria-label={album.onDeck ? 'Remove from On Deck' : 'Add to On Deck'}
								title={album.onDeck ? 'On Deck — tap to remove' : 'Add to On Deck'}
							>
								<span aria-hidden="true">🎧</span>
							</button>
						</form>
					{:else if album.onDeck}
						<!-- Readonly viewer: show the marker but no toggle. -->
						<span
							class="badge gap-1 self-center badge-sm badge-primary"
							title="On Deck"
							aria-label="On Deck"
						>
							<span aria-hidden="true">🎧</span>
						</span>
					{/if}
					<a
						href={album.url}
						target="_blank"
						rel="noopener noreferrer"
						class="shrink-0 self-center text-xs text-base-content/30 transition group-hover:text-primary/70 hover:text-primary"
						aria-label="Open on Rate Your Music"
						title="Open on Rate Your Music"
					>
						↗
					</a>
				</div>
				<div class="flex flex-wrap items-center gap-1 px-4 pb-3 pl-23">
					{#each split.primary as g (g)}
						<button
							type="button"
							class="badge badge-xs transition badge-neutral hover:badge-primary"
							onclick={() => pickGenreFromBadge(g)}
						>
							{g}
						</button>
					{/each}
					{#each split.secondary as g (g)}
						<button
							type="button"
							class="badge badge-ghost badge-xs italic opacity-60 transition hover:opacity-100 hover:badge-primary"
							onclick={() => pickGenreFromBadge(g)}
						>
							{g}
						</button>
					{/each}
				</div>
			</li>
		{:else}
			<li class="px-4 py-10 text-center text-sm text-base-content/50">No albums to show yet.</li>
		{/each}
	</ul>
</section>
