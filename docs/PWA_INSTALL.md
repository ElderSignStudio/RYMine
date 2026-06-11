# Installing RYMine on iPhone

RYMine ships a Web App Manifest so you can pin the hosted readonly viewer
to your iPhone home screen and have it behave like a native app. There is
no App Store, no native packaging, and nothing to download outside of
Safari's built-in **Add to Home Screen** flow.

## What gets installed

Tapping **Add to Home Screen** registers an icon on the home screen tied to
your service URL (e.g. `https://my-rymine-viewer.onrender.com`). When you
tap that icon:

- The browser opens RYMine in standalone mode — no address bar, no Safari
  chrome — so it feels app-like.
- The PWA **start URL is `/car`**, not `/`. You land directly on Car Mode.
- The full app remains reachable in two places: typing the bare URL into
  Safari, or tapping the small "Full app ↗" link at the top of Car Mode.

## Install steps

1. Open Safari on your iPhone and visit your hosted RYMine URL.
2. If you're using the readonly hosted viewer, sign in with the viewer
   password first. (Logging in from inside Safari before installing means
   your session cookie is already in place when you next tap the icon.)
3. Tap the Share button (the square with the up-arrow in Safari's toolbar).
4. Scroll down and tap **Add to Home Screen**.
5. The title field will pre-fill as "RYMine" — leave it or rename. Tap
   **Add** in the top right.
6. The home screen now shows the RYMine icon. Tap it to launch.

You can move and rename the icon like any other app. To remove the install,
long-press the icon and choose **Remove App → Delete App**, the same flow
you'd use for any iOS app.

## Behavior after install

- **First tap from home screen**: Safari opens to `/car`. In readonly mode,
  if your session has expired, the existing auth gate redirects to
  `/login?from=/car`; after signing in, the server bounces back to `/car`
  automatically.
- **Local writable mode**: There's no password gate, so the icon just
  opens straight to Car Mode.
- **Theme**: The launched app picks up the same DaisyUI theme you've
  saved (`rymine.theme` in `localStorage`) — the same pre-paint script
  that runs in normal Safari fires here too, so the warm/cool/coffee/etc.
  vibe survives the install.
- **Going back to the full app**: Tap the **Full app ↗** link in the
  top-right of any Car Mode screen.

## iOS limitations to know about

A few things iOS Safari does differently from a real native app — none
of them break RYMine, but they're worth knowing:

- **Each installed PWA has its own cookie / `localStorage` jar**, separate
  from the same site in Safari proper. Signing in from Safari first
  (step 2 above) doesn't carry the session into the installed app — you
  may need to sign in once from the installed app the first time it opens
  the readonly viewer. After that, the session sticks for ~1 year (or
  until you rotate `RYMINE_VIEWER_PASSWORD`).
- **No native splash screen image** — iOS draws a solid-color splash
  using `background_color` (`#1a1815` here) while RYMine loads. We
  deliberately don't ship a splash image because the network round-trip
  for the manifest's `start_url` is fast.
- **No push notifications**, no background sync, no offline mode. The PWA
  needs a working network connection (Render service awake) to load
  anything. On Render's free tier, cold-start delays apply equally
  whether you open RYMine from the home-screen icon or from Safari.
- **Hosted-only**: There's no real reason to install the local writable
  instance from a phone, since it lives on your laptop. The install flow
  is designed for the hosted readonly viewer URL on your phone.

## Testing locally before publishing

You can verify the install assets work before deploying to Render:

```sh
npm run build && npm start
```

Then in any browser hit `http://127.0.0.1:3000/manifest.webmanifest` —
it should serve the JSON document, with `start_url: "/car"`. Also confirm
the icons exist:

```sh
curl -I http://127.0.0.1:3000/icon-192.png
curl -I http://127.0.0.1:3000/icon-512.png
curl -I http://127.0.0.1:3000/apple-touch-icon.png
```

All three should return `HTTP/1.1 200`.

For real iPhone testing, Safari requires HTTPS for full PWA features —
your Render deployment satisfies this automatically.
