# Motivado

Interactive video coaching: an expert on video walks you through a branching
dialogue of questions, exercises and tips, and your answers decide what comes
next.

This repository revives the original Motivado (2009–2014), which ran as a PHP
API, an importer and a Flash/Flex player. It is rebuilt as a static web app;
the coaching content and its logic are carried over unchanged.

|                  |                                                              |
| ---------------- | ------------------------------------------------------------ |
| `packages/engine`   | The coaching logic: graph walking, conditions, templating, validation (TypeScript, no dependencies) |
| `packages/importer` | One-off migration of the legacy XPDL models into JSON       |
| `apps/web`          | The site and the coaching player (React + Vite)             |
| `content/`          | Coachings as JSON, site catalogue, media manifest           |
| `tools/`            | Python helpers: legacy dump extraction, media pipeline      |
| `docs/`             | Architecture, content format, deployment, [operating the site](docs/OPERATIONS.md) |

## Quick start

```bash
npm install
npm test                 # engine + importer (+ playthrough of every coaching)
npm run dev              # http://localhost:5173
```

Videos are not in the repository. To play them locally, build the media once
(see [docs/MEDIA.md](docs/MEDIA.md)) and point the dev server at the output:

```bash
# apps/web/.env.local
MEDIA_DIR=D:/path/to/media-out
```

Without media the player still works; video steps show a notice and the text.

## Licenses

* Code: [MIT](LICENSE).
* Content in `content/`: all rights reserved, see
  [content/LICENSE.md](content/LICENSE.md).

## Background

The legacy repositories this was built from are archived on GitHub:
`motivado-modeling`, `-api`, `-import`, `-ui`, `-build`, `-config`.
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the old system worked
and what replaced what.
