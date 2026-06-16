// Mimir Token Utilities — estimation, formatting, and percentage helpers

/** Estimate token count from text using chars/4 heuristic */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/** Format token count for display: 1234 → "1.2k", 1234567 → "1.2M" */
export function formatTokenCount(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 1_000_000) {
		const k = count / 1000;
		return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
	}
	const m = count / 1_000_000;
	return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
}

/** Get percentage of budget used (0-100+) */
export function getTokenPercentage(used: number, limit: number): number {
	if (limit <= 0) return 0;
	return Math.round((used / limit) * 100);
}
