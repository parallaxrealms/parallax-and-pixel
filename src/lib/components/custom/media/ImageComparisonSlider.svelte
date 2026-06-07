<script lang="ts">
	interface Props {
		beforeImage: string;
		afterImage: string;
		beforeLabel?: string;
		afterLabel?: string;
		initialPosition?: number;
		class?: string;
	}

	let {
		beforeImage,
		afterImage,
		beforeLabel = 'Before',
		afterLabel = 'After',
		initialPosition = 50,
		class: className = ''
	}: Props = $props();

	let position = $state(50);
	let dragging = $state(false);
	let containerEl: HTMLElement | undefined = $state();

	// Sync position when initialPosition prop changes
	$effect(() => {
		position = initialPosition;
	});

	function getPositionFromEvent(clientX: number) {
		if (!containerEl) return position;
		const rect = containerEl.getBoundingClientRect();
		const x = clientX - rect.left;
		return Math.max(0, Math.min(100, (x / rect.width) * 100));
	}

	function onPointerDown(e: PointerEvent) {
		e.stopPropagation();
		e.preventDefault();
		dragging = true;
		position = getPositionFromEvent(e.clientX);
		(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		e.stopPropagation();
		position = getPositionFromEvent(e.clientX);
	}

	function onPointerUp(e: PointerEvent) {
		e.stopPropagation();
		dragging = false;
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			position = Math.max(0, position - 1);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			position = Math.min(100, position + 1);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={containerEl}
	class="relative select-none overflow-hidden border border-slate-700 {className}"
	style="aspect-ratio: 16/9;"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	<!-- Before image (full) -->
	<img
		src={beforeImage}
		alt={beforeLabel}
		class="absolute inset-0 h-full w-full object-cover"
		draggable="false"
	/>

	<!-- After image (clipped) -->
	<img
		src={afterImage}
		alt={afterLabel}
		class="absolute inset-0 h-full w-full object-cover"
		style="clip-path: inset(0 0 0 {position}%);"
		draggable="false"
	/>

	<!-- Slider line -->
	<div
		class="absolute top-0 bottom-0 z-10 w-0.5"
		style="left: {position}%; background-color: #00a5cf;"
	></div>

	<!-- Slider handle -->
	<div
		class="absolute top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center"
		style="left: {position}%;"
		role="slider"
		tabindex="0"
		aria-valuenow={Math.round(position)}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Image comparison slider"
		onkeydown={onKeyDown}
	>
		<div
			class="flex h-8 w-8 items-center justify-center rounded-full border-2"
			style="border-color: #00a5cf; background-color: rgba(2, 6, 23, 0.8);"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M4 8L1 5.5V10.5L4 8ZM12 8L15 5.5V10.5L12 8Z"
					fill="#00a5cf"
				/>
				<line x1="4" y1="8" x2="12" y2="8" stroke="#00a5cf" stroke-width="1.5" />
			</svg>
		</div>
	</div>

	<!-- Before label -->
	<div
		class="pointer-events-none absolute top-3 left-3 z-10 px-2 py-1 text-xs text-slate-200"
		style="background-color: rgba(2, 6, 23, 0.7);"
	>
		{beforeLabel}
	</div>

	<!-- After label -->
	<div
		class="pointer-events-none absolute top-3 right-3 z-10 px-2 py-1 text-xs text-slate-200"
		style="background-color: rgba(2, 6, 23, 0.7);"
	>
		{afterLabel}
	</div>
</div>
