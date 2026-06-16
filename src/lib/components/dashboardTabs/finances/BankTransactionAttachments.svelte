<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { BankTransactionAttachment } from '$lib/types/finances';
	import {
		Paperclip,
		Trash2,
		Download,
		File,
		Image as ImageIcon,
		FileSpreadsheet,
		Loader2
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		supabase: SupabaseClient;
		transactionId: string;
		readOnly?: boolean;
	}

	let { supabase, transactionId, readOnly = false }: Props = $props();

	let attachments = $state<BankTransactionAttachment[]>([]);
	let isLoading = $state(true);
	let isUploading = $state(false);

	function getFileIcon(fileType: string | null) {
		if (!fileType) return File;
		if (fileType.startsWith('image/')) return ImageIcon;
		if (fileType.includes('spreadsheet') || fileType.includes('csv')) return FileSpreadsheet;
		return File;
	}

	function formatFileSize(bytes: number | null): string {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	async function loadAttachments() {
		isLoading = true;
		try {
			const response = await fetch(`/api/bank/attachments?transaction_id=${transactionId}`);
			if (!response.ok) throw new Error('Failed to load');
			const result = await response.json();
			attachments = result.data || [];
		} catch {
			// silent - will show empty state
		} finally {
			isLoading = false;
		}
	}

	async function handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		isUploading = true;
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('transaction_id', transactionId);

			const response = await fetch('/api/bank/attachments', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.error || 'Upload failed');
			}

			toast.success('File uploaded');
			await loadAttachments();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Upload failed');
		} finally {
			isUploading = false;
			input.value = '';
		}
	}

	async function handleDelete(attachment: BankTransactionAttachment) {
		try {
			const response = await fetch(`/api/bank/attachments?id=${attachment.id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error('Delete failed');
			toast.success('Attachment removed');
			await loadAttachments();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Delete failed');
		}
	}

	async function handleDownload(attachment: BankTransactionAttachment) {
		try {
			const { data } = await supabase.storage
				.from('pxp-finance')
				.createSignedUrl(attachment.storage_path, 60);

			if (data?.signedUrl) {
				window.open(data.signedUrl, '_blank');
			}
		} catch {
			toast.error('Failed to download file');
		}
	}

	$effect(() => {
		if (transactionId) loadAttachments();
	});
</script>

<div class="space-y-2">
	<div class="flex items-center gap-2">
		<Paperclip class="h-4 w-4 text-slate-400" />
		<span class="text-sm font-medium text-slate-300">Attachments ({attachments.length})</span>
	</div>

	{#if isLoading}
		<div class="flex items-center gap-2 py-2">
			<Loader2 class="h-4 w-4 animate-spin text-slate-500" />
			<span class="text-xs text-slate-500">Loading...</span>
		</div>
	{:else}
		{#if attachments.length > 0}
			<div class="space-y-1">
				{#each attachments as att (att.id)}
					{@const Icon = getFileIcon(att.file_type)}
					<div class="flex items-center gap-2 bg-slate-800/50 px-2 py-1.5 text-xs">
						<Icon class="h-3.5 w-3.5 shrink-0 text-slate-400" />
						<span class="flex-1 truncate text-slate-300">{att.file_name}</span>
						{#if att.file_size}
							<span class="text-slate-500">{formatFileSize(att.file_size)}</span>
						{/if}
						<button onclick={() => handleDownload(att)} class="p-0.5 text-slate-400 hover:text-slate-200" aria-label="Download">
							<Download class="h-3.5 w-3.5" />
						</button>
						{#if !readOnly}
							<button onclick={() => handleDelete(att)} class="p-0.5 text-red-400 hover:text-red-300" aria-label="Delete">
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if !readOnly}
			<label class="flex cursor-pointer items-center gap-2 border border-dashed border-slate-600 px-3 py-2 text-xs text-slate-400 transition-colors hover:border-accent-primary/50 hover:text-slate-300 {isUploading ? 'pointer-events-none opacity-50' : ''}">
				{#if isUploading}
					<Loader2 class="h-3.5 w-3.5 animate-spin" /> Uploading...
				{:else}
					<Paperclip class="h-3.5 w-3.5" /> Add receipt or document
				{/if}
				<input type="file" class="hidden" onchange={handleFileUpload} disabled={isUploading} />
			</label>
		{/if}
	{/if}
</div>
