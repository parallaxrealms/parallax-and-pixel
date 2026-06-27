<script lang="ts">
	import type { SupabaseClient, User } from '@supabase/supabase-js';
	import { Button } from '@parallaxrealms/pxp-components';
	import { Input } from '@parallaxrealms/pxp-components/shadcn/input';
	import { Label } from '@parallaxrealms/pxp-components/shadcn/label';
	import { Checkbox } from '@parallaxrealms/pxp-components/shadcn/checkbox';
	import * as Dialog from '@parallaxrealms/pxp-components/shadcn/dialog';
	import MediaPickerDialog from '$lib/editor/components/MediaPickerDialog.svelte';
	import DiamondSpinner from '$lib/components/custom/loader/DiamondSpinner.svelte';
	import { Loader2 } from 'lucide-svelte';
	import {
		PLATFORM_CONFIGS,
		type SocialPlatform,
		type SocialIntegrationClient,
		type SocialPost,
		type ScheduledSocialPost
	} from '$lib/types/social';


	interface Props {
		supabase: SupabaseClient;
		siteId: string;
	}

	let { supabase, siteId }: Props = $props();

	// Sub-section navigation
	type Section = 'compose' | 'integrations' | 'history';
	let activeSection = $state<Section>('compose');

	// ─── Shared state ───
	let integrations = $state<SocialIntegrationClient[]>([]);
	let integrationsLoaded = $state(false);
	let integrationsLoading = $state(false);

	// ─── Compose state ───
	let postContent = $state('');
	let selectedPlatforms = $state<Set<SocialPlatform>>(new Set());
	let selectedImages = $state<string[]>([]);
	let posting = $state(false);
	let postResults = $state<{ platform: string; display_name: string; success: boolean; error?: string }[]>([]);
	let selectedImageUrl = $state('');
	let mediaPickerOpen = $state(false);

	// ─── Schedule state ───
	let scheduleMode = $state(false);
	let scheduledAt = $state('');
	let scheduling = $state(false);
	let scheduledPosts = $state<ScheduledSocialPost[]>([]);

	// ─── Integration config dialog ───
	let showConfigDialog = $state(false);
	let configPlatform = $state<SocialPlatform>('discord');
	let configDisplayName = $state('');
	let configSaving = $state(false);
	// Discord fields
	let discordWebhookUrl = $state('');
	// Bluesky fields
	let blueskyIdentifier = $state('');
	let blueskyAppPassword = $state('');

	// ─── History state ───
	let historyPosts = $state<SocialPost[]>([]);
	let historyLoading = $state(false);
	let historyTotal = $state(0);
	let historyPage = $state(1);
	let historyLimit = 20;
	let historyPlatformFilter = $state('');
	let historyStatusFilter = $state('');

	// ─── Derived ───
	let enabledIntegrations = $derived(integrations.filter((i) => i.is_enabled && i.has_credentials));
	let enabledPlatforms = $derived([...new Set(enabledIntegrations.map((i) => i.platform))]);

	let charLimit = $derived(() => {
		if (selectedPlatforms.size === 0) return Infinity;
		return Math.min(
			...Array.from(selectedPlatforms).map((p) => PLATFORM_CONFIGS[p].maxChars)
		);
	});

	let charsRemaining = $derived(charLimit() - postContent.length);

	// Get user session for MediaSelector
	let user = $state<User | null>(null);
	$effect(() => {
		supabase.auth.getUser().then(({ data }) => {
			user = data.user;
		});
	});

	// Watch for image selection from MediaSelector
	$effect(() => {
		if (selectedImageUrl) {
			if (!selectedImages.includes(selectedImageUrl)) {
				selectedImages = [...selectedImages, selectedImageUrl];
			}
			selectedImageUrl = '';
		}
	});

	// Load integrations on mount
	$effect(() => {
		if (!integrationsLoaded) {
			loadIntegrations();
		}
	});

	async function loadIntegrations() {
		integrationsLoading = true;
		try {
			const res = await fetch('/api/social/integrations');
			if (!res.ok) throw new Error('Failed to load integrations');
			const data = await res.json();
			integrations = data.integrations;
		} catch (e) {
			console.error('Error loading integrations:', e);
		} finally {
			integrationsLoading = false;
			integrationsLoaded = true;
		}
	}

	// ─── Compose functions ───
	function togglePlatform(platform: SocialPlatform) {
		const next = new Set(selectedPlatforms);
		if (next.has(platform)) {
			next.delete(platform);
		} else {
			next.add(platform);
		}
		selectedPlatforms = next;
	}

	function removeImage(index: number) {
		selectedImages = selectedImages.filter((_, i) => i !== index);
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
					image_urls: selectedImages.length > 0 ? selectedImages : undefined
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
					image_urls: selectedImages.length > 0 ? selectedImages : undefined,
					scheduled_at: new Date(scheduledAt).toISOString()
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || 'Failed to schedule post');
			}

			postResults = [{
				platform: 'system',
				display_name: 'Scheduler',
				success: true,
				error: undefined
			}];
			await loadScheduledPosts();
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

	async function loadScheduledPosts() {
		try {
			const res = await fetch('/api/social/schedule');
			if (!res.ok) return;
			const data = await res.json();
			scheduledPosts = data.posts;
		} catch {
			// silent
		}
	}

	async function cancelScheduledPost(id: string) {
		if (!confirm('Cancel this scheduled post?')) return;
		try {
			await fetch(`/api/social/schedule?id=${id}`, { method: 'DELETE' });
			await loadScheduledPosts();
		} catch (e) {
			console.error('Error cancelling scheduled post:', e);
		}
	}

	// Load scheduled posts when compose section is active
	$effect(() => {
		if (activeSection === 'compose') {
			loadScheduledPosts();
		}
	});

	// ─── Integration config functions ───
	function openConfig(platform: SocialPlatform) {
		configPlatform = platform;
		const existing = integrations.find((i) => i.platform === platform);
		configDisplayName = existing?.display_name || PLATFORM_CONFIGS[platform].name;
		discordWebhookUrl = '';
		blueskyIdentifier = '';
		blueskyAppPassword = '';
		showConfigDialog = true;
	}

	async function saveIntegration() {
		configSaving = true;
		try {
			let credentials: Record<string, string> = {};

			if (configPlatform === 'discord') {
				credentials = { webhook_url: discordWebhookUrl };
			} else if (configPlatform === 'bluesky') {
				credentials = { identifier: blueskyIdentifier, app_password: blueskyAppPassword };
			}

			const res = await fetch('/api/social/integrations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					platform: configPlatform,
					display_name: configDisplayName,
					credentials,
					is_enabled: true
				})
			});

			if (!res.ok) throw new Error('Failed to save integration');

			await loadIntegrations();
			showConfigDialog = false;
		} catch (e) {
			console.error('Error saving integration:', e);
			alert('Failed to save integration');
		} finally {
			configSaving = false;
		}
	}

	async function toggleIntegration(integration: SocialIntegrationClient) {
		try {
			await fetch('/api/social/integrations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					platform: integration.platform,
					display_name: integration.display_name,
					is_enabled: !integration.is_enabled
				})
			});
			await loadIntegrations();
		} catch (e) {
			console.error('Error toggling integration:', e);
		}
	}

	async function deleteIntegration(id: string) {
		if (!confirm('Remove this integration? Credentials will be deleted.')) return;
		try {
			await fetch(`/api/social/integrations?id=${id}`, { method: 'DELETE' });
			await loadIntegrations();
		} catch (e) {
			console.error('Error deleting integration:', e);
		}
	}

	// ─── History functions ───
	async function loadHistory() {
		historyLoading = true;
		try {
			const params = new URLSearchParams({
				page: historyPage.toString(),
				limit: historyLimit.toString()
			});
			if (historyPlatformFilter) params.set('platform', historyPlatformFilter);
			if (historyStatusFilter) params.set('status', historyStatusFilter);

			const res = await fetch(`/api/social/history?${params}`);
			if (!res.ok) throw new Error('Failed to load history');
			const data = await res.json();
			historyPosts = data.posts;
			historyTotal = data.total;
		} catch (e) {
			console.error('Error loading history:', e);
		} finally {
			historyLoading = false;
		}
	}

	// Load history when switching to history tab or changing filters
	$effect(() => {
		if (activeSection === 'history') {
			// Trigger on filter/page changes
			historyPlatformFilter;
			historyStatusFilter;
			historyPage;
			loadHistory();
		}
	});

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleString();
	}

	function truncate(str: string, len: number) {
		return str.length > len ? str.slice(0, len) + '...' : str;
	}
