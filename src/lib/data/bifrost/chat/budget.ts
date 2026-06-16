// Bifrost Budget — checking and enforcement.
//
// Token budgets live in `public.bifrost_budget_config`; usage rows in
// `public.bifrost_token_usage` (migration 009). All reads/writes target the
// public schema (RLS lets each user see/edit their own row; admins any).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface BudgetConfig {
	id: string;
	user_id: string;
	daily_limit: number;
	monthly_limit: number;
	per_conversation_limit: number;
	warning_threshold: number;
	updated_at: string;
}

export interface BudgetCategory {
	used: number;
	limit: number;
	percentage: number;
}

export type BudgetStatus = 'ok' | 'warning' | 'exceeded';

export interface BudgetCheck {
	daily: BudgetCategory;
	monthly: BudgetCategory;
	conversation: BudgetCategory;
	status: BudgetStatus;
}

export const DEFAULT_CONFIG = {
	daily_limit: 100000,
	monthly_limit: 2000000,
	per_conversation_limit: 50000,
	warning_threshold: 0.8
};

/** Load or create the default budget config for the current user. */
export async function loadBudgetConfig(supabase: SupabaseClient): Promise<BudgetConfig> {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	// Try to load existing config
	const { data, error } = await supabase
		.from('bifrost_budget_config')
		.select('*')
		.eq('user_id', user.id)
		.single();

	if (data) return data;

	// Create default config if not found
	if (error?.code === 'PGRST116') {
		const { data: newConfig, error: insertError } = await supabase
			.from('bifrost_budget_config')
			.insert({ user_id: user.id, ...DEFAULT_CONFIG })
			.select()
			.single();

		if (insertError) throw insertError;
		return newConfig;
	}

	throw error;
}

/** Save the current user's budget config. */
export async function saveBudgetConfig(
	supabase: SupabaseClient,
	config: {
		daily_limit: number;
		monthly_limit: number;
		per_conversation_limit: number;
		warning_threshold: number;
	}
): Promise<void> {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { error } = await supabase
		.from('bifrost_budget_config')
		.update({ ...config, updated_at: new Date().toISOString() })
		.eq('user_id', user.id);

	if (error) throw error;
}

/** Check budget status across all categories. */
export async function checkBudget(
	supabase: SupabaseClient,
	conversationId?: string
): Promise<BudgetCheck> {
	const config = await loadBudgetConfig(supabase);

	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	// Today's start (UTC)
	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);
	const todayStr = today.toISOString();

	// Month start (UTC)
	const monthStart = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
	const monthStr = monthStart.toISOString();

	// Daily usage. Only billable (paid) exchanges count toward budget — $0
	// OpenRouter :free usage is recorded but flagged billable=false, so it never
	// inflates the limit. The .eq('billable', true) filter is the paid-only gate.
	const { data: dailyData } = await supabase
		.from('bifrost_token_usage')
		.select('input_tokens, output_tokens')
		.eq('user_id', user.id)
		.eq('billable', true)
		.gte('created_at', todayStr);

	const dailyUsed = (dailyData ?? []).reduce(
		(sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0),
		0
	);

	// Monthly usage (billable only — same paid-only gate as daily).
	const { data: monthlyData } = await supabase
		.from('bifrost_token_usage')
		.select('input_tokens, output_tokens')
		.eq('user_id', user.id)
		.eq('billable', true)
		.gte('created_at', monthStr);

	const monthlyUsed = (monthlyData ?? []).reduce(
		(sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0),
		0
	);

	// Per-conversation usage
	let convUsed = 0;
	if (conversationId) {
		const { data: convData } = await supabase
			.from('bifrost_token_usage')
			.select('input_tokens, output_tokens')
			.eq('conversation_id', conversationId)
			.eq('billable', true);

		convUsed = (convData ?? []).reduce(
			(sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0),
			0
		);
	}

	const daily: BudgetCategory = {
		used: dailyUsed,
		limit: config.daily_limit,
		percentage: config.daily_limit > 0 ? Math.round((dailyUsed / config.daily_limit) * 100) : 0
	};

	const monthly: BudgetCategory = {
		used: monthlyUsed,
		limit: config.monthly_limit,
		percentage:
			config.monthly_limit > 0 ? Math.round((monthlyUsed / config.monthly_limit) * 100) : 0
	};

	const conversation: BudgetCategory = {
		used: convUsed,
		limit: config.per_conversation_limit,
		percentage:
			config.per_conversation_limit > 0
				? Math.round((convUsed / config.per_conversation_limit) * 100)
				: 0
	};

	// Overall status
	const thresholdPct = config.warning_threshold * 100;
	let status: BudgetStatus = 'ok';

	if (daily.percentage >= 100 || monthly.percentage >= 100 || conversation.percentage >= 100) {
		status = 'exceeded';
	} else if (
		daily.percentage >= thresholdPct ||
		monthly.percentage >= thresholdPct ||
		conversation.percentage >= thresholdPct
	) {
		status = 'warning';
	}

	return { daily, monthly, conversation, status };
}
