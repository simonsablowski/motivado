# Operating the site

Day-to-day tasks, in the order they come up. Deployment itself is in [DEPLOY.md](DEPLOY.md), media in
[MEDIA.md](MEDIA.md).

## Workflow

Every finished change goes straight to `main`; Cloudflare deploys from there.

```bash
npm run build -w @motivado/web      # type check, build, prerender (about 280 routes), sitemap
python tools/quality_check.py       # media mapping, handovers, Ratgeber links, photos
git add <files> && git commit && git push
```

Untracked working sheets in the repository root (`*.csv`) stay out of commits.

## Design

- Tokens and all new components: `apps/web/src/redesign.css` (loaded after the older `styles.css`, which still holds
  the player's inner views and a few legacy classes).
- Font: Figtree, self-hosted through `@fontsource-variable/figtree`.
- One accent, the aquamarine of the logo (`--accent`), on white and mist (`--tint`); large rounded shapes; text pages
  use `PageHead` (`components/PageHead.tsx`).
- Breadcrumbs: pages render them into the row under the header through `components/Crumbs.tsx`.

## Ratgeber articles

Articles are written as Markdown in `content/ratgeber-src/<topic>/<slug>.md` (not shipped) and built to the JSON the
site reads:

```bash
python tools/ratgeber_build.py <topic>              # build the articles, add them to the topic index
python tools/ratgeber_build.py <topic> --cutover    # also rebuild the topic page, remove articles that are not
                                                    # in the source folder, write redirects, fix links elsewhere
```

Per topic the source folder holds the articles plus:

- `_intro.md`: heading and intro of the topic page,
- `_groups.json`: sub-categories in display order, each with the package it links to,
- `_mapping.csv`: old article URL to the article that replaced it (used for the redirects in
  `apps/web/public/_redirects`).

Front matter of an article: `title`, `heading`, `description`, `group`, `package` (slug of the matching package),
`reviewed` (`YYYY-MM`), `related` (slugs), `summary` (bullet list for the "Kurz gesagt" box). References such as
`„Liebeskummer überwinden“` in the text become links to the article of that name.

Standard for every article: one clear question, key points in the summary, concrete steps, when to get help,
hotlines where they matter, a link to the matching package at the end.

## Voluntary support

`apps/web/src/site.config.ts` holds `supportUrl` (the PayPal payment link) and `supportProvider`. While `supportUrl`
is empty, the page `/unterstuetzen`, its footer link, the note at the end of each module and the paragraph in the
privacy notice are all hidden. The prerender step reads the same file to decide whether to emit the route.

## Media

New videos, slides and documents have to be uploaded to R2 by hand. The Worker never sees them. After an upload:

```bash
python tools/media_manifest.py      # refresh content/media-manifest.json
```

and check the files with a `HEAD` request against `media.motivado.com` before relying on them.

## Backups

- **Repository:** GitHub is the backup of code and content (including all Ratgeber sources and old versions).
- **Media:** the originals and the converted copies live outside the repository. R2 holds the converted ones that are
  online. Keep one more copy of the converted folder (about 3.6 GB) on an external drive or cloud storage.
- **Secrets:** none are stored in the repository. If payment or email services are added later, their keys are
  Cloudflare secrets only.

## Analytics

Cloudflare Web Analytics is switched on for `motivado.com` through the automatic setup (Cloudflare dashboard,
Analytics and logs, Web Analytics). It needs no cookies and no code in the repository. The privacy notice mentions it.
