<script lang="ts">
	import { genreCounts } from '$lib/genres';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type SortMode = 'count' | 'name';

	// Ephemeral local state — refresh resets it. The user's primary tap is the
	// genre itself, so we don't bother round-tripping these through the URL.
	let sortMode = $state<SortMode>('count');
	let searchInput = $state('');

	const allGenres = $derived(genreCounts(data.albums));

	const visibleGenres = $derived.by(() => {
		const needle = searchInput.trim().toLowerCase();
		const filtered = needle
			? allGenres.filter((g) => g.name.toLowerCase().includes(needle))
			: allGenres;
		const sorted = [...filtered];
		if (sortMode === 'count') {
			sorted.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
		} else {
			sorted.sort((a, b) => a.name.localeCompare(b.name));
		}
		return sorted;
	});
</script>

<svelte:head>
	<title>Genres · Car Mode · RYMine</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 sm:py-6">
	<!-- Big Back button + page title. Back always returns to /car. We use a
	     plain <a> rather than history.back() so refreshing this page doesn't
	     cause weird back-stack behavior. -->
	<header class="flex items-center gap-3">
		<a href="/car" class="btn gap-2 btn-ghost btn-lg" aria-label="Back to Car Mode home">
			<span aria-hidden="true">←</span>
			<span>Back</span>
		</a>
		<h1 class="text-2xl font-semibold tracking-tight">Genres</h1>
	</header>

	<!-- Sort pills + search input. Pills mirror the list page's sort control
	     so the visual rhythm is consistent across Car Mode. -->
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
		<div class="flex items-center gap-2 text-base">
			<span class="text-base-content/60">Sort:</span>
			<div class="flex gap-1.5">
				<button
					type="button"
					class="car-sort-btn {sortMode === 'count' ? 'car-sort-btn-on' : ''}"
					onclick={() => (sortMode = 'count')}
					aria-pressed={sortMode === 'count'}
				>
					Count
				</button>
				<button
					type="button"
					class="car-sort-btn {sortMode === 'name' ? 'car-sort-btn-on' : ''}"
					onclick={() => (sortMode = 'name')}
					aria-pressed={sortMode === 'name'}
				>
					A–Z
				</button>
			</div>
		</div>
	</div>

	<label class="car-search">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			class="car-search-icon"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7" />
			<path d="m21 21-4.3-4.3" />
		</svg>
		<input
			type="search"
			bind:value={searchInput}
			placeholder="Search genres…"
			class="car-search-input"
			aria-label="Search genres"
			autocomplete="off"
			autocorrect="off"
			spellcheck="false"
		/>
		{#if searchInput}
			<button
				type="button"
				class="car-search-clear"
				onclick={() => (searchInput = '')}
				aria-label="Clear search"
				title="Clear search"
			>
				✕
			</button>
		{/if}
	</label>

	{#if allGenres.length === 0}
		<p class="rounded-2xl border border-base-300/60 bg-base-200/40 p-6 text-center text-base">
			No genres yet — enrich some albums first.
		</p>
	{:else if visibleGenres.length === 0}
		<p
			class="rounded-2xl border border-base-300/60 bg-base-200/40 p-6 text-center text-base text-base-content/70"
		>
			No genres match "{searchInput.trim()}".
		</p>
	{:else}
		<ul class="grid gap-3">
			{#each visibleGenres as genre (genre.name)}
				<li>
					<a href="/car/list?view=genre&g={encodeURIComponent(genre.name)}" class="car-genre-tile">
						<span class="car-genre-name">{genre.name}</span>
						<span class="car-genre-count" aria-label="{genre.count} albums">{genre.count}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	/* Sort pill — copy of the list page's `.car-sort-btn` so the rhythm matches
	   across Car Mode pages. Kept scoped here rather than moved to a shared
	   stylesheet because there are only two surfaces and inlining keeps the
	   per-page CSS easy to see. */
	.car-sort-btn {
		padding: 0.6rem 1rem;
		border-radius: 9999px;
		font-size: 1rem;
		font-weight: 600;
		border: 1px solid color-mix(in oklab, currentColor 14%, transparent);
		background: color-mix(in oklab, var(--color-base-200) 60%, transparent);
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}
	.car-sort-btn-on {
		background: color-mix(in oklab, var(--color-primary) 22%, transparent);
		border-color: color-mix(in oklab, var(--color-primary) 50%, transparent);
	}

	/* Search input — big tap target, rounded, sits at the same width as the
	   genre list below. */
	.car-search {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0 1rem;
		min-height: 3.25rem;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklab, currentColor 14%, transparent);
		background: color-mix(in oklab, var(--color-base-200) 60%, transparent);
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}
	.car-search:focus-within {
		border-color: color-mix(in oklab, var(--color-primary) 60%, transparent);
		background: color-mix(in oklab, var(--color-base-300) 35%, transparent);
	}
	.car-search-icon {
		width: 1.1rem;
		height: 1.1rem;
		opacity: 0.65;
		flex-shrink: 0;
	}
	.car-search-input {
		flex: 1;
		min-width: 0;
		background: transparent;
		outline: none;
		font-size: 1.05rem;
	}
	.car-search-input::placeholder {
		color: color-mix(in oklab, currentColor 45%, transparent);
	}
	/* Hide the native search clear-button so we control it consistently. */
	.car-search-input::-webkit-search-cancel-button {
		display: none;
	}
	.car-search-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 9999px;
		background: color-mix(in oklab, var(--color-base-300) 55%, transparent);
		font-size: 0.95rem;
	}

	/* Genre row — wide tap target, count pinned to the right so the names
	   align visually. */
	.car-genre-tile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 4rem;
		padding: 0.875rem 1.25rem;
		border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
		border-radius: 1rem;
		background: color-mix(in oklab, var(--color-base-200) 60%, transparent);
		transition:
			background-color 120ms ease,
			border-color 120ms ease,
			transform 120ms ease;
	}
	.car-genre-tile:hover,
	.car-genre-tile:focus-visible {
		background: color-mix(in oklab, var(--color-base-300) 55%, transparent);
		border-color: color-mix(in oklab, currentColor 22%, transparent);
		transform: translateY(-1px);
	}
	.car-genre-tile:active {
		transform: translateY(0);
	}
	.car-genre-name {
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1.2;
	}
	.car-genre-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.5rem;
		padding: 0.25rem 0.6rem;
		border-radius: 9999px;
		background: color-mix(in oklab, var(--color-base-300) 60%, transparent);
		font-size: 0.95rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	@media (min-width: 640px) {
		.car-genre-name {
			font-size: 1.25rem;
		}
	}
</style>
