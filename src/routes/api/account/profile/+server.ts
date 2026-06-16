// POST /api/account/profile — update the calling user's own profile row.
//
// Writes go through the service-role client (getSupabaseAdmin) targeting the
// session user's OWN row — we do NOT rely on user_profiles RLS for client-side
// writes. Auth is the session user; we only ever write where user_id = session.user.id.
//
// Accepts { full_name?, username?, user_settings? }. user_settings is merged
// shallowly into the existing JSONB so partial preference updates (e.g. just
// default_tab) don't clobber other keys like custom_links / theme.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';

interface ProfilePatch {
	full_name?: string;
	username?: string;
	user_settings?: Record<string, unknown>;
}

// Basic username charset: letters, numbers, dot, underscore, hyphen; 2-32 chars.
const USERNAME_RE = /^[a-zA-Z0-9._-]{2,32}$/;

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.getSession();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = session.user.id;
	const admin = getSupabaseAdmin();

	let body: ProfilePatch;
	try {
		body = (await request.json()) as ProfilePatch;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const update: Record<string, unknown> = {};

	if (body.full_name !== undefined) {
		update.full_name = String(body.full_name).trim();
	}

	if (body.username !== undefined) {
		const username = String(body.username).trim();
		if (username.length > 0 && !USERNAME_RE.test(username)) {
			return json(
				{
					error:
						'Username must be 2-32 characters: letters, numbers, dot, underscore or hyphen.'
				},
				{ status: 400 }
			);
		}
		update.username = username.length > 0 ? username : null;
	}

	// Shallow-merge user_settings into the existing JSONB so we never clobber
	// keys the caller didn't send.
	if (body.user_settings !== undefined && body.user_settings !== null) {
		const { data: current } = await admin
			.from('user_profiles')
			.select('user_settings')
			.eq('user_id', userId)
			.single();

		const existing = (current?.user_settings ?? {}) as Record<string, unknown>;
		update.user_settings = { ...existing, ...body.user_settings };
	}

	if (Object.keys(update).length === 0) {
		return json({ error: 'No updatable fields provided' }, { status: 400 });
	}

	const { data, error } = await admin
		.from('user_profiles')
		.update(update)
		.eq('user_id', userId)
		.select('user_id, email, full_name, username, avatar_url, user_settings, account_status')
		.single();

	if (error) {
		// 23505 = unique_violation (username already taken)
		if (error.code === '23505') {
			return json({ error: 'That username is already taken.' }, { status: 409 });
		}
		return json({ error: error.message }, { status: 500 });
	}

	return json({ profile: data });
};

// GET /api/account/profile — return the caller's own profile row via service role.
// Used by the Settings tab when an RLS-restricted client read returns nothing.
export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.getSession();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const admin = getSupabaseAdmin();
	const { data, error } = await admin
		.from('user_profiles')
		.select('user_id, email, full_name, username, avatar_url, user_settings, account_status')
		.eq('user_id', session.user.id)
		.single();

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ profile: data });
};
