// POST /logout — clear the session cookie and bounce to /login.
// GET is allowed too for convenience (e.g. visiting the URL directly), since
// "log me out" is intent-only and has no side effect beyond cookie removal.

import { redirect } from '@sveltejs/kit';
import { clearSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ cookies }) => {
	clearSession(cookies);
	throw redirect(303, '/login');
};

export const GET = handler;
export const POST = handler;
