<!-- src/routes/auth/update_password/+page.svelte -->
<script lang="ts">
	import type { Session, User } from '@supabase/supabase-js';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';
	import { AnimatedButton, PasswordInput } from '@parallaxrealms/pxp-components';

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

<div class="auth-page">
	<!-- Background -->
	<div class="auth-background"></div>

	<div class="auth-container center-center">
		<div class="auth-card">
			<h1 class="auth-title">Update Password</h1>

			{#if showSuccessMessage}
				<div class="success-overlay">
					<div class="success-card">
						<div class="success-icon">✓</div>
						<h2 class="success-title">Success!</h2>
						<p class="success-text">Your password has been successfully updated.</p>
						<p class="success-countdown">
							Redirecting to login page in <span class="countdown-number">{redirectCountdown}</span>
							seconds...
						</p>
						<div class="progress-bar">
							<div
								class="progress-fill"
								style="width: {((5 - redirectCountdown) / 5) * 100}%"
							></div>
						</div>
						<div class="success-link-wrapper">
							<a
								href="/auth?success=password_reset&message=Your password has been successfully updated. Please sign in with your new password."
								class="success-link"
							>
								Go to Login Now
							</a>
						</div>
					</div>
				</div>
			{:else}
				{#if form?.error}
					<div class="auth-message auth-message-error">
						{form.error}
					</div>
				{/if}

				<p class="auth-description">Please enter your new password below.</p>

				<form method="POST" use:enhance={handleSubmit} class="auth-form">
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
						<p class="password-mismatch">Passwords do not match</p>
					{/if}

					<div class="form-submit">
						<AnimatedButton
							gradient="custom"
							customColors={['#00a5cf', '#9fffcb', '#25a18e']}
							size="lg"
							class="auth-submit-btn"
							type="submit"
							disabled={loading || !passwordsMatch || !password}
						>
							<span class="btn-text">
								{loading ? 'Updating...' : 'Update Password'}
							</span>
						</AnimatedButton>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>

<style>
	.auth-page {
		position: relative;
		min-height: 100vh;
		background-color: #020617; /* slate-950 */
	}

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
		min-height: 100vh;
		z-index: 10;
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

	.password-mismatch {
		font-size: 0.875rem;
		color: #ef4444;
		margin-top: -0.5rem;
	}

	.form-submit {
		padding-top: 0.5rem;
	}

	:global(.auth-submit-btn) {
		width: 100%;
		padding: 1rem;
		font-size: 1.125rem;
		font-weight: 700;
		color: #000;
		letter-spacing: 0.05em;
		transition: all 200ms;
	}

	:global(.auth-submit-btn:disabled) {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.btn-text {
		font-size: 1.125rem;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	/* Success Overlay */
	.success-overlay {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.success-card {
		width: 100%;
		background-color: #1e293b;
		border: 1px solid #334155;
		padding: 2rem;
		text-align: center;
	}

	.success-icon {
		margin: 0 auto 1rem;
		width: 4rem;
		height: 4rem;
		border-radius: 50%;
		background: linear-gradient(135deg, #00a5cf, #9fffcb);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: #020617;
		font-weight: 700;
	}

	.success-title {
		margin-bottom: 0.75rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.success-text {
		margin-bottom: 1rem;
		color: #94a3b8;
		font-size: 1rem;
	}

	.success-countdown {
		margin-bottom: 1.5rem;
		color: #cbd5e1;
		font-size: 0.875rem;
	}

	.countdown-number {
		font-weight: 700;
		color: #00a5cf;
		font-size: 1.125rem;
	}

	.progress-bar {
		width: 100%;
		height: 0.5rem;
		background-color: #334155;
		overflow: hidden;
		margin-bottom: 1.5rem;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #00a5cf, #9fffcb, #25a18e);
		transition: width 1s linear;
	}

	.success-link-wrapper {
		display: flex;
		justify-content: center;
	}

	.success-link {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: linear-gradient(135deg, #00a5cf, #25a18e);
		color: #020617;
		text-decoration: none;
		font-weight: 600;
		transition: all 200ms;
	}

	.success-link:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(0, 165, 207, 0.3);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.auth-card {
			padding: 1.5rem;
		}

		.auth-title {
			font-size: 1.5rem;
		}

		.success-icon {
			width: 3rem;
			height: 3rem;
			font-size: 1.5rem;
		}
	}
</style>
