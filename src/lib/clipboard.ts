/**
 * Copy text to the clipboard, reporting success rather than throwing.
 *
 * `navigator.clipboard` needs a secure context — which we always have: the
 * hosted viewer is https, and http://127.0.0.1 counts as secure too. The
 * catch is for the odd case (permission denied, older WebView) where callers
 * should fall back to showing the URL instead of silently doing nothing.
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
