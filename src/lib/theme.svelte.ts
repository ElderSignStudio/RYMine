// Curated DaisyUI theme set. Keep this list in sync with:
//  - src/app.css            (the `@plugin daisyui { themes: ... }` block)
//  - src/app.html           (the inline FOUC script's allow-list)
//
// To add a theme: append its name in all three places, rebuild.
// To remove: delete from all three. The store will fall back to DEFAULT_THEME
// if a previously-saved value is no longer recognised.

export const THEMES = ['coffee', 'dim', 'night', 'luxury', 'forest'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'coffee';

// Human-friendly one-liners shown in the picker.
export const THEME_BLURBS: Record<Theme, string> = {
	coffee: 'Warm browns — the cozy default',
	dim: 'Soft slate dark',
	night: 'Deep blue midnight',
	luxury: 'Black & gold collector',
	forest: 'Mossy green retreat'
};

const STORAGE_KEY = 'rymine.theme';

function isTheme(value: unknown): value is Theme {
	return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

class ThemeStore {
	current = $state<Theme>(DEFAULT_THEME);

	constructor() {
		if (typeof localStorage === 'undefined') return;
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (isTheme(stored)) this.current = stored;
		} catch {
			/* localStorage blocked */
		}
	}

	set(next: Theme) {
		this.current = next;
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', next);
		}
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			/* localStorage blocked */
		}
	}

	reset() {
		this.set(DEFAULT_THEME);
	}
}

export const themeStore = new ThemeStore();
