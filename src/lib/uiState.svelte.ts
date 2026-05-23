// Sidebar-only UI state that doesn't need to survive a page navigation: the
// per-list text filter ("type to filter genres / descriptors") and the per-list
// sort mode. These are ephemeral conveniences, not data filters — typing
// "ambi" in the sidebar filter just hides genre rows from view, it doesn't
// change which albums are visible.
//
// Filter state that DOES need to survive navigation (selected genre, selected
// descriptor, the album-list search query, sort mode/order) lives in the URL
// and is managed via $lib/filters.ts.

class UiState {
	// Sidebar genre-list text filter + sort.
	genreFilter = $state('');
	genreSort = $state<'name' | 'count'>('name');

	// Sidebar descriptor-list text filter + sort. Default sort is by count
	// because descriptors are usually browsed "what's common" rather than
	// alphabetically.
	descriptorFilter = $state('');
	descriptorSort = $state<'name' | 'count'>('count');
}

export const uiState = new UiState();
