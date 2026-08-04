// Expose mode + auth state to every page so the client can render the right
// chrome (read-only badge, logout button, hidden write controls). Values come
// straight from event.locals — populated by the server hook on every request.
//
// `build` rides along here too. Rendering it server-side on every request is
// what makes the version label trustworthy: it always reflects the process
// actually serving the page, so a cached client bundle can't show a stale
// version number.

import { BUILD_INFO } from '$lib/server/buildInfo';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	appMode: locals.appMode,
	isAuthenticated: locals.isAuthenticated,
	build: BUILD_INFO
});
