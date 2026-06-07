<!-- src/routes/auth/+page.svelte -->
<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { loginSchema, magicLinkSchema } from '@parallaxrealms/pxp-types/schemas';
	import { Button } from '$lib/components/shadcn/ui/button/index.js';
	import { Input } from '$lib/components/shadcn/ui/input';
	import { PasswordInput } from '@parallaxrealms/pxp-components';

	let { data }: { data: PageData } = $props();

	let showMagicLink = $state(false);

	// Login form
	const {
		form: loginForm,
		message: loginMessage,
		errors: loginErrors,
		enhance: loginEnhance,
		delayed: loginDelayed
	} = superForm(data.loginForm, {
validators: zodClient(loginSchema),
		resetForm: false,
		taintedMessage: null
	});

	// Magic link form
	const {
		form: magicForm,
		message: magicMessage,
		errors: magicErrors,
		enhance: magicEnhance,
		delayed: magicDelayed
	} = superForm(data.magicLinkForm, {
validators: zodClient(magicLinkSchema),
		resetForm: false,
		taintedMessage: null
	});
</script>

<div class="w-full max-w-md">
	<!-- Terminal panel (About-terminal CRT frame, translucent) -->
	<div
		class="w-full border border-cyan-800/40 bg-slate-900/60 p-6 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)] sm:p-8"
	>
		<!-- Prompt -->
		<div class="mb-6 font-terminal text-sm text-accent-highlight">
			<span class="text-slate-500">parallax@dev:~$</span> auth --login<span class="cursor-blink">_</span>
		</div>

		<!-- Heading -->
		<h1 class="mb-6 text-center text-3xl font-bold text-slate-100">Sign In</h1>

		<!-- Success message from password reset or other redirects -->
		{#if data.message}
			<div
				class="mb-4 border border-accent-primary/30 bg-accent-primary/10 p-3 font-terminal text-sm text-accent-primary"
			>
				{data.message}
			</div>
		{/if}

		<!-- Login form messages -->
		{#if $loginMessage}
			<div
				class="mb-4 border p-3 font-terminal text-sm {$loginMessage.includes('success') ||
				$loginMessage.includes('Thank')
					? 'border-accent-primary/30 bg-accent-primary/10 text-accent-primary'
					: 'border-red-500/30 bg-red-500/10 text-red-400'}"
			>
				{$loginMessage}
			</div>
		{/if}

		<!-- Normal Login Form -->
		<form method="POST" action="?/signin_email" use:loginEnhance class="flex flex-col gap-5">
			<div class="flex flex-col gap-2">
				<label for="email" class="font-terminal text-sm text-slate-300">Email</label>
				<Input
					id="email"
					name="email"
					bind:value={$loginForm.email}
					type="email"
					placeholder="Enter your email"
					autocomplete="email"
					class="font-terminal"
					aria-invalid={$loginErrors.email ? 'true' : undefined}
				/>
				{#if $loginErrors.email}
					<p class="font-terminal text-sm text-red-400">{$loginErrors.email}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<label for="password" class="font-terminal text-sm text-slate-300">Password</label>
				<PasswordInput
					id="password"
					name="password"
					bind:value={$loginForm.password as string}
					placeholder="Enter your password"
					autocomplete="current-password"
				/>
				{#if $loginErrors.password}
					<p class="font-terminal text-sm text-red-400">{$loginErrors.password}</p>
				{/if}
			</div>

			<div class="pt-2">
				<Button
					type="submit"
					size="lg"
					class="w-full bg-accent-primary px-6 py-3 font-terminal text-base font-bold text-slate-900 hover:bg-accent-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={$loginDelayed}
				>
					{$loginDelayed ? 'Signing in...' : 'Sign In'}
				</Button>
			</div>
		</form>

		<div class="mt-6 flex items-center justify-center">
			<a
				href="/auth/forgot_password"
				class="font-terminal text-sm text-slate-400 transition-colors hover:text-accent-primary"
			>
				Forgot password?
			</a>
		</div>

		<!-- Divider -->
		<div class="my-6 flex items-center gap-4 font-terminal text-xs text-slate-500">
			<div class="h-px flex-1 bg-gradient-to-r from-transparent to-accent-primary/40"></div>
			<span>OR</span>
			<div class="h-px flex-1 bg-gradient-to-l from-transparent to-accent-primary/40"></div>
		</div>

		<div class="flex flex-col gap-4">
			<Button
				variant="outline"
				size="lg"
				class="w-full border border-cyan-800/40 bg-slate-900/40 px-5 py-3 font-terminal text-base font-bold text-accent-primary transition-all hover:bg-accent-primary hover:text-slate-900"
				onclick={() => (showMagicLink = !showMagicLink)}
			>
				Login with Magic Link
			</Button>

			{#if showMagicLink}
				<form method="POST" action="?/magic" use:magicEnhance class="mt-2">
					{#if $magicMessage}
						<div
							class="mb-3 border p-3 font-terminal text-sm {$magicMessage.includes('check your email')
								? 'border-accent-primary/30 bg-accent-primary/10 text-accent-primary'
								: 'border-red-500/30 bg-red-500/10 text-red-400'}"
						>
							{$magicMessage}
						</div>
					{/if}

					<div class="flex flex-col gap-2">
						<Input
							id="magic-email"
							name="email"
							bind:value={$magicForm.email}
							type="email"
							placeholder="Enter your email"
							class="font-terminal"
							aria-invalid={$magicErrors.email ? 'true' : undefined}
						/>
						{#if $magicErrors.email}
							<p class="font-terminal text-sm text-red-400">{$magicErrors.email}</p>
						{/if}
						<Button
							type="submit"
							class="mt-2 w-full bg-accent-primary font-terminal font-bold text-slate-900 hover:bg-accent-primary/80"
							disabled={$magicDelayed}
						>
							{$magicDelayed ? 'Sending...' : 'Send Link'}
						</Button>
					</div>
				</form>
			{/if}
		</div>

		<!-- Footer prompt -->
		<div class="mt-8 font-terminal text-sm text-slate-500">
			parallax@dev:~$ <span class="cursor-blink text-accent-highlight">_</span>
		</div>
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
