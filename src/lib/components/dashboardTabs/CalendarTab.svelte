<script lang="ts">
	/**
	 * Admin Calendar tab — a simple single-tenant agenda/list of events grouped by
	 * date (no month grid). Reads + writes go directly through the passed session
	 * `supabase` client; RLS (public.pxp_is_admin) gates `calendar_events` to admins.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import { CalendarDays, Plus, Trash2, Pencil, Loader2, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	type EventRow = {
		id: string;
		title: string;
		description: string | null;
		start_at: string;
		end_at: string | null;
		all_day: boolean;
		color: string | null;
		created_at: string;
		updated_at: string;
	};

	let events = $state<EventRow[]>([]);
	let loading = $state(true);
	let showPast = $state(false);

	// add form
	let addOpen = $state(false);
	let fTitle = $state('');
	let fStart = $state('');
	let fEnd = $state('');
	let fAllDay = $state(false);
	let fColor = $state('#00a5cf');
	let fDescription = $state('');
	let saving = $state(false);

	// edit
	let editing = $state<EventRow | null>(null);

	const now = $state(new Date());

	const visible = $derived(
		events
			.filter((e) => {
				if (showPast) return true;
				const ref = e.end_at ?? e.start_at;
				return new Date(ref).getTime() >= now.getTime() - 12 * 60 * 60 * 1000;
			})
			.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
	);

	type Group = { key: string; label: string; items: EventRow[] };
	const grouped = $derived.by<Group[]>(() => {
		const map = new Map<string, EventRow[]>();
		for (const e of visible) {
			const d = new Date(e.start_at);
			const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(e);
		}
		return Array.from(map.entries()).map(([key, items]) => ({
			key,
			label: new Date(items[0].start_at).toLocaleDateString(undefined, {
				weekday: 'long',
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			}),
			items
		}));
	});

	function toLocalInput(iso: string): string {
		// produce value for <input type="datetime-local"> in local time
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	async function load() {
		loading = true;
		const { data, error } = await supabase
			.from('calendar_events')
			.select('*')
			.order('start_at', { ascending: true });
		if (error) {
			toast.error(`Could not load events: ${error.message}`);
		} else {
			events = (data ?? []) as EventRow[];
		}
		loading = false;
	}

	function resetForm() {
		fTitle = '';
		fStart = '';
		fEnd = '';
		fAllDay = false;
		fColor = '#00a5cf';
		fDescription = '';
		editing = null;
	}

	function openAdd() {
		resetForm();
		addOpen = true;
	}

	function openEdit(e: EventRow) {
		editing = e;
		fTitle = e.title;
		fStart = toLocalInput(e.start_at);
		fEnd = e.end_at ? toLocalInput(e.end_at) : '';
		fAllDay = e.all_day;
		fColor = e.color ?? '#00a5cf';
		fDescription = e.description ?? '';
		addOpen = true;
	}

	function closeForm() {
		addOpen = false;
		resetForm();
	}

	async function save() {
		const title = fTitle.trim();
		if (!title) {
			toast.error('Enter a title.');
			return;
		}
		if (!fStart) {
			toast.error('Pick a start time.');
			return;
		}
		saving = true;
		const payload: Record<string, unknown> = {
			title,
			start_at: new Date(fStart).toISOString(),
			end_at: fEnd ? new Date(fEnd).toISOString() : null,
			all_day: fAllDay,
			color: fColor || null,
			description: fDescription.trim() || null
		};

		if (editing) {
			payload.updated_at = new Date().toISOString();
			const { data, error } = await supabase
				.from('calendar_events')
				.update(payload)
				.eq('id', editing.id)
				.select()
				.single();
			saving = false;
			if (error) {
				toast.error(`Update failed: ${error.message}`);
				return;
			}
			events = events.map((e) => (e.id === editing!.id ? (data as EventRow) : e));
		} else {
			const { data, error } = await supabase
				.from('calendar_events')
				.insert(payload)
				.select()
				.single();
			saving = false;
			if (error) {
				toast.error(`Could not add event: ${error.message}`);
				return;
			}
			events = [...events, data as EventRow];
		}
		closeForm();
	}

	async function remove(e: EventRow) {
		const { error } = await supabase.from('calendar_events').delete().eq('id', e.id);
		if (error) {
			toast.error(`Delete failed: ${error.message}`);
			return;
		}
		events = events.filter((x) => x.id !== e.id);
	}

	function fmtTime(e: EventRow): string {
		if (e.all_day) return 'All day';
		const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
		const start = new Date(e.start_at).toLocaleTimeString(undefined, opts);
		if (!e.end_at) return start;
		const end = new Date(e.end_at).toLocaleTimeString(undefined, opts);
		return `${start} – ${end}`;
	}

	function isPast(e: EventRow): boolean {
		const ref = e.end_at ?? e.start_at;
		return new Date(ref).getTime() < now.getTime();
	}

	onMount(load);
</script>

<div class="mx-auto max-w-4xl">
	<header class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<CalendarDays class="h-6 w-6 text-accent-primary" />
			<div>
				<h1 class="text-2xl font-bold text-white">Calendar</h1>
				<p class="mt-0.5 text-sm text-slate-400">Upcoming events agenda.</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<label class="flex items-center gap-2 text-xs text-slate-400">
				<input type="checkbox" bind:checked={showPast} class="accent-[var(--accent-primary)]" />
				Show past
			</label>
			<button
				onclick={openAdd}
				class="flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
			>
				<Plus class="h-4 w-4" /> Add event
			</button>
		</div>
	</header>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if grouped.length === 0}
		<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
			{showPast ? 'No events yet.' : 'No upcoming events. Add one above.'}
		</div>
	{:else}
		<div class="space-y-6">
			{#each grouped as group (group.key)}
				<div>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
						{group.label}
					</h2>
					<div class="space-y-2">
						{#each group.items as e (e.id)}
							<div
								class="flex items-start gap-3 border border-slate-800 bg-slate-950 p-3 {isPast(e)
									? 'opacity-60'
									: ''}"
							>
								<span
									class="mt-1 h-3 w-3 shrink-0"
									style={`background-color: ${e.color ?? '#00a5cf'}`}
								></span>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<p class="text-sm font-medium text-white">{e.title}</p>
										<span class="text-xs text-slate-500">{fmtTime(e)}</span>
									</div>
									{#if e.description}
										<p class="mt-1 text-xs text-slate-400">{e.description}</p>
									{/if}
								</div>
								<div class="flex shrink-0 gap-1">
									<button
										onclick={() => openEdit(e)}
										title="Edit"
										class="text-slate-500 transition hover:text-accent-primary"
									>
										<Pencil class="h-3.5 w-3.5" />
									</button>
									<button
										onclick={() => remove(e)}
										title="Delete"
										class="text-slate-500 transition hover:text-red-400"
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Add/Edit dialog -->
{#if addOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={closeForm}
	>
		<div
			role="presentation"
			class="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-slate-700 bg-slate-900 p-5"
			onclick={(ev) => ev.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-white">{editing ? 'Edit event' : 'New event'}</h3>
				<button onclick={closeForm} class="text-slate-400 hover:text-white">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="space-y-3">
				<div>
					<label for="ev-title" class="mb-1 block text-xs font-medium text-slate-400">Title</label>
					<input
						id="ev-title"
						bind:value={fTitle}
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
					/>
				</div>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div>
						<label for="ev-start" class="mb-1 block text-xs font-medium text-slate-400">Start</label>
						<input
							id="ev-start"
							type="datetime-local"
							bind:value={fStart}
							class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
						/>
					</div>
					<div>
						<label for="ev-end" class="mb-1 block text-xs font-medium text-slate-400">End (optional)</label>
						<input
							id="ev-end"
							type="datetime-local"
							bind:value={fEnd}
							class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
						/>
					</div>
				</div>
				<div class="flex items-center gap-4">
					<label class="flex items-center gap-2 text-sm text-slate-300">
						<input type="checkbox" bind:checked={fAllDay} class="accent-[var(--accent-primary)]" />
						All day
					</label>
					<div class="flex items-center gap-2">
						<label for="ev-color" class="text-xs text-slate-400">Color</label>
						<input id="ev-color" type="color" bind:value={fColor} class="h-8 w-12 bg-transparent" />
					</div>
				</div>
				<div>
					<label for="ev-desc" class="mb-1 block text-xs font-medium text-slate-400">Description</label>
					<textarea
						id="ev-desc"
						bind:value={fDescription}
						rows="3"
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
					></textarea>
				</div>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button
					onclick={closeForm}
					class="border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
				>
					Cancel
				</button>
				<button
					onclick={save}
					disabled={saving}
					class="flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
				>
					{#if saving}<Loader2 class="h-4 w-4 animate-spin" />{/if} Save
				</button>
			</div>
		</div>
	</div>
{/if}
