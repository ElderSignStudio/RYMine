<script lang="ts">
	// The quiet "which build am I looking at?" line. Deliberately low-contrast
	// — it should be findable when you go looking and invisible otherwise.
	//
	// Values arrive as props from the root layout's server load, so they're
	// rendered fresh by the server that's actually running. That's what makes
	// this trustworthy: a stale client bundle can't show a stale version,
	// because the string comes down with the HTML.

	import type { BuildInfo } from '$lib/version';

	let {
		build,
		class: className = ''
	}: {
		build: BuildInfo;
		class?: string;
	} = $props();
</script>

<span class="tabular-nums {className}" title="Built {build.buildTime}">
	RYMine v{build.version} · build {build.commit}
</span>
