// POST /api/bank/import — batch insert transactions from parsed CSV.
// Admin-only; writes via the service-role client into the public schema.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin-guard';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';

interface ImportTxn {
	date: string;
	description: string;
	amount: number;
	balance: number | null;
	reference_number: string | null;
	raw_data: Record<string, string>;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const session = await locals.getSession();
	const admin = getSupabaseAdmin();

	try {
		const { account_id, file_name, transactions, column_mapping, period_start, period_end } =
			await request.json();

		if (!account_id || !transactions?.length) {
			return json({ error: 'account_id and transactions are required' }, { status: 400 });
		}

		// Create import record
		const { data: importRecord, error: importError } = await admin
			.from('bank_statement_imports')
			.insert({
				account_id,
				file_name: file_name || 'unknown.csv',
				row_count: transactions.length,
				period_start,
				period_end,
				column_mapping,
				imported_by: session?.user?.id ?? null
			})
			.select()
			.single();

		if (importError) throw importError;

		// Batch insert transactions (100 at a time)
		const BATCH_SIZE = 100;
		let insertedCount = 0;

		for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
			const batch = (transactions.slice(i, i + BATCH_SIZE) as ImportTxn[]).map((txn) => ({
				account_id,
				import_id: importRecord.id,
				date: txn.date,
				description: txn.description,
				amount: txn.amount,
				balance: txn.balance,
				reference_number: txn.reference_number,
				raw_data: txn.raw_data,
				status: 'unreviewed',
				type: txn.amount > 0 ? 'income' : txn.amount < 0 ? 'expense' : null,
				created_by: session?.user?.id ?? null
			}));

			const { error: batchError } = await admin.from('bank_transactions').insert(batch);
			if (batchError) throw batchError;
			insertedCount += batch.length;
		}

		// Create history entries for the import
		const { data: insertedTxns } = await admin
			.from('bank_transactions')
			.select('id')
			.eq('import_id', importRecord.id);

		if (insertedTxns?.length) {
			const historyBatch = insertedTxns.map((txn: { id: string }) => ({
				transaction_id: txn.id,
				user_id: session?.user?.id ?? null,
				action: 'created',
				changes: {
					source: { old: null, new: 'csv_import' },
					import_id: { old: null, new: importRecord.id }
				}
			}));

			for (let i = 0; i < historyBatch.length; i += BATCH_SIZE) {
				await admin.from('bank_transaction_history').insert(historyBatch.slice(i, i + BATCH_SIZE));
			}
		}

		return json(
			{ data: { import_id: importRecord.id, inserted_count: insertedCount } },
			{ status: 201 }
		);
	} catch (error) {
		console.error('Bank Import POST error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to import transactions' },
			{ status: 500 }
		);
	}
};
