# Deployment (free tier)

The site is static, so it needs only static hosting and a place for the media
files. Both fit into Cloudflare's free plan.

## 1. Media bucket (Cloudflare R2)

1. Cloudflare dashboard → R2 → create bucket `motivado-media`.
   (R2 asks for a payment card; the free allowance of 10 GB storage and free
   egress is more than the launch media needs, ~1.1 GB.)
2. Bucket → Settings → Custom domain → `media.motivado.com`.
3. Allow cross-origin reads for the site: Settings → CORS →
   `GET`, `HEAD`, origin `https://motivado.com`.
4. Upload the output of `tools/build_media.py`, for example with rclone
   configured for R2:

   ```bash
   rclone copy out/media r2:motivado-media --progress
   ```

## 2. Site (Cloudflare Workers with static assets)

Cloudflare now creates a Worker with static assets when you connect a
repository (the former "Pages" flow). The repository contains
`wrangler.jsonc`, which publishes `apps/web/dist` as a single page app, and
`.node-version`.

1. Workers & Pages -> Create -> import `simonsablowski/motivado`, branch `main`.
2. Settings -> Builds:

   | Setting | Value |
   | --- | --- |
   | Build command | `npm ci && npm run build -w @motivado/web` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/` |
   | Build variable | `VITE_MEDIA_BASE_URL` = `https://media.motivado.com` |

   The variable must be a *build* variable (Builds -> Variables and secrets),
   not a runtime variable, because Vite bakes it in at build time.
3. Settings -> Domains & Routes -> add the custom domain `motivado.com`.

Deep links work through `not_found_handling: single-page-application`.

## 3. Before going live

* Check the content you publish, in particular the health coachings and the
  named experts, and the third-party names in `b2b-*` coachings (those are not
  part of the launch set).

## Updating content

Edit the JSON in `content/coachings/`, run `npm test` (it validates every
coaching and plays it through) and push.
