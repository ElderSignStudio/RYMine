<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { albumHasGenre } from '$lib/genres';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type View = 'deck' | 'year' | 'recent' | 'top' | 'genre';
	type SortMode = 'added' | 'year';

	const VIEW_LABELS: Record<View, (currentYear: number, genre: string | null) => string> = {
		deck: () => 'On Deck',
		year: (y) => `Released in ${y}`,
		recent: () => 'Recently Added',
		top: () => 'Highest Rated',
		genre: (_y, g) => g ?? 'Genre'
	};

	const params = $derived(page.url.searchParams);
	const view = $derived(
		((): View => {
			const v = params.get('view');
			return v === 'deck' || v === 'year' || v === 'recent' || v === 'top' || v === 'genre'
				? v
				: 'recent';
		})()
	);
	const genreFilter = $derived(params.get('g') || null);
	const sort = $derived<SortMode>(params.get('sort') === 'year' ? 'year' : 'added');

	const title = $derived(VIEW_LABELS[view](data.currentYear, genreFilter));

	// "Highest Rated" uses myRating when present, else falls back to rymRating.
	// We expose the resolved score as a derived value on the row so the sort
	// + the right-edge metadata both read the same thing.
	function effectiveScore(a: { myRating?: number; rymRating?: number }): number | undefined {
		if (typeof a.myRating === 'number') return a.myRating;
		if (typeof a.rymRating === 'number') return a.rymRating;
		return undefined;
	}

	const visible = $derived.by(() => {
		// 1) View-specific filter
		let pool = data.albums;
		if (view === 'deck') {
			pool = pool.filter((a) => a.onDeck === true);
		} else if (view === 'year') {
			pool = pool.filter((a) => a.year === data.currentYear);
		} else if (view === 'top') {
			pool = pool.filter((a) => effectiveScore(a) !== undefined);
		} else if (view === 'genre' && genreFilter) {
			pool = pool.filter((a) => albumHasGenre(a, genreFilter));
		}

		const arr = [...pool];

		// 2) Sort. Highest Rated is naturally rating-desc no matter the toggle —
		// the toggle still works as a tiebreaker. For every other view, the
		// toggle is the primary key.
		function cmpAdded(a: (typeof arr)[number], b: (typeof arr)[number]) {
			const ad = a.dateAdded ?? '';
			const bd = b.dateAdded ?? '';
			if (!ad && !bd) return 0;
			if (!ad) return 1;
			if (!bd) return -1;
			return bd.localeCompare(ad); // desc: newest first
		}
		function cmpYear(a: (typeof arr)[number], b: (typeof arr)[number]) {
			if (a.year === b.year) return 0;
			if (a.year === undefined) return 1;
			if (b.year === undefined) return -1;
			return b.year - a.year; // desc: newest first
		}

		if (view === 'top') {
			arr.sort((a, b) => {
				const sa = effectiveScore(a) ?? 0;
				const sb = effectiveScore(b) ?? 0;
				if (sa !== sb) return sb - sa;
				return sort === 'year' ? cmpYear(a, b) : cmpAdded(a, b);
			});
		} else if (view === 'deck') {
			// On Deck — order by onDeckAt desc within deck members, then by
			// the chosen sort as tiebreaker for any with the same timestamp.
			arr.sort((a, b) => {
				const oa = a.onDeckAt ?? '';
				const ob = b.onDeckAt ?? '';
				if (oa !== ob) {
					if (!oa) return 1;
					if (!ob) return -1;
					return ob.localeCompare(oa);
				}
				return sort === 'year' ? cmpYear(a, b) : cmpAdded(a, b);
			});
		} else {
			arr.sort(sort === 'year' ? cmpYear : cmpAdded);
		}

		return arr;
	});

	function pushSort(next: SortMode) {
		// Local throwaway clone of the params — never observed reactively. The
		// linter's "use SvelteURLSearchParams" rule doesn't apply since we
		// stringify and discard immediately.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const sp = new URLSearchParams(params);
		if (next === 'added') sp.delete('sort');
		else sp.set('sort', next);
		goto(`/car/list?${sp.toString()}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function playHref(id: string) {
		// Preserve the current list URL so the play card's Back button can do a
		// clean history.back() and we land here again.
		return `/car/play/${id}`;
	}

	function rightMeta(a: (typeof visible)[number]): string {
		// Small per-row metadata in the right corner — varies by view so the
		// most-relevant fact is visible at a glance.
		if (view === 'deck' || view === 'recent') {
			return a.dateAdded ? new Date(a.dateAdded).toLocaleDateString() : '';
		}
		if (view === 'year') return a.year ? String(a.year) : '';
		if (view === 'top') {
			const s = effectiveScore(a);
			if (s === undefined) return '';
			const label = typeof a.myRating === 'number' ? 'you' : 'avg';
			return `${label} ★ ${s.toFixed(2)}`;
		}
		return a.year ? `(${a.year})` : '';
	}
</script>

<svelte:head>
	<title>{title} · Car Mode · RYMine</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 sm:py-6">
	<header class="flex flex-wrap items-center gap-3">
		<a href="/car" class="btn gap-2 btn-ghost btn-lg" aria-label="Back to Car Mode home">
			<span aria-hidden="true">←</span>
			<span>Back</span>
		</a>
		<h1 class="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight">{title}</h1>
	</header>

	<!-- Sort toggle — only two options, big buttons, easy to glance at. -->
	<div class="flex items-center gap-2 text-base">
		<span class="text-base-content/60">Sort:</span>
		<div class="flex gap-1.5">
			<button
				type="button"
				class="car-sort-btn {sort === 'added' ? 'car-sort-btn-on' : ''}"
				onclick={() => pushSort('added')}
				aria-pressed={sort === 'added'}
			>
				Added date
			</button>
			<button
				type="button"
				class="car-sort-btn {sort === 'year' ? 'car-sort-btn-on' : ''}"
				onclick={() => pushSort('year')}
				aria-pressed={sort === 'year'}
			>
				Release date
			</button>
		</div>
	</div>

	{#if visible.length === 0}
		<div
			class="flex flex-col items-center gap-4 rounded-2xl border border-base-300/60 bg-base-200/40 p-8 text-center"
		>
			<p class="text-lg text-base-content/70">No albums here yet.</p>
			<a href="/car" class="btn btn-lg btn-primary">Back to Car Mode</a>
		</div>
	{:else}
		<ul class="grid gap-3">
			{#each visible as album (album.id)}
				<li>
					<a href={playHref(album.id)} class="car-album-card">
						<span class="car-cover" aria-hidden="true">
							{#if album.coverUrl || album.largeCoverUrl}
								<img
									src={album.coverUrl ?? album.largeCoverUrl}
									alt=""
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<span class="car-cover-fallback">♪</span>
							{/if}
						</span>
						<span class="car-album-text">
							<span class="car-album-artist">{album.artist}</span>
							<span class="car-album-title">{album.title}</span>
							{#if rightMeta(album)}
								<span class="car-album-meta">{rightMeta(album)}</span>
							{/if}
						</span>
						<span class="car-album-chevron" aria-hidden="true">›</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
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

	.car-album-card {
		display: grid;
		grid-template-columns: 80px 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem;
		border: 1px solid color-mix(in oklab, currentColor 10%, transparent);
		border-radius: 1rem;
		background: color-mix(in oklab, var(--color-base-200) 55%, transparent);
		transition:
			background 120ms ease,
			border-color 120ms ease,
			transform 120ms ease;
	}
	.car-album-card:hover,
	.car-album-card:focus-visible {
		background: color-mix(in oklab, var(--color-base-300) 55%, transparent);
		border-color: color-mix(in oklab, currentColor 20%, transparent);
		transform: translateY(-1px);
	}
	.car-cover {
		display: block;
		width: 80px;
		height: 80px;
		overflow: hidden;
		border-radius: 0.6rem;
		background: color-mix(in oklab, var(--color-base-300) 60%, transparent);
		position: relative;
	}
	.car-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.car-cover-fallback {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: color-mix(in oklab, currentColor 35%, transparent);
	}
	.car-album-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		line-height: 1.2;
	}
	.car-album-artist {
		font-size: 0.85rem;
		font-weight: 500;
		color: color-mix(in oklab, currentColor 80%, transparent);
	}
	.car-album-title {
		font-size: 1.15rem;
		font-weight: 600;
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.car-album-meta {
		font-size: 0.85rem;
		color: color-mix(in oklab, currentColor 55%, transparent);
	}
	.car-album-chevron {
		font-size: 1.5rem;
		color: color-mix(in oklab, currentColor 40%, transparent);
	}
	@media (min-width: 640px) {
		.car-album-card {
			grid-template-columns: 96px 1fr auto;
		}
		.car-cover {
			width: 96px;
			height: 96px;
		}
		.car-album-title {
			font-size: 1.25rem;
		}
	}
</style>
