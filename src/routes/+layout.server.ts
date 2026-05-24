// Expose mode + auth state to every page so the client can render the right
// chrome (read-only badge, logout button, hidden write controls). Values come
// straight from event.locals — populated by the server hook on every request.

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	appMode: locals.appMode,
	isAuthenticated: locals.isAuthenticated
});
