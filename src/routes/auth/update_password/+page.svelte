<!-- src/routes/auth/update_password/+page.svelte -->
<script lang="ts">
	import type { Session, User } from '@supabase/supabase-js';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';
	import { Button } from '$lib/components/shadcn/ui/button';
	import { PasswordInput } from '@parallaxrealms/pxp-components';

	interface ActionData {
		success?: boolean;
		error?: string;
		message?: string;
	}

	let { data, form = null } = $props<{
		session: Session | null;
		user: User | null;
		form: ActionData | null;
	}>();
	let supabase = $derived.by(() => data.supabase);

	let loading = $state(false);
	let password = $state('');
	let confirmPassword = $state('');
	let passwordsMatch = $derived(password === confirmPassword);
	let showSuccessMessage = $state(false);
	let redirectCountdown = $state(5);
	let redirectTimer: number | null = null;

	function startRedirectCountdown() {
		let countdown = 5;
		redirectCountdown = countdown;

		const interval = window.setInterval(() => {
			countdown -= 1;
			redirectCountdown = countdown;

			if (countdown <= 0) {
				window.clearInterval(interval);
				window.location.href =
					'/auth?success=password_reset&message=Your password has been successfully updated. Please sign in with your new password.';
			}
		}, 1000);

		redirectTimer = window.setTimeout(() => {
			window.location.href =
				'/auth?success=password_reset&message=Your password has been successfully updated. Please sign in with your new password.';
		}, 5500);
	}

	const handleSubmit = ({ formElement }: { formElement: HTMLFormElement }) => {
		loading = true;
		console.log('Form submission started');

		return async ({ result }: { result: ActionResult }) => {
			console.log('Form submission result:', result.type);

			if (result.type === 'redirect') {
				console.log('Redirect to:', result.location);
				await applyAction(result);
				return;
			}

			if (result.type === 'success') {
				console.log('Success result:', result.data);

				if (result.data?.success) {
					showSuccessMessage = true;

					const { error } = await supabase.auth.signOut();
					if (error) {
						console.error('Error signing out:', error);
					} else {
						console.log('User signed out successfully');
					}

					const url = new URL(window.location.href);
					url.searchParams.set('success', 'true');
					window.history.replaceState({}, '', url.toString());

					startRedirectCountdown();
				}
			}

			await applyAction(result);
			loading = false;
		};
	};

	// Clean up the timer if component is destroyed
	$effect(() => {
		return () => {
			if (redirectTimer !== null) {
				window.clearTimeout(redirectTimer);
				redirectTimer = null;
			}
		};
	});
</script>

<div class="w-full max-w-md">
	<!-- Terminal panel (About-terminal CRT frame, translucent) -->
	<div
		class="w-full border border-cyan-800/40 bg-slate-900/60 p-6 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)] sm:p-8"
	>
		<!-- Prompt -->
		<div class="mb-6 font-terminal text-sm text-accent-highlight">
			<span class="text-slate-500">parallax@dev:~$</span> auth --update-password<span class="cursor-blink">_</span>
		</div>

		<!-- Heading -->
		<h1 class="mb-4 text-center text-3xl font-bold text-slate-100">Update Password</h1>

		{#if showSuccessMessage}
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent-primary to-accent-highlight text-3xl font-bold text-slate-950"
				>
					✓
				</div>
				<h2 class="mb-3 text-2xl font-bold text-slate-100">Success!</h2>
				<p class="mb-4 font-terminal text-sm text-slate-400">
					Your password has been successfully updated.
				</p>
				<p class="mb-6 font-terminal text-sm text-slate-300">
					Redirecting to login page in
					<span class="text-lg font-bold text-accent-primary">{redirectCountdown}</span>
					seconds...
				</p>
				<div class="mb-6 h-2 w-full overflow-hidden bg-slate-700/60">
					<div
						class="h-full bg-gradient-to-r from-accent-primary via-accent-highlight to-accent-secondary transition-[width] duration-1000 ease-linear"
						style="width: {((5 - redirectCountdown) / 5) * 100}%"
					></div>
				</div>
				<div class="flex justify-center">
					<a
						href="/auth?success=password_reset&message=Your password has been successfully updated. Please sign in with your new password."
						class="inline-block border border-accent-primary bg-accent-primary/10 px-6 py-3 font-terminal text-sm font-bold text-accent-primary transition-all hover:bg-accent-primary hover:text-slate-900"
					>
						Go to Login Now
					</a>
				</div>
			</div>
		{:else}
			{#if form?.error}
				<div class="mb-4 border border-red-500/30 bg-red-500/10 p-3 font-terminal text-sm text-red-400">
					{form.error}
				</div>
			{/if}

			<p class="mb-6 text-center font-terminal text-sm leading-relaxed text-slate-400">
				Please enter your new password below.
			</p>

			<form method="POST" use:enhance={handleSubmit} class="flex flex-col gap-5">
				<PasswordInput
					id="password"
					name="password"
					bind:value={password}
					label="New Password"
					placeholder="Enter your new password"
					autocomplete="new-password"
					required={true}
					helperText="Must be at least 6 characters"
					class="rounded-lg"
				/>

				<PasswordInput
					id="confirm-password"
					name="confirmPassword"
					bind:value={confirmPassword}
					label="Confirm New Password"
					placeholder="Confirm your new password"
					autocomplete="new-password"
					required={true}
					class="rounded-lg"
				/>

				{#if confirmPassword && !passwordsMatch}
					<p class="-mt-2 font-terminal text-sm text-red-400">Passwords do not match</p>
				{/if}

				<div class="pt-2">
					<Button
						type="submit"
						size="lg"
						class="w-full bg-accent-primary px-6 py-3 font-terminal text-base font-bold text-slate-900 hover:bg-accent-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
						disabled={loading || !passwordsMatch || !password}
					>
						{loading ? 'Updating...' : 'Update Password'}
					</Button>
				</div>
			</form>
		{/if}

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
