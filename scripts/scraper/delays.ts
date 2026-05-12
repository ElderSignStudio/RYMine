export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function jitter(minMs: number, maxMs: number): number {
	const lo = Math.min(minMs, maxMs);
	const hi = Math.max(minMs, maxMs);
	return Math.floor(lo + Math.random() * (hi - lo));
}

export async function humanPause(minMs: number, maxMs: number): Promise<number> {
	const ms = jitter(minMs, maxMs);
	await sleep(ms);
	return ms;
}
