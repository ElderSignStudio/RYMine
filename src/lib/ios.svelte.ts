// Is this an iPhone or iPad? Used only to decide whether RYM links should be
// handed to Chrome (see $lib/rymLink for why).
//
// UA sniffing is a last resort, but there is no feature test for "Safari on
// this OS version renders one particular site blank", so a device check is
// the only option available.
//
// Detection has to run on the client — the server can't know — and it has to
// run *after* hydration, otherwise the client's first render would disagree
// with the server-rendered HTML. So the flag starts `false` (matching SSR)
// and `detectIOS()` is called once from an $effect in the root layout. Links
// read `isIOS()` and re-render when it flips, a tick after hydration.

import { browser } from '$app/environment';

let ios = $state(false);

/** Call once, from a root-layout $effect. Safe to call more than once. */
export function detectIOS(): void {
	if (!browser) return;
	const nav = window.navigator;

	if (/iPad|iPhone|iPod/.test(nav.userAgent)) {
		ios = true;
		return;
	}

	// iPadOS 13+ reports itself as desktop macOS by default. A Mac never has
	// a touchscreen, so touch points disambiguate it from a real Mac.
	ios = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
}

/** Reactive — components re-render when detection completes. */
export function isIOS(): boolean {
	return ios;
}
