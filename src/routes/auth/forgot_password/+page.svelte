<!-- src/routes/auth/forgot_password/+page.svelte -->
<script lang="ts">
	import type { Session, User } from '@supabase/supabase-js';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';
	import { Input } from '$lib/components/shadcn/ui/input';
	import { Button } from '$lib/components/shadcn/ui/button';

	interface ActionData {
		message?: string;
		error?: string;
		reset?: {
			error?: string;
			success?: boolean;
			values?: {
				email?: string;
			};
		};
	}

	let { data, form = null } = $props<{
		session: Session | null;
		user: User | null;
		form: ActionData | null;
	}>();
	let loading = $state(false);
	let email = $state('');

	const handleSubmit = ({ formElement }: { formElement: HTMLFormElement }) => {
		loading = true;

		return async ({ result }: { result: ActionResult }) => {
			if (result.type === 'success') {
				await invalidateAll();
			}

			await applyAction(result);
			loading = false;
		};
	};
</script>

<div class="w-full max-w-md">
	<!-- Terminal panel (About-terminal CRT frame, translucent) -->
	<div
		class="w-full border border-cyan-800/40 bg-slate-900/60 p-6 backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)] sm:p-8"
	>
		<!-- Prompt -->
		<div class="mb-6 font-terminal text-sm text-accent-highlight">
			<span class="text-slate-500">parallax@dev:~$</span> auth --reset-password<span class="cursor-blink">_</span>
		</div>

		<!-- Heading -->
		<h1 class="mb-4 text-center text-3xl font-bold text-slate-100">Reset Password</h1>

		{#if form?.message}
			<div
				class="mb-4 border border-accent-primary/30 bg-accent-primary/10 p-3 font-terminal text-sm text-accent-primary"
			>
				{form.message}
			</div>
		{/if}

		{#if form?.error}
			<div class="mb-4 border border-red-500/30 bg-red-500/10 p-3 font-terminal text-sm text-red-400">
				{form.error}
			</div>
		{/if}

		<p class="mb-6 text-center font-terminal text-sm leading-relaxed text-slate-400">
			Enter your email address and we'll send you a link to reset your password.
		</p>

		<form method="POST" action="?/reset" use:enhance={handleSubmit} class="flex flex-col gap-5">
			<div class="flex flex-col gap-2">
				<label for="reset-email" class="font-terminal text-sm text-slate-300">Email address</label>
				<Input
					id="reset-email"
					name="email"
					bind:value={email}
					type="email"
					placeholder="Enter your email"
					autocomplete="email"
					class="font-terminal"
					required
				/>
			</div>

			<div class="pt-2">
				<Button
					type="submit"
					size="lg"
					class="w-full bg-accent-primary px-6 py-3 font-terminal text-base font-bold text-slate-900 hover:bg-accent-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={loading}
				>
					{loading ? 'Sending...' : 'Reset Password'}
				</Button>
			</div>
		</form>

		<!-- Divider -->
		<div class="my-6 h-px bg-gradient-to-r from-transparent via-accent-primary/40 to-transparent"></div>

		<div class="text-center font-terminal text-sm text-slate-400">
			Remember your password?
			<a href="/auth" class="ml-1 text-slate-200 transition-colors hover:text-accent-primary">Sign In</a>
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
