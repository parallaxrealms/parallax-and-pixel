<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { contactSchema } from '@parallaxrealms/schemas';
	import { Label } from '$lib/components/shadcn/ui/label';
	import { Button } from '$lib/components/shadcn/ui/button';
	import { Input } from '$lib/components/shadcn/ui/input';
	import { Textarea } from '$lib/components/shadcn/ui/textarea';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { ContactFormData } from '@parallaxrealms/schemas';
	import { AnimatedButton, GradientText } from '@parallaxrealms/components-core';

	let {
		data
	}: {
		data: SuperValidated<ContactFormData>;
	} = $props();

	const { form, message, errors, enhance, delayed } = superForm(data, {
validators: zodClient(contactSchema),
		resetForm: true,
		taintedMessage: null
	});
</script>

<div class="container mx-auto px-6">
	<div class="mb-16 text-center">
		<GradientText
			text="Get In Touch"
			variant="default"
			size="4xl"
			class="mb-4 font-bold md:text-5xl lg:text-6xl"
		/>
		<p class="mx-auto max-w-3xl text-xl text-muted-foreground">
			Ready to bring your vision to life? Get in touch and let's make something amazing.
		</p>
	</div>

	<div class="ml-2">
		<div class="bg-surface mx-auto max-w-3xl rounded-2xl border border-muted p-8">
			<GradientText text="Get in Touch" variant="default" size="2xl" class="mb-6 font-bold" />

			<!-- Success/Error Message -->
			{#if $message}
				<div
					class="mb-4 rounded-lg p-3 text-sm {$message
						? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
						: 'bg-red-500/10 text-red-600 dark:text-red-400'}"
				>
					{$message}
				</div>
			{/if}

			<!-- Contact Form -->
			<form method="POST" use:enhance class="space-y-4">
				<!-- Name Field -->
				<div>
					<Label for="name" class={$errors.name ? 'text-destructive' : ''}>
						Name <span class="text-destructive">*</span>
					</Label>
					<Input
						id="name"
						name="name"
						type="text"
						placeholder="John Doe"
						bind:value={$form.name}
						class="mt-1"
						aria-invalid={$errors.name ? 'true' : undefined}
					/>
					{#if $errors.name}
						<p class="mt-1 text-sm text-destructive">{$errors.name}</p>
					{/if}
				</div>

				<!-- Email Field -->
				<div>
					<Label for="email" class={$errors.email ? 'text-destructive' : ''}>
						Email <span class="text-destructive">*</span>
					</Label>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="john@example.com"
						bind:value={$form.email}
						class="mt-1"
						aria-invalid={$errors.email ? 'true' : undefined}
					/>
					{#if $errors.email}
						<p class="mt-1 text-sm text-destructive">{$errors.email}</p>
					{/if}
				</div>

				<!-- Phone Field (Optional) -->
				<div>
					<Label for="phone">Phone (Optional)</Label>
					<Input
						id="phone"
						name="phone"
						type="tel"
						placeholder="(555) 123-4567"
						bind:value={$form.phone}
						class="mt-1"
					/>
					{#if $errors.phone}
						<p class="mt-1 text-sm text-destructive">{$errors.phone}</p>
					{/if}
				</div>

				<!-- Message Field -->
				<div>
					<Label for="message" class={$errors.message ? 'text-destructive' : ''}>
						Message <span class="text-destructive">*</span>
					</Label>
					<Textarea
						id="message"
						name="message"
						rows={5}
						placeholder="Tell us about your project"
						bind:value={$form.message}
						class="mt-1 resize-none"
						aria-invalid={$errors.message ? 'true' : undefined}
					/>
					{#if $errors.message}
						<p class="mt-1 text-sm text-destructive">{$errors.message}</p>
					{/if}
				</div>

				<!-- Submit Button -->
				<AnimatedButton
					gradient="cmy"
					type="submit"
					class="w-full rounded-lg py-4 text-lg font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60"
					disabled={$delayed}
				>
					{#if $delayed}
						Sending...
					{:else}
						Send Message
					{/if}
				</AnimatedButton>
			</form>
		</div>
	</div>
</div>
