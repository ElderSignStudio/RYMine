<script lang="ts">
	import '../app.css';
	import { detectIOS } from '$lib/ios.svelte';

	let { children } = $props();

	// Detect iPhone/iPad once, here at the root so every route inherits it
	// (Car Mode, the full app, and the standalone /queue page). Running it in
	// an $effect means it happens after hydration, so the flag can't cause a
	// client/server render mismatch. See $lib/rymLink for what it's for.
	$effect(() => {
		detectIOS();
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png" />
	<title>RYMine</title>
</svelte:head>

{@render children()}
