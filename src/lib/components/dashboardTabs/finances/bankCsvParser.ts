// CSV parsing utility for bank statement imports

import type { CsvColumnMapping } from '$lib/types/finances';

export interface ParsedRow {
	[key: string]: string;
}

export interface ParsedCsv {
	headers: string[];
	rows: ParsedRow[];
}

export interface ParsedTransaction {
	date: string;
	description: string;
	amount: number;
	balance: number | null;
	reference_number: string | null;
	raw_data: Record<string, string>;
}

/**
 * Parse CSV text into headers + rows, handling quoted fields and various line endings
 */
export function parseCSV(text: string): ParsedCsv {
	const lines: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '"') {
			if (inQuotes && text[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if ((ch === '\n' || ch === '\r') && !inQuotes) {
			if (ch === '\r' && text[i + 1] === '\n') i++;
			if (current.trim()) lines.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	if (current.trim()) lines.push(current);

	if (lines.length === 0) return { headers: [], rows: [] };

	const parseLine = (line: string): string[] => {
		const fields: string[] = [];
		let field = '';
		let quoted = false;

		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				if (quoted && line[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					quoted = !quoted;
				}
			} else if (ch === ',' && !quoted) {
				fields.push(field.trim());
				field = '';
			} else {
				field += ch;
			}
		}
		fields.push(field.trim());
		return fields;
	};

	const headers = parseLine(lines[0]);
	const rows: ParsedRow[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = parseLine(lines[i]);
		const row: ParsedRow = {};
		headers.forEach((h, idx) => {
			row[h] = values[idx] || '';
		});
		rows.push(row);
	}

	return { headers, rows };
}

// Common header name patterns for auto-detection
const COLUMN_PATTERNS: Record<string, RegExp[]> = {
	date: [/^date$/i, /^trans(action)?[\s_-]?date$/i, /^posted?[\s_-]?date$/i, /^value[\s_-]?date$/i, /^booking[\s_-]?date$/i],
	description: [/^desc(ription)?$/i, /^memo$/i, /^narrative$/i, /^details?$/i, /^particulars$/i, /^trans(action)?[\s_-]?desc/i, /^payee$/i],
	amount: [/^amount$/i, /^trans(action)?[\s_-]?amount$/i, /^value$/i, /^sum$/i],
	debit: [/^debit$/i, /^withdrawal$/i, /^money[\s_-]?out$/i, /^dr$/i, /^paid[\s_-]?out$/i],
	credit: [/^credit$/i, /^deposit$/i, /^money[\s_-]?in$/i, /^cr$/i, /^paid[\s_-]?in$/i],
	balance: [/^balance$/i, /^running[\s_-]?balance$/i, /^closing[\s_-]?balance$/i],
	reference: [/^ref(erence)?$/i, /^check[\s_-]?no$/i, /^cheque[\s_-]?no$/i, /^trans(action)?[\s_-]?(id|no|number)$/i]
};

/**
 * Auto-detect column mappings from headers using fuzzy matching
 */
export function detectColumns(headers: string[]): Partial<CsvColumnMapping> {
	const mapping: Partial<CsvColumnMapping> = {};

	for (const header of headers) {
		for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
			if (patterns.some((p) => p.test(header))) {
				(mapping as Record<string, unknown>)[field] = header;
				break;
			}
		}
	}

	// Determine if single amount or separate debit/credit
	mapping.singleAmount = !!mapping.amount && !mapping.debit && !mapping.credit;
	if (!mapping.amount && mapping.debit && mapping.credit) {
		mapping.singleAmount = false;
	}

	return mapping;
}

/**
 * Detect date format from sample values
 */
export function detectDateFormat(samples: string[]): string {
	const validSamples = samples.filter((s) => s && s.trim());
	if (validSamples.length === 0) return 'YYYY-MM-DD';

	// Check for ISO format first
	if (validSamples.every((s) => /^\d{4}-\d{2}-\d{2}/.test(s))) {
		return 'YYYY-MM-DD';
	}

	// Try to detect DD vs MM by checking if any value > 12 in first position
	const slashSamples = validSamples.filter((s) => s.includes('/'));
	if (slashSamples.length > 0) {
		const firstParts = slashSamples.map((s) => parseInt(s.split('/')[0]));
		const secondParts = slashSamples.map((s) => parseInt(s.split('/')[1]));

		// If first part > 12, it must be day (DD/MM format)
		if (firstParts.some((p) => p > 12)) return 'DD/MM/YYYY';
		// If second part > 12, it must be day (MM/DD format)
		if (secondParts.some((p) => p > 12)) return 'MM/DD/YYYY';
		// Default to MM/DD/YYYY for US-centric
		return 'MM/DD/YYYY';
	}

	const dashSamples = validSamples.filter((s) => s.includes('-'));
	if (dashSamples.length > 0) {
		if (dashSamples[0].match(/^\d{4}/)) return 'YYYY-MM-DD';
		return 'MM-DD-YYYY';
	}

	return 'YYYY-MM-DD';
}

/**
 * Parse a date string with the given format into YYYY-MM-DD
 */
function parseDateWithFormat(value: string, format: string): string {
	const cleaned = value.trim();

	if (format === 'YYYY-MM-DD' || format === 'YYYY/MM/DD') {
		const parts = cleaned.split(/[-/]/);
		return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
	}

	if (format === 'MM/DD/YYYY' || format === 'MM-DD-YYYY' || format === 'M/D/YYYY') {
		const parts = cleaned.split(/[-/]/);
		let year = parts[2];
		if (year.length === 2) year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
		return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
	}

	if (format === 'DD/MM/YYYY' || format === 'DD-MM-YYYY') {
		const parts = cleaned.split(/[-/]/);
		let year = parts[2];
		if (year.length === 2) year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
		return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
	}

	// Fallback: try native Date parsing
	const d = new Date(cleaned);
	if (!isNaN(d.getTime())) {
		return d.toISOString().split('T')[0];
	}

	return cleaned;
}

/**
 * Parse an amount string, stripping currency symbols, commas, and handling parentheses for negatives
 */
export function parseAmount(value: string): number {
	if (!value || !value.trim()) return 0;

	let cleaned = value.trim();

	// Handle parentheses as negative: (123.45) → -123.45
	const isParenNeg = /^\(.*\)$/.test(cleaned);
	if (isParenNeg) {
		cleaned = cleaned.replace(/[()]/g, '');
	}

	// Remove currency symbols and commas
	cleaned = cleaned.replace(/[$€£¥,\s]/g, '');

	const num = parseFloat(cleaned);
	if (isNaN(num)) return 0;

	return isParenNeg ? -Math.abs(num) : num;
}

/**
 * Build structured transactions from parsed CSV rows using the column mapping
 */
export function buildTransactions(rows: ParsedRow[], mapping: CsvColumnMapping): ParsedTransaction[] {
	const transactions: ParsedTransaction[] = [];

	for (const row of rows) {
		const dateRaw = row[mapping.date];
		if (!dateRaw || !dateRaw.trim()) continue;

		const date = parseDateWithFormat(dateRaw, mapping.dateFormat);
		const description = row[mapping.description] || '';

		let amount: number;
		if (mapping.singleAmount && mapping.amount) {
			amount = parseAmount(row[mapping.amount]);
		} else {
			const debit = mapping.debit ? parseAmount(row[mapping.debit]) : 0;
			const credit = mapping.credit ? parseAmount(row[mapping.credit]) : 0;
			// Credits are positive, debits are negative
			amount = credit > 0 ? credit : debit > 0 ? -debit : credit - debit;
		}

		const balance = mapping.balance ? parseAmount(row[mapping.balance]) || null : null;
		const reference_number = mapping.reference ? row[mapping.reference] || null : null;

		transactions.push({
			date,
			description,
			amount,
			balance,
			reference_number,
			raw_data: { ...row }
		});
	}

	return transactions;
}

/**
 * Check for duplicate transactions (same date + amount + description)
 */
export function findDuplicates(
	newTxns: ParsedTransaction[],
	existingTxns: { date: string; amount: number; description: string }[]
): Set<number> {
	const duplicateIndices = new Set<number>();
	const existingSet = new Set(
		existingTxns.map((t) => `${t.date}|${t.amount}|${t.description.toLowerCase().trim()}`)
	);

	newTxns.forEach((txn, idx) => {
		const key = `${txn.date}|${txn.amount}|${txn.description.toLowerCase().trim()}`;
		if (existingSet.has(key)) {
			duplicateIndices.add(idx);
		}
	});

	return duplicateIndices;
}
