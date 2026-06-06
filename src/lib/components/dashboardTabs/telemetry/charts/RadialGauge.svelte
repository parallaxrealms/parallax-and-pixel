<script lang="ts">
	/**
	 * Radial (donut) percent gauge. Severity-tinted fill arc.
	 * Used for things that are bounded 0–100% (disk, memory, cpu).
	 * Ported from 9realms; structural grays restyled to the p&p slate palette.
	 */
	interface Props {
		value: number | null;
		label: string;
		sublabel?: string;
		/** Thresholds (percent) for amber and red zones */
		warnAt?: number;
		critAt?: number;
		/** Size in px */
		size?: number;
		loading?: boolean;
		/** Override colour ramp — when set, ignore thresholds */
		color?: string;
	}

	let {
		value,
		label,
		sublabel,
		warnAt = 70,
		critAt = 88,
		size = 132,
		loading = false,
		color
	}: Props = $props();

	const stroke = 10;

	let radius = $derived((size - stroke) / 2);
	let circumference = $derived(2 * Math.PI * radius);
	let clamped = $derived(
		value === null || !isFinite(value) ? 0 : Math.max(0, Math.min(100, value))
	);
	let dash = $derived((clamped / 100) * circumference);
	let severity = $derived(
		value === null
			? 'unknown'
			: clamped >= critAt
				? 'crit'
				: clamped >= warnAt
					? 'warn'
					: 'ok'
	);
	let stroke_color = $derived(
		color
			? color
			: severity === 'crit'
				? '#ef4444'
				: severity === 'warn'
					? '#f59e0b'
					: '#e2e8f0'
	);
	let glow = $derived(severity === 'crit' ? 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' : 'none');
</script>

<div class="flex flex-col items-center justify-center">
	<svg width={size} height={size} viewBox="0 0 {size} {size}" class="block">
		<!-- Track -->
		<circle
			cx={size / 2}
			cy={size / 2}
			r={radius}
			fill="none"
			stroke="rgba(255,255,255,0.06)"
			stroke-width={stroke}
		/>
		<!-- Fill arc -->
		<circle
			cx={size / 2}
			cy={size / 2}
			r={radius}
			fill="none"
			stroke={stroke_color}
			stroke-width={stroke}
			stroke-linecap="butt"
			stroke-dasharray="{dash} {circumference}"
			transform="rotate(-90 {size / 2} {size / 2})"
			style="transition: stroke-dasharray 600ms ease, stroke 300ms ease; filter: {glow};"
		/>
		<!-- Center text -->
		<text
			x="50%"
			y="50%"
			dominant-baseline="middle"
			text-anchor="middle"
			class="fill-slate-100"
			style="font: 300 22px ui-monospace, monospace;"
		>
			{loading || value === null ? '·' : `${clamped.toFixed(0)}%`}
		</text>
	</svg>
	<div class="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
		{label}
	</div>
	{#if sublabel}
		<div class="mt-0.5 text-[10px] text-slate-500">{sublabel}</div>
	{/if}
</div>
