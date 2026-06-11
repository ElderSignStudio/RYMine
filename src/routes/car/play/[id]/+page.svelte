<script lang="ts">
	import { goto } from '$app/navigation';
	import { STREAMING_SERVICES, appHref, type StreamingKey } from '$lib/streaming';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const album = $derived(data.album);

	const coverSrc = $derived(album.largeCoverUrl ?? album.coverUrl);

	// Combined genre list for the chip strip — same union the main app uses.
	// The Set here is a local dedup helper inside a $derived.by closure; nothing
	// outside observes it reactively, so the lint rule's reactivity concern
	// doesn't apply.
	const allGenresUnique = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seen = new Set<string>();
		const out: string[] = [];
		for (const list of [album.primaryGenres, album.secondaryGenres, album.genres]) {
			if (!list) continue;
			for (const g of list) {
				if (!seen.has(g)) {
					seen.add(g);
					out.push(g);
				}
			}
		}
		return out;
	});

	// Surface the two big services first ("priority" per spec); the smaller
	// pair surfaces underneath as optional buttons.
	const links = $derived(album.streamingLinks ?? {});
	const hasSpotify = $derived(Boolean(links.spotify));
	const hasApple = $derived(Boolean(links.appleMusic));
	const hasYouTube = $derived(Boolean(links.youtube));
	const hasBandcamp = $derived(Boolean(links.bandcamp));

	function bigHref(key: StreamingKey): string {
		return appHref(key, links[key]);
	}

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			goto('/car');
		}
	}
</script>

