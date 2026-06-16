<script lang="ts">
	/**
	 * Admin Notes tab — a simple single-tenant markdown notes board. Reads + writes
	 * go directly through the passed session `supabase` client; RLS
	 * (public.pxp_is_admin) gates the `notes` table to admins. Bodies are rendered
	 * with `marked` (admin-only self-authored content — no sanitization needed).
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import { StickyNote, Plus, Trash2, Pencil, Pin, PinOff, Loader2, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { marked } from 'marked';

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	type Note = {
		id: string;
		title: string;
		body: string;
		pinned: boolean;
		created_at: string;
		updated_at: string;
	};

	let notes = $state<Note[]>([]);
	let loading = $state(true);

	// dialog (add + edit share one form)
	let formOpen = $state(false);
	let editing = $state<Note | null>(null);
	let fTitle = $state('');
	let fBody = $state('');
	let saving = $state(false);

	const sorted = $derived(
		[...notes].sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
			return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		})
	);

	function renderMd(body: string): string {
		try {
			return marked.parse(body, { async: false }) as string;
		} catch {
			return body;
		}
	}

	async function load() {
		loading = true;
		const { data, error } = await supabase
			.from('notes')
			.select('*')
			.order('pinned', { ascending: false })
			.order('updated_at', { ascending: false });
		if (error) {
			toast.error(`Could not load notes: ${error.message}`);
		} else {
			notes = (data ?? []) as Note[];
		}
		loading = false;
	}

	function openAdd() {
		editing = null;
		fTitle = '';
		fBody = '';
		formOpen = true;
	}

	function openEdit(n: Note) {
		editing = n;
		fTitle = n.title;
		fBody = n.body;
		formOpen = true;
	}

	function closeForm() {
		formOpen = false;
		editing = null;
		fTitle = '';
		fBody = '';
	}

	async function save() {
		const title = fTitle.trim() || 'Untitled';
		saving = true;
		if (editing) {
			const { data, error } = await supabase
				.from('notes')
				.update({ title, body: fBody, updated_at: new Date().toISOString() })
				.eq('id', editing.id)
				.select()
				.single();
			saving = false;
			if (error) {
				toast.error(`Update failed: ${error.message}`);
				return;
			}
			notes = notes.map((n) => (n.id === editing!.id ? (data as Note) : n));
		} else {
			const { data, error } = await supabase
				.from('notes')
				.insert({ title, body: fBody })
				.select()
				.single();
			saving = false;
			if (error) {
				toast.error(`Could not add note: ${error.message}`);
				return;
			}
			notes = [...notes, data as Note];
		}
		closeForm();
	}

	async function togglePin(n: Note) {
		const { data, error } = await supabase
			.from('notes')
			.update({ pinned: !n.pinned, updated_at: new Date().toISOString() })
			.eq('id', n.id)
			.select()
			.single();
		if (error) {
			toast.error(`Pin failed: ${error.message}`);
			return;
		}
		notes = notes.map((x) => (x.id === n.id ? (data as Note) : x));
	}

	async function remove(n: Note) {
		const { error } = await supabase.from('notes').delete().eq('id', n.id);
		if (error) {
			toast.error(`Delete failed: ${error.message}`);
			return;
		}
		notes = notes.filter((x) => x.id !== n.id);
	}

	onMount(load);
</script>

<div class="mx-auto max-w-5xl">
	<header class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<StickyNote class="h-6 w-6 text-accent-primary" />
			<div>
				<h1 class="text-2xl font-bold text-white">Notes</h1>
				<p class="mt-0.5 text-sm text-slate-400">Markdown notes board.</p>
			</div>
		</div>
		<button
			onclick={openAdd}
			class="flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
		>
			<Plus class="h-4 w-4" /> Add note
		</button>
	</header>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if sorted.length === 0}
		<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
			No notes yet. Add one above.
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each sorted as n (n.id)}
				<div
					class="flex flex-col border bg-slate-950 p-4 {n.pinned
						? 'border-accent-primary/40'
						: 'border-slate-800'}"
				>
					<div class="mb-2 flex items-start justify-between gap-2">
						<h3 class="min-w-0 break-words text-sm font-semibold text-white">{n.title}</h3>
						<div class="flex shrink-0 gap-1">
							<button
								onclick={() => togglePin(n)}
								title={n.pinned ? 'Unpin' : 'Pin'}
								class="transition {n.pinned
									? 'text-accent-primary'
									: 'text-slate-500 hover:text-accent-primary'}"
							>
								{#if n.pinned}<Pin class="h-3.5 w-3.5" />{:else}<PinOff class="h-3.5 w-3.5" />{/if}
							</button>
							<button
								onclick={() => openEdit(n)}
								title="Edit"
								class="text-slate-500 transition hover:text-accent-primary"
							>
								<Pencil class="h-3.5 w-3.5" />
							</button>
							<button
								onclick={() => remove(n)}
								title="Delete"
								class="text-slate-500 transition hover:text-red-400"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
					{#if n.body.trim()}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<div
							class="prose prose-invert prose-sm max-w-none break-words text-sm text-slate-300 [&_a]:text-accent-primary [&_code]:text-accent-primary [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_pre]:overflow-x-auto [&_strong]:text-white"
						>
							{@html renderMd(n.body)}
						</div>
					{:else}
						<p class="text-xs italic text-slate-600">Empty note</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Add/Edit dialog -->
{#if formOpen}
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
				<h3 class="text-lg font-semibold text-white">{editing ? 'Edit note' : 'New note'}</h3>
				<button onclick={closeForm} class="text-slate-400 hover:text-white">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="space-y-3">
				<div>
					<label for="note-title" class="mb-1 block text-xs font-medium text-slate-400">Title</label>
					<input
						id="note-title"
						bind:value={fTitle}
						placeholder="Untitled"
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
					/>
				</div>
				<div>
					<label for="note-body" class="mb-1 block text-xs font-medium text-slate-400">
						Body (markdown)
					</label>
					<textarea
						id="note-body"
						bind:value={fBody}
						rows="10"
						placeholder="# Heading&#10;&#10;Write **markdown** here…"
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
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
