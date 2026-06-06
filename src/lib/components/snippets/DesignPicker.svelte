<script lang="ts">
	import { Upload, X, Trash2, Save, LogIn } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { Card, Button, Badge } from '@parallaxrealms/pxp-components';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { UploadedDesign } from '@parallaxrealms/pxp-types/rune';
	import { get } from 'svelte/store';
	import { customProductStore } from '@parallaxrealms/pxp-utils/stores-ecom';

	type UploadHandler =
		| ((file: File) => void | Promise<void>)
		| ((file: undefined, design: UploadedDesign) => void | Promise<void>);

	interface Props {
		supabase: SupabaseClient;
		siteId: string;
		currentView: 'front' | 'back';
		designLibrary: UploadedDesign[];
		currentUploadedDesign: UploadedDesign | null;
		onUpload?: (file: File | null, design?: UploadedDesign) => void | Promise<void>;
		onRemove?: (id: string | number) => void;
		onClear?: () => void;
		onApply?: (design: UploadedDesign, view: 'front' | 'back') => void;
		class?: string;
	}

	let {
		supabase,
		siteId,
		currentView,
		designLibrary = [],
		currentUploadedDesign = null,
		onUpload = async () => {},
		onRemove = () => {},
		onClear = () => {},
		onApply = () => {},
		class: className = ''
	}: Props = $props();

	let fileInput = $state<HTMLInputElement>();
	let isUploading = $state(false);
	let uploadError = $state<string | null>(null);
	let savedDesigns = $state<UploadedDesign[]>([]);
	let isLoadingDesigns = $state(false);

	/** Maps a client_uploaded_assets row to UploadedDesign type */
	function mapToUploadedDesign(row: any): UploadedDesign {
		return {
			id: row.id,
			name: row.metadata?.originalName || row.path?.split('/').pop() || 'Untitled',
			url: row.url,
			width: row.metadata?.width || 0,
			height: row.metadata?.height || 0,
			size_bytes: row.size || 0,
			mime_type: row.content_type || 'image/png',
			created_at: row.created_at
		};
	}

	// Load user's saved designs
	$effect(() => {
		if (browser && supabase && siteId) {
			loadUserDesigns();
		}
	});

	async function loadUserDesigns() {
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) return;

			isLoadingDesigns = true;
			const { data, error } = await supabase
				.from('client_uploaded_assets')
				.select('*')
				.eq('uploaded_by', user.id)
				.eq('site_id', siteId)
				.eq('type', 'design')
				.order('created_at', { ascending: false });

			if (error) throw error;

			savedDesigns = (data || []).map(mapToUploadedDesign);
		} catch (err) {
			console.error('Error loading designs:', err);
		} finally {
			isLoadingDesigns = false;
		}
	}

	function triggerUpload() {
		fileInput?.click();
	}

	async function handleFileChange(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		await onUpload(file);
		(event.target as HTMLInputElement).value = '';
	}

	async function applyDesign(design: UploadedDesign) {
		// Just notify parent to handle applying
		await onUpload(null, design);
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		uploadError = null;
		isUploading = true;

		try {
			if (!file.type.startsWith('image/')) throw new Error('Please upload an image file');
			if (file.size > 10 * 1024 * 1024) throw new Error('File size must be less than 10MB');

			const newDesign: UploadedDesign = {
				id: Date.now(),
				name: file.name,
				url: URL.createObjectURL(file),
				width: 500,
				height: 500,
				size_bytes: file.size,
				mime_type: file.type,
				created_at: new Date().toISOString()
			};

			// Just emit up to parent - no auto-apply here
			await onUpload(file, newDesign);
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Upload failed';
			console.error('Upload error:', error);
		} finally {
			isUploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function saveDesignToDatabase(file: File, userId: string): Promise<UploadedDesign> {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
			img.src = objectUrl;
		});

		const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
		const storagePath = `${siteId}/${userId}/designs/${fileName}`;

		const { error: uploadError } = await supabase.storage
			.from('client-uploaded-assets')
			.upload(storagePath, file, { cacheControl: '3600', upsert: false });

		if (uploadError) throw uploadError;

		const {
			data: { publicUrl }
		} = supabase.storage.from('client-uploaded-assets').getPublicUrl(storagePath);

		const { data: designData, error: dbError } = await supabase
			.from('client_uploaded_assets')
			.insert({
				bucket: 'client-uploaded-assets',
				path: storagePath,
				url: publicUrl,
				type: 'design',
				size: file.size,
				content_type: file.type,
				uploaded_by: userId,
				site_id: siteId,
				metadata: {
					width: img.width,
					height: img.height,
					originalName: file.name
				}
			})
			.select()
			.single();

		if (dbError) throw dbError;

		URL.revokeObjectURL(objectUrl);

		const newDesign = mapToUploadedDesign(designData);
		savedDesigns = [newDesign, ...savedDesigns];
		return newDesign;
	}

	async function removeDesign(id: string | number) {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (user && typeof id === 'string') {
			// Get the design to find storage path
			const { data: design } = await supabase
				.from('client_uploaded_assets')
				.select('path, bucket')
				.eq('id', id)
				.eq('uploaded_by', user.id)
				.eq('site_id', siteId)
				.single();

			const { error } = await supabase
				.from('client_uploaded_assets')
				.delete()
				.eq('id', id)
				.eq('uploaded_by', user.id)
				.eq('site_id', siteId);

			if (error) {
				console.error('Error removing design:', error);
				return;
			}

			// Delete from storage
			if (design?.path) {
				await supabase.storage.from(design.bucket || 'client-uploaded-assets').remove([design.path]);
			}

			savedDesigns = savedDesigns.filter((d) => d.id !== id);
		}
		onRemove(id);
	}

	async function clearAll() {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (user && confirm('Remove all designs from your library?')) {
			// Get all designs to delete from storage
			const { data: designs } = await supabase
				.from('client_uploaded_assets')
				.select('path, bucket')
				.eq('uploaded_by', user.id)
				.eq('site_id', siteId)
				.eq('type', 'design');

			const { error } = await supabase
				.from('client_uploaded_assets')
				.delete()
				.eq('uploaded_by', user.id)
				.eq('site_id', siteId)
				.eq('type', 'design');

			if (error) {
				console.error('Error clearing designs:', error);
				return;
			}

			// Delete from storage
			if (designs?.length) {
				const paths = designs.map((d) => d.path).filter(Boolean);
				if (paths.length) {
					await supabase.storage.from('client-uploaded-assets').remove(paths);
				}
			}

			savedDesigns = [];
		}
		onClear();
	}
