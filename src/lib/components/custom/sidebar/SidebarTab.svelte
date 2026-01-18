<!-- SidebarTab.svelte - Real-time sidebar configuration editor -->
<script lang="ts">
	import { sidebarConfig, sidebarActions } from '@parallaxrealms/stores-core';
	import { createSidebarConfig, sidebarConfigs } from '@parallaxrealms/utils-core';
	import type { SidebarConfig } from '@parallaxrealms/types-core';
	import { onMount } from 'svelte';

	// Local configuration state
	let localConfig = $state<SidebarConfig>(createSidebarConfig().build());
	let isInitialized = $state(false);
	let configName = $state('My Custom Config');
	let generatedCode = $state('');

	onMount(() => {
		console.log('🎨 SidebarTab onMount - $sidebarConfig:', $sidebarConfig);
		// Ensure we have a valid config from the store
		if ($sidebarConfig && $sidebarConfig.sidebar) {
			localConfig = { ...$sidebarConfig };
			console.log('🎨 SidebarTab onMount - Using store config');
		} else {
			// Fallback to default config if store is empty
			localConfig = createSidebarConfig().build();
			console.log('🎨 SidebarTab onMount - Using default config');
		}
		isInitialized = true;
		generateCode();
	});

	// Update sidebar config when local config changes
	$effect(() => {
		if (isInitialized && localConfig && localConfig.sidebar) {
			// Create a plain object to avoid proxy issues
			const plainConfig = JSON.parse(JSON.stringify(localConfig));
			console.log('🎨 SidebarTab: Updating config with:', plainConfig);
			sidebarActions.updateConfig(plainConfig);
			generateCode();
		}
	});

	// Generate code from current config
	function generateCode() {
		if (!localConfig || !localConfig.sidebar) {
			console.log('🎨 SidebarTab: Config not ready yet');
			return;
		}
		const config = JSON.parse(JSON.stringify(localConfig));
		generatedCode = `// ${configName}
const ${configName.toLowerCase().replace(/\s+/g, '')} = createSidebarConfig()
	.sidebar({
		widthExpanded: '${config.sidebar.widthExpanded}',
		widthCollapsed: '${config.sidebar.widthCollapsed}',
		bg: '${config.sidebar.bg}',
		border: '${config.sidebar.border}',
		padding: '${config.sidebar.padding}',
		margin: '${config.sidebar.margin}',
		gap: '${config.sidebar.gap}',
		radiusContainer: '${config.sidebar.radiusContainer}',
		radiusItem: '${config.sidebar.radiusItem}',
		radiusButton: '${config.sidebar.radiusButton}',
		radiusChildItem: '${config.sidebar.radiusChildItem}',
		alignContentExpanded: '${config.sidebar.alignContentExpanded}',
		alignContentCollapsed: '${config.sidebar.alignContentCollapsed}'
	})
	.behavior({
		autoCollapse: ${config.behavior.autoCollapse},
		persistState: ${config.behavior.persistState},
		showTooltips: ${config.behavior.showTooltips},
		expandOnHover: ${config.behavior.expandOnHover}
	})
	.animations({
		sidebarDuration: '${config.animations.sidebarDuration}',
		sidebarEasing: '${config.animations.sidebarEasing}',
		sidebarHoverScale: ${config.animations.sidebarHoverScale},
		sidebarItemDuration: '${config.animations.sidebarItemDuration}',
		sidebarItemDropdownEasing: '${config.animations.sidebarItemDropdownEasing}',
		sidebarItemDropdownDuration: '${config.animations.sidebarItemDropdownDuration}'
	})
		.responsive({
			mobileBreakpoint: '${config.responsive.mobileBreakpoint}',
			tabletBreakpoint: '${config.responsive.tabletBreakpoint}',
			desktopBreakpoint: '${config.responsive.desktopBreakpoint}',
			mobileState: '${config.responsive.mobileState}',
			tabletState: '${config.responsive.tabletState}',
			desktopState: '${config.responsive.desktopState}'
		})
		.sbi({
			bg: '${config.sbi.bg}',
			text: '${config.sbi.text}',
			hoverBg: '${config.sbi.hoverBg}',
			activeBg: '${config.sbi.activeBg}',
			activeText: '${config.sbi.activeText}',
			labelSpacing: '${config.sbi.labelSpacing}',
			height: '${config.sbi.height}',
			fontSize: '${config.sbi.fontSize}',
			duration: '${config.sbi.duration}',
			iconSize: '${config.sbi.iconSize}',
			radius: '${config.sbi.radius}'
		})
		.build();`;
	}

	// Reset to defaults
	function resetToDefaults() {
		localConfig = createSidebarConfig().build();
	}

	// Apply preset configurations
	function applyPreset(presetName: string) {
		// For now, just use default config for all presets
		// TODO: Implement proper preset loading
		localConfig = createSidebarConfig().build();
	}

	// Copy code to clipboard
	async function copyCode() {
		try {
			await navigator.clipboard.writeText(generatedCode);
			// You could add a toast notification here
			console.log('Code copied to clipboard!');
		} catch (err) {
			console.error('Failed to copy code:', err);
		}
	}
