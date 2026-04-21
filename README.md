# agentis-apps

A single home for small static web artifacts — quick prototypes and one-off tools.

**Live:** <https://parlin.github.io/agentis-apps/>

## Why this repo exists

Anything simple enough to be a pile of static HTML/CSS/JS (or a static build from Astro / Hugo / Eleventy) lives here and publishes via GitHub Pages. More involved apps (Vite, Next.js, React SPAs, Svelte, API routes, SSR) get their own repo and deploy to Vercel.

## Structure

```
agentis-apps/
  index.html          # landing page listing apps
  README.md
  <slug>/
    index.html        # the app
    assets/...        # optional
```

URL shape: `https://parlin.github.io/agentis-apps/<slug>/`

## Adding an app

1. Create a folder with a slug name.
2. Drop an `index.html` inside (plus any assets).
3. Add a card to the root `index.html`.
4. Commit and push — Pages redeploys in ~30–60s.

## Apps

- **[Bed time](https://parlin.github.io/agentis-apps/sleepy-hour/)** — cozy bedtime prototype: tap animals to tuck them in.
