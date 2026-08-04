// Server-side resolution of the build identifiers shown in the UI and
// reported by /api/health.
//
// Everything already comes baked in from build time ($lib/version). The only
// thing added here is a runtime env override for the commit: on Render both
// build-time and runtime see the same RENDER_GIT_COMMIT, but reading it again
// at boot covers the case where RYMINE_BUILD_COMMIT is set in the service's
// runtime environment only — e.g. redeploying an existing build, or running
// the adapter-node output somewhere the build didn't happen.
//
// Nothing secret is exposed: a version string and a public commit SHA.

import {
	APP_VERSION,
	BUILD_TIME,
	RAW_BUILD_COMMIT,
	shortCommit,
	type BuildInfo
} from '$lib/version';

const runtimeCommit = (
	process.env.RYMINE_BUILD_COMMIT ||
	process.env.RENDER_GIT_COMMIT ||
	''
).trim();

export const BUILD_INFO: BuildInfo = {
	version: APP_VERSION,
	commit: shortCommit(runtimeCommit || RAW_BUILD_COMMIT),
	buildTime: BUILD_TIME
};
