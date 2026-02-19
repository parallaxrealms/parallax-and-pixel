<script lang="ts" module>
	export interface ParticlesProps {
		className?: string;
		quantity?: number;
		staticity?: number;
		ease?: number;
		size?: number;
		refresh?: boolean;
		color?: string;
		vx?: number;
		vy?: number;
	}
</script>

<script lang="ts">
	let {
		className = '',
		quantity = 150,
		staticity = 35,
		ease = 50,
		size = 0.5,
		refresh = true,
		color = '#40de85',
		vx = 0,
		vy = 0
	}: ParticlesProps = $props();

	let canvasRef: HTMLCanvasElement = $state()!;
	let canvasContainerRef: HTMLDivElement = $state()!;
	let context: CanvasRenderingContext2D | null = $state(null);
	let circles: any[] = $state([]);
	let mouse = $state({ x: 0, y: 0 });
	let canvasSize = $state({ w: 0, h: 0 });
	const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

	function hexToRgb(hex: string): number[] {
		hex = hex.replace('#', '');

		if (hex.length === 3) {
			hex = hex
				.split('')
				.map((char) => char + char)
				.join('');
		}

		const hexInt = parseInt(hex, 16);
		const red = (hexInt >> 16) & 255;
		const green = (hexInt >> 8) & 255;
		const blue = hexInt & 255;
		return [red, green, blue];
	}

	const rgb = $derived(hexToRgb(color));

	function circleParams() {
		const x = Math.floor(Math.random() * canvasSize.w);
		const y = Math.floor(Math.random() * canvasSize.h);
		const translateX = 0;
		const translateY = 0;
		const pSize = Math.floor(Math.random() * 2) + size;
		const alpha = 0;
		const targetAlpha = parseFloat((Math.random() * 0.8 + 0.1).toFixed(1));
		const dx = (Math.random() - 0.5) * 0.1;
		const dy = (Math.random() - 0.5) * 0.1;
		const magnetism = 0.1 + Math.random() * 4;
		return {
			x,
			y,
			translateX,
			translateY,
			size: pSize,
			alpha,
			targetAlpha,
			dx,
			dy,
			magnetism
		};
	}

	function resizeCanvas() {
		if (canvasContainerRef && canvasRef && context) {
			circles.length = 0;
			canvasSize.w = canvasContainerRef.offsetWidth;
			canvasSize.h = canvasContainerRef.offsetHeight;
			canvasRef.width = canvasSize.w * dpr;
			canvasRef.height = canvasSize.h * dpr;
			canvasRef.style.width = `${canvasSize.w}px`;
			canvasRef.style.height = `${canvasSize.h}px`;
			context.scale(dpr, dpr);
		}
	}

	function clearContext() {
		if (context) {
			context.clearRect(0, 0, canvasSize.w, canvasSize.h);
		}
	}

	function drawCircle(circle: any, update = false) {
		if (context) {
			const { x, y, translateX, translateY, size, alpha } = circle;
			context.translate(translateX, translateY);
			context.beginPath();
			context.arc(x, y, size, 0, 2 * Math.PI);
			context.fillStyle = `rgba(${rgb.join(', ')}, ${alpha})`;
			context.fill();
			context.setTransform(dpr, 0, 0, dpr, 0, 0);

			if (!update) {
				circles.push(circle);
			}
		}
	}

	function drawParticles() {
		clearContext();
		for (let i = 0; i < quantity; i++) {
			const circle = circleParams();
			drawCircle(circle);
		}
	}

	function remapValue(value: any, start1: any, end1: any, start2: any, end2: any) {
		let remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
		return remapped > 0 ? remapped : 0;
	}

	let animationFrameId: number;

	function animate() {
		clearContext();
		circles.forEach((circle, i) => {
			const edge = [
				circle.x + circle.translateX - circle.size,
				canvasSize.w - circle.x - circle.translateX - circle.size,
				circle.y + circle.translateY - circle.size,
				canvasSize.h - circle.y - circle.translateY - circle.size
			];
			const closestEdge = edge.reduce((a, b) => Math.min(a, b));
			const remapClosestEdge = parseFloat(remapValue(closestEdge, 0, 20, 0, 1).toFixed(2));
			if (remapClosestEdge > 1) {
				circle.alpha += 0.02;
				if (circle.alpha > circle.targetAlpha) {
					circle.alpha = circle.targetAlpha;
				}
			} else {
				circle.alpha = circle.targetAlpha * remapClosestEdge;
			}
			circle.x += circle.dx + vx;
			circle.y += circle.dy + vy;
			circle.translateX += (mouse.x / (staticity / circle.magnetism) - circle.translateX) / ease;
			circle.translateY += (mouse.y / (staticity / circle.magnetism) - circle.translateY) / ease;

			drawCircle(circle, true);

			if (
				circle.x < -circle.size ||
				circle.x > canvasSize.w + circle.size ||
				circle.y < -circle.size ||
				circle.y > canvasSize.h + circle.size
			) {
				circles.splice(i, 1);
				const newCircle = circleParams();
				drawCircle(newCircle);
			}
		});
		animationFrameId = window.requestAnimationFrame(animate);
	}

	function onMouseMove(event: MouseEvent) {
		if (canvasRef) {
			let rect = canvasRef.getBoundingClientRect();
			let { w, h } = canvasSize;
			let x = event.clientX - rect.left - w / 2;
			let y = event.clientY - rect.top - h / 2;
			let inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2;
			if (inside) {
				mouse.x = x;
				mouse.y = y;
			}
		}
	}

	$effect(() => {
		if (canvasRef) {
			context = canvasRef.getContext('2d');
			resizeCanvas();
			animate();
			window.addEventListener('resize', resizeCanvas);
			window.addEventListener('mousemove', onMouseMove);
		}

		return () => {
			window.removeEventListener('resize', resizeCanvas);
			window.removeEventListener('mousemove', onMouseMove);
			if (animationFrameId) cancelAnimationFrame(animationFrameId);
		};
	});

	$effect(() => {
		if (canvasRef) {
			drawParticles();
			//   animate();
		}
	});
	//   Building Stage
</script>

<div class={className} bind:this={canvasContainerRef} aria-hidden="true">
	<canvas bind:this={canvasRef} class="size-full"></canvas>
</div>

<style>
	.size-full {
		width: 100%;
		height: 100%;
	}
</style>
