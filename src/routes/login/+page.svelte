<script lang="ts">
	import { page } from '$app/state';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const fromParam = $derived(page.url.searchParams.get('from') ?? '/');
</script>

<svelte:head>
	<title>Sign in · RYMine</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-base-100 px-4 text-base-content">
	<section
		class="card w-full max-w-sm border border-base-300/70 bg-base-200/40 p-6 shadow-sm sm:p-8"
	>
		<div class="mb-5 flex items-center gap-3">
			<span
				class="relative block h-10 w-10 shrink-0 overflow-hidden rounded-md bg-base-300/40 shadow-sm"
				aria-hidden="true"
			>
				<img src="/RYMine%20Icon.png" alt="" class="h-full w-full object-cover" />
			</span>
			<div class="leading-tight">
				<h1 class="text-xl font-semibold tracking-tight">RYMine</h1>
				<p class="text-xs text-base-content/60">read-only · sign in to browse</p>
			</div>
		</div>

		<!-- svelte-ignore a11y_autofocus -->
		<form method="POST" class="space-y-4">
			<input type="hidden" name="from" value={fromParam} />

			<label class="block">
				<span class="mb-1 block text-xs font-medium tracking-wide text-base-content/70 uppercase">
					Password
				</span>
				<input
					type="password"
					name="password"
					autocomplete="current-password"
					required
					autofocus
					class="input-bordered input w-full bg-base-100/70"
					aria-invalid={form?.error ? 'true' : undefined}
				/>
			</label>

			{#if form?.error}
				<p class="text-sm text-error" role="alert">{form.error}</p>
			{/if}

			<button type="submit" class="btn w-full btn-primary"> Sign in </button>
		</form>

		<p class="mt-5 text-center text-xs text-base-content/40">
			Local instance? Set <code class="rounded bg-base-300/50 px-1.5 py-0.5">RYMINE_MODE=local</code
			>
			to skip the login.
		</p>
	</section>
</main>