</script>

<div class="sidebar-config-editor">
	<!-- LEFT SECTION - Configuration Controls -->
	<div class="left-section">
		<!-- Section 1: Quick Presets -->
		<div class="config-section">
			<h3>Quick Presets</h3>
			<div class="two-columns">
				<div class="column">
					<button class="preset-btn" onclick={() => applyPreset('default')}>Default</button>
					<button class="preset-btn" onclick={() => applyPreset('compact')}>Compact</button>
					<button class="preset-btn" onclick={() => applyPreset('rounded')}>Rounded</button>
				</div>
				<div class="column">
					<button class="preset-btn" onclick={() => applyPreset('colorful')}>Colorful</button>
					<button class="preset-btn reset" onclick={resetToDefaults}>Reset to Defaults</button>
				</div>
			</div>
		</div>

		<!-- Section 2: Sidebar Container -->
		<div class="config-section">
			<h3>Sidebar Container</h3>
			<div class="two-columns">
				<div class="column">
					<div class="config-item">
						<label for="expanded-width">Expanded Width</label>
						<input
							id="expanded-width"
							type="text"
							bind:value={localConfig.sidebar.widthExpanded}
							placeholder="15rem"
						/>
					</div>
					<div class="config-item">
						<label for="collapsed-width">Collapsed Width</label>
						<input
							id="collapsed-width"
							type="text"
							bind:value={localConfig.sidebar.widthCollapsed}
							placeholder="4rem"
						/>
					</div>
					<div class="config-item">
						<label for="bg-color">Background Color</label>
						<input id="bg-color" type="color" bind:value={localConfig.sidebar.bg} />
					</div>
					<div class="config-item">
						<label for="border-color">Border Color</label>
						<input id="border-color" type="color" bind:value={localConfig.sidebar.border} />
					</div>
					<div class="config-item">
						<label for="padding">Padding</label>
						<input
							id="padding"
							type="text"
							bind:value={localConfig.sidebar.padding}
							placeholder="0.375rem"
						/>
					</div>
					<div class="config-item">
						<label for="margin">Margin</label>
						<input
							id="margin"
							type="text"
							bind:value={localConfig.sidebar.margin}
							placeholder="0.25rem"
						/>
					</div>
				</div>
				<div class="column">
					<div class="config-item">
						<label for="gap">Gap</label>
						<input id="gap" type="text" bind:value={localConfig.sidebar.gap} placeholder="0.5rem" />
					</div>
					<div class="config-item">
						<label for="radius-container">Container Radius</label>
						<input
							id="radius-container"
							type="text"
							bind:value={localConfig.sidebar.radiusContainer}
							placeholder="0"
						/>
					</div>
					<div class="config-item">
						<label for="radius-item">Item Radius</label>
						<input
							id="radius-item"
							type="text"
							bind:value={localConfig.sidebar.radiusItem}
							placeholder="var(--border-radius-md)"
						/>
					</div>
					<div class="config-item">
						<label for="radius-button">Button Radius</label>
						<input
							id="radius-button"
							type="text"
							bind:value={localConfig.sidebar.radiusButton}
							placeholder="var(--border-radius-md)"
						/>
					</div>
					<div class="config-item">
						<label for="radius-child">Child Item Radius</label>
						<input
							id="radius-child"
							type="text"
							bind:value={localConfig.sidebar.radiusChildItem}
							placeholder="var(--border-radius-md)"
						/>
					</div>
					<div class="config-item">
						<label for="align-expanded">Expanded Alignment</label>
						<select id="align-expanded" bind:value={localConfig.sidebar.alignContentExpanded}>
							<option value="start">Start</option>
							<option value="center">Center</option>
							<option value="end">End</option>
						</select>
					</div>
					<div class="config-item">
						<label for="align-collapsed">Collapsed Alignment</label>
						<select id="align-collapsed" bind:value={localConfig.sidebar.alignContentCollapsed}>
							<option value="start">Start</option>
							<option value="center">Center</option>
							<option value="end">End</option>
						</select>
					</div>
				</div>
			</div>
		</div>

		<!-- Section 5: Sidebar Behavior -->
		<div class="config-section">
			<h3>Sidebar Behavior</h3>
			<div class="two-columns">
				<div class="column">
					<div class="config-item checkbox">
						<label>
							<input type="checkbox" bind:checked={localConfig.behavior.autoCollapse} />
							Auto Collapse
						</label>
					</div>
					<div class="config-item checkbox">
						<label>
							<input type="checkbox" bind:checked={localConfig.behavior.persistState} />
							Persist State
						</label>
					</div>
				</div>
				<div class="column">
					<div class="config-item checkbox">
						<label>
							<input type="checkbox" bind:checked={localConfig.behavior.showTooltips} />
							Show Tooltips
						</label>
					</div>
					<div class="config-item checkbox">
						<label>
							<input type="checkbox" bind:checked={localConfig.behavior.expandOnHover} />
							Expand on Hover
						</label>
					</div>
				</div>
			</div>
		</div>

		<!-- Section 6: Sidebar Item Properties (--sbi-*) -->
		<div class="config-section">
			<h3>Sidebar Item Properties (--sbi-*)</h3>
			<div class="two-columns">
				<div class="column">
					<div class="config-item">
						<label for="sbi-bg">Background</label>
						<input
							id="sbi-bg"
							type="text"
							bind:value={localConfig.sbi.bg}
							placeholder="transparent"
						/>
					</div>
					<div class="config-item">
						<label for="sbi-text">Text Color</label>
						<input id="sbi-text" type="color" bind:value={localConfig.sbi.text} />
					</div>
					<div class="config-item">
						<label for="sbi-hover-bg">Hover Background</label>
						<input id="sbi-hover-bg" type="color" bind:value={localConfig.sbi.hoverBg} />
					</div>
					<div class="config-item">
						<label for="sbi-active-bg">Active Background</label>
						<input id="sbi-active-bg" type="color" bind:value={localConfig.sbi.activeBg} />
					</div>
					<div class="config-item">
						<label for="sbi-active-text">Active Text Color</label>
						<input id="sbi-active-text" type="color" bind:value={localConfig.sbi.activeText} />
					</div>
				</div>
				<div class="column">
					<div class="config-item">
						<label for="sbi-label-spacing">Label Spacing</label>
						<input
							id="sbi-label-spacing"
							type="text"
							bind:value={localConfig.sbi.labelSpacing}
							placeholder="0.75rem"
						/>
					</div>
					<div class="config-item">
						<label for="sbi-height">Height</label>
						<input
							id="sbi-height"
							type="text"
							bind:value={localConfig.sbi.height}
							placeholder="3rem"
						/>
					</div>
					<div class="config-item">
						<label for="sbi-font-size">Font Size</label>
						<input
							id="sbi-font-size"
							type="text"
							bind:value={localConfig.sbi.fontSize}
							placeholder="0.875rem"
						/>
					</div>
					<div class="config-item">
						<label for="sbi-duration">Duration</label>
						<input
							id="sbi-duration"
							type="text"
							bind:value={localConfig.sbi.duration}
							placeholder="0.2s"
						/>
					</div>
					<div class="config-item">
						<label for="sbi-icon-size">Icon Size</label>
						<input
							id="sbi-icon-size"
							type="text"
							bind:value={localConfig.sbi.iconSize}
							placeholder="1.375rem"
						/>
					</div>
					<div class="config-item">
						<label for="sbi-radius">Border Radius</label>
						<input
							id="sbi-radius"
							type="text"
							bind:value={localConfig.sbi.radius}
							placeholder="0.375rem"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Section 7: Sidebar Animations -->
		<div class="config-section">
			<h3>Sidebar Animations</h3>
			<div class="two-columns">
				<div class="column">
					<div class="config-item">
						<label for="sidebar-duration">Sidebar Duration</label>
						<input
							id="sidebar-duration"
							type="text"
							bind:value={localConfig.animations.sidebarDuration}
							placeholder="0.3s"
						/>
					</div>
					<div class="config-item">
						<label for="sidebar-easing">Sidebar Easing</label>
						<input
							id="sidebar-easing"
							type="text"
							bind:value={localConfig.animations.sidebarEasing}
							placeholder="ease-in-out"
						/>
					</div>
					<div class="config-item">
						<label for="sidebar-hover-scale">Sidebar Hover Scale</label>
						<input
							id="sidebar-hover-scale"
							type="number"
							bind:value={localConfig.animations.sidebarHoverScale}
							step="0.01"
							placeholder="1.02"
						/>
					</div>
				</div>
				<div class="column">
					<div class="config-item">
						<label for="item-duration">Item Duration</label>
						<input
							id="item-duration"
							type="text"
							bind:value={localConfig.animations.sidebarItemDuration}
							placeholder="0.2s"
						/>
					</div>
					<div class="config-item">
						<label for="item-easing">Item Easing</label>
						<input
							id="item-easing"
							type="text"
							bind:value={localConfig.animations.sidebarItemDropdownEasing}
							placeholder="ease-in-out"
						/>
					</div>
					<div class="config-item">
						<label for="item-dropdown-duration">Item Dropdown Duration</label>
						<input
							id="item-dropdown-duration"
							type="text"
							bind:value={localConfig.animations.sidebarItemDropdownDuration}
							placeholder="0.3s"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- RIGHT SECTION - Code Preview -->
	<div class="right-section">
		<div class="code-header">
			<div class="config-name-input">
				<label for="config-name">Config Name:</label>
				<input
					id="config-name"
					type="text"
					bind:value={configName}
					placeholder="My Custom Config"
				/>
			</div>
			<button class="copy-btn" onclick={copyCode}>COPY</button>
		</div>
		<div class="code-preview">
			<pre><code>{generatedCode}</code></pre>
		</div>
	</div>
