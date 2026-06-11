<script lang="ts">
	import { genreCounts } from '$lib/genres';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Combined primary + secondary genre counts — same logic the main sidebar
	// uses, sorted by count desc (most-common genres come up first because
	// that's what someone driving is most likely to want to tap).
	const sortedGenres = $derived(
		[...genreCounts(data.albums)].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
	);
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

	{#if sortedGenres.length === 0}
		<p class="rounded-2xl border border-base-300/60 bg-base-200/40 p-6 text-center text-base">
			No genres yet — enrich some albums first.
		</p>
	{:else}
		<ul class="grid gap-3">
			{#each sortedGenres as genre (genre.name)}
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
