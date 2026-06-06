<!-- src/routes/auth/+page.svelte -->
<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { loginSchema, magicLinkSchema } from '@parallaxrealms/pxp-types/schemas';
	import { Button } from '$lib/components/shadcn/ui/button/index.js';
	import { Input } from '$lib/components/shadcn/ui/input';
	import { AnimatedButton, GradientText, PasswordInput } from '@parallaxrealms/pxp-components';

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

<div class="auth-page min-h-screen bg-slate-950">
	<!-- Background Gradient -->
	<div class="auth-background"></div>

	<div class="auth-container">
		<div class="auth-wrapper">
			<div class="auth-card">
				<GradientText
					text="Login"
					variant="custom"
					lightColors={['#00a5cf', '#9fffcb', '#25a18e']}
					darkColors={['#00a5cf', '#9fffcb', '#25a18e']}
					size="4xl"
					class="mb-6 text-center font-bold md:text-5xl lg:text-6xl"
				/>

				<!-- Success message from password reset or other redirects -->
				{#if data.message}
					<div class="auth-message auth-message-success">
						{data.message}
					</div>
				{/if}

				<!-- Login form messages -->
				{#if $loginMessage}
					<div
						class="auth-message {$loginMessage.includes('success') ||
						$loginMessage.includes('Thank')
							? 'auth-message-success'
							: 'auth-message-error'}"
					>
						{$loginMessage}
					</div>
				{/if}

				<!-- Normal Login Form -->
				<form method="POST" action="?/signin_email" use:loginEnhance class="auth-form">
					<div class="form-group">
						<label for="email" class="form-label">Email</label>
						<Input
							id="email"
							name="email"
							bind:value={$loginForm.email}
							type="email"
							placeholder="Enter your email"
							autocomplete="email"
							aria-invalid={$loginErrors.email ? 'true' : undefined}
						/>
						{#if $loginErrors.email}
							<p class="form-error">{$loginErrors.email}</p>
						{/if}
					</div>

					<div class="form-group">
						<label for="password" class="form-label">Password</label>
						<PasswordInput
							id="password"
							name="password"
							bind:value={$loginForm.password as string}
							placeholder="Enter your password"
							autocomplete="current-password"
						/>
						{#if $loginErrors.password}
							<p class="form-error">{$loginErrors.password}</p>
						{/if}
					</div>

					<div class="form-submit">
						<AnimatedButton
							gradient="custom"
							customColors={['#00a5cf', '#9fffcb', '#25a18e']}
							size="lg"
							class="w-full px-6 py-3 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-60"
							type="submit"
							disabled={$loginDelayed}
						>
							<span class="btn-text">
								{$loginDelayed ? 'Signing in...' : 'Sign In'}
							</span>
						</AnimatedButton>
					</div>
				</form>

				<div class="auth-links">
					<a href="/auth/forgot_password" class="auth-link">Forgot password?</a>
				</div>

				<div class="auth-divider">
					<span>OR</span>
				</div>

				<div class="auth-alternatives">
					<Button
						variant="outline"
						size="lg"
						class="w-full border-2 border-accent-primary bg-slate-800/60 px-5 py-3 text-lg font-bold text-accent-primary transition-all hover:bg-accent-primary hover:text-slate-900"
						onclick={() => (showMagicLink = !showMagicLink)}
					>
						Login with Magic Link
					</Button>

					{#if showMagicLink}
						<form method="POST" action="?/magic" use:magicEnhance class="mt-4">
							{#if $magicMessage}
								<div
									class="mb-3 rounded-lg p-3 text-sm {$magicMessage.includes('check your email')
										? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
										: 'bg-red-500/10 text-red-600 dark:text-red-400'}"
								>
									{$magicMessage}
								</div>
							{/if}

							<div class="form-group-inline">
								<div class="form-input-group">
									<Input
										id="magic-email"
										name="email"
										bind:value={$magicForm.email}
										type="email"
										placeholder="Enter your email"
										aria-invalid={$magicErrors.email ? 'true' : undefined}
									/>
									{#if $magicErrors.email}
										<p class="form-error mt-1">{$magicErrors.email}</p>
									{/if}
									<Button type="submit" class="mt-2 w-full" disabled={$magicDelayed}>
										{$magicDelayed ? 'Sending...' : 'Send Link'}
									</Button>
								</div>
							</div>
						</form>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.auth-background {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 50% 0%, rgba(0, 165, 207, 0.15) 0%, transparent 50%),
			radial-gradient(circle at 0% 50%, rgba(37, 161, 142, 0.1) 0%, transparent 50%),
			radial-gradient(circle at 100% 50%, rgba(159, 255, 203, 0.1) 0%, transparent 50%);
		opacity: 0.6;
	}

	.auth-container {
		position: relative;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.auth-wrapper {
		width: 100%;
		max-width: 1280px;
		margin: 0 auto;
	}

	.auth-card {
		width: 100%;
		max-width: 28rem;
		margin: 5rem auto 0;
		background-color: #1e293b; /* slate-800 */
		backdrop-filter: blur(10px);
		border: 1px solid #334155; /* slate-700 */
		padding: 2rem;
	}

	/* Messages */
	.auth-message {
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
	}

	.auth-message-success {
		background-color: rgba(0, 165, 207, 0.1);
		color: #00a5cf;
		border: 1px solid rgba(0, 165, 207, 0.3);
	}

	.auth-message-error {
		background-color: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	/* Form Elements */
	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group-inline {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		display: block;
		text-align: left;
		font-size: 0.875rem;
		font-weight: 500;
		color: #cbd5e1; /* slate-300 */
	}

	.form-input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-error {
		font-size: 0.875rem;
		color: #ef4444;
		margin-top: 0.25rem;
	}

	.form-submit {
		padding-top: 0.5rem;
	}

	.btn-text {
		font-size: 1.125rem;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	/* Links */
	.auth-links {
		margin-top: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.auth-link {
		font-size: 0.875rem;
		color: #94a3b8; /* slate-400 */
		text-decoration: none;
		transition: color 150ms;
	}

	.auth-link:hover {
		color: #00a5cf; /* accent-primary */
	}

	/* Divider */
	.auth-divider {
		margin: 1.5rem 0;
		display: flex;
		align-items: center;
		color: #64748b; /* slate-500 */
		font-size: 0.75rem;
	}

	.auth-divider::before,
	.auth-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background-color: #334155; /* slate-700 */
	}

	.auth-divider span {
		margin: 0 1rem;
	}

	/* Alternatives */
	.auth-alternatives {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.auth-card {
			padding: 1.5rem;
			margin-top: 4rem;
		}

		.auth-links {
			flex-direction: column;
			align-items: stretch;
			text-align: center;
		}
	}
</style>
