// Render a 0–5 (half-step) rating as a visual star string.
// Used on the album detail page to show `myRating` the way RYM shows it.
//
// Examples:
//   starString(0)   → ""
//   starString(1)   → "★ ☆ ☆ ☆ ☆"
//   starString(3.5) → "★ ★ ★ ½ ☆"
//   starString(5)   → "★ ★ ★ ★ ★"
//
// We snap to the nearest half-star to mirror RYM's UI.
export function starString(rating: number | undefined | null): string {
	if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) {
		return '';
	}
	const clamped = Math.max(0, Math.min(5, rating));
	const half = Math.round(clamped * 2) / 2;
	const full = Math.floor(half);
	const hasHalf = half - full === 0.5;
	const empty = 5 - full - (hasHalf ? 1 : 0);
	const parts: string[] = [];
	for (let i = 0; i < full; i++) parts.push('★');
	if (hasHalf) parts.push('½');
	for (let i = 0; i < empty; i++) parts.push('☆');
	return parts.join(' ');
}
