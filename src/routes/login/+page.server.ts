import { fail, redirect } from '@sveltejs/kit';
import { IS_PUBLIC_VIEWER, IS_READONLY, verifyPassword } from '$lib/server/appMode';
import { setSession } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

// The login page only makes sense on a password-gated readonly instance. In
// local mode and in public viewer mode there's no gate, so bounce visitors
// straight back to the app. (In public mode `locals.isAuthenticated` is
// already true, so this is belt and braces.)
export const load: PageServerLoad = async ({ locals }) => {
	if (!IS_READONLY || IS_PUBLIC_VIEWER || locals.isAuthenticated) {
		throw redirect(303, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (!IS_READONLY || IS_PUBLIC_VIEWER) throw redirect(303, '/');

		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const from = String(form.get('from') ?? '/');

		const ok = await verifyPassword(password);
		if (!ok) {
			// Don't echo the password back. Don't reveal whether the password was
			// "almost right" — same response for empty, wrong, malformed.
			return fail(401, { error: 'Wrong password.' });
		}

		// Only emit Secure on https — cookie would silently fail to set on the
		// http://localhost preview otherwise.
		await setSession(cookies, { secure: url.protocol === 'https:' });

		// Refuse open redirects: only relative same-origin paths allowed.
		const safe = from.startsWith('/') && !from.startsWith('//') ? from : '/';
		throw redirect(303, safe);
	}
};
