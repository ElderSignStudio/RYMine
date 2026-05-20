// Module-level UI state shared between the (app) layout's sidebar and its
// child pages (the album list and the detail card). This is a local-only,
// single-user app, so a module singleton is appropriate — no per-request
// isolation concerns. Reactive on the client; on the server each render
// starts from defaults.

class UiState {
	selectedGenre = $state<string | null>(null);
	genreFilter = $state('');
	genreSort = $state<'name' | 'count'>('name');
}

export const uiState = new UiState();
