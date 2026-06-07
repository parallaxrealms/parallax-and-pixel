<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { Session } from '@supabase/supabase-js';

	let { data } = $props<{ data: { session: Session | null; supabase: any } }>();

	let session = $derived(data.session);
	let supabase = $derived(data.supabase);

	// Define proper types
	interface JWTHeader {
		typ: string;
		alg: string;
		kid?: string;
	}

	interface JWTClaims {
		sub?: string;
		email?: string;
		iat?: number;
		exp?: number;
		iss?: string;
		aud?: string;
		role?: string;
		user_metadata?: any;
		app_metadata?: any;
		is_anonymous?: boolean;
		[key: string]: any;
	}

	// JWT parts
	let jwtHeader = $state<JWTHeader | null>(null);
	let jwtPayload = $state<JWTClaims | null>(null);
	let jwtSignature = $state<string | null>(null);
	let claims = $state<JWTClaims | null>(null);
	let verificationMethod = $state<string>('Unknown');

	// Function to decode JWT parts manually
	function decodeJWT(token: string) {
		try {
			const parts = token.split('.');
			if (parts.length !== 3) {
				throw new Error('Invalid JWT format');
			}

			// Decode header
			const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));

			// Decode payload
			const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

			// Get signature (keep as base64)
			const signature = parts[2];

			return { header, payload, signature };
		} catch (error) {
			console.error('Failed to decode JWT:', error);
			return null;
		}
	}

	$effect(() => {
		if (session?.access_token) {
			// Decode the JWT manually to show header and payload
			const decoded = decodeJWT(session.access_token);
			if (decoded) {
				jwtHeader = decoded.header;
				jwtPayload = decoded.payload;
				jwtSignature = decoded.signature;
			}
		}

		if (supabase) {
			// Get claims using the new getClaims method
			const getClaims = async () => {
				try {
					const { data: claimsData, error } = await supabase.auth.getClaims();
					if (!error && claimsData) {
						// Handle nested claims structure
						const actualClaims = claimsData.claims || claimsData;
						claims = actualClaims;
						verificationMethod = 'getClaims() - Optimized verification';
					}
				} catch (err) {
					console.error('Failed to get claims:', err);
					verificationMethod = 'getClaims() failed - Check console';
				}
			};

			getClaims();
		}
	});

	const goBack = () => {
		if (typeof history !== 'undefined') {
			history.back();
		}
	};

	const goHome = () => {
		goto('/');
	};

	</script>

