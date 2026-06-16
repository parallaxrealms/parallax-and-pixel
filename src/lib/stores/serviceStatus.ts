// Service Status Store
// Shared between StatusBar and ServiceStatusTab

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { ServiceStatus } from '$lib/types/service-status';

export const serviceStatuses = writable<ServiceStatus[]>([]);
export const statusLastChecked = writable<string>('');
export const statusLoading = writable<boolean>(false);

let pollInterval: ReturnType<typeof setInterval> | null = null;

export async function fetchServiceStatuses(): Promise<void> {
	if (!browser) return;

	statusLoading.set(true);
	try {
		const res = await fetch('/api/status/check');
		if (res.ok) {
			const data = await res.json();
			serviceStatuses.set(data.services);
			statusLastChecked.set(data.checkedAt);
		}
	} catch {
		// Silently fail — statuses stay as-is or unknown
	} finally {
		statusLoading.set(false);
	}
}

export function startStatusPolling(intervalMs = 60000): void {
	if (!browser) return;
	stopStatusPolling();

	// Initial fetch
	fetchServiceStatuses();

	// Poll
	pollInterval = setInterval(fetchServiceStatuses, intervalMs);
}

export function stopStatusPolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}
