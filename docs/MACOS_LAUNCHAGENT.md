# Running RYMine in the background via macOS LaunchAgent

The interactive [`rymscraper.command`](../rymscraper.command) launcher pops a
Terminal window and runs RYMine in the foreground — fine when you want a
visible log, awkward when you'd rather have the server just _be there_ on
boot. This setup wires the local writable instance into a per-user macOS
LaunchAgent so it starts at login, runs silently in the background, and
restarts itself if it crashes.

The interactive launcher still works — both can coexist. You'd typically
use one or the other; if both end up trying to bind the port, the
LaunchAgent steps aside (see "How port collisions are handled").

## Install

```
npm run svc:install
```

Or, equivalently:

```
scripts/macos/svc install
```

What this does:

1. Detects your current `node` (Homebrew, nvm, etc.) and bakes its
   directory into the LaunchAgent's `PATH`. No hardcoded usernames, no
   sudo required.
2. Renders [`scripts/macos/com.rymine.local.plist.template`](../scripts/macos/com.rymine.local.plist.template)
   into `~/Library/LaunchAgents/com.rymine.local.plist` with your project
   path filled in.
3. Creates `logs/` next to the project.
4. `launchctl bootstrap`s the agent into the per-user `gui/$UID` domain,
   which auto-starts it now AND on every subsequent login.

The agent runs the production server on `http://127.0.0.1:3000` (localhost
only — never reachable from the network). Override the port by setting
`RYMINE_PORT` in your `.env` and reinstalling.

If you haven't built RYMine yet (`build/index.js` missing), the wrapper
does a one-time `npm run build` on first launch.

## Open the app

```
npm run svc:open
```

Opens `http://127.0.0.1:3000/` in your default browser. Or just visit
that URL directly — the LaunchAgent keeps the server up so it's always
ready.

For the PWA / Car Mode / phone-on-LAN scenarios, this is still your
laptop's local server; access from the phone needs you to use the hosted
readonly viewer (`https://<your-render-service>.onrender.com`) or set up
LAN access separately. RYMine deliberately binds to `127.0.0.1` only — see
"What this doesn't do" below.

## Stop / restart / check

```
npm run svc:stop       # unload (server goes away)
npm run svc:start      # reload (server comes back)
npm run svc:restart    # stop + start
npm run svc:status     # full readout
```

`status` prints:

- whether the plist is on disk
- whether `launchctl` has it loaded (and its PID)
- whether port 3000 is bound
- the live `/api/health` payload (proves the server is responsive)
- the last few lines of `logs/rymine.err.log` if anything is there

Useful for sanity-checking after a reboot or after rotating `.env` secrets.

## Where the logs are

- `logs/rymine.log` — stdout. The wrapper prints a timestamped startup
  banner here; the SvelteKit adapter prints its `Listening on …` line
  here.
- `logs/rymine.err.log` — stderr. Any crash, build failure, or unhandled
  error lands here. `svc status` tails the last few lines for a quick
  look.

`logs/` is gitignored. Delete the files whenever they get noisy:

```
rm logs/rymine.log logs/rymine.err.log
npm run svc:restart
```

## After code or .env changes

Code changes need a rebuild before they take effect — the LaunchAgent
runs the production bundle in `build/`, not `npm run dev`. Workflow:

```
npm run build         # regenerate build/
npm run svc:restart   # pick up the fresh bundle
```

`.env` changes are loaded by the wrapper at startup, so any time you
update env values:

```
npm run svc:restart
```

(`.env` is _not_ watched — without a restart, the running server keeps
the old values it captured at boot.)

## Uninstall

```
npm run svc:uninstall
```

Bootouts the agent and removes the plist from
`~/Library/LaunchAgents/com.rymine.local.plist`. `logs/` is left in place
in case you want to inspect them; delete by hand if you want them gone.

## How port collisions are handled

The wrapper checks whether the port is already in use before launching
`node build`. If it is (most commonly: you double-clicked
`rymscraper.command` and the foreground server is already running), the
wrapper exits cleanly. The plist's `KeepAlive { SuccessfulExit = false }`
means a clean exit is _not_ retried, so the LaunchAgent silently steps
aside instead of restart-thrashing.

When you close the `.command` window, the next `npm run svc:start` (or
the next login) brings the LaunchAgent back online.

## What this doesn't do

- **No network exposure.** The wrapper hard-binds `HOST=127.0.0.1`.
  Devices on your LAN cannot reach this server. Use the hosted Render
  viewer for phone access — see [PUBLISH_GITHUB.md](./PUBLISH_GITHUB.md).
- **No system-wide install.** The plist lands under your home directory
  (`~/Library/LaunchAgents`) and runs in `gui/$UID`. No sudo, no other
  users on the Mac affected.
- **No automatic rebuilds.** Code changes need an explicit
  `npm run build`. The wrapper only builds on first run when no
  `build/index.js` exists at all.
- **No log rotation.** macOS doesn't manage these for us. If `logs/` gets
  too big, delete the files and `svc:restart`.

## Troubleshooting

**`status` says `loaded: no` immediately after install.**
Check `logs/rymine.err.log`. The wrapper logs the reason if it bailed
(usually: build failed, or `node` not in the PATH the plist embedded).

**Health check returns nothing.**
The server takes ~1 s to bind. Wait a moment and re-run `svc:status`. If
it still doesn't respond, tail `logs/rymine.log` — adapter-node usually
prints why it failed to bind.

**`node not found in PATH` during install.**
The install script needs to see `node` on your shell PATH at install
time. Make sure your shell can run `node --version` first, then re-run
`npm run svc:install`.

**Port 3000 unexpectedly busy.**
`lsof -ti :3000` shows the PID. If it's not RYMine, kill that process
and `svc:restart`. If it _is_ RYMine but the wrong instance, `svc:stop`
first, kill any leftovers, then `svc:start`.
