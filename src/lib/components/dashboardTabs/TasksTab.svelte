<script lang="ts">
	/**
	 * Admin Tasks tab — a simple single-tenant status board (To Do / In Progress /
	 * Blocked / Done). Reads + writes go directly through the passed session
	 * `supabase` client; RLS (public.pxp_is_admin) gates the `tasks` table to admins.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import {
		ListTodo, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Loader2, X, Check
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	type Status = 'todo' | 'in_progress' | 'blocked' | 'done';
	type Priority = 'low' | 'medium' | 'high';

	type Task = {
		id: string;
		title: string;
		description: string | null;
		status: Status;
		priority: Priority;
		due_date: string | null;
		sort_order: number;
		created_at: string;
		updated_at: string;
	};

	const STATUSES: { id: Status; label: string }[] = [
		{ id: 'todo', label: 'To Do' },
		{ id: 'in_progress', label: 'In Progress' },
		{ id: 'blocked', label: 'Blocked' },
		{ id: 'done', label: 'Done' }
	];

	const PRIORITY_STYLES: Record<Priority, string> = {
		low: 'bg-slate-700 text-slate-300',
		medium: 'bg-accent-primary/20 text-accent-primary',
		high: 'bg-red-500/15 text-red-400'
	};

	const PRIORITY_ORDER: Priority[] = ['low', 'medium', 'high'];

	let tasks = $state<Task[]>([]);
	let loading = $state(true);

	// add form
	let newTitle = $state('');
	let newPriority = $state<Priority>('medium');
	let newDue = $state('');
	let adding = $state(false);

	// edit dialog
	let editing = $state<Task | null>(null);
	let editTitle = $state('');
	let editDescription = $state('');
	let editDue = $state('');
	let savingEdit = $state(false);

	const columns = $derived(
		STATUSES.map((s) => ({
			...s,
			items: tasks
				.filter((t) => t.status === s.id)
				.sort((a, b) => a.sort_order - b.sort_order)
		}))
	);

	async function load() {
		loading = true;
		const { data, error } = await supabase
			.from('tasks')
			.select('*')
			.order('status', { ascending: true })
			.order('sort_order', { ascending: true });
		if (error) {
			toast.error(`Could not load tasks: ${error.message}`);
		} else {
			tasks = (data ?? []) as Task[];
		}
		loading = false;
	}

	async function addTask(e: SubmitEvent) {
		e.preventDefault();
		const title = newTitle.trim();
		if (!title) {
			toast.error('Enter a task title.');
			return;
		}
		adding = true;
		const payload: Record<string, unknown> = {
			title,
			priority: newPriority,
			status: 'todo' as Status
		};
		if (newDue) payload.due_date = newDue;
		const { data, error } = await supabase.from('tasks').insert(payload).select().single();
		adding = false;
		if (error) {
			toast.error(`Could not add task: ${error.message}`);
			return;
		}
		tasks = [...tasks, data as Task];
		newTitle = '';
		newPriority = 'medium';
		newDue = '';
	}

	async function patch(task: Task, changes: Partial<Task>) {
		const payload = { ...changes, updated_at: new Date().toISOString() };
		const { data, error } = await supabase
			.from('tasks')
			.update(payload)
			.eq('id', task.id)
			.select()
			.single();
		if (error) {
			toast.error(`Update failed: ${error.message}`);
			return;
		}
		tasks = tasks.map((t) => (t.id === task.id ? (data as Task) : t));
	}

	function moveStatus(task: Task, dir: -1 | 1) {
		const idx = STATUSES.findIndex((s) => s.id === task.status);
		const next = idx + dir;
		if (next < 0 || next >= STATUSES.length) return;
		patch(task, { status: STATUSES[next].id });
	}

	function cyclePriority(task: Task) {
		const idx = PRIORITY_ORDER.indexOf(task.priority);
		const next = PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length];
		patch(task, { priority: next });
	}

	function markDone(task: Task) {
		patch(task, { status: 'done' });
	}

	async function remove(task: Task) {
		const { error } = await supabase.from('tasks').delete().eq('id', task.id);
		if (error) {
			toast.error(`Delete failed: ${error.message}`);
			return;
		}
		tasks = tasks.filter((t) => t.id !== task.id);
	}

	function openEdit(task: Task) {
		editing = task;
		editTitle = task.title;
		editDescription = task.description ?? '';
		editDue = task.due_date ?? '';
	}

	async function saveEdit() {
		if (!editing) return;
		const title = editTitle.trim();
		if (!title) {
			toast.error('Title cannot be empty.');
			return;
		}
		savingEdit = true;
		await patch(editing, {
			title,
			description: editDescription.trim() || null,
			due_date: editDue || null
		});
		savingEdit = false;
		editing = null;
	}

	function fmtDue(d: string): string {
		try {
			return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return d;
		}
	}

	onMount(load);
</script>

<div class="mx-auto max-w-6xl">
	<header class="mb-6 flex items-center gap-3">
		<ListTodo class="h-6 w-6 text-accent-primary" />
		<div>
			<h1 class="text-2xl font-bold text-white">Tasks</h1>
			<p class="mt-0.5 text-sm text-slate-400">A simple status board.</p>
		</div>
	</header>

	<!-- Add task -->
	<form onsubmit={addTask} class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
		<input
			type="text"
			bind:value={newTitle}
			placeholder="New task title…"
			disabled={adding}
			class="flex-1 border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none disabled:opacity-60"
		/>
		<select
			bind:value={newPriority}
			disabled={adding}
			class="border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:border-accent-primary focus:outline-none"
		>
			<option value="low">Low</option>
			<option value="medium">Medium</option>
			<option value="high">High</option>
		</select>
		<input
			type="date"
			bind:value={newDue}
			disabled={adding}
			class="border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:border-accent-primary focus:outline-none"
		/>
		<button
			type="submit"
			disabled={adding}
			class="flex items-center justify-center gap-2 bg-accent-primary px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
		>
			{#if adding}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Plus class="h-4 w-4" />{/if}
			Add
		</button>
	</form>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			{#each columns as col (col.id)}
				<div class="border border-slate-800 bg-slate-900/40">
					<div class="flex items-center justify-between border-b border-slate-800 px-3 py-2">
						<h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">{col.label}</h2>
						<span class="text-xs text-slate-600">{col.items.length}</span>
					</div>
					<div class="space-y-2 p-2">
						{#if col.items.length === 0}
							<p class="px-2 py-6 text-center text-xs text-slate-600">Empty</p>
						{:else}
							{#each col.items as task (task.id)}
								<div class="border border-slate-800 bg-slate-950 p-3">
									<div class="flex items-start justify-between gap-2">
										<p
											class="min-w-0 break-words text-sm font-medium {task.status === 'done'
												? 'text-slate-500 line-through'
												: 'text-white'}"
										>
											{task.title}
										</p>
										<div class="flex shrink-0 gap-1">
											<button
												onclick={() => openEdit(task)}
												title="Edit"
												class="text-slate-500 transition hover:text-accent-primary"
											>
												<Pencil class="h-3.5 w-3.5" />
											</button>
											<button
												onclick={() => remove(task)}
												title="Delete"
												class="text-slate-500 transition hover:text-red-400"
											>
												<Trash2 class="h-3.5 w-3.5" />
											</button>
										</div>
									</div>

									{#if task.description}
										<p class="mt-1 text-xs text-slate-400">{task.description}</p>
									{/if}

									<div class="mt-2 flex flex-wrap items-center gap-2">
										<button
											onclick={() => cyclePriority(task)}
											title="Cycle priority"
											class="px-2 py-0.5 text-xs font-medium {PRIORITY_STYLES[task.priority]}"
										>
											{task.priority}
										</button>
										{#if task.due_date}
											<span class="text-xs text-slate-500">{fmtDue(task.due_date)}</span>
										{/if}
									</div>

									<div class="mt-2 flex items-center justify-between border-t border-slate-800 pt-2">
										<div class="flex gap-1">
											<button
												onclick={() => moveStatus(task, -1)}
												disabled={task.status === 'todo'}
												title="Move left"
												class="text-slate-500 transition hover:text-accent-primary disabled:opacity-30 disabled:hover:text-slate-500"
											>
												<ChevronLeft class="h-4 w-4" />
											</button>
											<button
												onclick={() => moveStatus(task, 1)}
												disabled={task.status === 'done'}
												title="Move right"
												class="text-slate-500 transition hover:text-accent-primary disabled:opacity-30 disabled:hover:text-slate-500"
											>
												<ChevronRight class="h-4 w-4" />
											</button>
										</div>
										{#if task.status !== 'done'}
											<button
												onclick={() => markDone(task)}
												class="flex items-center gap-1 text-xs text-slate-500 transition hover:text-emerald-400"
											>
												<Check class="h-3.5 w-3.5" /> Done
											</button>
										{/if}
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Edit dialog -->
{#if editing}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={() => (editing = null)}
	>
		<div
			role="presentation"
			class="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-slate-700 bg-slate-900 p-5"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-white">Edit task</h3>
				<button onclick={() => (editing = null)} class="text-slate-400 hover:text-white">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="space-y-3">
				<div>
					<label for="edit-title" class="mb-1 block text-xs font-medium text-slate-400">Title</label>
					<input
						id="edit-title"
						bind:value={editTitle}
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
					/>
				</div>
				<div>
					<label for="edit-desc" class="mb-1 block text-xs font-medium text-slate-400">Description</label>
					<textarea
						id="edit-desc"
						bind:value={editDescription}
						rows="3"
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
					></textarea>
				</div>
				<div>
					<label for="edit-due" class="mb-1 block text-xs font-medium text-slate-400">Due date</label>
					<input
						id="edit-due"
						type="date"
						bind:value={editDue}
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
					/>
				</div>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button
					onclick={() => (editing = null)}
					class="border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
				>
					Cancel
				</button>
				<button
					onclick={saveEdit}
					disabled={savingEdit}
					class="flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
				>
					{#if savingEdit}<Loader2 class="h-4 w-4 animate-spin" />{/if} Save
				</button>
			</div>
		</div>
	</div>
{/if}
