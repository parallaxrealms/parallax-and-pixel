import type { SupabaseClient } from '@supabase/supabase-js';

// Normalize a raw bank-transaction description into a stable merchant key.
// Strips dates, transaction IDs, store numbers, and payment-rail noise so
// "AUTHORIZED ON 04/14 ADOBE INC 800-833-6687" and
// "AUTHORIZED ON 05/14 ADOBE INC 800-833-6687" collapse to the same key.
export function normalizeMerchant(desc: string): string {
	if (!desc) return '';
	return desc
		.toLowerCase()
		.replace(/\d{2}[/-]\d{2}([/-]\d{2,4})?/g, ' ')
		.replace(/#\s*\d+/g, ' ')
		.replace(/\b\d{4,}\b/g, ' ')
		.replace(/\b(pos|purchase|payment|debit|ach|eft|visa|mc|mastercard|recurring|authorized|on)\b/g, ' ')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ')
		.slice(0, 4)
		.join(' ');
}

// Fallback display name when no custom alias has been set: title-case the
// normalized key so we show "Adobe Inc" rather than the raw bank string.
export function prettyMerchant(desc: string): string {
	const norm = normalizeMerchant(desc);
	if (!norm) return desc;
	return norm
		.split(' ')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

export interface BillAlias {
	id: string;
	merchant_key: string;
	custom_title: string;
}

export type AliasMap = Map<string, string>;

export async function loadBillAliases(supabase: SupabaseClient): Promise<AliasMap> {
	const map: AliasMap = new Map();
	const { data, error } = await supabase
		.from('bill_aliases')
		.select('merchant_key, custom_title');
	if (error) {
		console.warn('[billMerchant] failed to load aliases', error);
		return map;
	}
	for (const row of (data || []) as { merchant_key: string; custom_title: string }[]) {
		map.set(row.merchant_key, row.custom_title);
	}
	return map;
}

// Resolve a description to its custom alias if one is registered, else null.
export function aliasFor(desc: string, aliases: AliasMap): string | null {
	const key = normalizeMerchant(desc);
	if (!key) return null;
	return aliases.get(key) ?? null;
}

export async function upsertBillAlias(
	supabase: SupabaseClient,
	merchantKey: string,
	customTitle: string
): Promise<void> {
	const { error } = await supabase
		.from('bill_aliases')
		.upsert({ merchant_key: merchantKey, custom_title: customTitle }, { onConflict: 'merchant_key' });
	if (error) throw error;
}

export async function deleteBillAlias(supabase: SupabaseClient, merchantKey: string): Promise<void> {
	const { error } = await supabase.from('bill_aliases').delete().eq('merchant_key', merchantKey);
	if (error) throw error;
}