</div>

<style>
	.sidebar-config-editor {
		display: flex;
		gap: 2rem;
		height: 100vh;
		overflow: hidden;
	}

	.left-section {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		background: var(--color-background);
	}

	.right-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--color-surface);
		border-left: 1px solid var(--color-border);
	}

	.config-section {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background: var(--color-surface);
		border-radius: var(--border-radius-lg);
		border: 1px solid var(--color-border);
	}

	.config-section h3 {
		margin: 0 0 1rem 0;
		color: var(--color-text);
		font-size: 1.125rem;
		font-weight: 600;
	}

	.two-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.config-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.config-item label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.config-item input[type='text'],
	.config-item input[type='number'],
	.config-item select {
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.config-item input[type='text']:focus,
	.config-item input[type='number']:focus,
	.config-item select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary-alpha);
	}

	.config-item input[type='color'] {
		width: 100%;
		height: 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-md);
		cursor: pointer;
	}

	.config-item input[type='checkbox'] {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--color-primary);
	}

	.config-item.checkbox {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.preset-btn {
		padding: 0.5rem 1rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--border-radius-md);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.preset-btn:hover {
		background: var(--color-primary-hover);
		transform: translateY(-1px);
	}

	.preset-btn.reset {
		background: var(--color-danger);
	}

	.preset-btn.reset:hover {
		background: var(--color-danger-hover);
	}

	.code-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.config-name-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
	}

	.config-name-input label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		white-space: nowrap;
	}

	.config-name-input input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.copy-btn {
		padding: 0.5rem 1rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--border-radius-md);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.copy-btn:hover {
		background: var(--color-primary-hover);
		transform: translateY(-1px);
	}

	/* Code preview */
	.code-preview {
		flex: 1;
		overflow: auto;
		padding: 1rem;
		background: #f8fafc; /* slate-50 */
	}

	.code-preview pre {
		margin: 0;
		color: #334155; /* slate-700 */
		font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.code-preview code {
		color: inherit;
		background: none;
		padding: 0;
		border: none;
		border-radius: 0;
	}

	/* Dark mode code preview */
	:global(.dark) .code-preview {
		background: #1e1e1e;
	}

	:global(.dark) .code-preview pre {
		color: #d4d4d4;
	}

	/* Responsive design */
	@media (max-width: 1024px) {
		.sidebar-config-editor {
			flex-direction: column;
			height: auto;
		}

		.left-section,
		.right-section {
			flex: none;
		}

		.two-columns {
			grid-template-columns: 1fr;
		}
	}
</style>
