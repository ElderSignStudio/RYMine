// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AppMode } from '$lib/server/appMode';

declare global {
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