<div class="w-full max-w-6xl">
	<!-- Prompt -->
	<div class="mb-4 font-terminal text-sm text-accent-highlight">
		<span class="text-slate-500">parallax@dev:~$</span> auth --session<span class="cursor-blink">_</span>
	</div>

	<h1 class="my-2 text-3xl font-bold text-slate-100 sm:text-4xl">Current Session Data</h1>

	<!-- JWT Information Header -->
	<div
		class="mb-4 mt-4 border border-cyan-800/40 bg-slate-900/60 p-4 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)]"
	>
		<h2 class="mb-2 font-terminal text-xl font-semibold text-accent-primary">JWT Information</h2>
		<div class="text-sm text-slate-300">
			<p class="mb-2">Your JWT is being verified using:</p>
			<ul class="list-inside list-disc space-y-1 text-slate-400">
				<li>Asymmetric keys (JWKS) - New method, no network calls</li>
				<li>Symmetric keys (JWT_SECRET) - Legacy fallback method</li>
			</ul>
			<p class="mt-2 font-terminal text-xs text-slate-500">
				<strong>Current Method:</strong>
				{verificationMethod}
			</p>
		</div>
	</div>

	<!-- First Row: JWT Header and Payload -->
	<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- JWT Header -->
		<div
			class="border border-cyan-800/40 bg-slate-900/60 p-4 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)]"
		>
			<h2 class="mb-3 font-terminal text-xl font-semibold text-accent-primary">JWT Header</h2>
			{#if jwtHeader}
				<div class="space-y-2 text-sm text-slate-300">
					<div><strong>Type:</strong> {jwtHeader.typ || 'N/A'}</div>
					<div><strong>Algorithm:</strong> {jwtHeader.alg || 'N/A'}</div>
					<div><strong>Key ID:</strong> {jwtHeader.kid || 'Not present (symmetric)'}</div>
				</div>

				<details class="mt-4">
					<summary
						class="cursor-pointer font-terminal text-sm text-accent-primary hover:text-accent-secondary"
					>
						View Full Header Object
					</summary>
					<pre class="mt-2 overflow-auto bg-slate-950/70 p-3 font-terminal text-xs text-slate-300">
{JSON.stringify(jwtHeader, null, 2)}
					</pre>
				</details>
			{:else}
				<p class="font-terminal text-sm text-slate-400">No JWT header found</p>
			{/if}
		</div>

		<!-- JWT Payload (Raw Decoded) -->
		<div
			class="border border-cyan-800/40 bg-slate-900/60 p-4 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)]"
		>
			<h2 class="mb-3 font-terminal text-xl font-semibold text-accent-highlight">
				JWT Payload (Raw Decoded)
			</h2>
			{#if jwtPayload}
				<div class="space-y-2 text-sm text-slate-300">
					<div><strong>Subject (sub):</strong> {jwtPayload.sub || 'N/A'}</div>
					<div><strong>Email:</strong> {jwtPayload.email || 'N/A'}</div>
					<div><strong>Role:</strong> {jwtPayload.role || 'N/A'}</div>
					<div><strong>Issuer:</strong> {jwtPayload.iss || 'N/A'}</div>
					<div><strong>Audience:</strong> {jwtPayload.aud || 'N/A'}</div>
					<div>
						<strong>Issued At:</strong>
						{jwtPayload.iat ? new Date(jwtPayload.iat * 1000).toLocaleString() : 'N/A'}
					</div>
					<div>
						<strong>Expires At:</strong>
						{jwtPayload.exp ? new Date(jwtPayload.exp * 1000).toLocaleString() : 'N/A'}
					</div>
					<div><strong>Is Anonymous:</strong> {jwtPayload.is_anonymous ? 'Yes' : 'No'}</div>
				</div>

				<details class="mt-4">
					<summary
						class="cursor-pointer font-terminal text-sm text-accent-highlight hover:text-accent-primary"
					>
						View Full Payload Object
					</summary>
					<pre class="mt-2 overflow-auto bg-slate-950/70 p-3 font-terminal text-xs text-slate-300">
{JSON.stringify(jwtPayload, null, 2)}
					</pre>
				</details>
			{:else}
				<p class="font-terminal text-sm text-slate-400">No JWT payload found</p>
			{/if}
		</div>
	</div>

	<!-- Second Row: Session and Claims -->
	<div class="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Session Data -->
		<div
			class="border border-cyan-800/40 bg-slate-900/60 p-4 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)]"
		>
			<h2 class="mb-3 font-terminal text-xl font-semibold text-accent-primary">
				Session (from getSession)
			</h2>
			{#if session}
				<div class="space-y-2 text-sm text-slate-300">
					<div><strong>User ID:</strong> {session.user?.id || 'N/A'}</div>
					<div><strong>Email:</strong> {session.user?.email || 'N/A'}</div>
					<div><strong>Username:</strong> {session.user?.user_metadata?.username || 'N/A'}</div>
					<div>
						<strong>Expires At:</strong>
						{session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}
					</div>
					<div><strong>Token Type:</strong> {session.token_type || 'N/A'}</div>
					<div><strong>Is Anonymous:</strong> {session.user?.is_anonymous ? 'Yes' : 'No'}</div>
				</div>

				<details class="mt-4">
					<summary
						class="cursor-pointer font-terminal text-sm text-accent-primary hover:text-accent-secondary"
					>
						View Full Session Object
					</summary>
					<pre class="mt-2 overflow-auto bg-slate-950/70 p-3 font-terminal text-xs text-slate-300">
{JSON.stringify(session, null, 2)}
					</pre>
				</details>
			{:else}
				<p class="font-terminal text-sm text-slate-400">No session found</p>
			{/if}
		</div>

		<!-- Claims Data -->
		<div
			class="border border-cyan-800/40 bg-slate-900/60 p-4 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)]"
		>
			<h2 class="mb-3 font-terminal text-xl font-semibold text-accent-highlight">
				Claims (from getClaims)
			</h2>
			<div class="mb-3 font-terminal text-xs text-slate-400">
				<strong>Verification Method:</strong>
				{verificationMethod}
			</div>
			{#if claims}
				<div class="space-y-2 text-sm text-slate-300">
					<div><strong>Subject (sub):</strong> {claims.sub || 'N/A'}</div>
					<div><strong>Email:</strong> {claims.email || 'N/A'}</div>
					<div><strong>Role:</strong> {claims.role || 'N/A'}</div>
					<div>
						<strong>Issued At:</strong>
						{claims.iat ? new Date(claims.iat * 1000).toLocaleString() : 'N/A'}
					</div>
					<div>
						<strong>Expires At:</strong>
						{claims.exp ? new Date(claims.exp * 1000).toLocaleString() : 'N/A'}
					</div>
					<div><strong>Issuer:</strong> {claims.iss || 'N/A'}</div>
					<div><strong>Audience:</strong> {claims.aud || 'N/A'}</div>
				</div>

				<details class="mt-4">
					<summary
						class="cursor-pointer font-terminal text-sm text-accent-highlight hover:text-accent-primary"
					>
						View Full Claims Object
					</summary>
					<pre class="mt-2 overflow-auto bg-slate-950/70 p-3 font-terminal text-xs text-slate-300">
{JSON.stringify(claims, null, 2)}
					</pre>
				</details>
			{:else}
				<p class="font-terminal text-sm text-slate-400">No claims found or still loading...</p>
			{/if}
		</div>
	</div>
	<!-- Third Row: JWT Signature (Full Width) -->
	<div class="mb-4">
		<div
			class="border border-cyan-800/40 bg-slate-900/60 p-4 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)]"
		>
			<h2 class="mb-3 font-terminal text-xl font-semibold text-accent-primary">JWT Signature</h2>
			{#if jwtSignature}
				<div class="text-sm text-slate-300">
					<div class="break-all bg-slate-950/70 p-3 font-terminal text-xs">
						{jwtSignature}
					</div>
					<p class="mt-2 font-terminal text-xs text-slate-500">
						This signature is verified by your server using either asymmetric (JWKS) or symmetric
						(JWT_SECRET) methods. Algorithm used: <strong>{jwtHeader?.alg || 'Unknown'}</strong>
					</p>
				</div>
			{:else}
				<p class="font-terminal text-sm text-slate-400">No JWT signature found</p>
			{/if}
		</div>
	</div>

	<!-- Navigation Buttons -->
	<div class="mt-4 flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
		<button
			class="cursor-pointer border border-accent-primary bg-transparent px-6 py-2 font-terminal text-sm font-bold text-accent-primary transition-all hover:bg-accent-primary hover:text-slate-950"
			onclick={goBack}
		>
			Go Back
		</button>

		<button
			class="cursor-pointer border border-accent-primary bg-transparent px-6 py-2 font-terminal text-sm font-bold text-accent-primary transition-all hover:bg-accent-primary hover:text-slate-950"
			onclick={goHome}
		>
			Go Home
		</button>
	</div>
</div>

<style>
	.cursor-blink {
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>
