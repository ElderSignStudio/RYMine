// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AppMode } from '$lib/server/appMode';

declare global {
	// Compile-time constants injected by Vite's `define` (see vite.config.ts).
	const __APP_VERSION__: string;
	const __BUILD_COMMIT__: string;
	const __BUILD_TIME__: string;

	namespace App {
		// interface Error {}
		interface Locals {
			appMode: AppMode;
			isAuthenticated: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
