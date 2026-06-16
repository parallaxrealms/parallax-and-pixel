// /api/account/avatar — upload / remove the calling user's avatar.
//
// Writes go through the service-role client (getSupabaseAdmin); we only ever
// touch the session user's OWN row + their OWN storage prefix (`${userId}/...`).
// RLS is not relied upon for these writes.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';

const AVATAR_BUCKET = 'avatars';
const MAX_BYTES = 3 * 1024 * 1024; // ~3MB

function extFromType(type: string): string {
	const map: Record<string, string> = {
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'image/avif': 'avif'
	};
	return map[type] || 'png';
}

// Given a public URL, recover the object path inside the bucket (`${userId}/file.ext`).
function pathFromPublicUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	const marker = `/object/public/${AVATAR_BUCKET}/`;
	const idx = url.indexOf(marker);
	if (idx === -1) return null;
	return url.slice(idx + marker.length).split('?')[0] || null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.getSession();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = session.user.id;
	const admin = getSupabaseAdmin();

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'Expected multipart form data' }, { status: 400 });
	}

	const file = form.get('file');
	if (!(file instanceof File)) {
		return json({ error: 'Missing "file" field' }, { status: 400 });
	}
	if (!file.type.startsWith('image/')) {
		return json({ error: 'File must be an image' }, { status: 400 });
	}
	if (file.size > MAX_BYTES) {
		return json({ error: 'Image must be smaller than 3MB' }, { status: 400 });
	}

	// Read the existing avatar so we can clean it up after a successful upload.
	const { data: existing } = await admin
		.from('user_profiles')
		.select('avatar_url')
		.eq('user_id', userId)
		.single();
	const previousPath = pathFromPublicUrl(existing?.avatar_url);

	const objectPath = `${userId}/${Date.now()}.${extFromType(file.type)}`;
	const bytes = new Uint8Array(await file.arrayBuffer());

	const { error: uploadError } = await admin.storage
		.from(AVATAR_BUCKET)
		.upload(objectPath, bytes, { upsert: true, contentType: file.type });

	if (uploadError) {
		return json({ error: uploadError.message }, { status: 500 });
	}

	const {
		data: { publicUrl }
	} = admin.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);

	const { error: updateError } = await admin
		.from('user_profiles')
		.update({ avatar_url: publicUrl })
		.eq('user_id', userId);

	if (updateError) {
		return json({ error: updateError.message }, { status: 500 });
	}

	// Best-effort cleanup of the previous object (ignore failure).
	if (previousPath && previousPath !== objectPath) {
		await admin.storage.from(AVATAR_BUCKET).remove([previousPath]);
	}

	return json({ avatar_url: publicUrl });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	const session = await locals.getSession();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = session.user.id;
	const admin = getSupabaseAdmin();

	const { data: existing } = await admin
		.from('user_profiles')
		.select('avatar_url')
		.eq('user_id', userId)
		.single();
	const previousPath = pathFromPublicUrl(existing?.avatar_url);

	const { error: updateError } = await admin
		.from('user_profiles')
		.update({ avatar_url: null })
		.eq('user_id', userId);

	if (updateError) {
		return json({ error: updateError.message }, { status: 500 });
	}

	if (previousPath) {
		await admin.storage.from(AVATAR_BUCKET).remove([previousPath]);
	}

	return json({ avatar_url: null });
};
