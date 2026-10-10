# Deployment

**Status: not deployed.** No external publish has been performed. This document describes the build and
static-hosting process so deployment can proceed quickly once explicitly authorized -- it is not a
record of an actual deployment.

## Production build

```bash
npm run build     # tsc -b && vite build -- outputs to dist/
npm run preview    # serves dist/ locally for a final smoke check before any real deploy
```

Verified (this session, against the exact commit this documentation was written at): the build succeeds
cleanly, typechecks cleanly, and the production preview serves correctly with the real Web Worker and
WASM solver both loading and functioning (every Playwright e2e test runs against exactly this build,
never a dev server -- see `TESTING.md`).

## Static hosting (GitHub Pages) -- base path

`vite.config.ts` currently has **no `base` option set**, which defaults to `/` (correct for a
root-domain deploy, e.g. `username.github.io`). If this project is deployed as a PROJECT page instead
(e.g. `username.github.io/cascadia/`), `vite.config.ts` needs:

```ts
export default defineConfig({
  base: '/cascadia/',   // must match the actual repo/path name exactly
  // ...existing config
})
```

This was deliberately left unset rather than guessed at build-this-session time: the exact target path
depends on how this project is slotted into the broader portfolio structure, which is a decision outside
this session's scope to make unilaterally. Whoever authorizes deployment should set this to match the
actual target path, rebuild, and re-verify with `npm run preview` that every asset (the WASM file, the
Worker script, the Archivo font files) resolves correctly under that base path before publishing.

## Pre-deployment checklist

- [ ] `base` in `vite.config.ts` matches the real target path (see above).
- [ ] `npm run build` succeeds with no errors.
- [ ] `npm run preview` serves the build correctly: the intro plays, at least one control produces a
      real solved result, and the browser console shows no errors.
- [ ] Full test suite green (`TESTING.md`): `npx tsc --noEmit`, `npm run test`, `npm run test:e2e`,
      `.venv/bin/python -m pytest -q`.
- [ ] `LIMITATIONS.md` reflects the actual shipped state (update if anything changed since it was last
      written).
- [ ] After publishing: a real `curl` check against the live URL, and a real screenshot of the live page
      actually loading -- this project's own standing rule is that a deployment is not verified until
      checked this way, not merely "the push succeeded."

## What this build does NOT include

No CDN, no server-side rendering, no backend of any kind -- this is a fully static site (HTML/CSS/JS +
one WASM binary + static JSON data fixtures), suitable for any static host (GitHub Pages, Netlify,
Vercel's static mode, a plain S3 bucket) with no server-side configuration beyond correct MIME types for
`.wasm` (most modern static hosts, including GitHub Pages, serve this correctly by default).
