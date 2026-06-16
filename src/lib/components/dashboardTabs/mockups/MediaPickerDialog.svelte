<script lang="ts">
	/**
	 * Inline Media Library picker dialog for the mockup creator.
	 *
	 * PxP's MediaSelector.svelte is a full-page library tab, not a reusable
	 * "pick → emit URL" control, so the creator uses this lightweight picker.
	 * It queries the same `media_assets` table / `media_library` bucket recipe
	 * and emits the chosen image's public URL + label via `onpick`.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { MediaRow } from '@parallaxrealms/pxp-types/auth';
	import { Search, Loader2, ImageOff } from 'lucide-svelte';

	interface PickedMedia {
		url: string;
		name: string;
	}

	interface Props {
		supabase: SupabaseClient;
		open: boolean;
		title?: string;
		onpick: (media: PickedMedia) => void;
		onclose: () => void;
	}

	let { supabase, open = $bindable(), title = 'Pick from Media Library', onpick, onclose }: Props =
		$props();

	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let search = $state('');
	let items = $state<{ id: string; url: string; name: string }[]>([]);
	let loaded = $state(false);

	async function loadMedia() {
		isLoading = true;
		error = null;
		try {
			const likeSearch = search ? `%${search.replaceAll('%', '\\%')}%` : '%';
			const { data, error: qErr } = await supabase
				.from('media_assets')
				.select('*')
				.eq('type', 'image')
				.ilike('path', likeSearch)
				.order('updated_at', { ascending: false })
				.limit(500);
			if (qErr) throw qErr;
			items = (data as MediaRow[]).map((r) => ({
				id: r.path,
				url: r.url,
				name: r.path.split('/').pop() || r.path
			}));
			loaded = true;
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load media';
		} finally {
			isLoading = false;
		}
	}

	// Load (once) when opened; reload on search input.
	$effect(() => {
		if (open && !loaded && !isLoading) loadMedia();
	});

	function choose(item: { url: string; name: string }) {
		onpick({ url: item.url, name: item.name });
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

{#if open}
	<!-- Native modal (UI-STYLE.md: no Odin kit, no rounded corners) -->
	<div
		role="presentation"
		class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
		onclick={handleBackdrop}
	>
		<div
			class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
				<h2 class="text-base font-bold text-white">{title}</h2>
				<button
					type="button"
					class="text-slate-400 transition hover:text-accent-primary"
					onclick={onclose}
					aria-label="Close"
				>
					✕
				</button>
			</div>

			<div class="border-b border-slate-800 p-3">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
					<input
						class="w-full border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
						placeholder="Search media…"
						bind:value={search}
						oninput={loadMedia}
					/>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto p-3">
				{#if isLoading}
					<div class="flex items-center justify-center py-16">
						<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
					</div>
				{:else if error}
					<div class="border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
				{:else if items.length === 0}
					<div
						class="flex flex-col items-center justify-center gap-2 border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500"
					>
						<ImageOff class="h-8 w-8" />
						{search ? 'No media matches your search.' : 'No images in the Media Library yet.'}
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
						{#each items as item (item.id)}
							<button
								type="button"
								class="group relative overflow-hidden border border-slate-800 bg-slate-800 transition hover:border-accent-primary"
								onclick={() => choose(item)}
								title={item.name}
							>
								<img src={item.url} alt={item.name} class="aspect-square w-full object-cover" loading="lazy" />
								<div
									class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-1.5"
								>
									<p class="truncate text-[11px] text-slate-200">{item.name}</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
