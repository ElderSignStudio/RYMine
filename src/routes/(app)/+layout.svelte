<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { buildFiltersURL, filterAlbums, parseFilters, withChanges } from '$lib/filters';
	import { descriptorCounts, formatLastScraped, genreCounts } from '$lib/genres';
	import { DEFAULT_THEME, THEMES, THEME_BLURBS, themeStore, type Theme } from '$lib/theme.svelte';
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

	// Mobile-only collapse state for the sidebar sections. We initialise from
	// the URL (read directly, not from the $derived `filters`, to avoid Svelte
	// state-init warnings) so a deep link with ?g=… or ?d=… arrives expanded.
	// On lg+ these flags don't affect layout — CSS forces the panels open.
	let genresOpenMobile = $state<boolean>(Boolean(page.url.searchParams.get('g')));
	let descriptorsOpenMobile = $state<boolean>(Boolean(page.url.searchParams.get('d')));
	$effect(() => {
		// Auto-expand the section when its filter becomes active (e.g. user
		// tapped a genre badge from an album row). We only open — never auto-
		// close — so manual collapses stay in effect.
		if (filters.genre) genresOpenMobile = true;
	});
	$effect(() => {
		if (filters.descriptor) descriptorsOpenMobile = true;
	});

	// URL is the source of truth for selected genre / descriptor / search /
	// sort. See $lib/filters.ts for the rationale (back-nav, bookmarkability).
	const filters = $derived(parseFilters(page.url.searchParams));

	// Detail routes (/album/[id]) don't benefit from the sidebar filters or the
	// mobile chip strip — both belong to the album list. On mobile, leaving
	// them in the flow pushes the actual detail content below the fold so the
	// user lands on the sidebar headers after navigation. Hide both on detail
	// routes (mobile keeps the page lean; desktop still gets the left sidebar).
	const isDetailPage = $derived(page.url.pathname.startsWith('/album/'));

	// Mode + auth come from the root +layout.server.ts. In readonly mode we
	// hide write controls and show a small badge + logout. The server still
	// enforces the same rules — these flags only drive the chrome.
	const isReadonly = $derived(data.appMode === 'readonly');

	// Each sidebar list narrows to "what could you add given the OTHER active
	// filters?" — picking a genre narrows the descriptor list to descriptors on
	// matching albums (and vice versa). Search is included too so the sidebar
	// reflects whatever's currently visible in the album list.
	const genresSourceAlbums = $derived(
		filterAlbums(data.albums, { descriptor: filters.descriptor, query: filters.query })
	);
	const descriptorsSourceAlbums = $derived(
		filterAlbums(data.albums, { genre: filters.genre, query: filters.query })
	);

	const allGenres = $derived(genreCounts(genresSourceAlbums));
	const allDescriptors = $derived(descriptorCounts(descriptorsSourceAlbums));

	const visibleGenres = $derived.by(() => {
		const list = [...allGenres];
		// Pin the currently-selected genre even if narrowing knocked its count
		// to zero, so the user always has a place to deselect from.
		const sel = filters.genre;
		if (sel && !list.some((g) => g.name === sel)) list.push({ name: sel, count: 0 });
		return list
			.sort((a, b) => {
				if (uiState.genreSort === 'count') return b.count - a.count || a.name.localeCompare(b.name);
				return a.name.localeCompare(b.name);
			})
			.filter((g) => g.name.toLowerCase().includes(uiState.genreFilter.trim().toLowerCase()));
	});

	const visibleDescriptors = $derived.by(() => {
		const list = [...allDescriptors];
		const sel = filters.descriptor;
		if (sel && !list.some((d) => d.name === sel)) list.push({ name: sel, count: 0 });
		return list
			.sort((a, b) => {
				if (uiState.descriptorSort === 'count')
					return b.count - a.count || a.name.localeCompare(b.name);
				return a.name.localeCompare(b.name);
			})
			.filter((d) => d.name.toLowerCase().includes(uiState.descriptorFilter.trim().toLowerCase()));
	});

	// Matches the queue page's rule: an album counts as enriched once the
	// bookmarklet has run on it, even if some RYM fields came back empty.
	const unenrichedCount = $derived(data.albums.filter((a) => !a.enrichedAt).length);

	const sync = $derived(data.syncSession);
	const previewSeverity = $derived.by<'none' | 'mild' | 'strong'>(() => {
		const p = sync?.preview;
		if (!p || p.removed === 0) return 'none';
		if (p.removed > 5 && p.removalPct >= 25) return 'strong';
		return 'mild';
	});

	async function selectGenre(name: string) {
		const next = withChanges(filters, { genre: filters.genre === name ? null : name });
		await goto(buildFiltersURL(next), { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function selectDescriptor(name: string) {
		const next = withChanges(filters, {
			descriptor: filters.descriptor === name ? null : name
		});
		await goto(buildFiltersURL(next), { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function clearAllFilters() {
		const next = withChanges(filters, { genre: null, descriptor: null, query: '' });
		await goto(buildFiltersURL(next), { replaceState: true, keepFocus: true, noScroll: true });
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

	// When the user comes back from a RYM tab after running the import or
	// enrich bookmarklet, re-fetch so all (app)/* pages — list, detail, queue —
	// pick up the new data without a manual reload.
	$effect(() => {
		function onFocus() {
			invalidateAll();
		}
		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	});

	// Poll while a sync is active so banner counts stay roughly live.
	$effect(() => {
		if (!sync) return;
		const id = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(id);
	});

	function pickTheme(next: Theme) {
		themeStore.set(next);
		// Close the DaisyUI dropdown (focus-within based) by blurring the
		// currently-focused element so the user lands back in the page flow.
		(document.activeElement as HTMLElement | null)?.blur();
	}

	function resetTheme() {
		themeStore.reset();
		(document.activeElement as HTMLElement | null)?.blur();
	}

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
		<div
			class="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-3"
		>
			<a href="/" class="flex items-center gap-2 sm:gap-3" title="Back to album list">
				<span
					class="relative block h-9 w-9 shrink-0 overflow-hidden rounded-md bg-base-300/40 shadow-sm sm:h-14 sm:w-14"
				>
					<span
						class="absolute inset-0 flex items-center justify-center text-lg text-base-content/40 sm:text-2xl"
						aria-hidden="true"
					>
						⛏
					</span>
					<img
						src="/RYMine%20Icon.png"
						alt=""
						class="relative h-full w-full object-cover"
						loading="eager"
						decoding="async"
					/>
				</span>
				<h1 class="text-lg font-semibold tracking-tight sm:text-3xl">RYMine</h1>
			</a>

			{#if isReadonly}
				<span
					class="badge gap-1 badge-outline badge-sm text-base-content/70"
					title="This RYMine instance is read-only. Writes (import / enrich / sync) are disabled."
				>
					<span aria-hidden="true">👁</span>
					<span class="hidden sm:inline">read-only</span>
				</span>
			{/if}

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

				{#if !sync && !isReadonly}
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

				<!-- Theme picker -->
				<div class="dropdown dropdown-end">
					<div
						tabindex="0"
						role="button"
						aria-label="Change theme"
						title="Change theme · current: {themeStore.current}"
						class="btn gap-1.5 btn-ghost transition btn-sm hover:-translate-y-0.5"
					>
						<span
							class="inline-flex h-4 w-4 overflow-hidden rounded-sm ring-1 ring-base-content/15"
							aria-hidden="true"
						>
							<span class="flex-1 bg-base-100"></span>
							<span class="flex-1 bg-base-300"></span>
							<span class="flex-1 bg-primary"></span>
						</span>
						<span class="hidden sm:inline">Theme</span>
					</div>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						tabindex="0"
						class="dropdown-content z-30 mt-2 w-64 rounded-box border border-base-300/70 bg-base-200 p-2 shadow-lg"
					>
						<p class="px-2 pt-1 pb-2 text-xs text-base-content/60">Pick a vibe — saved locally.</p>
						<ul class="flex flex-col gap-1">
							{#each THEMES as t (t)}
								<li>
									<button
										type="button"
										onclick={() => pickTheme(t)}
										class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-base-300/60 {themeStore.current ===
										t
											? 'bg-primary/15 ring-1 ring-primary/30'
											: ''}"
									>
										<!-- Mini swatch — each scoped to its own data-theme so DaisyUI
										     resolves its actual palette in the preview. -->
										<span
											data-theme={t}
											class="flex h-7 w-10 shrink-0 overflow-hidden rounded border border-base-content/15"
											aria-hidden="true"
										>
											<span class="flex-1 bg-base-100"></span>
											<span class="flex-1 bg-base-300"></span>
											<span class="flex-1 bg-primary"></span>
											<span class="flex-1 bg-secondary"></span>
										</span>
										<span class="min-w-0 flex-1">
											<span class="block text-sm font-medium capitalize">{t}</span>
											<span class="block truncate text-xs text-base-content/55">
												{THEME_BLURBS[t]}
											</span>
										</span>
										{#if themeStore.current === t}
											<span class="text-xs text-primary" aria-label="Active">●</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
						{#if themeStore.current !== DEFAULT_THEME}
							<div class="mt-2 border-t border-base-300/70 pt-2">
								<button
									type="button"
									onclick={resetTheme}
									class="btn w-full btn-ghost btn-xs"
									title="Reset to {DEFAULT_THEME}"
								>
									Reset to default ({DEFAULT_THEME})
								</button>
							</div>
						{/if}
					</div>
				</div>

				{#if !isReadonly}
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
							class="btn hidden btn-ghost transition btn-sm hover:-translate-y-0.5 sm:inline-flex"
							onclick={pickFiles}
							disabled={importing}
							title="Import saved RYM wishlist HTML pages (legacy — the bookmarklet is the easier path)"
						>
							{#if importing}
								<span class="loading loading-xs loading-spinner"></span>
								Importing…
							{:else}
								Import HTML
							{/if}
						</button>
					</form>
				{:else}
					<!-- Readonly mode: replace the write toolbar with a logout link. -->
					<form method="POST" action="/logout" class="contents">
						<button
							type="submit"
							class="btn btn-ghost transition btn-sm hover:-translate-y-0.5"
							title="Sign out"
						>
							Logout
						</button>
					</form>
				{/if}
			</div>
		</div>

		<!-- Mobile-only active-filter strip. Rides along with the sticky header
		     so it stays visible while the album list scrolls underneath.
		     Suppressed on detail pages where it's not relevant. -->
		{#if (filters.genre || filters.descriptor || filters.query) && !isDetailPage}
			<div class="border-t border-base-300/70 bg-base-200/85 px-3 py-1.5 lg:hidden">
				<div class="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-1.5 text-xs">
					<span class="text-base-content/50">filters:</span>
					{#if filters.genre}
						<button
							type="button"
							class="badge gap-1 badge-sm badge-primary"
							onclick={() => selectGenre(filters.genre as string)}
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
							onclick={() => selectDescriptor(filters.descriptor as string)}
							title="Remove descriptor filter"
						>
							{filters.descriptor}
							<span aria-hidden="true">✕</span>
						</button>
					{/if}
					{#if filters.query}
						<span class="badge gap-1 badge-ghost badge-sm" title={`search: ${filters.query}`}>
							“{filters.query}”
						</span>
					{/if}
					<button
						type="button"
						class="btn ml-auto btn-ghost btn-xs"
						onclick={clearAllFilters}
						title="Clear all filters and search"
					>
						Clear all
					</button>
				</div>
			</div>
		{/if}
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
									· {form.coversRefreshed} cover{form.coversRefreshed === 1 ? '' : 's'} refreshed{/if}{#if form.artistsRefreshed}
									· {form.artistsRefreshed} artist{form.artistsRefreshed === 1 ? '' : 's'} refreshed{/if}
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
			class="scrollbar-soft card w-full shrink-0 flex-col overflow-hidden border border-base-300/70 bg-base-200/60 shadow-sm lg:sticky lg:top-21 lg:flex lg:max-h-[calc(100vh-6.5rem)] lg:w-72 {isDetailPage
				? 'hidden'
				: 'flex'}"
		>
			<!-- Genres section -->
			<div class="flex min-h-0 flex-col">
				<!-- Section header — clickable on mobile to toggle, inert on lg+
				     (the body below is forced open by Tailwind anyway). -->
				<button
					type="button"
					onclick={() => (genresOpenMobile = !genresOpenMobile)}
					class="flex w-full items-center justify-between gap-2 border-b border-base-300/70 p-4 text-left transition-colors hover:bg-base-300/30 lg:cursor-default lg:hover:bg-transparent"
					aria-expanded={genresOpenMobile}
					aria-controls="sidebar-genres-body"
				>
					<span class="flex min-w-0 items-center gap-2">
						<span class="text-xs text-base-content/40 lg:hidden" aria-hidden="true"
							>{genresOpenMobile ? '▾' : '▸'}</span
						>
						<h2 class="text-sm font-semibold tracking-wider text-base-content/70 uppercase">
							Genres
						</h2>
						{#if filters.genre && !genresOpenMobile}
							<span class="badge truncate badge-sm badge-primary lg:hidden" title="active genre">
								{filters.genre}
							</span>
						{/if}
					</span>
					<span
						class="shrink-0 text-xs text-base-content/50"
						title={filters.descriptor || filters.query
							? 'genres available within current descriptor + search'
							: 'across all albums'}
					>
						{allGenres.length}
						{filters.descriptor || filters.query ? 'here' : 'total'}
					</span>
				</button>

				<div
					id="sidebar-genres-body"
					class="flex min-h-0 flex-col {genresOpenMobile ? '' : 'hidden'} lg:flex"
				>
					<div class="border-b border-base-300/70 px-4 pt-3 pb-4">
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

					<ul
						class="scrollbar-soft max-h-[35vh] min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-[36vh]"
					>
						{#each visibleGenres as genre (genre.name)}
							<li>
								<button
									type="button"
									onclick={() => selectGenre(genre.name)}
									class="group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150
									hover:bg-base-300/60
									{filters.genre === genre.name
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
				</div>
			</div>

			<!-- Descriptors section -->
			<div class="flex min-h-0 flex-col border-t border-base-300/70">
				<button
					type="button"
					onclick={() => (descriptorsOpenMobile = !descriptorsOpenMobile)}
					class="flex w-full items-center justify-between gap-2 border-b border-base-300/70 p-4 text-left transition-colors hover:bg-base-300/30 lg:cursor-default lg:hover:bg-transparent"
					aria-expanded={descriptorsOpenMobile}
					aria-controls="sidebar-descriptors-body"
				>
					<span class="flex min-w-0 items-center gap-2">
						<span class="text-xs text-base-content/40 lg:hidden" aria-hidden="true"
							>{descriptorsOpenMobile ? '▾' : '▸'}</span
						>
						<h2 class="text-sm font-semibold tracking-wider text-base-content/70 uppercase">
							Descriptors
						</h2>
						{#if filters.descriptor && !descriptorsOpenMobile}
							<span
								class="badge gap-1 truncate badge-sm italic badge-secondary lg:hidden"
								title="active descriptor"
							>
								{filters.descriptor}
							</span>
						{/if}
					</span>
					<span
						class="shrink-0 text-xs text-base-content/50"
						title={filters.genre || filters.query
							? 'descriptors available within current genre + search'
							: 'across all albums'}
					>
						{allDescriptors.length}
						{filters.genre || filters.query ? 'here' : 'total'}
					</span>
				</button>

				<div
					id="sidebar-descriptors-body"
					class="flex min-h-0 flex-col {descriptorsOpenMobile ? '' : 'hidden'} lg:flex"
				>
					<div class="border-b border-base-300/70 px-4 pt-3 pb-4">
						<div class="mb-2 flex items-center gap-1 text-xs">
							<span class="text-base-content/50">sort:</span>
							<button
								type="button"
								class="btn btn-ghost btn-xs {uiState.descriptorSort === 'name' ? 'btn-active' : ''}"
								onclick={() => (uiState.descriptorSort = 'name')}
								title="Alphabetical"
							>
								A–Z
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-xs {uiState.descriptorSort === 'count'
									? 'btn-active'
									: ''}"
								onclick={() => (uiState.descriptorSort = 'count')}
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
								bind:value={uiState.descriptorFilter}
								placeholder="Filter descriptors…"
								class="grow bg-transparent outline-none"
								aria-label="Filter descriptors"
							/>
						</label>
					</div>

					<ul
						class="scrollbar-soft max-h-[35vh] min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-[36vh]"
					>
						{#each visibleDescriptors as descriptor (descriptor.name)}
							<li>
								<button
									type="button"
									onclick={() => selectDescriptor(descriptor.name)}
									class="group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-xs italic transition-colors duration-150
									hover:bg-base-300/60
									{filters.descriptor === descriptor.name
										? 'bg-primary/15 text-primary-content/90 ring-1 ring-primary/30'
										: ''}"
								>
									<span class="truncate">{descriptor.name}</span>
									<span
										class="badge badge-ghost badge-xs not-italic transition group-hover:badge-neutral"
										aria-label="{descriptor.count} albums"
									>
										{descriptor.count}
									</span>
								</button>
							</li>
						{:else}
							<li class="px-3 py-6 text-center text-xs text-base-content/50">
								{allDescriptors.length === 0
									? 'Run the Enrich Album bookmarklet on a release page to start collecting descriptors.'
									: 'No descriptors match.'}
							</li>
						{/each}
					</ul>
				</div>
			</div>

			{#if filters.genre || filters.descriptor || filters.query}
				<div class="border-t border-base-300/70 bg-base-200/40 px-3 py-2">
					<button
						type="button"
						class="btn w-full btn-ghost btn-xs"
						onclick={clearAllFilters}
						title="Clear genre, descriptor, and search filters"
					>
						Clear filters
					</button>
				</div>
			{/if}
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
