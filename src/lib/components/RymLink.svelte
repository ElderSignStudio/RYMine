<script lang="ts">
	// The small "open this on RYM" links — the ↗ affordances in the album list,
	// the detail header and the enrichment queue. One anchor, so all three pick
	// up the iOS Chrome handoff identically.
	//
	// On iOS the href becomes a `googlechromes://` URL and we drop
	// `target="_blank"`: a custom scheme hands off to Chrome without navigating
	// this page, so a blank leftover tab is exactly what we don't want. Off
	// iOS this is an ordinary external anchor, unchanged from before.
	//
	// The bigger surfaces (Car Mode play card, album detail footer) render
	// their own action group with Safari + copy fallbacks instead of using
	// this component.

	import { isIOS } from '$lib/ios.svelte';
	import { rymHref } from '$lib/rymLink';

	let {
		url,
		class: className = '',
		title,
		ariaLabel,
		children
	}: {
		url: string;
		class?: string;
		title?: string;
		ariaLabel?: string;
		children: import('svelte').Snippet;
	} = $props();

	const ios = $derived(isIOS());
	const href = $derived(rymHref(url, ios));
</script>

<a
	{href}
	target={ios ? undefined : '_blank'}
	rel="noopener noreferrer"
	class={className}
	{title}
	aria-label={ariaLabel}
>
	{@render children()}
</a>