<svelte:head>
	<title>{album.artist} — {album.title} · Car Mode · RYMine</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 sm:gap-6 sm:py-6">
	<!-- Big back button at the top, kept simple and full-height-friendly. -->
	<div class="flex items-center gap-3">
		<button
			type="button"
			onclick={goBack}
			class="btn gap-2 btn-ghost btn-lg"
			aria-label="Back to the previous list"
		>
			<span aria-hidden="true">←</span>
			<span>Back</span>
		</button>
	</div>

	<!-- Big cover. Square, full-bleed within the page max-width. -->
	<div class="car-play-cover">
		<span class="car-play-cover-fallback" aria-hidden="true">♪</span>
		{#if coverSrc}
			<img src={coverSrc} alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" />
		{/if}
	</div>

	<!-- Artist + title + year — large, legible, and quiet. -->
	<div class="px-1">
		<p class="text-base font-medium text-base-content/70 sm:text-lg">{album.artist}</p>
		<h1 class="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
			<em class="not-italic">{album.title}</em>
			{#if album.year}
				<span class="ml-1 text-xl font-normal text-base-content/55 sm:text-2xl">
					({album.year})
				</span>
			{/if}
		</h1>
		{#if allGenresUnique.length > 0}
			<ul class="mt-3 flex flex-wrap gap-1.5">
				{#each allGenresUnique.slice(0, 6) as g (g)}
					<li class="rounded-full bg-base-300/40 px-2.5 py-1 text-xs text-base-content/70">
						{g}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Streaming actions. Spotify + Apple Music are the priority pair (big
	     buttons). YouTube + Bandcamp fall to a secondary row when present.
	     When Spotify AND Apple Music are BOTH missing, surface a clear
	     message — even if YouTube/Bandcamp are present, those don't replace
	     the primary services per spec. RYM page link is always shown in the
	     missing-primary path so the user has somewhere to go. -->
	<div class="flex flex-col gap-3">
		{#if hasSpotify}
			<a
				href={bigHref('spotify')}
				target="_blank"
				rel="noopener noreferrer"
				class="car-big-btn"
				data-service="spotify"
			>
				<span class="car-big-btn-dot bg-emerald-500" aria-hidden="true"></span>
				<span class="car-big-btn-label">Open in {STREAMING_SERVICES.spotify.label}</span>
				<span class="car-big-btn-arrow" aria-hidden="true">↗</span>
			</a>
		{/if}
		{#if hasApple}
			<a
				href={bigHref('appleMusic')}
				target="_blank"
				rel="noopener noreferrer"
				class="car-big-btn"
				data-service="appleMusic"
			>
				<span class="car-big-btn-dot bg-rose-500" aria-hidden="true"></span>
				<span class="car-big-btn-label">Open in {STREAMING_SERVICES.appleMusic.label}</span>
				<span class="car-big-btn-arrow" aria-hidden="true">↗</span>
			</a>
		{/if}

		{#if !hasSpotify && !hasApple}
			<div
				class="rounded-2xl border border-base-300/60 bg-base-200/40 p-4 text-base text-base-content/75"
				role="status"
			>
				No Spotify or Apple Music link captured yet.{#if hasYouTube || hasBandcamp}
					Try YouTube or Bandcamp below.{:else}
					Enrich this album to add streaming buttons.{/if}
			</div>
		{/if}

		{#if hasYouTube || hasBandcamp}
			<div class="flex flex-wrap gap-2">
				{#if hasYouTube}
					<a
						href={bigHref('youtube')}
						target="_blank"
						rel="noopener noreferrer"
						class="car-small-btn"
					>
						<span class="car-big-btn-dot bg-red-500" aria-hidden="true"></span>
						<span>YouTube</span>
						<span class="car-big-btn-arrow" aria-hidden="true">↗</span>
					</a>
				{/if}
				{#if hasBandcamp}
					<a
						href={bigHref('bandcamp')}
						target="_blank"
						rel="noopener noreferrer"
						class="car-small-btn"
					>
						<span class="car-big-btn-dot bg-cyan-500" aria-hidden="true"></span>
						<span>Bandcamp</span>
						<span class="car-big-btn-arrow" aria-hidden="true">↗</span>
					</a>
				{/if}
			</div>
		{/if}

		<!-- Always-visible secondary link to the RYM page. Sits beneath the
		     streaming actions so it's a clear "I want the album page" tap
		     without competing with Spotify/Apple Music for visual weight. -->
		<a
			href={album.url}
			target="_blank"
			rel="noopener noreferrer"
			class="car-small-btn justify-center"
			title="Open this album on Rate Your Music"
		>
			<span>Open on Rate Your Music</span>
			<span class="car-big-btn-arrow" aria-hidden="true">↗</span>
		</a>
	</div>
</main>

<style>
	.car-play-cover {
		position: relative;
		aspect-ratio: 1 / 1;
		width: 100%;
		max-width: 28rem;
		margin: 0 auto;
		overflow: hidden;
		border-radius: 1.25rem;
		background: color-mix(in oklab, var(--color-base-300) 60%, transparent);
		box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4);
	}
	.car-play-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		position: relative;
	}
	.car-play-cover-fallback {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 4rem;
		color: color-mix(in oklab, currentColor 30%, transparent);
	}

	.car-big-btn {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-height: 4.25rem;
		padding: 1rem 1.25rem;
		border: 1px solid color-mix(in oklab, currentColor 18%, transparent);
		border-radius: 1.25rem;
		background: color-mix(in oklab, var(--color-base-200) 70%, transparent);
		transition:
			background 120ms ease,
			border-color 120ms ease,
			transform 120ms ease;
	}
	.car-big-btn:hover,
	.car-big-btn:focus-visible {
		background: color-mix(in oklab, var(--color-base-300) 65%, transparent);
		border-color: color-mix(in oklab, currentColor 30%, transparent);
		transform: translateY(-1px);
	}
	.car-big-btn-dot {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 9999px;
		flex-shrink: 0;
	}
	.car-big-btn-label {
		flex: 1;
		font-size: 1.2rem;
		font-weight: 600;
	}
	.car-big-btn-arrow {
		font-size: 1.15rem;
		color: color-mix(in oklab, currentColor 50%, transparent);
	}

	.car-small-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.7rem 1rem;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklab, currentColor 14%, transparent);
		background: color-mix(in oklab, var(--color-base-200) 60%, transparent);
		font-size: 1rem;
		font-weight: 500;
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}
	.car-small-btn:hover,
	.car-small-btn:focus-visible {
		background: color-mix(in oklab, var(--color-base-300) 60%, transparent);
		border-color: color-mix(in oklab, currentColor 24%, transparent);
	}

	@media (min-width: 640px) {
		.car-big-btn-label {
			font-size: 1.4rem;
		}
	}
</style>
