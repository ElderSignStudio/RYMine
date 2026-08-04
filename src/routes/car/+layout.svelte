<script lang="ts">
	import '../../app.css';
	import VersionLabel from '$lib/components/VersionLabel.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<!--
	Minimal Car Mode chrome. NO sidebar, NO sticky chip strip, NO full app
	header. The whole point is a calm, low-density surface for thumb-driving
	use. Per-page Back/title bars live inside each child page; this layout
	only sets the page shell, theme inheritance, and iOS safe-area padding.

	The safe-area padding belongs on this wrapper (not on each page) so that:
	  - the dark background still bleeds full-bleed under the notch / home
	    indicator (matches app.html's `viewport-fit=cover`), and
	  - the actual interactive content is always inset by the iPhone's
	    `env(safe-area-inset-*)` values both in Safari and in the installed
	    PWA. On desktop these env values are 0 — no visible change.
-->
<div
	class="car-shell flex min-h-dvh flex-col bg-base-100 text-base-content [-webkit-tap-highlight-color:transparent]"
>
	{@render children()}

	<!-- Deliberately tiny and very low contrast: Car Mode is a glanceable
	     surface, so this sits at the very bottom purely so the build can be
	     confirmed without leaving Car Mode. -->
	<VersionLabel
		build={data.build}
		class="block px-4 pt-2 pb-3 text-center text-[0.65rem] text-base-content/25"
	/>
</div>

<style>
	.car-shell {
		/* Use `max(env(...), 0px)` so browsers that don't understand
		   `env()` (treated as 0 by the parser) still get a valid value. */
		padding-top: max(env(safe-area-inset-top), 0px);
		padding-bottom: max(env(safe-area-inset-bottom), 0px);
		padding-left: max(env(safe-area-inset-left), 0px);
		padding-right: max(env(safe-area-inset-right), 0px);
	}
</style>
