<script lang="ts">
	import { formatWishlistDate } from '$lib/dates';
	import { albumHasDescriptor, albumHasGenre } from '$lib/genres';
	import { uiState } from '$lib/uiState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Album-list-only sort state. Genre / descriptor filter state lives on
	// the shared uiState singleton so the sidebar drives it.
	type AlbumSort = 'artist' | 'year' | 'added' | 'rymRating' | 'myRating';
	let albumSort = $state<AlbumSort>('artist');
	let albumDir = $state<'asc' | 'desc'>('asc');

	const visibleAlbums = $derived.by(() => {
		const base = data.albums.filter((a) => {
			if (uiState.selectedGenre && !albumHasGenre(a, uiState.selectedGenre)) return false;
			if (uiState.selectedDescriptor && !albumHasDescriptor(a, uiState.selectedDescriptor))
				return false;
			return true;
		});
		const sign = albumDir === 'asc' ? 1 : -1;

		function compareOptionalNumber(ax: number | undefined, bx: number | undefined): number {
			if (ax === undefined && bx === undefined) return 0;
			if (ax === undefined) return 1; // missing always last
			if (bx === undefined) return -1;
			return sign * (ax - bx);
		}

		const sorted = [...base].sort((a, b) => {
			if (albumSort === 'artist') return sign * a.artist.localeCompare(b.artist);
			if (albumSort === 'year') return compareOptionalNumber(a.year, b.year);
			if (albumSort === 'rymRating') return compareOptionalNumber(a.rymRating, b.rymRating);
			if (albumSort === 'myRating') return compareOptionalNumber(a.myRating, b.myRating);
			// 'added' — ISO strings sort lexicographically == chronologically
			const ad = a.dateAdded ?? '';
			const bd = b.dateAdded ?? '';
			if (!ad && !bd) return 0;
			if (!ad) return 1;
			if (!bd) return -1;
			return sign * ad.localeCompare(bd);
		});
		return sorted;
	});

	function setAlbumSort(mode: AlbumSort) {
		if (albumSort === mode) {
			albumDir = albumDir === 'asc' ? 'desc' : 'asc';
		} else {
			albumSort = mode;
			// Sensible defaults: A→Z for artist, but newer/higher first for the rest.
			albumDir = mode === 'artist' ? 'asc' : 'desc';
		}
	}

	function sortArrow(mode: AlbumSort): string {
		if (albumSort !== mode) return '';
		return albumDir === 'asc' ? ' ↑' : ' ↓';
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
			<button
				type="button"
				class="btn btn-ghost btn-xs {albumSort === 'rymRating' ? 'btn-active' : ''}"
				onclick={() => setAlbumSort('rymRating')}
				title="Sort by RYM average rating"
			>
				avg ★{sortArrow('rymRating')}
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs {albumSort === 'myRating' ? 'btn-active' : ''}"
				onclick={() => setAlbumSort('myRating')}
				title="Sort by your rating (unrated last)"
			>
				you ★{sortArrow('myRating')}
			</button>
			{#if uiState.selectedGenre || uiState.selectedDescriptor}
				<button
					type="button"
					class="btn ml-2 btn-ghost btn-xs"
					onclick={() => {
						uiState.selectedGenre = null;
						uiState.selectedDescriptor = null;
					}}
				>
					Clear filter
				</button>
			{/if}
		</div>
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
				<div class="flex flex-wrap items-center gap-1 px-4 pb-3 pl-23">
					{#each split.primary as g (g)}
						<button
							type="button"
							class="badge badge-xs transition badge-neutral hover:badge-primary"
							onclick={() => (uiState.selectedGenre = uiState.selectedGenre === g ? null : g)}
						>
							{g}
						</button>
					{/each}
					{#each split.secondary as g (g)}
						<button
							type="button"
							class="badge badge-ghost badge-xs italic opacity-60 transition hover:opacity-100 hover:badge-primary"
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
