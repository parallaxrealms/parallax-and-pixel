// GET    /api/bank/attachments?transaction_id=xxx  — list attachments
// POST   /api/bank/attachments                       — upload (FormData: file + transaction_id)
// DELETE /api/bank/attachments?id=xxx                — delete attachment
//
// Admin-only; all storage + DB writes go through the service-role client into
// the public schema + the private `pxp-finance` storage bucket.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin-guard';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';

const BUCKET = 'pxp-finance';

export const GET: RequestHandler = async ({ url, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const admin = getSupabaseAdmin();
	try {
		const transaction_id = url.searchParams.get('transaction_id');
		if (!transaction_id) {
			return json({ error: 'transaction_id is required' }, { status: 400 });
		}

		const { data, error } = await admin
			.from('bank_transaction_attachments')
			.select('*')
			.eq('transaction_id', transaction_id)
			.order('created_at', { ascending: false });

		if (error) throw error;
		return json({ data: data || [] });
	} catch (error) {
		console.error('Bank Attachments GET error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to fetch attachments' },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const session = await locals.getSession();
	const admin = getSupabaseAdmin();
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const transaction_id = formData.get('transaction_id') as string | null;

		if (!file) return json({ error: 'File is required' }, { status: 400 });
		if (!transaction_id) return json({ error: 'transaction_id is required' }, { status: 400 });

		const filePath = `bank-receipts/${transaction_id}/${Date.now()}_${file.name}`;
		const { error: uploadError } = await admin.storage.from(BUCKET).upload(filePath, file);
		if (uploadError) throw uploadError;

		const { data, error: insertError } = await admin
			.from('bank_transaction_attachments')
			.insert({
				transaction_id,
				user_id: session?.user?.id ?? null,
				file_name: file.name,
				file_size: file.size,
				file_type: file.type,
				storage_path: filePath
			})
			.select()
			.single();

		if (insertError) {
			await admin.storage.from(BUCKET).remove([filePath]);
			throw insertError;
		}

		await admin.from('bank_transaction_history').insert({
			transaction_id,
			user_id: session?.user?.id ?? null,
			action: 'attachment_added',
			changes: { file_name: { old: null, new: file.name } }
		});

		return json({ data }, { status: 201 });
	} catch (error) {
		console.error('Bank Attachments POST error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to upload attachment' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const session = await locals.getSession();
	const admin = getSupabaseAdmin();
	try {
		const id = url.searchParams.get('id');
		if (!id) return json({ error: 'Attachment ID is required' }, { status: 400 });

		const { data: attachment, error: fetchError } = await admin
			.from('bank_transaction_attachments')
			.select('id, storage_path, transaction_id, file_name')
			.eq('id', id)
			.single();

		if (fetchError?.code === 'PGRST116') return json({ error: 'Attachment not found' }, { status: 404 });
		if (fetchError) throw fetchError;

		const { error: storageError } = await admin.storage.from(BUCKET).remove([attachment.storage_path]);
		if (storageError) console.warn('Storage delete error:', storageError);

		const { error: deleteError } = await admin
			.from('bank_transaction_attachments')
			.delete()
			.eq('id', id);
		if (deleteError) throw deleteError;

		await admin.from('bank_transaction_history').insert({
			transaction_id: attachment.transaction_id,
			user_id: session?.user?.id ?? null,
			action: 'attachment_removed',
			changes: { file_name: { old: attachment.file_name, new: null } }
		});

		return json({ success: true });
	} catch (error) {
		console.error('Bank Attachments DELETE error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to delete attachment' },
			{ status: 500 }
		);
	}
};
