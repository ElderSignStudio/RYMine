# Deploying RYMine to Render as a readonly viewer

This is the deploy guide for the **hosted viewer half** of RYMine. The
writable instance stays on your laptop; the hosted one is just a browser-able
mirror that receives fresh data from you via `POST /api/publish`.

There is no database. There are no user accounts. Just one password to read,
and one bearer token for the local app to push updates.

---

## What you need before starting

- A [Render](https://render.com) account.
- A long random string for `RYMINE_VIEWER_PASSWORD` — what you'll type to log
  in from your phone / laptop.
- A second long random string for `RYMINE_PUBLISH_TOKEN` — what your local
  RYMine puts in the Authorization header when it pushes data.

Two separate secrets on purpose: rotating one doesn't invalidate the other.

```sh
# generate a 32-byte token to use for either
openssl rand -base64 32
```

---

## Render service setup

Create a new **Web Service** on Render and point it at your repo.

| Field             | Value                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| Runtime           | Node                                                                          |
| Build command     | `npm ci && npm run build`                                                     |
| Start command     | `npm start`                                                                   |
| Health check path | `/api/health`                                                                 |
| Node version      | 20.x or newer (set via `engines` in package.json, or Render's "Node Version") |

### Environment variables

Set these in the service's **Environment** tab. All but `BODY_SIZE_LIMIT` are
required for the hosted viewer to work.

| Var                                | Value                                                                                  | Notes                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RYMINE_MODE`                      | `readonly`                                                                             | Required. The server refuses to boot in readonly without a password.                                                                                    |
| `RYMINE_VIEWER_PASSWORD`           | _(your long secret)_                                                                   | Required. What you type at `/login`.                                                                                                                    |
| `RYMINE_REMOTE_DATA_URL`           | `https://raw.githubusercontent.com/ElderSignStudio/RYMineData/main/data/wishlist.json` | **Recommended.** When set, the viewer reads wishlist JSON from this URL instead of the local filesystem — Render sleep/restart can't lose data anymore. |
| `RYMINE_REMOTE_DATA_CACHE_SECONDS` | `300`                                                                                  | Optional. In-memory cache TTL. Default 300s. Tune down for faster propagation after a publish, up to reduce GitHub hits.                                |
| `HOST`                             | `0.0.0.0`                                                                              | adapter-node binds here. Render needs `0.0.0.0`, not `127.0.0.1`.                                                                                       |
| `ORIGIN`                           | `https://<your-service>.onrender.com`                                                  | Required for SvelteKit CSRF acceptance on form posts (login). Must match the public URL exactly.                                                        |
| `BODY_SIZE_LIMIT`                  | `5000000` (≈ 5 MB) or higher                                                           | Optional but recommended if you ever fall back to `/api/publish`.                                                                                       |
| `RYMINE_DATA_PATH`                 | `/var/data/wishlist.json` (with a disk attached)                                       | Optional. Only matters when `RYMINE_REMOTE_DATA_URL` is unset.                                                                                          |
| `RYMINE_PUBLISH_TOKEN`             | _(your long secret)_                                                                   | Optional / legacy. Only needed if you still want to accept direct `POST /api/publish` pushes from the local Render-backed flow.                         |

**Do not set `PORT` yourself** — Render injects it.

> **Note:** With `RYMINE_REMOTE_DATA_URL` set, you no longer need
> `RYMINE_PUBLISH_TOKEN` on Render unless you're keeping the legacy direct
> publish flow alive. The new pipeline pushes to GitHub from your laptop;
> Render only reads.

---

## Persistent data path

Render's free tier ephemeral filesystems lose everything on redeploy / sleep.
You have two options:

### Option A — Add a Render Persistent Disk (recommended, paid)

In the service settings, attach a Disk:

- Name: `rymine-data`
- Mount path: `/var/data`
- Size: 1 GB (overkill — the JSON is well under 1 MB even with hundreds of enriched albums)

Then set:

```
RYMINE_DATA_PATH=/var/data/wishlist.json
```

Published data now survives restarts and redeploys.

### Option B — Republish after every restart (free tier)

Skip the disk. The wishlist file lives in the container's ephemeral storage.
After any cold start / redeploy, the hosted viewer will return an empty list
until you press **Publish** locally again.

For a personal viewer this is annoying but tolerable — your laptop is the
source of truth, so a republish is cheap. Just be aware that:

- On Render's free tier, the service spins down after ~15 min of inactivity.
  The first request after that triggers a cold start (~30s) AND loses any
  data published since the last persistent-state checkpoint. With Option B,
  every cold start = empty viewer.
- A republish is one button click on the local app.

If you go Option B, leave `RYMINE_DATA_PATH` unset — the app falls back to
`./data/wishlist.json` inside the container, which is writable but ephemeral.

---

## Verify the deploy

After Render finishes building, hit:

```
https://<your-service>.onrender.com/api/health
```

Expected response:

```json
{
	"ok": true,
	"name": "rymine",
	"mode": "readonly",
	"hasData": false,
	"albumCount": 0,
	"lastScrapedAt": null
}
```

`hasData: false` is normal on a fresh deploy — you haven't published yet.

Then open the root URL in a browser. You should be redirected to `/login`.
Enter `RYMINE_VIEWER_PASSWORD`. You'll land on the (currently empty) album
list with a small `read-only` badge in the header.

---

## Configure your local app to publish

> **Recommended:** Use the new GitHub-backed publish flow instead. It avoids
> the Render filesystem entirely, so free-tier sleep can't lose data. See
> [PUBLISH_GITHUB.md](./PUBLISH_GITHUB.md). The legacy direct-to-Render flow
> below is kept working but no longer the default.

In your local RYMine repo, edit `.env`:

```
RYMINE_MODE=local
RYMINE_PUBLISH_BACKEND=render
RYMINE_PUBLISH_URL=https://<your-service>.onrender.com/api/publish
RYMINE_PUBLISH_TOKEN=<same long secret as on Render>
```

Restart the local app (`npm run build && npm start` or double-click the
launcher). A **Publish** button now appears in the header next to Start Full
Sync. Click it. Watch for the success banner:

> Published 234 albums to my-rymine-viewer.onrender.com (5/23/2026, 11:42 PM)

Re-check `/api/health` on the hosted instance — `hasData` is now `true` and
`albumCount` matches.

---

## Rotating the publish token

1. Generate a new secret (`openssl rand -base64 32`).
2. Update `RYMINE_PUBLISH_TOKEN` on Render → save → service restarts.
3. Update `RYMINE_PUBLISH_TOKEN` in your local `.env` → restart the local app.

Browser logins are not affected — they use `RYMINE_VIEWER_PASSWORD`, a
separate secret.

The viewer password rotates the same way: change it on Render, restart, and
all outstanding login sessions invalidate automatically (the session cookie
is keyed by the password).

---

## Troubleshooting

**Publish → 401 "Hosted viewer rejected the publish token"**

The tokens don't match. Make sure `RYMINE_PUBLISH_TOKEN` on Render and in
your local `.env` are byte-identical (watch out for trailing whitespace and
newlines when copy-pasting).

**Publish → 503 "Publish endpoint not configured"**

The hosted instance is in readonly mode but `RYMINE_PUBLISH_TOKEN` is empty
or missing. Set it on Render and let the service restart.

**Publish → 413 / hangs on a large wishlist**

You hit adapter-node's `BODY_SIZE_LIMIT`. Raise it on Render
(`BODY_SIZE_LIMIT=10000000` for 10 MB).

**Publish → "Network error reaching ..."**

The hosted service URL is wrong or the service is asleep mid-cold-start.
Open the URL in a browser first to wake it up, then click Publish again.

**Login form → 403 / "Cross-site POST form submissions are forbidden"**

`ORIGIN` on Render doesn't match the actual URL you're visiting. The two
must agree exactly — same scheme, same host, no trailing slash.
`https://my-app.onrender.com` (not `http://`, not with a trailing `/`).

**Hosted viewer says "No data" after a Render redeploy**

Option B (no persistent disk) — your data was lost with the container.
Press Publish locally to repopulate. Switch to Option A if this happens
often enough to annoy you.

**Cold-start delay on first request (~30s)**

Render free tier behavior, not RYMine's fault. The service sleeps after
~15 min of inactivity and takes a moment to spin up on the next request.
Upgrade to a paid Web Service tier to keep it warm.

**Bookmarklet / Import / Queue / Start Full Sync UI is gone**

That's by design in readonly mode. These are write workflows that don't
make sense on the hosted viewer; they're hidden, and the underlying
endpoints reject with 403 even if you POST directly. Use the local
writable instance for those, then publish.

**`/api/health` returns mode: "local" on the hosted instance**

`RYMINE_MODE` isn't set to `readonly` on Render. Until it is, the publish
endpoint also returns 404, the readonly badge doesn't show, and the login
gate is off — i.e. _your hosted instance is browsable without a password_.
Fix this immediately.

---

## What this deployment is and isn't

It **is**:

- A single-user, password-gated browser-able mirror of your local wishlist.
- Push-based: data only changes when you click Publish on your laptop.
- Stateless w.r.t. accounts — no DB, no signup, no OAuth.

It **isn't**:

- A multi-user app.
- A scraper, importer, or enrichment runner. All write workflows live on
  your local instance; the hosted viewer only knows how to receive `POST
/api/publish` and serve reads.
- Privacy-grade. The viewer password is enough to keep casual visitors out
  but it's a single shared secret over standard HTTP-only cookies — fine
  for a personal album list, not for anything sensitive.
