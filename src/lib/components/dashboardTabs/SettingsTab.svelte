<script lang="ts">
	/**
	 * Personal Settings tab — profile, preferences, security (password + MFA),
	 * and account lifecycle for the *current* user.
	 *
	 * Profile / preferences / avatar WRITES go through the service-role-backed
	 * /api/account/* endpoints (they write the caller's own row). Auth/email/
	 * password/MFA actions use the passed session `supabase` client directly
	 * (Supabase GoTrue). House style mirrors NotesTab: slate palette, accent
	 * (#00a5cf), lucide icons, svelte-sonner toasts, native modals.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import {
		Settings as SettingsIcon,
		User,
		SlidersHorizontal,
		ShieldCheck,
		AlertTriangle,
		Upload,
		Trash2,
		Save,
		Plus,
		Loader2,
		Mail,
		KeyRound,
		Smartphone,
		Link as LinkIcon,
		X
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	type CustomLink = { label: string; url: string };

	type Profile = {
		user_id: string;
		email: string | null;
		full_name: string | null;
		username: string | null;
		avatar_url: string | null;
		user_settings: Record<string, unknown> | null;
		account_status: string | null;
	};

	type MfaFactor = {
		id: string;
		friendly_name?: string | null;
		factor_type: string;
		status: string;
	};

	// The admin dashboard tabs the user can pick as their landing tab.
	const TAB_OPTIONS = [
		'home', 'website', 'media', 'social', 'telemetry', 'audit', 'tools',
		'daedalus', 'tasks', 'calendar', 'notes', 'finances', 'bifrost',
		'status', 'email', 'settings', 'users'
	];
	const TAB_LABELS: Record<string, string> = {
		home: 'Dashboard', website: 'Pages', media: 'Media', social: 'Social',
		telemetry: 'Telemetry', audit: 'Audit', tools: 'Tools', daedalus: 'Daedalus',
		tasks: 'Tasks', calendar: 'Calendar', notes: 'Notes', finances: 'Finances',
		bifrost: 'Bifrost', status: 'Status', email: 'Email', settings: 'Settings', users: 'Users'
	};

	let loading = $state(true);
	let userId = $state('');
	let email = $state('');
	let profile = $state<Profile | null>(null);

	// Profile form
	let fullName = $state('');
	let username = $state('');
	let avatarUrl = $state<string | null>(null);
	let savingProfile = $state(false);
	let uploadingAvatar = $state(false);
	let avatarInput: HTMLInputElement | null = $state(null);

	// Email change
	let newEmail = $state('');
	let savingEmail = $state(false);

	// Preferences
	let defaultTab = $state('home');
	let theme = $state('auto');
	let quicklinks = $state<CustomLink[]>([]);
	let savingPrefs = $state(false);

	// Security — password
	let newPassword = $state('');
	let confirmPassword = $state('');
	let savingPassword = $state(false);

	// Security — MFA
	let factors = $state<MfaFactor[]>([]);
	let loadingFactors = $state(false);
	let enrolling = $state(false);
	let enrollData = $state<{ factorId: string; qr: string; secret: string } | null>(null);
	let verifyCode = $state('');
	let verifying = $state(false);

	// Account lifecycle
	let busyAccount = $state(false);

	function settingsObj(): Record<string, unknown> {
		return (profile?.user_settings ?? {}) as Record<string, unknown>;
	}

	async function load() {
		loading = true;
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (!user) {
			loading = false;
			toast.error('Not signed in.');
			return;
		}
		userId = user.id;
		email = user.email ?? '';

		// Try a direct client read of the OWN row first; fall back to the
		// service-role GET if RLS hides it.
		let row: Profile | null = null;
		const { data } = await supabase
			.from('user_profiles')
			.select('user_id, email, full_name, username, avatar_url, user_settings, account_status')
			.eq('user_id', user.id)
			.single();
		row = (data as Profile) ?? null;

		if (!row) {
			try {
				const res = await fetch('/api/account/profile');
				if (res.ok) {
					const body = (await res.json()) as { profile: Profile };
					row = body.profile;
				}
			} catch {
				/* ignore — leave row null */
			}
		}

		if (row) {
			profile = row;
			fullName = row.full_name ?? '';
			username = row.username ?? '';
			avatarUrl = row.avatar_url ?? null;
			const s = (row.user_settings ?? {}) as Record<string, unknown>;
			defaultTab = (s.default_tab as string) || 'home';
			theme = (s.theme as string) || 'auto';
			quicklinks = Array.isArray(s.custom_links) ? (s.custom_links as CustomLink[]) : [];
		}

		loading = false;
		loadFactors();
	}

	// ---------- Profile ----------
	async function saveProfile() {
		savingProfile = true;
		try {
			const res = await fetch('/api/account/profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ full_name: fullName, username })
			});
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || 'Could not save profile.');
				return;
			}
			profile = body.profile as Profile;
			toast.success('Profile saved.');
		} catch {
			toast.error('Network error saving profile.');
		} finally {
			savingProfile = false;
		}
	}

	async function onAvatarPicked(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploadingAvatar = true;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const res = await fetch('/api/account/avatar', { method: 'POST', body: fd });
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || 'Upload failed.');
				return;
			}
			avatarUrl = body.avatar_url;
			toast.success('Avatar updated.');
		} catch {
			toast.error('Network error uploading avatar.');
		} finally {
			uploadingAvatar = false;
			if (avatarInput) avatarInput.value = '';
		}
	}

	async function removeAvatar() {
		if (!avatarUrl) return;
		uploadingAvatar = true;
		try {
			const res = await fetch('/api/account/avatar', { method: 'DELETE' });
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || 'Could not remove avatar.');
				return;
			}
			avatarUrl = null;
			toast.success('Avatar removed.');
		} catch {
			toast.error('Network error removing avatar.');
		} finally {
			uploadingAvatar = false;
		}
	}

	async function changeEmail() {
		const next = newEmail.trim();
		if (!next) return;
		savingEmail = true;
		try {
			const { error } = await supabase.auth.updateUser({ email: next });
			if (error) {
				toast.error(error.message);
				return;
			}
			toast.success('Confirmation email sent — check your inbox to finish the change.');
			newEmail = '';
		} catch {
			toast.error('Could not start email change.');
		} finally {
			savingEmail = false;
		}
	}

	// ---------- Preferences ----------
	async function savePreferences(extra: Record<string, unknown> = {}) {
		savingPrefs = true;
		try {
			const user_settings = {
				default_tab: defaultTab,
				theme,
				custom_links: quicklinks,
				...extra
			};
			const res = await fetch('/api/account/profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_settings })
			});
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || 'Could not save preferences.');
				return;
			}
			profile = body.profile as Profile;
			toast.success('Preferences saved.');
		} catch {
			toast.error('Network error saving preferences.');
		} finally {
			savingPrefs = false;
		}
	}

	function addQuicklink() {
		quicklinks = [...quicklinks, { label: '', url: '' }];
	}
	function removeQuicklink(i: number) {
		quicklinks = quicklinks.filter((_, idx) => idx !== i);
	}

	// ---------- Password ----------
	async function changePassword() {
		if (newPassword.length < 8) {
			toast.error('Password must be at least 8 characters.');
			return;
		}
		if (newPassword !== confirmPassword) {
			toast.error('Passwords do not match.');
			return;
		}
		savingPassword = true;
		try {
			const { error } = await supabase.auth.updateUser({ password: newPassword });
			if (error) {
				toast.error(error.message);
				return;
			}
			toast.success('Password updated.');
			newPassword = '';
			confirmPassword = '';
		} catch {
			toast.error('Could not update password.');
		} finally {
			savingPassword = false;
		}
	}

	// ---------- MFA ----------
	async function loadFactors() {
		loadingFactors = true;
		try {
			const { data, error } = await supabase.auth.mfa.listFactors();
			if (error) {
				toast.error(error.message);
				return;
			}
			factors = (data?.all ?? data?.totp ?? []) as MfaFactor[];
		} catch {
			/* non-fatal */
		} finally {
			loadingFactors = false;
		}
	}

	async function startEnroll() {
		enrolling = true;
		try {
			const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
			if (error) {
				toast.error(error.message);
				return;
			}
			enrollData = {
				factorId: data.id,
				qr: data.totp.qr_code,
				secret: data.totp.secret
			};
			verifyCode = '';
		} catch {
			toast.error('Could not start MFA enrollment.');
		} finally {
			enrolling = false;
		}
	}

	async function verifyEnroll() {
		if (!enrollData) return;
		const code = verifyCode.trim();
		if (code.length < 6) {
			toast.error('Enter the 6-digit code from your authenticator.');
			return;
		}
		verifying = true;
		try {
			const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
				factorId: enrollData.factorId
			});
			if (chErr) {
				toast.error(chErr.message);
				return;
			}
			const { error: vErr } = await supabase.auth.mfa.verify({
				factorId: enrollData.factorId,
				challengeId: ch.id,
				code
			});
			if (vErr) {
				toast.error(vErr.message);
				return;
			}
			toast.success('Authenticator verified.');
			enrollData = null;
			verifyCode = '';
			await loadFactors();
		} catch {
			toast.error('Verification failed.');
		} finally {
			verifying = false;
		}
	}

	function cancelEnroll() {
		// Best-effort unenroll of the pending factor so it doesn't linger.
		if (enrollData) {
			supabase.auth.mfa.unenroll({ factorId: enrollData.factorId }).catch(() => {});
		}
		enrollData = null;
		verifyCode = '';
	}

	async function unenroll(factorId: string) {
		if (!confirm('Remove this authenticator?')) return;
		try {
			const { error } = await supabase.auth.mfa.unenroll({ factorId });
			if (error) {
				toast.error(error.message);
				return;
			}
			toast.success('Authenticator removed.');
			await loadFactors();
		} catch {
			toast.error('Could not remove authenticator.');
		}
	}

	// ---------- Account ----------
	async function deactivate() {
		if (!confirm('Deactivate your account? You will be signed out and can reactivate later.'))
			return;
		busyAccount = true;
		try {
			const res = await fetch('/api/user/account', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'deactivate' })
			});
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || body.message || 'Could not deactivate.');
				return;
			}
			toast.success('Account deactivated. Signing out…');
			setTimeout(() => supabase.auth.signOut(), 1500);
		} catch {
			toast.error('Network error.');
		} finally {
			busyAccount = false;
		}
	}

	async function deleteAccount() {
		const typed = prompt('This schedules permanent deletion. Type "DELETE MY ACCOUNT" to confirm.');
		if (typed !== 'DELETE MY ACCOUNT') {
			if (typed !== null) toast.error('Confirmation text did not match.');
			return;
		}
		busyAccount = true;
		try {
			const res = await fetch('/api/user/account', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ confirmation: 'DELETE MY ACCOUNT' })
			});
			const body = await res.json();
			if (!res.ok) {
				toast.error(body.error || body.message || 'Could not delete account.');
				return;
			}
			toast.success('Account deletion requested. Signing out…');
			setTimeout(() => supabase.auth.signOut(), 1500);
		} catch {
			toast.error('Network error.');
		} finally {
			busyAccount = false;
		}
	}

	onMount(load);

	const inputClass =
		'w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none';
	const btnPrimary =
		'flex items-center justify-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60';
	const btnGhost =
		'flex items-center justify-center gap-2 border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800';
