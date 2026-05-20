<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formatLastScraped, genreCounts } from '$lib/genres';
	import { uiState } from '$lib/uiState.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Form result lives on whichever child page just submitted. Reading it
	// from $app/state lets banners render here in the layout regardless of
	// which child page is currently mounted.
	const form = $derived(page.form);

	let importing = $state(false);
	let refreshing = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let importForm = $state<HTMLFormElement | null>(null);
	let finishModalOpen = $state(false);

	const allGenres = $derived(genreCounts(data.albums));

	const visibleGenres = $derived(
		[...allGenres]
			.sort((a, b) => {
				if (uiState.genreSort === 'count') return b.count - a.count || a.name.localeCompare(b.name);
				return a.name.localeCompare(b.name);
			})
			.filter((g) => g.name.toLowerCase().includes(uiState.genreFilter.trim().toLowerCase()))
	);

	const unenrichedCount = $derived(
		data.albums.filter(
			(a) =>
				!a.enrichedAt ||
				typeof a.rymRating !== 'number' ||
				!a.descriptors ||
				a.descriptors.length === 0 ||
				!a.secondaryGenres ||
				a.secondaryGenres.length === 0
		).length
	);

	const sync = $derived(data.syncSession);
	const previewSeverity = $derived.by<'none' | 'mild' | 'strong'>(() => {
		const p = sync?.preview;
		if (!p || p.removed === 0) return 'none';
		if (p.removed > 5 && p.removalPct >= 25) return 'strong';
		return 'mild';
	});

	async function selectGenre(name: string) {
		uiState.selectedGenre = uiState.selectedGenre === name ? null : name;
		// If we're not on the album list, jump to it so the filter takes effect.
		if (page.url.pathname !== '/') await goto('/');
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

	// Poll while a sync is active so banner counts stay roughly live.
	$effect(() => {
		if (!sync) return;
		const id = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(id);
	});

	async function openFinishModal() {
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
			<a href="/" class="flex items-center gap-2" title="Back to album list">
				<span class="text-2xl" aria-hidden="true">🎚️</span>
				<div class="leading-tight">
					<h1 class="text-lg font-semibold tracking-tight sm:text-xl">RYMScraper</h1>
					<p class="hidden text-xs text-base-content/60 sm:block">
						a cozy little wishlist, sorted by mood
					</p>
				</div>
			</a>

			<div class="ml-auto flex items-center gap-3">
				{#if data.source === 'mock'}
					<span
						class="badge hidden badge-sm badge-warning md:inline-flex"
						title="No data/wishlist.json yet — showing mock data."
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
					<form method="POST" action="/?/startSync" class="contents" use:enhance>
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
					title="Set up the one-click browser bookmarklets"
				>
					Bookmarklet
				</a>

				<a
					href="/queue"
					class="btn hidden btn-ghost transition btn-sm hover:-translate-y-0.5 sm:inline-flex"
					title="Albums still missing detail metadata"
				>
					Queue
					{#if unenrichedCount > 0}
						<span class="ml-1 badge badge-xs font-medium badge-warning">
							{unenrichedCount}
						</span>
					{/if}
				</a>

				<form
					bind:this={importForm}
					method="POST"
					action="/?/import"
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
						action="/?/cancelSync"
						class="contents"
						onsubmit={confirmCancelSync}
						use:enhance
					>
						<button type="submit" class="btn btn-ghost btn-sm">Cancel Sync</button>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- Action-result banners (whichever child page just submitted) -->
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
			{:else if form.syncStarted}
				<div
					class="alert border-info/30 bg-info/10 py-2 text-sm alert-info shadow-sm"
					role="status"
				>
					<span>
						Full sync started. Snapshot taken: <strong>{form.initialCount}</strong>
						{form.initialCount === 1 ? 'album' : 'albums'}. Click the bookmarklet on each RYM
						wishlist page, then come back and finish.
					</span>
				</div>
			{:else if form.syncFinished}
				<div
					class="alert border-success/30 bg-success/10 py-2 text-sm alert-success shadow-sm"
					role="status"
				>
					<span>
						Sync complete · added <strong>{form.added}</strong>, updated {form.updated}, unchanged
						{form.unchanged}, removed <strong>{form.removed}</strong> (total {form.total})
					</span>
				</div>
			{:else if form.syncCancelled}
				<div
					class="alert border-warning/30 bg-warning/10 py-2 text-sm alert-warning shadow-sm"
					role="status"
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
			{/if}
		</div>
	{/if}

	<!-- Main two-pane layout: sidebar + right panel slot -->
	<main class="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row">
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
						class="btn btn-ghost btn-xs {uiState.genreSort === 'name' ? 'btn-active' : ''}"
						onclick={() => (uiState.genreSort = 'name')}
						title="Alphabetical"
					>
						A–Z
					</button>
					<button
						type="button"
						class="btn btn-ghost btn-xs {uiState.genreSort === 'count' ? 'btn-active' : ''}"
						onclick={() => (uiState.genreSort = 'count')}
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
						bind:value={uiState.genreFilter}
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
								{uiState.selectedGenre === genre.name
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

		<!-- Right panel slot -->
		<section class="min-w-0 flex-1">
			{@render children()}
		</section>
	</main>

	<footer class="border-t border-base-300/60 py-3 text-center text-xs text-base-content/40">
		local-only · JSON-backed · click an album to see details
	</footer>
</div>

<!-- Finish Full Sync confirmation modal (sync state is on layout, so the modal lives here too) -->
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
							<span class="text-xs font-normal text-base-content/60">
								({sync.preview.removalPct}%)
							</span>
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
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => (finishModalOpen = false)}
					>Back</button
				>
				<form
					method="POST"
					action="/?/finishSync"
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
