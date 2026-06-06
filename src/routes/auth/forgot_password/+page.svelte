<!-- src/routes/auth/forgot_password/+page.svelte -->
<script lang="ts">
	import type { Session, User } from '@supabase/supabase-js';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';
	import { Input } from '$lib/components/shadcn/ui/input';
	import { AnimatedButton } from '@parallaxrealms/pxp-components';

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

<div class="auth-page min-h-screen bg-slate-950">
	<!-- Background -->
	<div class="auth-background"></div>

	<div class="auth-container">
		<div class="auth-card">
			<h1 class="auth-title">Reset Password</h1>

			{#if form?.message}
				<div class="auth-message auth-message-success">
					{form.message}
				</div>
			{/if}

			{#if form?.error}
				<div class="auth-message auth-message-error">
					{form.error}
				</div>
			{/if}

			<p class="auth-description">
				Enter your email address and we'll send you a link to reset your password.
			</p>

			<form method="POST" action="?/reset" use:enhance={handleSubmit} class="auth-form">
				<div class="form-group">
					<label for="reset-email" class="form-label">Email address</label>
					<Input
						id="reset-email"
						name="email"
						bind:value={email}
						type="email"
						placeholder="Enter your email"
						autocomplete="email"
						required
					/>
				</div>

				<div class="form-submit">
					<AnimatedButton
						gradient="custom"
						customColors={['#00a5cf', '#9fffcb', '#25a18e']}
						size="lg"
						class="w-full px-6 py-3 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-60"
						type="submit"
						disabled={loading}
					>
						<span class="btn-text">
							{loading ? 'Sending...' : 'Reset Password'}
						</span>
					</AnimatedButton>
				</div>
			</form>

			<div class="auth-footer">
				Remember your password?
				<a href="/auth" class="auth-link auth-link-primary">Sign In</a>
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

	.auth-card {
		width: 100%;
		max-width: 28rem;
		margin: 5rem auto 0;
		background-color: #1e293b; /* slate-800 */
		backdrop-filter: blur(10px);
		border: 1px solid #334155; /* slate-700 */
		padding: 2rem;
	}

	.auth-title {
		margin-bottom: 1rem;
		background: linear-gradient(to right, #00a5cf, #9fffcb, #25a18e);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-size: 1.875rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-align: center;
	}

	.auth-description {
		margin-bottom: 1.5rem;
		color: #94a3b8;
		font-size: 0.875rem;
		text-align: center;
		line-height: 1.5;
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
		gap: 1.25rem;
	}

	.form-group {
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

	.form-submit {
		padding-top: 0.5rem;
	}

	.btn-text {
		font-size: 1.125rem;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	/* Footer */
	.auth-footer {
		margin-top: 1.5rem;
		text-align: center;
		font-size: 0.875rem;
		color: #94a3b8;
	}

	.auth-link {
		color: #f1f5f9;
		text-decoration: none;
		margin-left: 0.25rem;
		transition: color 150ms;
	}

	.auth-link-primary:hover {
		color: #00a5cf;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.auth-card {
			padding: 1.5rem;
		}

		.auth-title {
			font-size: 1.5rem;
		}
	}
</style>