</script>

<div class="mx-auto max-w-3xl">
	<header class="mb-6 flex items-center gap-3">
		<SettingsIcon class="h-6 w-6 text-accent-primary" />
		<div>
			<h1 class="text-2xl font-bold text-white">Settings</h1>
			<p class="mt-0.5 text-sm text-slate-400">Your profile, preferences, and security.</p>
		</div>
	</header>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else}
		<div class="space-y-6">
			<!-- Profile -->
			<section class="border border-slate-800 bg-slate-900/50 p-5">
				<div class="mb-4 flex items-center gap-2">
					<User class="h-4 w-4 text-accent-primary" />
					<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Profile</h2>
				</div>

				<div class="mb-5 flex items-center gap-4">
					<div class="h-16 w-16 shrink-0 overflow-hidden border border-slate-700 bg-slate-800">
						{#if avatarUrl}
							<img src={avatarUrl} alt="Avatar" class="h-full w-full object-cover" />
						{:else}
							<div class="flex h-full w-full items-center justify-center text-slate-600">
								<User class="h-7 w-7" />
							</div>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							class={btnGhost}
							disabled={uploadingAvatar}
							onclick={() => avatarInput?.click()}
						>
							{#if uploadingAvatar}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Upload
									class="h-4 w-4"
								/>{/if}
							Upload
						</button>
						{#if avatarUrl}
							<button class={btnGhost} disabled={uploadingAvatar} onclick={removeAvatar}>
								<Trash2 class="h-4 w-4" /> Remove
							</button>
						{/if}
						<input
							bind:this={avatarInput}
							type="file"
							accept="image/*"
							class="hidden"
							onchange={onAvatarPicked}
						/>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="set-fullname" class="mb-1 block text-xs font-medium text-slate-400"
							>Full name</label
						>
						<input id="set-fullname" bind:value={fullName} class={inputClass} placeholder="Jane Doe" />
					</div>
					<div>
						<label for="set-username" class="mb-1 block text-xs font-medium text-slate-400"
							>Username</label
						>
						<input id="set-username" bind:value={username} class={inputClass} placeholder="jane" />
					</div>
				</div>

				<div class="mt-4">
					<label for="set-email" class="mb-1 block text-xs font-medium text-slate-400">Email</label>
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
						<input id="set-email" value={email} readonly class="{inputClass} opacity-70" />
					</div>
					<div class="mt-2 flex flex-col gap-2 sm:flex-row">
						<input
							bind:value={newEmail}
							class={inputClass}
							placeholder="new@email.com"
							type="email"
						/>
						<button class={btnGhost} disabled={savingEmail || !newEmail.trim()} onclick={changeEmail}>
							{#if savingEmail}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Mail
									class="h-4 w-4"
								/>{/if}
							Change email
						</button>
					</div>
					<p class="mt-1 text-xs text-slate-500">Changing your email triggers a confirmation email.</p>
				</div>

				<div class="mt-5 flex justify-end">
					<button class={btnPrimary} disabled={savingProfile} onclick={saveProfile}>
						{#if savingProfile}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Save
								class="h-4 w-4"
							/>{/if}
						Save profile
					</button>
				</div>
			</section>

			<!-- Preferences -->
			<section class="border border-slate-800 bg-slate-900/50 p-5">
				<div class="mb-4 flex items-center gap-2">
					<SlidersHorizontal class="h-4 w-4 text-accent-primary" />
					<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Preferences</h2>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="set-deftab" class="mb-1 block text-xs font-medium text-slate-400"
							>Default dashboard tab</label
						>
						<select id="set-deftab" bind:value={defaultTab} class={inputClass}>
							{#each TAB_OPTIONS as t (t)}
								<option value={t}>{TAB_LABELS[t] ?? t}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="set-theme" class="mb-1 block text-xs font-medium text-slate-400">Theme</label>
						<select id="set-theme" bind:value={theme} class={inputClass}>
							<option value="auto">Auto</option>
							<option value="dark">Dark</option>
							<option value="light">Light</option>
						</select>
					</div>
				</div>

				<!-- Quicklinks -->
				<div class="mt-5">
					<div class="mb-2 flex items-center justify-between">
						<div class="flex items-center gap-2 text-xs font-medium text-slate-400">
							<LinkIcon class="h-3.5 w-3.5" /> Quicklinks
						</div>
						<button
							class="flex items-center gap-1 text-xs text-slate-400 transition hover:text-accent-primary"
							onclick={addQuicklink}
						>
							<Plus class="h-3.5 w-3.5" /> Add
						</button>
					</div>
					{#if quicklinks.length === 0}
						<p class="text-xs italic text-slate-600">No quicklinks yet.</p>
					{:else}
						<div class="space-y-2">
							{#each quicklinks as link, i (i)}
								<div class="flex items-center gap-2">
									<div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
										<input
											bind:value={link.label}
											placeholder="Label"
											class="{inputClass} sm:flex-1"
										/>
										<input
											bind:value={link.url}
											placeholder="https://…"
											class="{inputClass} sm:flex-[2]"
										/>
									</div>
									<button
										class="shrink-0 text-slate-500 transition hover:text-red-400"
										onclick={() => removeQuicklink(i)}
										aria-label="Remove quicklink"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="mt-5 flex justify-end">
					<button class={btnPrimary} disabled={savingPrefs} onclick={() => savePreferences()}>
						{#if savingPrefs}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Save
								class="h-4 w-4"
							/>{/if}
						Save preferences
					</button>
				</div>
			</section>

			<!-- Security -->
			<section class="border border-slate-800 bg-slate-900/50 p-5">
				<div class="mb-4 flex items-center gap-2">
					<ShieldCheck class="h-4 w-4 text-accent-primary" />
					<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Security</h2>
				</div>

				<!-- Password -->
				<div class="mb-6">
					<div class="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
						<KeyRound class="h-3.5 w-3.5" /> Change password
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						<input
							bind:value={newPassword}
							type="password"
							placeholder="New password"
							class={inputClass}
						/>
						<input
							bind:value={confirmPassword}
							type="password"
							placeholder="Confirm password"
							class={inputClass}
						/>
					</div>
					<div class="mt-3 flex justify-end">
						<button class={btnGhost} disabled={savingPassword} onclick={changePassword}>
							{#if savingPassword}<Loader2 class="h-4 w-4 animate-spin" />{/if} Update password
						</button>
					</div>
				</div>

				<!-- MFA -->
				<div>
					<div class="mb-2 flex items-center justify-between">
						<div class="flex items-center gap-2 text-xs font-medium text-slate-400">
							<Smartphone class="h-3.5 w-3.5" /> Two-factor (authenticator app)
						</div>
						{#if !enrollData}
							<button
								class="flex items-center gap-1 text-xs text-slate-400 transition hover:text-accent-primary"
								disabled={enrolling}
								onclick={startEnroll}
							>
								{#if enrolling}<Loader2 class="h-3.5 w-3.5 animate-spin" />{:else}<Plus
										class="h-3.5 w-3.5"
									/>{/if}
								Add authenticator
							</button>
						{/if}
					</div>

					{#if loadingFactors}
						<div class="py-2"><Loader2 class="h-4 w-4 animate-spin text-slate-600" /></div>
					{:else if factors.length === 0 && !enrollData}
						<p class="text-xs italic text-slate-600">No authenticators enrolled.</p>
					{:else}
						<div class="space-y-2">
							{#each factors as f (f.id)}
								<div
									class="flex items-center justify-between border border-slate-800 bg-slate-950 px-3 py-2"
								>
									<div class="text-sm text-slate-300">
										{f.friendly_name || f.factor_type}
										<span
											class="ml-2 inline-block px-1.5 py-0.5 text-[10px] uppercase {f.status ===
											'verified'
												? 'bg-emerald-500/15 text-emerald-400'
												: 'bg-amber-500/15 text-amber-400'}">{f.status}</span
										>
									</div>
									<button
										class="text-slate-500 transition hover:text-red-400"
										onclick={() => unenroll(f.id)}
										aria-label="Remove authenticator"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							{/each}
						</div>
					{/if}

					{#if enrollData}
						<div class="mt-3 border border-slate-700 bg-slate-950 p-4">
							<p class="mb-3 text-xs text-slate-400">
								Scan this QR code with your authenticator app, then enter the 6-digit code to verify.
							</p>
							<div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
								<img
									src={enrollData.qr}
									alt="MFA QR code"
									class="h-40 w-40 border border-slate-700 bg-white p-2"
								/>
								<div class="flex-1">
									<p class="mb-1 text-xs text-slate-500">Manual setup key</p>
									<code class="block break-all text-xs text-accent-primary">{enrollData.secret}</code>
									<input
										bind:value={verifyCode}
										inputmode="numeric"
										maxlength="8"
										placeholder="123456"
										class="{inputClass} mt-3"
									/>
									<div class="mt-3 flex gap-2">
										<button class={btnPrimary} disabled={verifying} onclick={verifyEnroll}>
											{#if verifying}<Loader2 class="h-4 w-4 animate-spin" />{/if} Verify
										</button>
										<button class={btnGhost} onclick={cancelEnroll}>Cancel</button>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</section>

			<!-- Account -->
			<section class="border border-red-900/40 bg-red-950/10 p-5">
				<div class="mb-4 flex items-center gap-2">
					<AlertTriangle class="h-4 w-4 text-red-400" />
					<h2 class="text-sm font-semibold uppercase tracking-wider text-red-300">Account</h2>
				</div>
				<div class="flex flex-wrap gap-3">
					<button
						class="flex items-center gap-2 border border-amber-700/50 px-4 py-2 text-sm text-amber-300 transition hover:bg-amber-900/20 disabled:opacity-60"
						disabled={busyAccount}
						onclick={deactivate}
					>
						Deactivate account
					</button>
					<button
						class="flex items-center gap-2 border border-red-700/50 px-4 py-2 text-sm text-red-300 transition hover:bg-red-900/20 disabled:opacity-60"
						disabled={busyAccount}
						onclick={deleteAccount}
					>
						<Trash2 class="h-4 w-4" /> Delete account
					</button>
				</div>
				<p class="mt-2 text-xs text-slate-500">
					Deactivation is reversible. Deletion schedules permanent removal after a grace period.
				</p>
			</section>
		</div>
	{/if}
</div>
