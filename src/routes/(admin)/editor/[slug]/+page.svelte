<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { PUBLIC_SITE_ID } from '$env/static/public';
	import type { Editor } from '@tiptap/core';
	import { Button, ToggleFlip } from '@parallaxrealms/components-core';
	import { Input } from '@parallaxrealms/components-core/shadcn/input';
	import { Label } from '@parallaxrealms/components-core/shadcn/label';
	import { Checkbox } from '@parallaxrealms/components-core/shadcn/checkbox';
	import * as Dialog from '@parallaxrealms/components-core/shadcn/dialog';
	import * as Select from '$lib/components/shadcn/ui/select';
	import { MediaSelector } from '@parallaxrealms/components-ecom';
	import { EdraEditor, EdraToolBar } from '@parallaxrealms/components-edda';
	import { ArrowLeft, Save, Eye, Loader2, ChevronDown } from 'lucide-svelte';

	// Dialog component aliases for MediaSelector
	const MediaDialog = Dialog.Root;
	const MediaDialogContent = Dialog.Content;
	const MediaDialogHeader = Dialog.Header;
	const MediaDialogTitle = Dialog.Title;
	const MediaDialogDescription = Dialog.Description;
	const MediaDialogFooter = Dialog.Footer;

	let { data, form } = $props();

	const siteId = PUBLIC_SITE_ID || 'default';

	let editor = $state<Editor>();
	let title = $state(data.page?.title ?? '');
	let status = $state(data.page?.status ?? 'draft');
	let metaDescription = $state(data.page?.meta_description ?? '');
	let saving = $state(false);
	let sidebarOpen = $state(true);

	// Background options state - initialized from page_options if available
	const pageOptions = (data.page?.page_options ?? {}) as Record<string, unknown>;
	const bgOptions = (pageOptions?.background ?? {}) as Record<string, unknown>;

	// Background type now includes 'gradient'
	let bgType = $state<'none' | 'color' | 'gradient' | 'image'>(
		(bgOptions?.type as 'none' | 'color' | 'gradient' | 'image') ?? 'none'
	);

	// Light/dark mode solid colors
	let bgColorLight = $state((bgOptions?.colorLight as string) ?? '#ffffff');
	let bgColorDark = $state((bgOptions?.colorDark as string) ?? '#1a1a1a');

	// Gradient colors (2 stops, each with light/dark)
	let gradientColor1Light = $state((bgOptions?.gradientColor1Light as string) ?? '#ffffff');
	let gradientColor1Dark = $state((bgOptions?.gradientColor1Dark as string) ?? '#1a1a1a');
	let gradientColor2Light = $state((bgOptions?.gradientColor2Light as string) ?? '#e0e0e0');
	let gradientColor2Dark = $state((bgOptions?.gradientColor2Dark as string) ?? '#333333');
	let gradientDirection = $state((bgOptions?.gradientDirection as string) ?? 'to bottom');

	// Image options
	let bgImageUrl = $state((bgOptions?.imageUrl as string) ?? '');
	let bgSize = $state<'cover' | 'contain' | 'auto'>((bgOptions?.size as 'cover' | 'contain' | 'auto') ?? 'cover');
	let bgPosition = $state((bgOptions?.position as string) ?? 'center center');
	let bgRepeat = $state<'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'>(
		(bgOptions?.repeat as 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y') ?? 'no-repeat'
	);

	// Overlay light/dark
	let overlayEnabled = $state((bgOptions?.overlayEnabled as boolean) ?? false);
	let overlayColorLight = $state((bgOptions?.overlayColorLight as string) ?? '#000000');
	let overlayColorDark = $state((bgOptions?.overlayColorDark as string) ?? '#000000');
	let overlayAlpha = $state((bgOptions?.overlayAlpha as number) ?? 0.5);

	// Page text color light/dark
	let textColorLight = $state((pageOptions?.textColorLight as string) ?? '#111111');
	let textColorDark = $state((pageOptions?.textColorDark as string) ?? '#f5f5f5');

	// For MediaSelector image URL binding
	let selectedBgImageUrl = $state('');
	$effect(() => {
		if (selectedBgImageUrl) {
			bgImageUrl = selectedBgImageUrl;
			selectedBgImageUrl = '';
		}
	});

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	// Derive page styles JSON for hidden form field (background + text color)
	let pageStylesJson = $derived(() => {
		const background = bgType === 'none' ? null : {
			type: bgType,
			colorLight: bgColorLight,
			colorDark: bgColorDark,
			gradientColor1Light,
			gradientColor1Dark,
			gradientColor2Light,
			gradientColor2Dark,
			gradientDirection,
			imageUrl: bgImageUrl,
			size: bgSize,
			position: bgPosition,
			repeat: bgRepeat,
			overlayEnabled,
			overlayColorLight,
			overlayColorDark,
			overlayAlpha
		};

		return JSON.stringify({
			background,
			textColorLight,
			textColorDark
		});
	});

	// Always dark mode
	const isDark = true;

	// Live preview background styles
	let previewBackgroundStyle = $derived(() => {
		if (bgType === 'none') return '';

		const styles: string[] = [];

		if (bgType === 'color') {
			const color = isDark ? bgColorDark : bgColorLight;
			if (color) styles.push(`background-color: ${color}`);
		} else if (bgType === 'gradient') {
			const c1 = isDark ? gradientColor1Dark : gradientColor1Light;
			const c2 = isDark ? gradientColor2Dark : gradientColor2Light;
			styles.push(`background: linear-gradient(${gradientDirection}, ${c1}, ${c2})`);
		} else if (bgType === 'image' && bgImageUrl) {
			styles.push(`background-image: url('${bgImageUrl}')`);
			styles.push(`background-size: ${bgSize}`);
			styles.push(`background-position: ${bgPosition}`);
			styles.push(`background-repeat: ${bgRepeat}`);
		}

		return styles.join('; ');
	});

	// Live preview overlay styles (for image backgrounds)
	let previewOverlayStyle = $derived(() => {
		if (bgType !== 'image' || !overlayEnabled) return '';

		const color = isDark ? overlayColorDark : overlayColorLight;
		const r = parseInt(color.slice(1, 3), 16);
		const g = parseInt(color.slice(3, 5), 16);
		const b = parseInt(color.slice(5, 7), 16);

		return `background-color: rgba(${r}, ${g}, ${b}, ${overlayAlpha})`;
	});

	// Live preview text color
	let previewTextColorStyle = $derived(() => {
		const color = isDark ? textColorDark : textColorLight;
		return color ? `color: ${color}` : '';
	});

	let hasPreviewOverlay = $derived(bgType === 'image' && overlayEnabled);

	let contentJson = $derived(() => {
		if (editor) {
			return JSON.stringify(editor.getJSON());
		}
		return '';
	});

	function handleBack() {
		goto('/dashboard');
	}

	function handlePreview() {
		if (data.slug) {
			window.open(`/${data.slug}`, '_blank');
		}
	}
</script>

<div class="editor-page">
	<!-- Header with Toolbar -->
	<header class="editor-header">
		<div class="header-row">
			<div class="header-left">
				<Button variant="ghost" size="sm" onclick={handleBack}>
					<ArrowLeft class="h-4 w-4 mr-2" />
					Back
				</Button>
				<div class="page-info">
					<span class="slug">/{data.slug}</span>
					{#if data.isNew}
						<span class="badge new">New</span>
					{:else}
						<span class="badge {status}">{status}</span>
					{/if}
				</div>
			</div>

			<div class="header-right">
				{#if !data.isNew}
					<Button variant="outlined" size="sm" onclick={handlePreview}>
						<Eye class="h-4 w-4 mr-2" />
						Preview
					</Button>
				{/if}
			</div>
		</div>

		<!-- Toolbar row -->
		<div class="toolbar-row">
			<ToggleFlip isOpen={sidebarOpen} {toggleSidebar} />
			{#if editor}
				<EdraToolBar {editor} />
			{/if}
		</div>
	</header>

	<!-- Main Editor Area -->
	<div class="editor-container">
		<form
			method="POST"
			action="?/save"
			class:sidebar-collapsed={!sidebarOpen}
			use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					saving = false;
					if (result.type === 'success') {
						await update();
					}
				};
			}}
		>
			<!-- Hidden fields -->
			<input type="hidden" name="content" value={contentJson()} />
			<input type="hidden" name="is_new" value={data.isNew ? 'true' : 'false'} />
			<input type="hidden" name="page_styles" value={pageStylesJson()} />

			<!-- Page Settings Sidebar -->
			<aside class="editor-sidebar">
				<div class="sidebar-section">
					<Label for="title">Page Title</Label>
					<Input
						id="title"
						name="title"
						bind:value={title}
						placeholder="Enter page title..."
					/>
				</div>

				<div class="sidebar-section">
					<Label for="status">Status</Label>
					<input type="hidden" name="status" value={status} />
					<Select.Root bind:value={status} type="single">
						<Select.Trigger class="select-trigger w-full">
							{status === 'draft' ? 'Draft' : status === 'published' ? 'Published' : 'Archived'}
						</Select.Trigger>
						<Select.Content class="select-content">
							<Select.Item value="draft" label="Draft">Draft</Select.Item>
							<Select.Item value="published" label="Published">Published</Select.Item>
							<Select.Item value="archived" label="Archived">Archived</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="sidebar-section">
					<Label for="meta_description">Meta Description</Label>
					<textarea
						id="meta_description"
						name="meta_description"
						bind:value={metaDescription}
						placeholder="SEO description..."
						class="textarea-input"
						rows="3"
					></textarea>
				</div>

				<!-- Background Options -->
				<div class="sidebar-section">
					<Label for="bg_type">Background</Label>
					<Select.Root bind:value={bgType} type="single">
						<Select.Trigger class="select-trigger w-full">
							{bgType === 'none' ? 'None (Default)' : bgType === 'color' ? 'Solid Color' : bgType === 'gradient' ? 'Gradient' : 'Image'}
						</Select.Trigger>
						<Select.Content class="select-content">
							<Select.Item value="none" label="None (Default)">None (Default)</Select.Item>
							<Select.Item value="color" label="Solid Color">Solid Color</Select.Item>
							<Select.Item value="gradient" label="Gradient">Gradient</Select.Item>
							<Select.Item value="image" label="Image">Image</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				{#if bgType === 'color'}
					<details class="collapsible-section" open>
						<summary class="collapsible-trigger">
							<span>Color Options</span>
							<ChevronDown class="h-4 w-4" />
						</summary>
						<div class="collapsible-content">
							<div class="color-mode-row">
								<div class="color-mode-col">
									<span class="mode-label">Light Mode</span>
									<input type="color" bind:value={bgColorLight} class="color-input" />
									<Input type="text" bind:value={bgColorLight} placeholder="#ffffff" class="color-text-input" />
								</div>
								<div class="color-mode-col">
									<span class="mode-label">Dark Mode</span>
									<input type="color" bind:value={bgColorDark} class="color-input" />
									<Input type="text" bind:value={bgColorDark} placeholder="#1a1a1a" class="color-text-input" />
								</div>
							</div>
						</div>
					</details>
				{/if}

				{#if bgType === 'gradient'}
					<details class="collapsible-section" open>
						<summary class="collapsible-trigger">
							<span>Gradient Options</span>
							<ChevronDown class="h-4 w-4" />
						</summary>
						<div class="collapsible-content">
							<div class="bg-option-group">
								<Label for="gradient_direction">Direction</Label>
								<Select.Root bind:value={gradientDirection} type="single">
									<Select.Trigger class="select-trigger w-full">
										{gradientDirection === 'to top' ? 'To Top' : gradientDirection === 'to right' ? 'To Right' : gradientDirection === 'to bottom' ? 'To Bottom' : gradientDirection === 'to left' ? 'To Left' : gradientDirection === 'to top right' ? 'To Top Right' : gradientDirection === 'to bottom right' ? 'To Bottom Right' : gradientDirection === 'to bottom left' ? 'To Bottom Left' : 'To Top Left'}
									</Select.Trigger>
									<Select.Content class="select-content">
										<Select.Item value="to top" label="To Top">To Top</Select.Item>
										<Select.Item value="to right" label="To Right">To Right</Select.Item>
										<Select.Item value="to bottom" label="To Bottom">To Bottom</Select.Item>
										<Select.Item value="to left" label="To Left">To Left</Select.Item>
										<Select.Item value="to top right" label="To Top Right">To Top Right</Select.Item>
										<Select.Item value="to bottom right" label="To Bottom Right">To Bottom Right</Select.Item>
										<Select.Item value="to bottom left" label="To Bottom Left">To Bottom Left</Select.Item>
										<Select.Item value="to top left" label="To Top Left">To Top Left</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>

							<Label>Color 1</Label>
							<div class="color-mode-row">
								<div class="color-mode-col">
									<span class="mode-label">Light</span>
									<input type="color" bind:value={gradientColor1Light} class="color-input" />
									<Input type="text" bind:value={gradientColor1Light} placeholder="#ffffff" class="color-text-input" />
								</div>
								<div class="color-mode-col">
									<span class="mode-label">Dark</span>
									<input type="color" bind:value={gradientColor1Dark} class="color-input" />
									<Input type="text" bind:value={gradientColor1Dark} placeholder="#1a1a1a" class="color-text-input" />
								</div>
							</div>

							<Label>Color 2</Label>
							<div class="color-mode-row">
								<div class="color-mode-col">
									<span class="mode-label">Light</span>
									<input type="color" bind:value={gradientColor2Light} class="color-input" />
									<Input type="text" bind:value={gradientColor2Light} placeholder="#e0e0e0" class="color-text-input" />
								</div>
								<div class="color-mode-col">
									<span class="mode-label">Dark</span>
									<input type="color" bind:value={gradientColor2Dark} class="color-input" />
									<Input type="text" bind:value={gradientColor2Dark} placeholder="#333333" class="color-text-input" />
								</div>
							</div>
						</div>
					</details>
				{/if}

				{#if bgType === 'image'}
					<details class="collapsible-section" open>
						<summary class="collapsible-trigger">
							<span>Image Options</span>
							<ChevronDown class="h-4 w-4" />
						</summary>
						<div class="collapsible-content">
							<div class="bg-option-group">
								<Label>Image Source</Label>
								{#if data.supabase && data.session?.user}
									<div class="media-selector-row">
										<MediaSelector
											supabase={data.supabase}
											user={data.session.user}
											{siteId}
											mode="picker"
											bind:value={selectedBgImageUrl}
											{Button}
											{Input}
											{Label}
											{Checkbox}
											Dialog={MediaDialog}
											DialogContent={MediaDialogContent}
											DialogHeader={MediaDialogHeader}
											DialogTitle={MediaDialogTitle}
											DialogDescription={MediaDialogDescription}
											DialogFooter={MediaDialogFooter}
										/>
									</div>
								{/if}
								<Input type="url" bind:value={bgImageUrl} placeholder="Or enter image URL..." />
								{#if bgImageUrl}
									<div class="bg-preview">
										<img src={bgImageUrl} alt="Background preview" />
									</div>
								{/if}
							</div>

							<div class="bg-option-group">
								<Label for="bg_size">Size</Label>
								<Select.Root bind:value={bgSize} type="single">
									<Select.Trigger class="select-trigger w-full">
										{bgSize === 'cover' ? 'Cover' : bgSize === 'contain' ? 'Contain' : 'Auto'}
									</Select.Trigger>
									<Select.Content class="select-content">
										<Select.Item value="cover" label="Cover">Cover</Select.Item>
										<Select.Item value="contain" label="Contain">Contain</Select.Item>
										<Select.Item value="auto" label="Auto">Auto</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>

							<div class="bg-option-group">
								<Label for="bg_position">Position</Label>
								<Select.Root bind:value={bgPosition} type="single">
									<Select.Trigger class="select-trigger w-full">
										{bgPosition === 'center center' ? 'Center' : bgPosition === 'top center' ? 'Top' : bgPosition === 'bottom center' ? 'Bottom' : bgPosition === 'left center' ? 'Left' : bgPosition === 'right center' ? 'Right' : bgPosition === 'top left' ? 'Top Left' : bgPosition === 'top right' ? 'Top Right' : bgPosition === 'bottom left' ? 'Bottom Left' : 'Bottom Right'}
									</Select.Trigger>
									<Select.Content class="select-content">
										<Select.Item value="center center" label="Center">Center</Select.Item>
										<Select.Item value="top center" label="Top">Top</Select.Item>
										<Select.Item value="bottom center" label="Bottom">Bottom</Select.Item>
										<Select.Item value="left center" label="Left">Left</Select.Item>
										<Select.Item value="right center" label="Right">Right</Select.Item>
										<Select.Item value="top left" label="Top Left">Top Left</Select.Item>
										<Select.Item value="top right" label="Top Right">Top Right</Select.Item>
										<Select.Item value="bottom left" label="Bottom Left">Bottom Left</Select.Item>
										<Select.Item value="bottom right" label="Bottom Right">Bottom Right</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>

							<div class="bg-option-group">
								<Label for="bg_repeat">Repeat</Label>
								<Select.Root bind:value={bgRepeat} type="single">
									<Select.Trigger class="select-trigger w-full">
										{bgRepeat === 'no-repeat' ? 'No Repeat' : bgRepeat === 'repeat' ? 'Repeat' : bgRepeat === 'repeat-x' ? 'Repeat X' : 'Repeat Y'}
									</Select.Trigger>
									<Select.Content class="select-content">
										<Select.Item value="no-repeat" label="No Repeat">No Repeat</Select.Item>
										<Select.Item value="repeat" label="Repeat">Repeat</Select.Item>
										<Select.Item value="repeat-x" label="Repeat X">Repeat X</Select.Item>
										<Select.Item value="repeat-y" label="Repeat Y">Repeat Y</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>
						</div>
					</details>

					<details class="collapsible-section">
						<summary class="collapsible-trigger">
							<span>Overlay Options</span>
							<ChevronDown class="h-4 w-4" />
						</summary>
						<div class="collapsible-content">
							<div class="overlay-toggle">
								<Checkbox id="overlay_enabled" bind:checked={overlayEnabled} />
								<Label for="overlay_enabled">Enable Overlay</Label>
							</div>

							{#if overlayEnabled}
								<div class="color-mode-row">
									<div class="color-mode-col">
										<span class="mode-label">Light</span>
										<input type="color" bind:value={overlayColorLight} class="color-input" />
										<Input type="text" bind:value={overlayColorLight} placeholder="#000000" class="color-text-input" />
									</div>
									<div class="color-mode-col">
										<span class="mode-label">Dark</span>
										<input type="color" bind:value={overlayColorDark} class="color-input" />
										<Input type="text" bind:value={overlayColorDark} placeholder="#000000" class="color-text-input" />
									</div>
								</div>

								<div class="bg-option-group">
									<Label for="overlay_alpha">Opacity: {Math.round(overlayAlpha * 100)}%</Label>
									<input
										type="range"
										id="overlay_alpha"
										bind:value={overlayAlpha}
										min="0"
										max="1"
										step="0.01"
										class="range-input"
									/>
								</div>
							{/if}
						</div>
					</details>
				{/if}

				<!-- Text Color Options -->
				<div class="sidebar-section">
					<Label>Text Color</Label>
					<div class="color-mode-row">
						<div class="color-mode-col">
							<span class="mode-label">Light Mode</span>
							<input type="color" bind:value={textColorLight} class="color-input" />
							<Input type="text" bind:value={textColorLight} placeholder="#111111" class="color-text-input" />
						</div>
						<div class="color-mode-col">
							<span class="mode-label">Dark Mode</span>
							<input type="color" bind:value={textColorDark} class="color-input" />
							<Input type="text" bind:value={textColorDark} placeholder="#f5f5f5" class="color-text-input" />
						</div>
					</div>
				</div>

				<Button type="submit" class="w-full" disabled={saving || !title.trim()}>
					{#if saving}
						<Loader2 class="h-4 w-4 mr-2 animate-spin" />
						Saving...
					{:else}
						<Save class="h-4 w-4 mr-2" />
						Save Page
					{/if}
				</Button>

				{#if form?.error}
					<p class="error-message">{form.error}</p>
				{/if}

				{#if form?.success}
					<p class="success-message">Page saved successfully!</p>
				{/if}
			</aside>

			<!-- Editor Content -->
			<main class="editor-main">
				<div class="editor-content" style="{previewBackgroundStyle()}; {previewTextColorStyle()}">
					{#if hasPreviewOverlay}
						<div class="preview-overlay" style={previewOverlayStyle()}></div>
					{/if}
					<EdraEditor
						bind:editor
						content={data.page?.content ?? undefined}
						editable={true}
						autofocus={true}
						supabase={data.supabase}
						user={data.session?.user}
						{siteId}
					/>
				</div>
			</main>
		</form>
	</div>
</div>

<style>
	.editor-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: var(--dashboard-bg);
	}

	.editor-header {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid var(--dashboard-border);
		background-color: var(--dashboard-surface);
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
	}

	.toolbar-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border-top: 1px solid var(--dashboard-border);
		padding: 0.25rem 0.5rem;
		overflow-x: auto;
	}

	.toolbar-row :global(.edra-toolbar) {
		flex: 1;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.slug {
		font-family: monospace;
		font-size: 0.875rem;
		color: var(--dashboard-text-muted);
	}

	.badge {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	.badge.new {
		background-color: #3b82f6;
		color: white;
	}

	.badge.draft {
		background-color: #f59e0b;
		color: white;
	}

	.badge.published {
		background-color: #10b981;
		color: white;
	}

	.badge.archived {
		background-color: #6b7280;
		color: white;
	}

	.editor-container {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	.editor-container form {
		display: grid;
		grid-template-columns: 280px 1fr;
		height: 100%;
		transition: grid-template-columns 0.3s ease;
	}

	.editor-container form.sidebar-collapsed {
		grid-template-columns: 0 1fr;
	}

	.editor-sidebar {
		padding: 1.5rem;
		border-right: 1px solid var(--dashboard-border);
		background-color: var(--dashboard-surface);
		overflow-y: auto;
		overflow-x: hidden;
		transition: transform 0.3s ease, opacity 0.3s ease;
	}

	.sidebar-collapsed .editor-sidebar {
		transform: translateX(-100%);
		opacity: 0;
		pointer-events: none;
	}

	.sidebar-section {
		margin-bottom: 1.5rem;
	}

	.sidebar-section :global(label) {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--dashboard-text);
	}

	.select-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--dashboard-border);
		background-color: var(--dashboard-bg);
		color: var(--dashboard-text);
		font-size: 0.875rem;
	}

	/* shadcn Select styling */
	:global(.select-trigger) {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--dashboard-border) !important;
		border-radius: 0 !important;
		background-color: var(--dashboard-bg) !important;
		color: var(--dashboard-text) !important;
		font-size: 0.875rem;
		justify-content: space-between;
	}

	:global(.select-trigger:focus) {
		border-color: var(--dashboard-focus-ring) !important;
		box-shadow: 0 0 0 2px rgba(0, 165, 207, 0.2) !important;
	}

	:global(.select-content) {
		border: 1px solid var(--dashboard-border) !important;
		border-radius: 0 !important;
		background-color: var(--dashboard-surface) !important;
	}

	:global([data-slot="select-item"]) {
		border-radius: 0 !important;
		color: var(--dashboard-text) !important;
	}

	:global([data-slot="select-item"]:hover),
	:global([data-slot="select-item"][data-highlighted]) {
		background-color: var(--dashboard-bg) !important;
		color: var(--accent-primary) !important;
	}

	.textarea-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--dashboard-border);
		background-color: var(--dashboard-bg);
		color: var(--dashboard-text);
		font-size: 0.875rem;
		resize: vertical;
	}

	/* Collapsible sections (native details/summary) */
	.collapsible-section {
		margin-bottom: 1rem;
		border: 1px solid var(--dashboard-border);
		overflow: hidden;
	}

	.collapsible-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		cursor: pointer;
		background-color: var(--dashboard-surface);
		font-weight: 500;
		font-size: 0.875rem;
		color: var(--dashboard-text);
	}

	.collapsible-trigger:hover {
		background-color: var(--dashboard-surface-hover);
	}

	.collapsible-section[open] .collapsible-trigger :global(svg) {
		transform: rotate(180deg);
	}

	.collapsible-content {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border-top: 1px solid var(--dashboard-border);
	}

	.error-message {
		margin-top: 1rem;
		padding: 0.5rem;
		background-color: rgba(220, 38, 38, 0.1);
		border: 1px solid rgba(220, 38, 38, 0.3);
		color: #ef4444;
		font-size: 0.875rem;
	}

	.success-message {
		margin-top: 1rem;
		padding: 0.5rem;
		background-color: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: #10b981;
		font-size: 0.875rem;
	}

	.editor-main {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.editor-content {
		flex: 1;
		overflow-y: auto;
		padding: 2rem;
		background-color: var(--dashboard-bg);
		position: relative;
	}

	.preview-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 0;
	}

	.editor-content :global(.ProseMirror) {
		position: relative;
		z-index: 1;
	}

	/* Background options styles */
	.bg-option-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.color-mode-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.color-mode-col {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.mode-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--dashboard-text-muted);
	}

	.color-mode-col .color-input {
		width: 100%;
		height: 32px;
		padding: 2px;
		border: 1px solid var(--dashboard-border);
		cursor: pointer;
	}

	.color-mode-col :global(.color-text-input) {
		width: 100%;
		font-size: 0.75rem;
	}

	.color-input {
		width: 40px;
		height: 32px;
		padding: 2px;
		border: 1px solid var(--dashboard-border);
		cursor: pointer;
	}

	.color-text-input {
		flex: 1;
		min-width: 60px;
	}

	.media-selector-row {
		margin-bottom: 0.5rem;
	}

	.bg-preview {
		margin-top: 0.5rem;
		overflow: hidden;
		border: 1px solid var(--dashboard-border);
	}

	.bg-preview img {
		width: 100%;
		height: 80px;
		object-fit: cover;
	}

	.overlay-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.overlay-toggle :global(label) {
		margin-bottom: 0 !important;
	}

	.range-input {
		width: 100%;
		height: 6px;
		background: var(--dashboard-border);
		cursor: pointer;
		-webkit-appearance: none;
	}

	.range-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		background: var(--accent-primary);
		cursor: pointer;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.editor-container form {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		.editor-sidebar {
			border-right: none;
			border-bottom: 1px solid var(--dashboard-border);
			max-height: 200px;
		}
	}
</style>
