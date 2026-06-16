<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { FinanceCategoryRow } from '$lib/types/finances';
	import { getFinanceCategories, refreshFinanceCategories } from '$lib/stores/financeCategories.svelte';
	import {
		Plus,
		Pencil,
		Trash2,
		Check,
		X,
		Settings,
		ChevronUp,
		ChevronDown,
		Loader2
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		supabase: SupabaseClient;
	}

	let { supabase }: Props = $props();

	let isOpen = $state(false);
	let categories = $derived(getFinanceCategories());
	let isSaving = $state(false);

	// Add new category
	let newCategoryName = $state('');
	let isAdding = $state(false);

	// Edit category
	let editingId = $state<string | null>(null);
	let editingName = $state('');

	// Delete
	let deleteDialogOpen = $state(false);
	let categoryToDelete = $state<FinanceCategoryRow | null>(null);

	let sortedCategories = $derived([...categories].sort((a, b) => a.sort_order - b.sort_order));

	async function addCategory() {
		if (!newCategoryName.trim()) return;
		isAdding = true;
		try {
			const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) : 0;

			const { error } = await supabase
				.from('finance_categories')
				.insert({ name: newCategoryName.trim(), sort_order: maxOrder + 1 });

			if (error) throw error;

			newCategoryName = '';
			toast.success('Category added');
			await refreshFinanceCategories(supabase);
		} catch (err) {
			const e = err as { code?: string; message?: string };
			if (e?.code === '23505') {
				toast.error('Category already exists');
			} else {
				toast.error(e?.message || 'Failed to add category');
			}
		} finally {
			isAdding = false;
		}
	}

	function startEdit(cat: FinanceCategoryRow) {
		editingId = cat.id;
		editingName = cat.name;
	}

	function cancelEdit() {
		editingId = null;
		editingName = '';
	}

	async function saveEdit() {
		if (!editingId || !editingName.trim()) return;
		isSaving = true;
		try {
			const oldCat = categories.find((c) => c.id === editingId);
			const oldName = oldCat?.name;
			const newName = editingName.trim();

			if (oldName === newName) {
				cancelEdit();
				return;
			}

			const { error } = await supabase
				.from('finance_categories')
				.update({ name: newName, updated_at: new Date().toISOString() })
				.eq('id', editingId);

			if (error) throw error;

			// Update existing transactions that used the old name.
			if (oldName) {
				await supabase
					.from('bank_transactions')
					.update({ category: newName })
					.eq('category', oldName);
			}

			toast.success('Category renamed');
			cancelEdit();
			await refreshFinanceCategories(supabase);
		} catch (err) {
			const e = err as { code?: string; message?: string };
			if (e?.code === '23505') {
				toast.error('Category name already exists');
			} else {
				toast.error(e?.message || 'Failed to rename');
			}
		} finally {
			isSaving = false;
		}
	}

	function confirmDelete(cat: FinanceCategoryRow) {
		categoryToDelete = cat;
		deleteDialogOpen = true;
	}

	async function deleteCategory() {
		if (!categoryToDelete) return;
		try {
			const { error } = await supabase
				.from('finance_categories')
				.delete()
				.eq('id', categoryToDelete.id);

			if (error) throw error;

			toast.success(`Deleted "${categoryToDelete.name}"`);
			categoryToDelete = null;
			deleteDialogOpen = false;
			await refreshFinanceCategories(supabase);
		} catch (err) {
			const e = err as { message?: string };
			toast.error(e?.message || 'Failed to delete');
		}
	}

	// Swap sort_order between a category and its neighbor (up/down reorder).
	async function move(index: number, dir: -1 | 1) {
		const a = sortedCategories[index];
		const b = sortedCategories[index + dir];
		if (!a || !b) return;
		isSaving = true;
		try {
			const results = await Promise.all([
				supabase.from('finance_categories').update({ sort_order: b.sort_order }).eq('id', a.id),
				supabase.from('finance_categories').update({ sort_order: a.sort_order }).eq('id', b.id)
			]);
			const firstErr = results.find((r) => r.error)?.error;
			if (firstErr) throw firstErr;
			await refreshFinanceCategories(supabase);
		} catch (err) {
			const e = err as { message?: string };
			toast.error(e?.message || 'Failed to reorder');
			await refreshFinanceCategories(supabase);
		} finally {
			isSaving = false;
		}
	}

	function handleAddKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') addCategory();
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveEdit();
		if (e.key === 'Escape') cancelEdit();
	}
</script>

<!-- Trigger Button -->
<button
	onclick={() => (isOpen = true)}
	class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
	title="Manage categories"
