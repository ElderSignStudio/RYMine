<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const yearLabel = $derived(`Released in ${data.currentYear}`);

	// Surprise Me rolls the dice client-side. It used to be a form action
	// (POST → 303), which the readonly hook blocks as a write — even though
	// picking a random index from already-loaded data has no side effects.
	// Doing it in the browser sidesteps that gate without touching the
	// readonly write protections, and works identically in local and hosted
	// modes since the wishlist is already loaded by the parent layout server
	// load for everything else in /car/*.
	function surpriseMe() {
		const list = data.albums;
		if (list.length === 0) {
			// Friendly empty state — /car/list?view=recent renders the existing
			// "No albums here yet" card with a big Back button, so we reuse it
			// rather than minting a one-off empty surface here.
			goto('/car/list?view=recent');
			return;
		}
		const pick = list[Math.floor(Math.random() * list.length)];
		goto(`/car/play/${pick.id}`);
	}
</script>

<svelte:head>
	<title>Car Mode · RYMine</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-10">
	<!-- Top strip: brand + return to full app. Tiny because the main controls
	     are below. The "Full app" link is unobtrusive but always reachable. -->
	<header class="flex items-center justify-between text-base-content/70">
		<div class="flex items-center gap-2">
			<span
				class="relative block h-8 w-8 shrink-0 overflow-hidden rounded-md bg-base-300/40"
				aria-hidden="true"
			>
				<img src="/RYMine%20Icon.png" alt="" class="h-full w-full object-cover" />
			</span>
			<span class="text-base font-semibold tracking-tight">Car Mode</span>
		</div>
		<a
			href="/"
			class="btn gap-1 btn-ghost btn-sm hover:underline"
			title="Back to the full RYMine app"
		>
			Full app ↗
		</a>
	</header>

	<!-- Six big choices, full-bleed on mobile. Each is its own <a> so the entire
	     card is the tap target. Surprise Me is a plain client-side button —
	     no form/POST so it works in readonly hosted mode without tripping
	     the write-block guard. -->
	<nav class="grid gap-3 sm:gap-4">
		<a href="/car/list?view=deck" class="car-tile" data-tone="primary">
			<span class="car-tile-icon" aria-hidden="true">🎧</span>
			<span class="car-tile-label">On Deck</span>
		</a>

		<a href="/car/list?view=year" class="car-tile">
			<span class="car-tile-icon" aria-hidden="true">📅</span>
			<span class="car-tile-label">{yearLabel}</span>
		</a>

		<a href="/car/list?view=recent" class="car-tile">
			<span class="car-tile-icon" aria-hidden="true">🆕</span>
			<span class="car-tile-label">Recently Added</span>
		</a>

		<a href="/car/list?view=top" class="car-tile">
			<span class="car-tile-icon" aria-hidden="true">★</span>
			<span class="car-tile-label">Highest Rated</span>
		</a>

		<button type="button" class="car-tile w-full" onclick={surpriseMe}>
			<span class="car-tile-icon" aria-hidden="true">🎲</span>
			<span class="car-tile-label">Surprise Me</span>
		</button>

		<a href="/car/genres" class="car-tile">
			<span class="car-tile-icon" aria-hidden="true">🎼</span>
			<span class="car-tile-label">Genres</span>
		</a>
	</nav>
</main>

<style>
	/* Big, calm, thumb-friendly tile. Used by all six top-level choices so the
	   sizing/spacing/colour are consistent. The `data-tone="primary"` variant
	   highlights On Deck since that's the most likely tap. */
	.car-tile {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		min-height: 5rem; /* ~80px — big enough for confident tapping */
		padding: 1rem 1.25rem;
		border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
		border-radius: 1rem;
		background: color-mix(in oklab, var(--color-base-200) 60%, transparent);
		text-align: left;
		transition:
			transform 120ms ease,
			background-color 120ms ease,
			border-color 120ms ease;
	}
	.car-tile:hover,
	.car-tile:focus-visible {
		background: color-mix(in oklab, var(--color-base-300) 55%, transparent);
		border-color: color-mix(in oklab, currentColor 22%, transparent);
		transform: translateY(-1px);
	}
	.car-tile:active {
		transform: translateY(0);
	}
	.car-tile[data-tone='primary'] {
		background: color-mix(in oklab, var(--color-primary) 18%, transparent);
		border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
	}
	.car-tile-icon {
		font-size: 1.75rem;
		line-height: 1;
		width: 2.25rem;
		text-align: center;
	}
	.car-tile-label {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	@media (min-width: 640px) {
		.car-tile {
			min-height: 6rem;
		}
		.car-tile-label {
			font-size: 1.4rem;
		}
	}
</style>
