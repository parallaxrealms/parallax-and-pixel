import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SITE_ID } from '$env/static/public';
import { PRIVATE_SUPABASE_SATORI_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { encryptCredentials } from '$lib/server/crypto';
import type { SocialIntegration, SocialIntegrationClient } from '$lib/types/social';

const siteId = PUBLIC_SITE_ID || 'unknown';

function getServiceClient() {
	return createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SATORI_KEY, {
		auth: { persistSession: false }
	});
}

async function requireAdmin(locals: App.Locals) {
	const session = await locals.getSession();
	if (!session?.user) throw error(401, 'Unauthorized');

	const supabase = getServiceClient();
	const { data: role } = await supabase
		.schema('pxp')
		.from('user_roles')
		.select('role')
		.eq('user_id', session.user.id)
		.single();

	if (!role || (role.role !== 'admin' && role.role !== 'power-user')) {
		throw error(403, 'Admin access required');
	}

	return { session, supabase };
}

/** GET - List all integrations (client-safe, no credentials) */
export const GET: RequestHandler = async ({ locals }) => {
	const { supabase } = await requireAdmin(locals);

	const { data, error: dbError } = await supabase
		.schema('pxp')
		.from('social_integrations')
		.select('*')
		.eq('site_id', siteId)
		.order('platform', { ascending: true });

	if (dbError) throw error(500, dbError.message);

	const clientSafe: SocialIntegrationClient[] = (data as SocialIntegration[]).map((row) => ({
		id: row.id,
		site_id: row.site_id,
		platform: row.platform,
		display_name: row.display_name,
		is_enabled: row.is_enabled,
		has_credentials: !!row.encrypted_credentials,
		oauth_expires_at: row.oauth_expires_at,
		oauth_scope: row.oauth_scope,
		created_at: row.created_at,
		updated_at: row.updated_at
	}));

	return json({ integrations: clientSafe });
};

/** POST - Create or update an integration */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, supabase } = await requireAdmin(locals);
	const body = await request.json();

	const { platform, display_name, credentials, is_enabled } = body;

	if (!platform || !display_name) {
		throw error(400, 'Platform and display_name are required');
	}

	const encrypted = credentials ? encryptCredentials(credentials) : undefined;

	const upsertData: Record<string, unknown> = {
		site_id: siteId,
		platform,
		display_name,
		is_enabled: is_enabled ?? true,
		created_by: session.user.id,
		updated_at: new Date().toISOString()
	};

	if (encrypted) {
		upsertData.encrypted_credentials = encrypted;
	}

	const { data, error: dbError } = await supabase
		.schema('pxp')
		.from('social_integrations')
		.upsert(upsertData, {
			onConflict: 'site_id,platform,display_name'
		})
		.select()
		.single();

	if (dbError) throw error(500, dbError.message);

	const row = data as SocialIntegration;
	const clientSafe: SocialIntegrationClient = {
		id: row.id,
		site_id: row.site_id,
		platform: row.platform,
		display_name: row.display_name,
		is_enabled: row.is_enabled,
		has_credentials: !!row.encrypted_credentials,
		oauth_expires_at: row.oauth_expires_at,
		oauth_scope: row.oauth_scope,
		created_at: row.created_at,
		updated_at: row.updated_at
	};

	return json({ integration: clientSafe });
};

/** DELETE - Remove an integration by ID */
export const DELETE: RequestHandler = async ({ url, locals }) => {
	const { supabase } = await requireAdmin(locals);
	const id = url.searchParams.get('id');

	if (!id) throw error(400, 'Integration ID is required');

	const { error: dbError } = await supabase
		.schema('pxp')
		.from('social_integrations')
		.delete()
		.eq('id', id)
		.eq('site_id', siteId);

	if (dbError) throw error(500, dbError.message);

	return json({ success: true });
};
