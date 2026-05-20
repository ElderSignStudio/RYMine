// Module-level UI state shared between the (app) layout's sidebar and its
// child pages (the album list and the detail card). This is a local-only,
// single-user app, so a module singleton is appropriate — no per-request
// isolation concerns. Reactive on the client; on the server each render
// starts from defaults.

class UiState {
	// Genre filter (sidebar + album-list filter)
	selectedGenre = $state<string | null>(null);
	genreFilter = $state('');
	genreSort = $state<'name' | 'count'>('name');

	// Descriptor filter — same shape, lives in its own sidebar section.
	// Default sort is by count because descriptors are usually browsed
	// "what's common" rather than alphabetically.
	selectedDescriptor = $state<string | null>(null);
	descriptorFilter = $state('');
	descriptorSort = $state<'name' | 'count'>('count');
}

export const uiState = new UiState();
