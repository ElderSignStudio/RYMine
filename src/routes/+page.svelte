<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { formatWishlistDate } from '$lib/dates';
	import { formatLastScraped, genreCounts } from '$lib/genres';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let genreFilter = $state('');
	let selectedGenre = $state<string | null>(null);
	let genreSort = $state<'name' | 'count'>('name');
	let albumSort = $state<'artist' | 'year' | 'added'>('artist');
	let albumDir = $state<'asc' | 'desc'>('asc');
	let importing = $state(false);
	let refreshing = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let importForm = $state<HTMLFormElement | null>(null);
	let finishModalOpen = $state(false);

	const allGenres = $derived(genreCounts(data.albums));

	const visibleGenres = $derived(
		[...allGenres]
			.sort((a, b) => {
				if (genreSort === 'count') return b.count - a.count || a.name.localeCompare(b.name);
				return a.name.localeCompare(b.name);
			})
			.filter((g) => g.name.toLowerCase().includes(genreFilter.trim().toLowerCase()))
	);

	const visibleAlbums = $derived.by(() => {
		const base = selectedGenre
			? data.albums.filter((a) => a.genres.includes(selectedGenre!))
			: data.albums;
		const sign = albumDir === 'asc' ? 1 : -1;
		const sorted = [...base].sort((a, b) => {
			if (albumSort === 'artist') {
				return sign * a.artist.localeCompare(b.artist);
			}
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
			if (!ad) return 1; // missing always last
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
			// Sensible default direction per mode.
			albumDir = mode === 'artist' ? 'asc' : 'desc';
		}
	}

	function sortArrow(mode: 'artist' | 'year' | 'added'): string {
		if (albumSort !== mode) return '';
		return albumDir === 'asc' ? ' ↑' : ' ↓';
	}

	const sync = $derived(data.syncSession);
	const previewSeverity = $derived.by<'none' | 'mild' | 'strong'>(() => {
		const p = sync?.preview;
		if (!p || p.removed === 0) return 'none';
		if (p.removed > 5 && p.removalPct >= 25) return 'strong';
		return 'mild';
	});

	function selectGenre(name: string) {
		selectedGenre = selectedGenre === name ? null : name;
	}

	function pickFiles() {
		fileInput?.click();
	}

	function onFilesChosen() {
		if (fileInput && fileInput.files && fileInput.files.length > 0) {
			importForm?.requestSubmit();
		}
	}

	function confirmCancelSync(e: SubmitEvent) {
		if (
			!confirm(
				'Cancel this full sync? No albums will be removed; you just lose the in-progress session.'
			)
		) {
			e.preventDefault();
		}
	}

	// The bookmarklet POSTs to /api/import from a different tab, so the local app
	// doesn't naturally know its sync counts changed. While a sync is active,
	// poll every 3s so the banner stays roughly live and Finish opens with
	// fresh numbers.
	$effect(() => {
		if (!sync) return;
		const id = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(id);
	});

	async function openFinishModal() {
		// Belt-and-suspenders: ensure the preview reflects the current session
		// state before we render it.
		refreshing = true;
		await invalidateAll();
		refreshing = false;
		finishModalOpen = true;
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
				{#if data.source === 'mock'}
					<span
						class="badge hidden badge-sm badge-warning md:inline-flex"
						title="No data/wishlist.json yet — showing mock data. Import saved RYM wishlist HTML to populate."
					>
						mock data
					</span>
				{/if}
				<span class="hidden text-xs text-base-content/60 md:inline">
					last updated:
					<span class="font-medium text-base-content/80">
						{formatLastScraped(data.lastScrapedAt)}
					</span>
				</span>

				{#if !sync}
					<form method="POST" action="?/startSync" class="contents" use:enhance>
						<button
							type="submit"
							class="btn hidden btn-ghost transition btn-outline btn-sm hover:-translate-y-0.5 sm:inline-flex"
							title="Take a snapshot now and remove anything not seen by the time you finish."
						>
							Start Full Sync
						</button>
					</form>
				{/if}

				<a
					href="/bookmarklet"
					class="btn hidden btn-ghost transition btn-sm hover:-translate-y-0.5 sm:inline-flex"
					title="Set up the one-click browser bookmarklet"
				>
					Bookmarklet
				</a>

				<form
					bind:this={importForm}
					method="POST"
					action="?/import"
					enctype="multipart/form-data"
					class="contents"
					use:enhance={() => {
						importing = true;
						return async ({ update }) => {
							await update({ reset: true });
							if (fileInput) fileInput.value = '';
							importing = false;
						};
					}}
				>
					<input
						bind:this={fileInput}
						name="files"
						type="file"
						accept=".html,.htm,text/html"
						multiple
						class="hidden"
						onchange={onFilesChosen}
					/>
					<button
						type="button"
						class="btn shadow-sm transition btn-sm btn-primary hover:-translate-y-0.5 hover:shadow-md sm:btn-md"
						onclick={pickFiles}
						disabled={importing}
						title="Import saved RYM wishlist HTML pages"
					>
						{#if importing}
							<span class="loading loading-xs loading-spinner"></span>
							Importing…
						{:else}
							Import HTML
						{/if}
					</button>
				</form>
			</div>
		</div>
	</header>

	<!-- Active full-sync banner -->
	{#if sync}
		<div class="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6">
			<div
				class="alert flex flex-wrap items-center gap-3 border-info/30 bg-info/10 py-3 text-sm shadow-sm"
				role="status"
			>
				<span class="text-base" aria-hidden="true">🔄</span>
				<span class="flex-1 leading-tight">
					<strong>Full sync in progress</strong>
					<span class="text-base-content/70">
						· {sync.preview.pageCount}
						{sync.preview.pageCount === 1 ? 'page' : 'pages'} imported · {sync.preview.seenCount}
						{sync.preview.seenCount === 1 ? 'album' : 'albums'} seen · snapshot has {sync.preview
							.initialCount}
					</span>
				</span>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						onclick={async () => {
							refreshing = true;
							await invalidateAll();
							refreshing = false;
						}}
						title="Refresh sync progress"
						disabled={refreshing}
					>
						{refreshing ? '…' : '↻'}
					</button>
					<button
						type="button"
						class="btn shadow-sm transition btn-sm btn-primary hover:-translate-y-0.5"
						onclick={openFinishModal}
						disabled={refreshing}
					>
						Finish Full Sync
					</button>
					<form
						method="POST"
						action="?/cancelSync"
						class="contents"
						onsubmit={confirmCancelSync}
						use:enhance
					>
						<button type="submit" class="btn btn-ghost btn-sm"> Cancel Sync </button>
					</form>
				</div>
			</div>
		</div>
	{/if}

	{#if form}
		<div class="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6">
			{#if form.success}
				<div
					role="status"
					class="alert border-success/30 bg-success/10 py-2 text-sm alert-success shadow-sm"
				>
					<span>
						Imported <strong>{form.added}</strong> new
						{form.added === 1 ? 'album' : 'albums'} from {form.files}
						{form.files === 1 ? 'file' : 'files'}
						<span class="opacity-70">
							{#if form.syncActive}
								({form.updated} updated · {form.unchanged} unchanged{#if form.datesRefreshed}
									· {form.datesRefreshed} date{form.datesRefreshed === 1 ? '' : 's'} refreshed{/if}{#if form.coversRefreshed}
									· {form.coversRefreshed} cover{form.coversRefreshed === 1 ? '' : 's'} refreshed{/if}
								· total {form.total})
							{:else}
								({form.duplicates} duplicate{form.duplicates === 1 ? '' : 's'} skipped{#if form.datesRefreshed}
									· {form.datesRefreshed} date{form.datesRefreshed === 1 ? '' : 's'} refreshed{/if}{#if form.coversRefreshed}
									· {form.coversRefreshed} cover{form.coversRefreshed === 1 ? '' : 's'} refreshed{/if}
								· total {form.total})
							{/if}
						</span>
					</span>
				</div>
				{#if form.errors && form.errors.length > 0}
					<ul class="mt-2 list-disc pl-6 text-xs text-base-content/60">
						{#each form.errors as msg (msg)}
							<li>{msg}</li>
						{/each}
					</ul>
				{/if}
			{:else if form.syncStarted}
				<div
					role="status"
					class="alert border-info/30 bg-info/10 py-2 text-sm alert-info shadow-sm"
				>
					<span>
						Full sync started. Snapshot taken: <strong>{form.initialCount}</strong>
						{form.initialCount === 1 ? 'album' : 'albums'}. Click the bookmarklet on each RYM
						wishlist page, then come back and finish.
					</span>
				</div>
			{:else if form.syncFinished}
				<div
					role="status"
					class="alert border-success/30 bg-success/10 py-2 text-sm alert-success shadow-sm"
				>
					<span>
						Sync complete · added <strong>{form.added}</strong>, updated {form.updated}, unchanged {form.unchanged},
						removed <strong>{form.removed}</strong> (total {form.total})
					</span>
				</div>
			{:else if form.syncCancelled}
				<div
					role="status"
					class="alert border-warning/30 bg-warning/10 py-2 text-sm alert-warning shadow-sm"
				>
					<span>
						Sync cancelled. {form.pageCount}
						{form.pageCount === 1 ? 'page' : 'pages'} discarded · nothing was removed.
					</span>
				</div>
			{:else if form.error}
				<div role="alert" class="alert py-2 text-sm alert-error shadow-sm">
					<span>{form.error}</span>
				</div>
				{#if form.errors && form.errors.length > 0}
					<ul class="mt-2 list-disc pl-6 text-xs text-base-content/60">
						{#each form.errors as msg (msg)}
							<li>{msg}</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	{/if}

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
				<div class="mb-2 flex items-center gap-1 text-xs">
					<span class="text-base-content/50">sort:</span>
					<button
						type="button"
						class="btn btn-ghost btn-xs {genreSort === 'name' ? 'btn-active' : ''}"
						onclick={() => (genreSort = 'name')}
						title="Alphabetical"
					>
						A–Z
					</button>
					<button
						type="button"
						class="btn btn-ghost btn-xs {genreSort === 'count' ? 'btn-active' : ''}"
						onclick={() => (genreSort = 'count')}
						title="By album count, highest first"
					>
						count
					</button>
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
			<div class="flex flex-wrap items-end justify-between gap-3 border-b border-base-300/70 p-4">
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
					{#if selectedGenre}
						<button
							type="button"
							class="btn ml-2 btn-ghost btn-xs"
							onclick={() => (selectedGenre = null)}
						>
							Clear filter
						</button>
					{/if}
				</div>
			</div>

			<ul class="divide-y divide-base-300/60">
				{#each visibleAlbums as album (album.url)}
					{@const addedDisplay = formatWishlistDate(album.dateAdded)}
					<li>
						<a
							href={album.url}
							target="_blank"
							rel="noopener noreferrer"
							class="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-base-300/40"
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
										<span class="ml-1 text-xs text-base-content/40">
											· added {addedDisplay}
										</span>
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
		local-only · JSON-backed · import saved RYM HTML to populate
	</footer>
</div>

<!-- Finish Full Sync confirmation modal -->
{#if finishModalOpen && sync}
	<div
		class="fixed inset-0 z-30 flex items-center justify-center bg-base-300/70 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label="Confirm finish full sync"
		onclick={(e) => {
			if (e.target === e.currentTarget) finishModalOpen = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') finishModalOpen = false;
		}}
		tabindex="-1"
	>
		<div class="card mx-4 w-full max-w-md border border-base-300/70 bg-base-100 p-5 shadow-xl">
			<h2 class="mb-1 text-lg font-semibold tracking-tight">Finish full sync?</h2>
			<p class="mb-4 text-xs text-base-content/60">
				Started {formatLastScraped(sync.startedAt)} · {sync.preview.pageCount}
				{sync.preview.pageCount === 1 ? 'page' : 'pages'} imported · {sync.preview.seenCount} albums seen
			</p>

			<div class="mb-4 grid grid-cols-2 gap-2 text-sm">
				<div class="rounded bg-base-200/60 px-3 py-2">
					<div class="text-xs text-base-content/60">Added</div>
					<div class="font-semibold">{sync.preview.added}</div>
				</div>
				<div class="rounded bg-base-200/60 px-3 py-2">
					<div class="text-xs text-base-content/60">Updated</div>
					<div class="font-semibold">{sync.preview.updated}</div>
				</div>
				<div class="rounded bg-base-200/60 px-3 py-2">
					<div class="text-xs text-base-content/60">Unchanged</div>
					<div class="font-semibold">{sync.preview.unchanged}</div>
				</div>
				<div
					class="rounded px-3 py-2 {previewSeverity === 'strong'
						? 'border border-error/40 bg-error/15'
						: previewSeverity === 'mild'
							? 'bg-warning/15'
							: 'bg-base-200/60'}"
				>
					<div class="text-xs text-base-content/60">Will be removed</div>
					<div class="font-semibold">
						{sync.preview.removed}
						{#if sync.preview.removed > 0}
							<span class="text-xs font-normal text-base-content/60"
								>({sync.preview.removalPct}%)</span
							>
						{/if}
					</div>
				</div>
			</div>

			{#if previewSeverity === 'strong'}
				<div
					role="alert"
					class="mb-4 alert border-error/40 bg-error/10 py-2 text-xs alert-error shadow-sm"
				>
					<span>
						This is a big deletion ({sync.preview.removalPct}% of your snapshot). Double-check you
						imported every wishlist page before finishing — you can still <em>Cancel Sync</em> safely.
					</span>
				</div>
			{:else if previewSeverity === 'mild'}
				<p class="mb-4 text-xs text-base-content/60">
					{sync.preview.removed}
					{sync.preview.removed === 1 ? 'album' : 'albums'} from the snapshot were not seen during this
					sync and will be removed.
				</p>
			{:else}
				<p class="mb-4 text-xs text-base-content/60">
					No albums will be removed — every snapshot URL was seen.
				</p>
			{/if}

			<div class="flex flex-wrap items-center justify-end gap-2">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => (finishModalOpen = false)}
				>
					Back
				</button>
				<form
					method="POST"
					action="?/finishSync"
					class="contents"
					use:enhance={() => {
						return async ({ update }) => {
							await update({ reset: true });
							finishModalOpen = false;
						};
					}}
				>
					<button
						type="submit"
						class="btn shadow-sm transition btn-sm hover:-translate-y-0.5 {previewSeverity ===
						'strong'
							? 'btn-error'
							: 'btn-primary'}"
					>
						{#if sync.preview.removed === 0}
							Finish (no removals)
						{:else}
							Confirm · remove {sync.preview.removed}
							{sync.preview.removed === 1 ? 'album' : 'albums'}
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}