>
	<Settings class="h-3.5 w-3.5" />
	Categories
</button>

<!-- Manager Dialog -->
{#if isOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={() => (isOpen = false)}
	>
		<div
			role="presentation"
			class="max-h-[90vh] w-full max-w-md overflow-y-auto border border-slate-700 bg-slate-900 p-5"
			onclick={(ev) => ev.stopPropagation()}
		>
			<div class="mb-4 flex items-start justify-between">
				<div>
					<h3 class="text-lg font-semibold text-white">Finance Categories</h3>
					<p class="text-sm text-slate-400">Add, rename, reorder, or remove transaction categories.</p>
				</div>
				<button onclick={() => (isOpen = false)} class="text-slate-400 hover:text-white">
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Add new -->
			<div class="mb-4 flex items-center gap-2">
				<input
					bind:value={newCategoryName}
					placeholder="New category name..."
					onkeydown={handleAddKeydown}
					class="flex-1 border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
				/>
				<button
					onclick={addCategory}
					disabled={isAdding || !newCategoryName.trim()}
					class="flex items-center gap-1 bg-accent-primary px-3 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
				>
					<Plus class="h-4 w-4" /> Add
				</button>
			</div>

			<!-- Category list -->
			<div class="max-h-[400px] overflow-y-auto">
				<div class="flex flex-col gap-1">
					{#each sortedCategories as cat, i (cat.id)}
						{#if editingId === cat.id}
							<div class="flex items-center gap-2 px-2 py-1.5">
								<input
									bind:value={editingName}
									onkeydown={handleEditKeydown}
									class="flex-1 border border-accent-primary bg-slate-950 px-2 py-1 text-sm text-white focus:outline-none"
								/>
								<button onclick={saveEdit} disabled={isSaving} class="p-1 text-emerald-400 hover:text-emerald-300" title="Save">
									<Check class="h-4 w-4" />
								</button>
								<button onclick={cancelEdit} class="p-1 text-slate-400 hover:text-slate-200" title="Cancel">
									<X class="h-4 w-4" />
								</button>
							</div>
						{:else}
							<div class="group flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800/40">
								<div class="flex flex-col">
									<button
										onclick={() => move(i, -1)}
										disabled={i === 0 || isSaving}
										class="text-slate-500 hover:text-accent-primary disabled:opacity-30"
										aria-label="Move up"
									>
										<ChevronUp class="h-3.5 w-3.5" />
									</button>
									<button
										onclick={() => move(i, 1)}
										disabled={i === sortedCategories.length - 1 || isSaving}
										class="text-slate-500 hover:text-accent-primary disabled:opacity-30"
										aria-label="Move down"
									>
										<ChevronDown class="h-3.5 w-3.5" />
									</button>
								</div>
								<span class="flex-1 text-sm text-slate-300">{cat.name}</span>
								<button onclick={() => startEdit(cat)} class="p-1 text-slate-500 hover:text-accent-primary" title="Rename">
									<Pencil class="h-3.5 w-3.5" />
								</button>
								<button onclick={() => confirmDelete(cat)} class="p-1 text-slate-500 hover:text-red-400" title="Delete">
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</div>
						{/if}
					{/each}
				</div>

				{#if categories.length === 0}
					<p class="py-4 text-center text-sm text-slate-500">No categories yet. Add one above.</p>
				{/if}
			</div>

			<div class="mt-4 flex justify-end">
				<button
					onclick={() => (isOpen = false)}
					class="border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete confirmation -->
{#if deleteDialogOpen && categoryToDelete}
	<div
		role="presentation"
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
		onclick={() => { deleteDialogOpen = false; categoryToDelete = null; }}
	>
		<div
			role="presentation"
			class="max-h-[90vh] w-full max-w-md overflow-y-auto border border-slate-700 bg-slate-900 p-5"
			onclick={(ev) => ev.stopPropagation()}
		>
			<h3 class="text-lg font-semibold text-white">Delete Category</h3>
			<p class="mt-2 text-sm text-slate-400">
				Delete "{categoryToDelete.name}"? Existing transactions with this category will keep their
				current value but it won't appear in dropdowns.
			</p>
			<div class="mt-5 flex justify-end gap-2">
				<button
					onclick={() => { deleteDialogOpen = false; categoryToDelete = null; }}
					class="border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
				>
					Cancel
				</button>
				<button
					onclick={deleteCategory}
					class="flex items-center gap-1 border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
				>
					<Trash2 class="h-4 w-4" /> Delete
				</button>
			</div>
		</div>
	</div>
{/if}
