<script lang="ts">
	import { formatWishlistDate } from '$lib/dates';
	import { uiState } from '$lib/uiState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Album-list-only sort state. Genre filter state lives on the shared
	// uiState singleton so the sidebar in the layout drives it.
	let albumSort = $state<'artist' | 'year' | 'added'>('artist');
	let albumDir = $state<'asc' | 'desc'>('asc');

	const visibleAlbums = $derived.by(() => {
		const base = uiState.selectedGenre
			? data.albums.filter((a) => a.genres.includes(uiState.selectedGenre!))
			: data.albums;
		const sign = albumDir === 'asc' ? 1 : -1;
		const sorted = [...base].sort((a, b) => {
			if (albumSort === 'artist') return sign * a.artist.localeCompare(b.artist);
			if (albumSort === 'year') {
				const ay = a.year;
				const by = b.year;
				if (ay === undefined && by === undefined) return 0;
				if (ay === undefined) return 1; // missing always last
				if (by === undefined) return -1;
				return sign * (ay - by);
			}
			// 'added'
			const ad = a.dateAdded ?? '';
			const bd = b.dateAdded ?? '';
			if (!ad && !bd) return 0;
			if (!ad) return 1;
			if (!bd) return -1;
			return sign * ad.localeCompare(bd);
		});
		return sorted;
	});

	function setAlbumSort(mode: 'artist' | 'year' | 'added') {
		if (albumSort === mode) {
			albumDir = albumDir === 'asc' ? 'desc' : 'asc';
		} else {
			albumSort = mode;
			albumDir = mode === 'artist' ? 'asc' : 'desc';
		}
	}

	function sortArrow(mode: 'artist' | 'year' | 'added'): string {
		if (albumSort !== mode) return '';
		return albumDir === 'asc' ? ' ↑' : ' ↓';
	}
</script>

<section class="card overflow-hidden border border-base-300/70 bg-base-200/40 shadow-sm">
	<div class="flex flex-wrap items-end justify-between gap-3 border-b border-base-300/70 p-4">
		<div>
			<h2 class="text-base font-semibold tracking-tight sm:text-lg">
				{uiState.selectedGenre ?? 'All albums'}
			</h2>
			<p class="text-xs text-base-content/60">
				{visibleAlbums.length}
				{visibleAlbums.length === 1 ? 'album' : 'albums'}
				{uiState.selectedGenre ? 'in this genre' : 'in wishlist'}
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-1 text-xs">
			<span class="text-base-content/50">sort:</span>
			<button
				type="button"
				class="btn btn-ghost btn-xs {albumSort === 'artist' ? 'btn-active' : ''}"
				onclick={() => setAlbumSort('artist')}
				title="Sort alphabetically by artist"
			>
				artist{sortArrow('artist')}
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs {albumSort === 'year' ? 'btn-active' : ''}"
				onclick={() => setAlbumSort('year')}
				title="Sort by release year"
			>
				year{sortArrow('year')}
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs {albumSort === 'added' ? 'btn-active' : ''}"
				onclick={() => setAlbumSort('added')}
				title="Sort by wishlist-added date"
			>
				added{sortArrow('added')}
			</button>
			{#if uiState.selectedGenre}
				<button
					type="button"
					class="btn ml-2 btn-ghost btn-xs"
					onclick={() => (uiState.selectedGenre = null)}
				>
					Clear filter
				</button>
			{/if}
		</div>
	</div>

	<ul class="divide-y divide-base-300/60">
		{#each visibleAlbums as album (album.url)}
			{@const addedDisplay = formatWishlistDate(album.dateAdded)}
			<li class="group transition-colors duration-150 hover:bg-base-300/40">
				<div class="flex items-center gap-3 px-4 pt-3">
					<a
						href="/album/{album.id}"
						class="flex min-w-0 flex-1 items-center gap-3"
						title="Open local detail panel"
					>
						<span
							class="relative block h-11 w-11 shrink-0 overflow-hidden rounded bg-base-300/40 shadow-sm transition-transform group-hover:scale-[1.02]"
							aria-hidden="true"
						>
							<span
								class="absolute inset-0 flex items-center justify-center text-base text-base-content/30"
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
							<span class="block truncate text-sm font-medium sm:text-[0.95rem]">
								<span class="text-base-content/90">{album.artist}</span>
								<span class="text-base-content/40"> — </span>
								<span class="text-base-content italic">{album.title}</span>
								{#if album.year}
									<span class="ml-1 text-base-content/50">({album.year})</span>
								{/if}
								{#if typeof album.rymRating === 'number'}
									<span class="ml-1 text-xs text-base-content/55" title="RYM average rating">
										· ★ {album.rymRating.toFixed(2)}
									</span>
								{/if}
								{#if typeof album.myRating === 'number'}
									<span class="ml-1 text-xs font-medium text-primary/80" title="Your rating">
										· you {album.myRating}
									</span>
								{/if}
								{#if addedDisplay}
									<span class="ml-1 text-xs text-base-content/40">· added {addedDisplay}</span>
								{/if}
							</span>
						</span>
					</a>
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
				<div class="flex flex-wrap gap-1 px-4 pb-3 pl-17">
					{#each album.genres as g (g)}
						<button
							type="button"
							class="badge badge-ghost badge-xs transition hover:badge-primary"
							onclick={() => (uiState.selectedGenre = uiState.selectedGenre === g ? null : g)}
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
