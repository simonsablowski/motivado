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

## 2. Site (Cloudflare Pages)

1. Pages → create project from this GitHub repository.
2. Build command `npm ci && npm run build -w @motivado/web`,
   output directory `apps/web/dist`.
3. Environment variable `VITE_MEDIA_BASE_URL=https://media.motivado.com`.
4. Custom domain `motivado.com`.

`apps/web/public/_redirects` makes deep links work (single page app).

## 3. Before going live

* Fill in `Impressum` and `Datenschutz` (`apps/web/src/pages/Static.tsx`).
  German law requires real operator details.
* Postal address and operator name in the Impressum. The contact address
  (`contact@simsab.net`) is set in `apps/web/src/site.config.ts` and in the
  content.
* Check the content you publish, in particular the health coachings and the
  named experts, and the third-party names in `b2b-*` coachings (those are not
  part of the launch set).

## Updating content

Edit the JSON in `content/coachings/`, run `npm test` (it validates every
coaching and plays it through) and push.
