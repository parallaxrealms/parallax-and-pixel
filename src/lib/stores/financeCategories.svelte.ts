import type { SupabaseClient } from '@supabase/supabase-js';
import { FINANCE_CATEGORIES_FALLBACK, type FinanceCategoryRow } from '$lib/types/finances';

// Shared reactive state for finance categories.
let categories = $state<FinanceCategoryRow[]>([]);
let loaded = $state(false);
let loading = $state(false);

export function getFinanceCategories(): FinanceCategoryRow[] {
	return categories;
}

export function getFinanceCategoryNames(): string[] {
	if (categories.length > 0) {
		return categories.map((c) => c.name);
	}
	return [...FINANCE_CATEGORIES_FALLBACK];
}

export function isFinanceCategoriesLoaded(): boolean {
	return loaded;
}

export async function loadFinanceCategories(supabase: SupabaseClient): Promise<string[]> {
	if (loaded || loading) return getFinanceCategoryNames();
	loading = true;

	try {
		const { data, error } = await supabase
			.from('finance_categories')
			.select('*')
			.order('sort_order');

		if (error) throw error;

		categories = data || [];
		loaded = true;
		return getFinanceCategoryNames();
	} catch (err) {
		console.error('Failed to load finance categories, using fallback:', err);
		loaded = true;
		return [...FINANCE_CATEGORIES_FALLBACK];
	} finally {
		loading = false;
	}
}

export function refreshFinanceCategories(supabase: SupabaseClient): Promise<string[]> {
	loaded = false;
	loading = false;
	return loadFinanceCategories(supabase);
}