</script>

<div class="social-tab">
	<!-- Header -->
	<div class="header-section">
		<h1 class="text-2xl font-bold text-white">
			<span class="text-accent-primary">Social</span> &amp; Sharing
		</h1>
		<p class="mt-0.5 text-sm text-slate-400">Post to social media platforms.</p>
	</div>

	<!-- Sub-nav -->
	<div class="sub-nav">
		<button
			class="sub-nav-btn"
			class:active={activeSection === 'compose'}
			onclick={() => (activeSection = 'compose')}
		>
			Compose
		</button>
		<button
			class="sub-nav-btn"
			class:active={activeSection === 'integrations'}
			onclick={() => (activeSection = 'integrations')}
		>
			Integrations
		</button>
		<button
			class="sub-nav-btn"
			class:active={activeSection === 'history'}
			onclick={() => (activeSection = 'history')}
		>
			History
		</button>
	</div>

	{#if integrationsLoading && !integrationsLoaded}
		<div class="loading-container">
			<DiamondSpinner size="lg" text="Loading..." />
		</div>
	{:else if activeSection === 'compose'}
		<!-- ═══ COMPOSE SECTION ═══ -->
		<div class="compose-section">
			<div class="section-card">
				<div class="section-header">
					<h2 class="text-lg text-accent-primary">Compose Post</h2>
				</div>

				<!-- Platform selection -->
				<div class="platform-select">
					<Label class="">Platforms</Label>
					<div class="platform-chips">
						{#each enabledPlatforms as platform}
							{@const config = PLATFORM_CONFIGS[platform]}
							<button
								class="platform-chip"
								class:selected={selectedPlatforms.has(platform)}
								onclick={() => togglePlatform(platform)}
								style="--platform-color: {config.color}"
							>
								<span class="platform-dot" style="background-color: {config.color}"></span>
								{config.name}
							</button>
						{/each}
						{#if enabledPlatforms.length === 0}
							<p class="text-sm text-slate-500">
								No platforms configured. Go to Integrations to set up.
							</p>
						{/if}
					</div>
				</div>

				<!-- Content textarea -->
				<div class="compose-area">
					<Label class="">Content</Label>
					<textarea
						class="compose-textarea"
						bind:value={postContent}
						placeholder="What's on your mind?"
						rows={5}
					></textarea>
					<div class="char-count" class:over={charsRemaining < 0}>
						{#if charLimit() < Infinity}
							{postContent.length} / {charLimit()}
							{#if charsRemaining < 0}
								<span class="text-red-400">({Math.abs(charsRemaining)} over)</span>
							{/if}
						{:else}
							{postContent.length} chars
						{/if}
					</div>
				</div>

				<!-- Image picker -->
				<div class="image-section">
					<Label class="">Images (optional)</Label>
					{#if user}
						<div class="media-selector-row">
							<Button
								type="button"
								variant="outlined"
								onclick={() => (mediaPickerOpen = true)}
							>
								Browse media library
							</Button>
							<MediaPickerDialog
								bind:open={mediaPickerOpen}
								onSelect={(url) => (selectedImageUrl = url)}
								{supabase}
								{user}
								{siteId}
								mediaTable="media_assets"
								mediaBucket="media_library"
							/>
						</div>
					{/if}
					{#if selectedImages.length > 0}
						<div class="image-previews">
							{#each selectedImages as url, i}
								<div class="image-preview">
									<img src={url} alt="Selected {i + 1}" />
									<button class="remove-img-btn" onclick={() => removeImage(i)} title="Remove">x</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Schedule toggle -->
				<div class="schedule-section">
					<label class="schedule-toggle">
						<input type="checkbox" bind:checked={scheduleMode} />
						<span>Schedule for later</span>
					</label>
					{#if scheduleMode}
						<input
							type="datetime-local"
							class="schedule-datetime"
							bind:value={scheduledAt}
							min={new Date().toISOString().slice(0, 16)}
						/>
						{#if scheduledAt}
							<p class="text-xs text-slate-500">Will post at {new Date(scheduledAt).toLocaleString()}</p>
						{/if}
					{/if}
				</div>

				<!-- Send / Schedule button -->
				<div class="compose-actions">
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
								Schedule Post
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
								Posting...
							{:else}
								Send Post
							{/if}
						</Button>
					{/if}
				</div>

				<!-- Results -->
				{#if postResults.length > 0}
					<div class="post-results">
						{#each postResults as result}
							<div class="result-row" class:success={result.success} class:fail={!result.success}>
								<span class="result-platform">{result.display_name}</span>
								<span class="result-status">
									{result.success ? 'Sent' : 'Failed'}
								</span>
								{#if result.error}
									<span class="result-error text-xs">{result.error}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Scheduled posts queue -->
				{#if scheduledPosts.length > 0}
					<div class="scheduled-queue">
						<h3 class="text-sm text-accent-secondary">Scheduled Posts</h3>
						{#each scheduledPosts as post}
							<div class="scheduled-item">
								<div class="scheduled-item-info">
									<span class="text-sm">{post.content.length > 60 ? post.content.slice(0, 60) + '...' : post.content}</span>
									<span class="text-xs text-slate-500">{new Date(post.scheduled_at).toLocaleString()}</span>
									<div class="scheduled-platforms">
										{#each post.platforms as platform}
											{@const config = PLATFORM_CONFIGS[platform]}
											<span class="platform-dot" style="background-color: {config?.color || '#666'}" title={config?.name || platform}></span>
										{/each}
									</div>
								</div>
								<button
									class="action-btn delete text-xs"
									onclick={() => cancelScheduledPost(post.id)}
								>
									Cancel
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

	{:else if activeSection === 'integrations'}
		<!-- ═══ INTEGRATIONS SECTION ═══ -->
		<div class="integrations-section">
			<div class="platform-grid">
				{#each Object.entries(PLATFORM_CONFIGS) as [platform, config]}
					{@const integration = integrations.find((i) => i.platform === platform)}
					<div class="platform-card section-card">
						<div class="platform-card-header">
							<span class="platform-dot-lg" style="background-color: {config.color}"></span>
							<h3 class="text-lg text-white">{config.name}</h3>
						</div>

						<div class="platform-card-body">
							{#if config.requiresOAuth && !integration}
								<p class="text-sm text-slate-500">Not connected</p>
								{#if platform === 'instagram' || platform === 'facebook'}
									<a
										href="/api/social/oauth/meta?platform={platform}"
										class="add-btn"
									>
										Connect with Meta
									</a>
								{:else if platform === 'tiktok'}
									<a
										href="/api/social/oauth/tiktok"
										class="add-btn"
									>
										Connect TikTok
									</a>
								{/if}
								<p class="text-xs text-slate-600 mt-1">
									Requires {config.name} developer app registration
								</p>
							{:else if integration}
								<div class="integration-status">
									<span class="status-badge status-published">Connected</span>
									<span class="text-xs text-slate-500">{integration.display_name}</span>
								</div>
								{#if integration.oauth_expires_at}
									<span class="text-xs text-slate-600">
										Token expires {new Date(integration.oauth_expires_at).toLocaleDateString()}
									</span>
								{/if}
								<div class="integration-actions">
									{#if config.requiresOAuth}
										{#if platform === 'instagram' || platform === 'facebook'}
											<a href="/api/social/oauth/meta?platform={platform}" class="action-btn edit text-xs">
												Reconnect
											</a>
										{:else if platform === 'tiktok'}
											<a href="/api/social/oauth/tiktok" class="action-btn edit text-xs">
												Reconnect
											</a>
										{/if}
									{:else}
										<button
											class="action-btn edit text-xs"
											onclick={() => openConfig(platform as SocialPlatform)}
										>
											Update
										</button>
									{/if}
									<button
										class="action-btn text-xs"
										class:settings={integration.is_enabled}
										class:delete={!integration.is_enabled}
										onclick={() => toggleIntegration(integration)}
									>
										{integration.is_enabled ? 'Enabled' : 'Disabled'}
									</button>
									<button
										class="action-btn delete text-xs"
										onclick={() => deleteIntegration(integration.id)}
									>
										Del
									</button>
								</div>
							{:else}
								<p class="text-sm text-slate-500">Not connected</p>
								<button
									class="add-btn"
									onclick={() => openConfig(platform as SocialPlatform)}
								>
									Configure
								</button>
							{/if}
						</div>

						<div class="platform-card-footer text-xs text-slate-600">
							Max {config.maxChars} chars
							{config.supportsImages ? ' | Images' : ''}
						</div>
					</div>
				{/each}
			</div>
		</div>

	{:else if activeSection === 'history'}
		<!-- ═══ HISTORY SECTION ═══ -->
		<div class="history-section">
			<div class="section-card">
				<div class="section-header">
					<h2 class="text-lg text-accent-primary">Post History</h2>
					<div class="history-filters">
						<select class="filter-select" bind:value={historyPlatformFilter} onchange={() => { historyPage = 1; }}>
							<option value="">All Platforms</option>
							{#each Object.entries(PLATFORM_CONFIGS) as [key, cfg]}
								<option value={key}>{cfg.name}</option>
							{/each}
						</select>
						<select class="filter-select" bind:value={historyStatusFilter} onchange={() => { historyPage = 1; }}>
							<option value="">All Status</option>
							<option value="success">Success</option>
							<option value="failed">Failed</option>
							<option value="partial">Partial</option>
							<option value="scheduled">Scheduled</option>
						</select>
					</div>
				</div>

				{#if historyLoading}
					<div class="loading-container">
						<DiamondSpinner size="sm" text="Loading..." />
					</div>
				{:else if historyPosts.length === 0}
					<div class="empty-state">
						<p class="text-lg text-slate-500">No posts yet</p>
					</div>
				{:else}
					<div class="history-list">
						{#each historyPosts as post}
							{@const config = PLATFORM_CONFIGS[post.platform]}
							<div class="history-item">
								<div class="history-item-left">
									<span class="platform-dot" style="background-color: {config?.color || '#666'}"></span>
									<span class="text-xs text-slate-400">{config?.name || post.platform}</span>
								</div>
								<div class="history-item-content">
									<span class="text-sm">{truncate(post.content, 80)}</span>
								</div>
								<div class="history-item-right">
									<span
										class="status-badge"
										class:status-published={post.status === 'success'}
										class:status-draft={post.status === 'partial'}
										class:status-failed={post.status === 'failed'}
									>
										{post.status}
									</span>
									<span class="text-xs text-slate-600">{formatDate(post.posted_at)}</span>
								</div>
							</div>
						{/each}
					</div>

					<!-- Pagination -->
					{#if historyTotal > historyLimit}
						<div class="pagination">
							<button
								class="action-btn text-xs"
								disabled={historyPage <= 1}
								onclick={() => (historyPage = historyPage - 1)}
							>
								Prev
							</button>
							<span class="text-xs text-slate-500">
								Page {historyPage} of {Math.ceil(historyTotal / historyLimit)}
							</span>
							<button
								class="action-btn text-xs"
								disabled={historyPage >= Math.ceil(historyTotal / historyLimit)}
								onclick={() => (historyPage = historyPage + 1)}
							>
								Next
							</button>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Integration Config Dialog -->
<Dialog.Root bind:open={showConfigDialog}>
	<Dialog.Content class="dialog-content">
		<Dialog.Header>
			<Dialog.Title class="font-rubik" style="color: {PLATFORM_CONFIGS[configPlatform]?.color}">
				Configure {PLATFORM_CONFIGS[configPlatform]?.name}
			</Dialog.Title>
			<Dialog.Description class="">
				Enter your {PLATFORM_CONFIGS[configPlatform]?.name} credentials
			</Dialog.Description>
		</Dialog.Header>
		<div class="dialog-body">
			<div class="form-group">
				<Label for="config-display-name" class="">Display Name</Label>
				<Input id="config-display-name" bind:value={configDisplayName} class="cyber-input" />
			</div>

			{#if configPlatform === 'discord'}
				<div class="form-group">
					<Label for="discord-webhook" class="">Webhook URL</Label>
					<Input
						id="discord-webhook"
						type="url"
						placeholder="https://discord.com/api/webhooks/..."
						bind:value={discordWebhookUrl}
						class="cyber-input"
					/>
					<p class="text-xs text-slate-500 mt-1">
						Server Settings > Integrations > Webhooks > New Webhook > Copy URL
					</p>
				</div>
			{:else if configPlatform === 'bluesky'}
				<div class="form-group">
					<Label for="bsky-identifier" class="">Handle or Email</Label>
					<Input
						id="bsky-identifier"
						placeholder="you.bsky.social"
						bind:value={blueskyIdentifier}
						class="cyber-input"
					/>
				</div>
				<div class="form-group">
					<Label for="bsky-password" class="">App Password</Label>
					<Input
						id="bsky-password"
						type="password"
						placeholder="xxxx-xxxx-xxxx-xxxx"
						bind:value={blueskyAppPassword}
						class="cyber-input"
					/>
					<p class="text-xs text-slate-500 mt-1">
						Settings > Privacy and Security > App Passwords > Add App Password
					</p>
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button
				variant="outlined"
				onclick={() => (showConfigDialog = false)}
				class="rounded-none border border-slate-700 bg-slate-800 text-slate-300 hover:text-accent-primary"
			>
				Cancel
			</Button>
			<Button
				onclick={saveIntegration}
				disabled={configSaving}
				class="primary-btn"
			>
				{#if configSaving}
					<Loader2 class="h-4 w-4 mr-2 animate-spin" />
					Saving...
				{:else}
					Save
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.social-tab {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 1152px;
		margin: 0 auto;
	}

	.header-section {
		padding: 0.25rem 0 0.5rem;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 4rem;
	}

	/* Sub Navigation */
	.sub-nav {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid #1e293b;
		padding-bottom: 0;
		overflow-x: auto;
	}

	.sub-nav-btn {
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid transparent;
		border-bottom: 2px solid transparent;
		color: #94a3b8;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.sub-nav-btn:hover {
		color: var(--accent-primary);
	}

	.sub-nav-btn.active {
		color: var(--accent-primary);
		border-bottom-color: var(--accent-primary);
	}

	/* Section Card */
	.section-card {
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid #1e293b;
		padding: 1rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #1e293b;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	/* ═══ COMPOSE ═══ */
	.compose-section {
		max-width: 700px;
		margin: 0 auto;
		width: 100%;
	}

	.platform-select {
		margin-bottom: 1rem;
	}

	.platform-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.platform-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		background: #0f172a;
		border: 1px solid #334155;
		color: #cbd5e1;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.8125rem;
	}

	.platform-chip:hover {
		border-color: var(--platform-color);
	}

	.platform-chip.selected {
		border-color: var(--platform-color);
		background: color-mix(in srgb, var(--platform-color) 15%, transparent);
		color: #ffffff;
	}

	.platform-dot {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
	}

	.platform-dot-lg {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
	}

	.compose-area {
		margin-bottom: 1rem;
	}

	.compose-textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: #0f172a;
		border: 1px solid #334155;
		font-family: 'Space Mono', monospace;
		font-size: 0.875rem;
		color: #ffffff;
		resize: vertical;
		margin-top: 0.5rem;
	}

	.compose-textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.char-count {
		text-align: right;
		font-size: 0.75rem;
		color: #94a3b8;
		margin-top: 0.25rem;
	}

	.char-count.over {
		color: #f87171;
	}

	.image-section {
		margin-bottom: 1rem;
	}

	.media-selector-row {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.image-previews {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	.image-preview {
		position: relative;
		width: 80px;
		height: 80px;
		border: 1px solid #334155;
		overflow: hidden;
	}

	.image-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-img-btn {
		position: absolute;
		top: 0;
		right: 0;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(2, 6, 23, 0.8);
		color: #f87171;
		border: none;
		cursor: pointer;
		font-size: 0.625rem;
		line-height: 1;
	}

	.compose-actions {
		margin-bottom: 1rem;
	}

	.post-results {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.result-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		flex-wrap: wrap;
	}

	.result-row.success {
		background: rgba(0, 165, 207, 0.1);
		border: 1px solid rgba(0, 165, 207, 0.3);
	}

	.result-row.fail {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.result-platform {
		font-size: 0.8125rem;
		color: #ffffff;
	}

	.result-status {
		font-size: 0.75rem;
	}

	.result-row.success .result-status {
		color: var(--accent-primary);
	}

	.result-row.fail .result-status {
		color: #f87171;
	}

	.result-error {
		color: #f87171;
		flex-basis: 100%;
	}

	/* ═══ INTEGRATIONS ═══ */
	.platform-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.platform-grid {
			grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		}
	}

	.platform-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.platform-card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.platform-card-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	.integration-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.integration-actions {
		display: flex;
		gap: 0.25rem;
	}

	.platform-card-footer {
		border-top: 1px solid #1e293b;
		padding-top: 0.5rem;
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		background: var(--accent-primary);
		color: #020617;
		border: none;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.8125rem;
	}

	.add-btn:hover {
		opacity: 0.9;
	}

	/* ═══ HISTORY ═══ */
	.history-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.filter-select {
		padding: 0.375rem 0.5rem;
		background: #0f172a;
		border: 1px solid #334155;
		color: #cbd5e1;
		font-size: 0.75rem;
	}

	.filter-select:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		background: #020617;
		border: 1px solid #1e293b;
		transition: border-color 0.2s;
	}

	.history-item:hover {
		border-color: var(--accent-primary);
	}

	.history-item-left {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 90px;
	}

	.history-item-content {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: #cbd5e1;
	}

	.history-item-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 1rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
	}

	/* Status badges */
	.status-badge {
		padding: 0.125rem 0.5rem;
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-published {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}

	.status-draft {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
	}

	.status-failed {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
	}

	/* Action buttons */
	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.625rem;
		background: #1e293b;
		border: 1px solid #334155;
		color: #cbd5e1;
		cursor: pointer;
		transition: all 0.2s;
	}

	.action-btn:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.action-btn.edit {
		color: var(--accent-primary);
	}

	.action-btn.edit:hover {
		background: rgba(0, 165, 207, 0.1);
		border-color: var(--accent-primary);
	}

	.action-btn.settings {
		color: #34d399;
	}

	.action-btn.settings:hover {
		background: rgba(16, 185, 129, 0.1);
		border-color: #34d399;
	}

	.action-btn.delete {
		color: #f87171;
	}

	.action-btn.delete:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: #f87171;
	}

	/* Dialog styles */
	.dialog-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 0;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	:global(.dialog-content) {
		background: #0f172a !important;
		border: 1px solid #334155 !important;
		border-radius: 0 !important;
		max-height: 90vh;
		overflow-y: auto;
	}

	:global(.cyber-input) {
		background: #0f172a !important;
		border-color: #334155 !important;
		border-radius: 0 !important;
		color: #ffffff !important;
	}

	:global(.cyber-input:focus) {
		border-color: var(--accent-primary) !important;
	}

	/* ═══ SCHEDULE ═══ */
	.schedule-section {
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.schedule-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.8125rem;
		color: #cbd5e1;
	}

	.schedule-toggle input[type="checkbox"] {
		accent-color: var(--accent-primary);
	}

	.schedule-datetime {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: #0f172a;
		border: 1px solid #334155;
		font-family: 'Space Mono', monospace;
		font-size: 0.8125rem;
		color: #ffffff;
	}

	.schedule-datetime:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.scheduled-queue {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #1e293b;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.scheduled-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(0, 165, 207, 0.05);
		border: 1px solid rgba(0, 165, 207, 0.2);
	}

	.scheduled-item-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.scheduled-platforms {
		display: flex;
		gap: 0.25rem;
	}

	:global(.primary-btn) {
		background: var(--accent-primary) !important;
		color: #020617 !important;
		border-radius: 0 !important;
		font-weight: 500 !important;
	}

	:global(.primary-btn:hover) {
		opacity: 0.9;
	}
</style>
