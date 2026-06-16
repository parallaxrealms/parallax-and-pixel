<script lang="ts">
	/**
	 * Admin Users tab — list every user and manage role / ban / MFA / deletion.
	 *
	 * All mutations go through the admin-gated /api/admin/users/* endpoints
	 * (service-role on the server). Request bodies mirror the 9realms
	 * AdminSettingsTab exactly:
	 *   role:   POST   { userId, role }
	 *   ban:    POST   { userId, ban: boolean }
	 *   mfa:    DELETE { userId }
	 *   delete: DELETE { userId }
	 * House style: slate palette, accent (#00a5cf), lucide, svelte-sonner.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import {
		Users as UsersIcon,
		Search,
		RefreshCw,
		Ban,
		ShieldCheck,
		Shield,
		Trash2,
		Loader2,
		AlertCircle
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	// Convention: tabs receive {supabase}. This tab uses the admin API proxies
	// (service-role) instead, so the client is currently unused.
	let { supabase: _supabase } = $props<{ supabase: SupabaseClient }>();

	type UserRow = {
		id: string;
		email: string | null;
		username: string | null;
		full_name: string | null;
		role: string;
		created_at: string;
		email_confirmed_at: string | null;
		banned_until: string | null;
	};

	const ROLES = ['user', 'power-user', 'client', 'admin'];

	let users = $state<UserRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return users;
		return users.filter(
			(u) =>
				u.email?.toLowerCase().includes(q) ||
				u.username?.toLowerCase().includes(q) ||
				u.full_name?.toLowerCase().includes(q)
		);
	});

	async function loadUsers() {
		loading = true;
		error = null;
		try {
			const res = await fetch('/api/admin/users');
			const body = await res.json();
			if (!res.ok) {
				error = body.error || 'Failed to load users.';
				return;
			}
			users = (body.users ?? []) as UserRow[];
		} catch {
			error = 'Network error loading users.';
		} finally {
			loading = false;
		}
	}

	async function updateRole(user: UserRow, role: string) {
		try {
			const res = await fetch('/api/admin/users/role', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: user.id, role })
			});
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || 'Could not update role.');
				return;
			}
			users = users.map((u) => (u.id === user.id ? { ...u, role } : u));
			toast.success(`Role set to ${role}.`);
		} catch {
			toast.error('Network error updating role.');
		}
	}

	async function setBan(user: UserRow, ban: boolean) {
		if (ban && !confirm(`Ban ${user.email || user.username || 'this user'}?`)) return;
		try {
			const res = await fetch('/api/admin/users/ban', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: user.id, ban })
			});
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || 'Could not update ban status.');
				return;
			}
			toast.success(ban ? 'User banned.' : 'User unbanned.');
			await loadUsers();
		} catch {
			toast.error('Network error updating ban status.');
		}
	}

	async function resetMfa(user: UserRow) {
		if (!confirm(`Reset all MFA factors for ${user.email || user.username || 'this user'}?`)) return;
		try {
			const res = await fetch('/api/admin/users/mfa', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: user.id })
			});
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || 'Could not reset MFA.');
				return;
			}
			toast.success('MFA factors removed.');
		} catch {
			toast.error('Network error resetting MFA.');
		}
	}

	async function deleteUser(user: UserRow) {
		if (
			!confirm(
				`DELETE ${user.email || user.username || 'this user'}? This cannot be undone.`
			)
		)
			return;
		try {
			const res = await fetch('/api/admin/users/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: user.id })
			});
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || 'Could not delete user.');
				return;
			}
			toast.success('User deleted.');
			await loadUsers();
		} catch {
			toast.error('Network error deleting user.');
		}
	}

	function fmtDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return iso;
		}
	}

	onMount(loadUsers);
</script>

<div class="mx-auto max-w-6xl">
	<header class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<UsersIcon class="h-6 w-6 text-accent-primary" />
			<div>
				<h1 class="text-2xl font-bold text-white">Users</h1>
				<p class="mt-0.5 text-sm text-slate-400">Manage roles, access, and accounts.</p>
			</div>
		</div>
		<button
			onclick={loadUsers}
			class="flex items-center gap-1.5 border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
		>
			<RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" /> Refresh
		</button>
	</header>

	<div class="relative mb-5">
		<Search
			class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
		/>
		<input
			type="text"
			bind:value={search}
			placeholder="Search by email, username, or name…"
			class="w-full border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
		/>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if error}
		<div
			class="flex items-center gap-2 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
		>
			<AlertCircle class="h-4 w-4 shrink-0" />
			{error}
		</div>
	{:else if filtered.length === 0}
		<div
			class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500"
		>
			{search ? 'No users match your search.' : 'No users found.'}
		</div>
	{:else}
		<div class="overflow-x-auto border border-slate-800">
			<table class="w-full text-left text-sm">
				<thead class="bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
					<tr>
						<th class="px-4 py-3 font-medium">Email</th>
						<th class="hidden px-4 py-3 font-medium lg:table-cell">Name</th>
						<th class="px-4 py-3 font-medium">Role</th>
						<th class="hidden px-4 py-3 font-medium sm:table-cell">Status</th>
						<th class="hidden px-4 py-3 font-medium md:table-cell">Created</th>
						<th class="px-4 py-3 text-right font-medium">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each filtered as u (u.id)}
						<tr class="bg-slate-950 hover:bg-slate-900/60">
							<td class="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-slate-300" title={u.email || ''}>{u.email || '—'}</td>
							<td class="hidden px-4 py-3 text-slate-300 lg:table-cell">
								{u.username || u.full_name || '—'}
							</td>
							<td class="px-4 py-3">
								<select
									value={u.role}
									onchange={(e) => updateRole(u, e.currentTarget.value)}
									class="border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:border-accent-primary focus:outline-none"
								>
									{#each ROLES as r (r)}
										<option value={r}>{r}</option>
									{/each}
								</select>
							</td>
							<td class="hidden px-4 py-3 sm:table-cell">
								{#if u.banned_until}
									<span class="inline-block bg-red-500/15 px-2 py-0.5 text-xs text-red-400"
										>Banned</span
									>
								{:else if u.email_confirmed_at}
									<span class="inline-block bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400"
										>Active</span
									>
								{:else}
									<span class="inline-block bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400"
										>Unverified</span
									>
								{/if}
							</td>
							<td class="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-500 md:table-cell"
								>{fmtDate(u.created_at)}</td
							>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1">
									{#if u.banned_until}
										<button
											class="border border-slate-700 p-1.5 text-emerald-400 transition hover:bg-slate-800"
											title="Unban"
											aria-label="Unban user"
											onclick={() => setBan(u, false)}
										>
											<ShieldCheck class="h-4 w-4" />
										</button>
									{:else}
										<button
											class="border border-slate-700 p-1.5 text-amber-400 transition hover:bg-slate-800"
											title="Ban"
											aria-label="Ban user"
											onclick={() => setBan(u, true)}
										>
											<Ban class="h-4 w-4" />
										</button>
									{/if}
									<button
										class="border border-slate-700 p-1.5 text-amber-400 transition hover:bg-slate-800"
										title="Reset MFA"
										aria-label="Reset MFA"
										onclick={() => resetMfa(u)}
									>
										<Shield class="h-4 w-4" />
									</button>
									<button
										class="border border-slate-700 p-1.5 text-red-400 transition hover:bg-slate-800"
										title="Delete user"
										aria-label="Delete user"
										onclick={() => deleteUser(u)}
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