</script>

<!-- Upload + Current Session -->
<div class="design-picker {className}">
	<!-- Current Session Designs -->
	{#if designLibrary.length > 0}
		<div class="design-strip">
			{#each designLibrary as design (design.id)}
				<button
					class="design-thumb {currentUploadedDesign?.id === design.id ? 'selected' : ''}"
					onclick={() => {
						currentUploadedDesign = design;
						onApply(design, currentView);
					}}
				>
					<img src={design.url} alt={design.name} class="thumb-image" />
				</button>
			{/each}
		</div>
	{/if}

	<!-- Saved Designs -->
	{#if supabase && savedDesigns.length > 0}
		<Card variant="default" class="space-y-4 p-4">
			<h2 class="text-lg font-semibold">Your Designs</h2>

			<div>
				<input
					type="file"
					accept="image/*"
					class="hidden"
					bind:this={fileInput}
					onchange={handleFileChange}
				/>
				<Button onclick={triggerUpload} variant="outlined" class="flex items-center gap-2">
					<Upload class="h-4 w-4" />
					<span>Upload New Design</span>
				</Button>
			</div>

			<div class="grid grid-cols-3 gap-3">
				{#each savedDesigns as design (design.id)}
					<button
						type="button"
						class="relative w-full cursor-pointer rounded-lg border bg-transparent p-0 text-left transition hover:ring-2 hover:ring-primary"
						class:ring-2={currentUploadedDesign?.id === design.id}
						class:ring-primary={currentUploadedDesign?.id === design.id}
						onclick={() => applyDesign(design)}
					>
						<img src={design.url} alt={design.name} class="h-24 w-full rounded object-contain" />
						<Badge size="sm" class="absolute bottom-1 left-1">
							{design.name}
						</Badge>
					</button>
				{/each}
			</div>
		</Card>
	{/if}

	<div class="upload-strip">
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			onchange={handleFileUpload}
			class="hidden"
			disabled={isUploading}
		/>
		<Button variant="default" size="md" onclick={() => fileInput?.click()} disabled={isUploading}>
			{#if isUploading}
				<div class="spinner"></div>
				Uploading...
			{:else}
				<Upload class="mr-2 h-4 w-4" /> Upload
			{/if}
		</Button>

		{#if designLibrary.length > 0}
			<Button variant="custom" onclick={clearAll} class="clear-btn" title="Clear all designs">
				<Trash2 class="h-4 w-4" />
			</Button>
		{/if}
	</div>

	{#if uploadError}<div class="error-message">{uploadError}</div>{/if}
</div>

<style>
	.design-picker {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.upload-strip {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		z-index: 100;
	}

	.design-strip {
		display: flex;
		flex-wrap: nowrap;
		overflow-x: auto;
		gap: 0.75rem;
		padding: 0.25rem 0;
	}

	.design-thumb {
		flex: 0 0 auto;
		width: 6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		margin: 0.25rem;
		z-index: 100;
	}

	.design-thumb.selected .thumb-image {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
	}

	.thumb-image {
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-sm);
		cursor: pointer;
		transition: all 0.2s;
	}
	.thumb-image:hover {
		transform: scale(1.05);
		border: 1px solid var(--color-primary);
	}

	.apply-row {
		display: flex;
		gap: 0.25rem;
		width: 100%;
	}
	.apply-row button {
		flex: 1;
		font-size: 0.7rem;
		padding: 0.25rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--border-radius-sm);
		cursor: pointer;
		transition: background 0.2s;
	}
	.apply-row button:hover {
		background: var(--color-primary-dark);
	}

	.saved-section {
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-border);
	}
</style>
