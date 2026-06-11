<script lang="ts">
	import '../../app.css';

	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<!--
	Minimal Car Mode chrome. NO sidebar, NO sticky chip strip, NO full app
	header. The whole point is a calm, low-density surface for thumb-driving
	use. Per-page Back/title bars live inside each child page; this layout
	only sets the page shell and theme inheritance.
-->
<div
	class="flex min-h-[100dvh] flex-col bg-base-100 text-base-content [-webkit-tap-highlight-color:transparent]"
>
	{@render children()}
</div>
