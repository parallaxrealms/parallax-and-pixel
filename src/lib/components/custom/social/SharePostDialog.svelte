<script lang="ts">
	import { Button } from '@parallaxrealms/components-core';
	import { Input } from '@parallaxrealms/components-core/shadcn/input';
	import { Label } from '@parallaxrealms/components-core/shadcn/label';
	import * as Dialog from '@parallaxrealms/components-core/shadcn/dialog';
	import { Loader2 } from 'lucide-svelte';
	import {
		PLATFORM_CONFIGS,
		type SocialPlatform,
		type SocialIntegrationClient
	} from '$lib/types/social';

	interface Props {
		open: boolean;
		title: string;
		slug: string;
		metaDescription: string;
		pageId?: string;
		onClose?: () => void;
	}

	let { open = $bindable(), title, slug, metaDescription, pageId, onClose }: Props = $props();

	let integrations = $state<SocialIntegrationClient[]>([]);
	let loading = $state(false);
	let posting = $state(false);
	let postContent = $state('');
	let selectedPlatforms = $state<Set<SocialPlatform>>(new Set());
	let postResults = $state<{ platform: string; display_name: string; success: boolean; error?: string }[]>([]);
	let scheduleMode = $state(false);
	let scheduledAt = $state('');
	let scheduling = $state(false);

	let enabledIntegrations = $derived(integrations.filter((i) => i.is_enabled && i.has_credentials));
	let enabledPlatforms = $derived([...new Set(enabledIntegrations.map((i) => i.platform))]);

	let charLimit = $derived(() => {
		if (selectedPlatforms.size === 0) return Infinity;
		return Math.min(
			...Array.from(selectedPlatforms).map((p) => PLATFORM_CONFIGS[p].maxChars)
		);
	});

	let charsRemaining = $derived(charLimit() - postContent.length);

	// When dialog opens, pre-fill content and load integrations
	$effect(() => {
		if (open) {
			const blogUrl = `https://parallaxandpixel.com/blog/${slug}`;
			postContent = `${title}\n\n${metaDescription || ''}\n\n${blogUrl}`.trim();
			postResults = [];
			selectedPlatforms = new Set();
			scheduleMode = false;
			scheduledAt = '';
			loadIntegrations();
		}
	});

	async function loadIntegrations() {
		loading = true;
		try {
			const res = await fetch('/api/social/integrations');
			if (!res.ok) throw new Error('Failed to load');
			const data = await res.json();
			integrations = data.integrations;

			// Auto-select all enabled platforms
			selectedPlatforms = new Set(
				integrations
					.filter((i) => i.is_enabled && i.has_credentials)
					.map((i) => i.platform)
			);
		} catch (e) {
			console.error('Error loading integrations:', e);
		} finally {
			loading = false;
		}
	}

	function togglePlatform(platform: SocialPlatform) {
		const next = new Set(selectedPlatforms);
		if (next.has(platform)) {
			next.delete(platform);
		} else {
			next.add(platform);
		}
		selectedPlatforms = next;
	}

	async function sendPost() {
		if (!postContent.trim() || selectedPlatforms.size === 0) return;

		posting = true;
		postResults = [];

		try {
			const res = await fetch('/api/social/post', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: postContent,
					platforms: Array.from(selectedPlatforms),
					link_url: `https://parallaxandpixel.com/blog/${slug}`,
					link_title: title,
					page_id: pageId || undefined,
					page_slug: slug
				})
			});

			const data = await res.json();
			postResults = data.results || [];
		} catch (e) {
			postResults = [
				{
					platform: 'error',
					display_name: 'System',
					success: false,
					error: e instanceof Error ? e.message : 'Unexpected error'
				}
			];
		} finally {
			posting = false;
		}
	}

	async function schedulePost() {
		if (!postContent.trim() || selectedPlatforms.size === 0 || !scheduledAt) return;

		scheduling = true;
		postResults = [];

		try {
			const res = await fetch('/api/social/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: postContent,
					platforms: Array.from(selectedPlatforms),
					link_url: `https://parallaxandpixel.com/blog/${slug}`,
					link_title: title,
					page_id: pageId || undefined,
					page_slug: slug,
					scheduled_at: new Date(scheduledAt).toISOString()
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Failed to schedule');
			}

			postResults = [{
				platform: 'system',
				display_name: 'Scheduler',
				success: true,
				error: undefined
			}];
		} catch (e) {
			postResults = [{
				platform: 'error',
				display_name: 'System',
				success: false,
				error: e instanceof Error ? e.message : 'Unexpected error'
			}];
		} finally {
			scheduling = false;
		}
	}

	function handleClose() {
		open = false;
		onClose?.();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="share-dialog-content">
		<Dialog.Header>
			<Dialog.Title class="font-rubik text-accent-primary">Share Post</Dialog.Title>
			<Dialog.Description class="font-terminal">
				Share "{title}" to social media
			</Dialog.Description>
		</Dialog.Header>

		{#if loading}
			<div class="share-loading">
				<Loader2 class="h-5 w-5 animate-spin text-accent-primary" />
				<span class="font-terminal text-sm text-slate-400">Loading platforms...</span>
			</div>
		{:else}
			<div class="share-body">
				<!-- Platform selection -->
				<div class="share-platforms">
					<Label class="font-terminal">Platforms</Label>
					<div class="share-platform-chips">
						{#each enabledPlatforms as platform}
							{@const config = PLATFORM_CONFIGS[platform]}
							<button
								class="share-chip font-terminal"
								class:selected={selectedPlatforms.has(platform)}
								onclick={() => togglePlatform(platform)}
								style="--platform-color: {config.color}"
							>
								<span class="share-dot" style="background-color: {config.color}"></span>
								{config.name}
							</button>
						{/each}
						{#if enabledPlatforms.length === 0}
							<p class="font-terminal text-sm text-slate-500">
								No platforms configured. Set up integrations in Dashboard > Social.
							</p>
						{/if}
					</div>
				</div>

				<!-- Content -->
				<div class="share-content-area">
					<Label class="font-terminal">Content</Label>
					<textarea
						class="share-textarea"
						bind:value={postContent}
						rows={6}
					></textarea>
					<div class="share-char-count font-terminal" class:over={charsRemaining < 0}>
						{#if charLimit() < Infinity}
							{postContent.length} / {charLimit()}
						{:else}
							{postContent.length} chars
						{/if}
					</div>
				</div>

				<!-- Schedule toggle -->
				<div class="share-schedule">
					<label class="share-schedule-toggle font-terminal">
						<input type="checkbox" bind:checked={scheduleMode} />
						<span>Schedule for later</span>
					</label>
					{#if scheduleMode}
						<input
							type="datetime-local"
							class="share-schedule-datetime"
							bind:value={scheduledAt}
							min={new Date().toISOString().slice(0, 16)}
						/>
					{/if}
				</div>

				<!-- Results -->
				{#if postResults.length > 0}
					<div class="share-results">
						{#each postResults as result}
							<div class="share-result" class:success={result.success} class:fail={!result.success}>
								<span class="font-terminal text-sm">{result.display_name}</span>
								<span class="font-terminal text-xs">
									{result.success ? 'Sent' : 'Failed'}
								</span>
								{#if result.error}
									<span class="font-terminal text-xs share-error">{result.error}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outlined" onclick={handleClose}>
				{postResults.length > 0 ? 'Close' : 'Cancel'}
			</Button>
			{#if postResults.length === 0}
				{#if scheduleMode}
					<Button
						onclick={schedulePost}
						disabled={scheduling || !postContent.trim() || selectedPlatforms.size === 0 || charsRemaining < 0 || !scheduledAt}
						class="primary-btn"
					>
						{#if scheduling}
							<Loader2 class="h-4 w-4 mr-2 animate-spin" />
							Scheduling...
						{:else}
							Schedule
						{/if}
					</Button>
				{:else}
					<Button
						onclick={sendPost}
						disabled={posting || !postContent.trim() || selectedPlatforms.size === 0 || charsRemaining < 0}
						class="primary-btn"
					>
						{#if posting}
							<Loader2 class="h-4 w-4 mr-2 animate-spin" />
							Sharing...
						{:else}
							Share Now
						{/if}
					</Button>
				{/if}
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.share-dialog-content) {
		background: rgba(23, 23, 23, 0.95) !important;
		border: 1px solid #3f3f46 !important;
		backdrop-filter: blur(10px);
		max-width: 520px !important;
	}

	.share-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
	}

	.share-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.5rem 0;
	}

	.share-platforms {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.share-platform-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.share-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3rem 0.625rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #3f3f46;
		border-radius: 0.375rem;
		color: #a3a3a3;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.8125rem;
	}

	.share-chip:hover {
		border-color: var(--platform-color);
	}

	.share-chip.selected {
		border-color: var(--platform-color);
		background: color-mix(in srgb, var(--platform-color) 15%, transparent);
		color: #fafafa;
	}

	.share-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.share-content-area {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.share-textarea {
		width: 100%;
		padding: 0.625rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #3f3f46;
		border-radius: 0.375rem;
		font-family: 'Space Mono', monospace;
		font-size: 0.8125rem;
		color: #fafafa;
		resize: vertical;
	}

	.share-textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.share-char-count {
		text-align: right;
		font-size: 0.6875rem;
		color: #71717a;
	}

	.share-char-count.over {
		color: #ef4444;
	}

	.share-results {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.share-result {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border-radius: 0.375rem;
		flex-wrap: wrap;
	}

	.share-result.success {
		background: rgba(0, 255, 255, 0.08);
		border: 1px solid rgba(0, 255, 255, 0.2);
	}

	.share-result.fail {
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.share-result.success span:nth-child(2) {
		color: var(--accent-primary);
	}

	.share-result.fail span:nth-child(2) {
		color: #ef4444;
	}

	.share-error {
		color: #ef4444;
		flex-basis: 100%;
	}

	.share-schedule {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.share-schedule-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.8125rem;
		color: #a3a3a3;
	}

	.share-schedule-toggle input[type="checkbox"] {
		accent-color: var(--accent-primary);
	}

	.share-schedule-datetime {
		width: 100%;
		padding: 0.5rem 0.625rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #3f3f46;
		border-radius: 0.375rem;
		font-family: 'Space Mono', monospace;
		font-size: 0.8125rem;
		color: #fafafa;
	}

	.share-schedule-datetime:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	:global(.primary-btn) {
		background: var(--accent-primary) !important;
		color: #000 !important;
	}

	:global(.primary-btn:hover) {
		background: var(--accent-highlight) !important;
	}
</style>
