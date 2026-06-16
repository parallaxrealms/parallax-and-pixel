// Bank-statement reconciliation types — ported from 9realms.
// Local to the Parallax & Pixel Finances tab; all tables live in `public`.

export const FINANCE_CATEGORIES_FALLBACK = [
	'Software & Subscriptions',
	'Equipment & Supplies',
	'Marketing & Advertising',
	'Utilities',
	'Rent & Facilities',
	'Payroll',
	'Taxes',
	'Product Sales',
	'Service Revenue',
	'Client Payments',
	'Refunds',
	"Owner's Contribution",
	'Other'
] as const;

export interface FinanceCategoryRow {
	id: string;
	name: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export type BankAccountType = 'personal' | 'business';
export type BankTransactionStatus = 'unreviewed' | 'reviewed' | 'matched' | 'excluded';
export type BankTransactionType = 'income' | 'expense' | 'transfer';

export interface BankAccount {
	id: string;
	name: string;
	account_type: BankAccountType;
	owner_id: string | null;
	shared: boolean;
	institution_name: string | null;
	account_number_last4: string | null;
	currency: string;
	notes: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface BankStatementImport {
	id: string;
	account_id: string;
	file_name: string;
	row_count: number;
	period_start: string | null;
	period_end: string | null;
	column_mapping: CsvColumnMapping | null;
	imported_by: string | null;
	created_at: string;
}

export interface BankTransaction {
	id: string;
	account_id: string;
	import_id: string | null;
	date: string;
	description: string;
	amount: number;
	balance: number | null;
	reference_number: string | null;
	raw_data: Record<string, unknown> | null;
	status: BankTransactionStatus;
	type: BankTransactionType | null;
	category: string | null;
	notes: string | null;
	finance_id: string | null;
	reviewed_by: string | null;
	reviewed_at: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
	updated_by: string | null;
}

export interface BankTransactionAttachment {
	id: string;
	transaction_id: string;
	user_id: string | null;
	file_name: string;
	file_size: number | null;
	file_type: string | null;
	storage_path: string;
	created_at: string;
}

export interface BankTransactionHistoryEntry {
	id: string;
	transaction_id: string;
	user_id: string | null;
	action:
		| 'created'
		| 'updated'
		| 'reviewed'
		| 'unreviewed'
		| 'matched'
		| 'excluded'
		| 'attachment_added'
		| 'attachment_removed';
	changes: Record<string, { old: unknown; new: unknown }> | null;
	created_at: string;
}

export interface CsvColumnMapping {
	date: string;
	description: string;
	amount?: string;
	debit?: string;
	credit?: string;
	balance?: string;
	reference?: string;
	dateFormat: string;
	singleAmount: boolean;
}
