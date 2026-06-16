<script lang="ts">
	/**
	 * Admin Tools tab — self-contained developer utilities.
	 * Ported from 9realms (KeyGenTab). Currently: Key Generator (Web Crypto, fully
	 * client-side). Favicon generator + QR tracking are separate, heavier ports
	 * (server + Supabase storage) and are not included here yet.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import {
		KeyRound, Copy, Check, Eye, EyeOff, RefreshCw, AlertTriangle, Wrench,
		QrCode as QrIcon, Download, Image as ImageIcon
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import QRCode from 'qrcode';
	import JSZip from 'jszip';

	let { supabase: _supabase } = $props<{ supabase: SupabaseClient }>();

	const keyTypes = [
		{
			id: 'aes-256',
			name: 'AES-256 Key',
			description: '32 bytes / 64 hex characters',
			detail: 'Advanced Encryption Standard with a 256-bit key. The industry standard for symmetric encryption used to protect data at rest and in transit. Common uses include encrypting database fields, file encryption, and securing sensitive configuration values.',
			bytes: 32,
			format: 'hex' as const
		},
		{
			id: 'aes-128',
			name: 'AES-128 Key',
			description: '16 bytes / 32 hex characters',
			detail: 'AES with a 128-bit key provides strong encryption with slightly faster performance than AES-256. Suitable for encrypting session data, cache entries, or internal service communication where the threat model does not require 256-bit strength.',
			bytes: 16,
			format: 'hex' as const
		},
		{
			id: 'hmac-sha256',
			name: 'HMAC-SHA256 Secret',
			description: '32 bytes / 64 hex characters',
			detail: 'Hash-based Message Authentication Code using SHA-256. Used to verify both the integrity and authenticity of a message. Common uses include webhook signature verification (Stripe, GitHub webhooks), CSRF token generation, and API request signing.',
			bytes: 32,
			format: 'hex' as const
		},
		{
			id: 'jwt-secret',
			name: 'JWT Secret',
			description: '64 bytes / 128 hex characters',
			detail: 'A high-entropy secret used to sign and verify JSON Web Tokens (HS256/HS384/HS512). JWTs are widely used for stateless authentication, session management, and inter-service authorization. The 512-bit length provides strong security against brute-force attacks on the token signature.',
			bytes: 64,
			format: 'hex' as const
		},
		{
			id: 'api-key',
			name: 'API Key',
			description: '32 bytes, base64url encoded',
			detail: 'A URL-safe, base64-encoded token suitable for API authentication. Used as bearer tokens, service-to-service auth keys, or third-party API integration credentials. The base64url encoding makes it safe to use in URLs, HTTP headers, and environment variables without escaping.',
			bytes: 32,
			format: 'base64url' as const
		},
		{
			id: 'password',
			name: 'Random Password',
			description: 'Configurable length, mixed characters',
			detail: 'A cryptographically random password using uppercase, lowercase, digits, and special characters. Ideal for database passwords, admin accounts, service credentials, or any situation requiring a strong human-readable password that meets complexity requirements.',
			bytes: 0,
			format: 'password' as const
		},
		{
			id: 'uuid',
			name: 'UUID v4',
			description: '36 characters with hyphens',
			detail: 'A randomly generated Universally Unique Identifier following RFC 4122 version 4. Used for database primary keys, correlation IDs, resource identifiers, and any scenario requiring a globally unique value without coordination between systems.',
			bytes: 16,
			format: 'uuid' as const
		}
	] as const;

	let selectedTypeId = $state<string>('aes-256');
	let generatedKey = $state('');
	let revealed = $state(false);
	let copied = $state(false);
	let passwordLength = $state(32);

	let selectedType = $derived(keyTypes.find((t) => t.id === selectedTypeId) ?? keyTypes[0]);

	function bytesToHex(bytes: Uint8Array): string {
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	function bytesToBase64Url(bytes: Uint8Array): string {
		const base64 = btoa(String.fromCharCode(...bytes));
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}

	function bytesToUuid(bytes: Uint8Array): string {
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = bytesToHex(bytes);
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
	}

	function generatePassword(length: number): string {
		const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
		const array = new Uint32Array(length);
		crypto.getRandomValues(array);
		return Array.from(array)
			.map((n) => charset[n % charset.length])
			.join('');
	}

	function generate() {
		const type = selectedType;
		if (type.format === 'password') {
			generatedKey = generatePassword(passwordLength);
		} else if (type.format === 'uuid') {
			const bytes = new Uint8Array(type.bytes);
			crypto.getRandomValues(bytes);
			generatedKey = bytesToUuid(bytes);
		} else if (type.format === 'base64url') {
			const bytes = new Uint8Array(type.bytes);
			crypto.getRandomValues(bytes);
			generatedKey = bytesToBase64Url(bytes);
		} else {
			const bytes = new Uint8Array(type.bytes);
			crypto.getRandomValues(bytes);
			generatedKey = bytesToHex(bytes);
		}
		revealed = false;
		copied = false;
	}

	async function copyToClipboard() {
		if (!generatedKey) return;
		try {
			await navigator.clipboard.writeText(generatedKey);
			copied = true;
			toast.success('Key copied to clipboard');
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	}

	function handleTypeChange(e: Event) {
		selectedTypeId = (e.target as HTMLSelectElement).value;
		generatedKey = '';
		revealed = false;
		copied = false;
	}

	// ── QR generator (client-side) ──────────────────────────────────────────
	let qrText = $state('');
	let qrSize = $state(512);
	let qrPngUrl = $state('');
	let qrSvg = $state('');

	async function renderQr() {
		const text = qrText.trim();
		if (!text) {
			qrPngUrl = '';
			qrSvg = '';
			return;
		}
		try {
			qrPngUrl = await QRCode.toDataURL(text, { width: qrSize, margin: 1, errorCorrectionLevel: 'M' });
			qrSvg = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
		} catch {
			toast.error('Could not render QR code');
		}
	}

	$effect(() => {
		qrText;
		qrSize;
		renderQr();
	});

	function downloadDataUrl(href: string, filename: string) {
		const a = document.createElement('a');
		a.href = href;
		a.download = filename;
		a.click();
	}

	function downloadQrPng() {
		if (qrPngUrl) downloadDataUrl(qrPngUrl, 'qr.png');
	}

	function downloadQrSvg() {
		if (!qrSvg) return;
		const url = URL.createObjectURL(new Blob([qrSvg], { type: 'image/svg+xml' }));
		downloadDataUrl(url, 'qr.svg');
		URL.revokeObjectURL(url);
	}

	// ── Favicon generator (client-side, zip download) ───────────────────────
	let favFile = $state<File | null>(null);
	let favPreview = $state<string | null>(null);
	let favAppName = $state('');
	let favShortName = $state('');
	let favThemeColor = $state('#0f172a');
	let favBgColor = $state('#0f172a');
	let favBusy = $state(false);

	function onFavFile(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0] ?? null;
		favFile = f;
		if (favPreview) URL.revokeObjectURL(favPreview);
		favPreview = f ? URL.createObjectURL(f) : null;
	}

	async function pngAt(img: HTMLImageElement, size: number): Promise<Uint8Array> {
		const c = document.createElement('canvas');
		c.width = size;
		c.height = size;
		const ctx = c.getContext('2d');
		if (!ctx) throw new Error('Canvas not available');
		ctx.clearRect(0, 0, size, size);
		ctx.drawImage(img, 0, 0, size, size);
		const blob: Blob = await new Promise((res, rej) =>
			c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
		);
		return new Uint8Array(await blob.arrayBuffer());
	}

	// Build a valid .ico that embeds PNG entries (supported by modern browsers).
	function buildIco(imgs: { size: number; png: Uint8Array }[]): Uint8Array {
		const count = imgs.length;
		let offset = 6 + count * 16;
		const entries = imgs.map((im) => {
			const e = { ...im, offset, length: im.png.length };
			offset += im.png.length;
			return e;
		});
		const u8 = new Uint8Array(offset);
		const dv = new DataView(u8.buffer);
		dv.setUint16(0, 0, true);
		dv.setUint16(2, 1, true);
		dv.setUint16(4, count, true);
		let p = 6;
		for (const e of entries) {
			u8[p] = e.size >= 256 ? 0 : e.size;
			u8[p + 1] = e.size >= 256 ? 0 : e.size;
			u8[p + 2] = 0;
			u8[p + 3] = 0;
			dv.setUint16(p + 4, 1, true);
			dv.setUint16(p + 6, 32, true);
			dv.setUint32(p + 8, e.length, true);
			dv.setUint32(p + 12, e.offset, true);
			p += 16;
		}
		for (const e of entries) u8.set(e.png, e.offset);
		return u8;
	}

	async function generateFavicons() {
		if (!favFile) return;
		favBusy = true;
		try {
			const img = new Image();
			img.src = URL.createObjectURL(favFile);
			await img.decode();
			const sizes = [16, 32, 48, 180, 192, 512];
			const pngs: Record<number, Uint8Array> = {};
			for (const s of sizes) pngs[s] = await pngAt(img, s);
			URL.revokeObjectURL(img.src);

			const ico = buildIco([16, 32, 48].map((s) => ({ size: s, png: pngs[s] })));
			const manifest = {
				name: favAppName || 'App',
				short_name: favShortName || favAppName || 'App',
				icons: [
					{ src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' }
				],
				theme_color: favThemeColor,
				background_color: favBgColor,
				display: 'standalone'
			};
			const html = [
				'<link rel="icon" href="/favicon.ico" sizes="any" />',
				'<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />',
				'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
				'<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
				'<link rel="manifest" href="/site.webmanifest" />',
				`<meta name="theme-color" content="${favThemeColor}" />`
			].join('\n');

			const zip = new JSZip();
			zip.file('favicon.ico', ico);
			zip.file('favicon-16x16.png', pngs[16]);
			zip.file('favicon-32x32.png', pngs[32]);
			zip.file('favicon-48x48.png', pngs[48]);
			zip.file('apple-touch-icon.png', pngs[180]);
			zip.file('web-app-manifest-192x192.png', pngs[192]);
			zip.file('web-app-manifest-512x512.png', pngs[512]);
			zip.file('site.webmanifest', JSON.stringify(manifest, null, 2));
			zip.file('snippet.html', html);

			const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
			downloadDataUrl(url, 'favicons.zip');
			URL.revokeObjectURL(url);
			toast.success('Favicon set downloaded');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Favicon generation failed');
		} finally {
			favBusy = false;
		}
	}
</script>

<div class="mx-auto max-w-3xl">
	<header class="mb-6 flex items-center gap-3">
		<Wrench class="h-6 w-6 text-accent-primary" />
		<div>
			<h1 class="text-2xl font-bold text-white">Tools</h1>
			<p class="mt-0.5 text-sm text-slate-400">Self-contained developer utilities.</p>
		</div>
	</header>

	<section class="space-y-6">
		<h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
			<KeyRound class="h-4 w-4" /> Key Generator
		</h2>

		<div class="flex items-start gap-3 border border-accent-primary/30 bg-accent-primary/10 p-4">
			<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-accent-primary" />
			<div class="text-sm text-accent-primary/90">
				Keys are generated entirely in your browser with the Web Crypto API. Nothing is sent to a
				server or stored anywhere.
			</div>
		</div>

		<div class="space-y-2">
			<label for="key-type" class="block text-sm font-medium text-slate-300">Key Type</label>
			<select
				id="key-type"
				value={selectedTypeId}
				onchange={handleTypeChange}
				class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-accent-primary focus:outline-none"
			>
				{#each keyTypes as type (type.id)}
					<option value={type.id}>{type.name}</option>
				{/each}
			</select>
			<p class="text-sm text-slate-500">{selectedType.description}</p>
			<div class="border border-slate-800 bg-slate-900/50 px-4 py-3">
				<p class="text-sm leading-relaxed text-slate-400">{selectedType.detail}</p>
			</div>
		</div>

		{#if selectedType.format === 'password'}
			<div class="space-y-2">
				<label for="password-length" class="block text-sm font-medium text-slate-300">
					Length: {passwordLength} characters
				</label>
				<input
					id="password-length"
					type="range"
					min="16"
					max="64"
					bind:value={passwordLength}
					class="w-full accent-[var(--accent-primary)]"
				/>
				<div class="flex justify-between text-xs text-slate-600">
					<span>16</span>
					<span>64</span>
				</div>
			</div>
		{/if}

		<button
			onclick={generate}
			class="flex items-center gap-2 bg-accent-primary px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:opacity-90"
		>
			{#if generatedKey}
				<RefreshCw class="h-4 w-4" /> Regenerate
			{:else}
				<KeyRound class="h-4 w-4" /> Generate
			{/if}
		</button>

		{#if generatedKey}
			<div class="space-y-3">
				<label for="generated-key" class="block text-sm font-medium text-slate-300">
					Generated {selectedType.name}
				</label>
				<div class="flex items-center gap-2">
					<div class="relative min-w-0 flex-1">
						<input
							id="generated-key"
							type={revealed ? 'text' : 'password'}
							value={generatedKey}
							readonly
							class="w-full border border-slate-700 bg-slate-900 px-3 py-2 pr-10 font-mono text-sm text-white outline-none focus:border-accent-primary focus:outline-none"
						/>
					</div>
					<button
						onclick={() => (revealed = !revealed)}
						class="shrink-0 border border-slate-700 bg-slate-800 p-2.5 text-slate-400 transition hover:text-accent-primary"
						title={revealed ? 'Hide key' : 'Reveal key'}
					>
						{#if revealed}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
					</button>
					<button
						onclick={copyToClipboard}
						class="shrink-0 border border-slate-700 bg-slate-800 p-2.5 transition {copied
							? 'text-emerald-400'
							: 'text-slate-400 hover:text-accent-primary'}"
						title="Copy to clipboard"
					>
						{#if copied}<Check class="h-4 w-4" />{:else}<Copy class="h-4 w-4" />{/if}
					</button>
				</div>
				<p class="text-xs text-slate-600">{generatedKey.length} characters</p>
			</div>
		{/if}
	</section>

	<!-- ── QR Generator ─────────────────────────────────────────────────── -->
	<section class="mt-12 space-y-4 border-t border-slate-800 pt-8">
		<h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
			<QrIcon class="h-4 w-4" /> QR Generator
		</h2>
		<div class="space-y-2">
			<label for="qr-text" class="block text-sm font-medium text-slate-300">URL or text</label>
			<input
				id="qr-text"
				type="text"
				bind:value={qrText}
				placeholder="https://parallaxandpixel.com"
				class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-accent-primary focus:outline-none"
			/>
		</div>
		<div class="flex items-center gap-3">
			<label for="qr-size" class="text-sm text-slate-400">Size (px)</label>
			<select id="qr-size" bind:value={qrSize} class="border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none">
				<option value={256}>256</option>
				<option value={512}>512</option>
				<option value={1024}>1024</option>
			</select>
		</div>
		{#if qrPngUrl}
			<div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
				<img src={qrPngUrl} alt="QR preview" class="h-40 w-40 border border-slate-700 bg-white p-2" />
				<div class="flex flex-wrap gap-2">
					<button onclick={downloadQrPng} class="flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90">
						<Download class="h-4 w-4" /> PNG
					</button>
					<button onclick={downloadQrSvg} class="flex items-center gap-2 border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:text-accent-primary">
						<Download class="h-4 w-4" /> SVG
					</button>
				</div>
			</div>
		{/if}
	</section>

	<!-- ── Favicon Generator ────────────────────────────────────────────── -->
	<section class="mt-12 space-y-4 border-t border-slate-800 pt-8">
		<h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
			<ImageIcon class="h-4 w-4" /> Favicon Generator
		</h2>
		<p class="text-sm text-slate-500">
			Upload a square image (512×512+ PNG recommended). Generates favicon.ico, PNG sizes,
			apple-touch-icon, web manifest, and an HTML snippet — entirely in your browser — as a zip.
		</p>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-2">
				<label for="fav-file" class="block text-sm font-medium text-slate-300">Source image</label>
				<input
					id="fav-file"
					type="file"
					accept="image/*"
					onchange={onFavFile}
					class="block w-full text-sm text-slate-400 file:mr-3 file:border-0 file:bg-accent-primary file:px-3 file:py-2 file:text-slate-950"
				/>
				{#if favPreview}
					<img src={favPreview} alt="source preview" class="mt-2 h-24 w-24 border border-slate-700 object-contain" />
				{/if}
			</div>
			<div class="space-y-2">
				<label class="block text-sm font-medium text-slate-300" for="fav-app">App name</label>
				<input id="fav-app" bind:value={favAppName} class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-accent-primary focus:outline-none" />
				<label class="block text-sm font-medium text-slate-300" for="fav-short">Short name</label>
				<input id="fav-short" bind:value={favShortName} class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-accent-primary focus:outline-none" />
				<div class="flex flex-wrap gap-4 pt-1">
					<div>
						<label class="block text-xs text-slate-400" for="fav-theme">Theme color</label>
						<input id="fav-theme" type="color" bind:value={favThemeColor} class="h-9 w-16 bg-transparent" />
					</div>
					<div>
						<label class="block text-xs text-slate-400" for="fav-bg">Background</label>
						<input id="fav-bg" type="color" bind:value={favBgColor} class="h-9 w-16 bg-transparent" />
					</div>
				</div>
			</div>
		</div>
		<button
			onclick={generateFavicons}
			disabled={!favFile || favBusy}
			class="flex items-center gap-2 bg-accent-primary px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
		>
			{#if favBusy}
				<RefreshCw class="h-4 w-4 animate-spin" /> Generating…
			{:else}
				<Download class="h-4 w-4" /> Generate & download zip
			{/if}
		</button>
	</section>
</div>
