// Display metadata for the streaming services we surface on the detail page.
// `order` is the iteration order the UI uses; keeping it as a tuple guarantees
// the same shape on home + detail + future surfaces.

import type { StreamingLinks } from './types';

export type StreamingKey = keyof StreamingLinks;

export const STREAMING_SERVICES: Record<StreamingKey, { label: string; dot: string }> = {
	spotify: { label: 'Spotify', dot: 'bg-emerald-500' },
	appleMusic: { label: 'Apple Music', dot: 'bg-rose-500' },
	youtube: { label: 'YouTube', dot: 'bg-red-500' },
	bandcamp: { label: 'Bandcamp', dot: 'bg-cyan-500' }
};

export const STREAMING_ORDER: readonly StreamingKey[] = [
	'spotify',
	'appleMusic',
	'youtube',
	'bandcamp'
] as const;

export function hasAnyStreamingLink(links: StreamingLinks | undefined | null): boolean {
	if (!links) return false;
	return STREAMING_ORDER.some((k) => Boolean(links[k]));
}
