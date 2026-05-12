function ts(): string {
	return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

export const log = {
	info: (msg: string, ...rest: unknown[]) => console.log(`[${ts()}] ${msg}`, ...rest),
	warn: (msg: string, ...rest: unknown[]) => console.warn(`[${ts()}] WARN  ${msg}`, ...rest),
	error: (msg: string, ...rest: unknown[]) => console.error(`[${ts()}] ERROR ${msg}`, ...rest)
};
