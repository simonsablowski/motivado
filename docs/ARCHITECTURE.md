# Architecture

## The legacy system

```
BizAgi (.bpm) ──export──▶ modeling/*.xpdl
                              │  motivado-import (PHP)
                              ▼
                    MySQL: coaching / object / objecttransition
                              │
motivado-api  ◀─ in-process ─ motivado-ui  ◀── HTTP/JSON ── player (Flash/Flex)
(walks the graph,             (session, user answers)
 evaluates conditions)
```

Coachings were drawn as flow charts. Each activity carried
`$Type:key("prop":value) text` in its description; the importer turned the
chart into *objects* (nodes) and *transitions* (edges). The API returned the
objects from the user's position up to the next decision, the player rendered
them and reported the answers back.

## Now

```
content/coachings/*.json ──▶ packages/engine ──▶ apps/web (React)
        ▲                         graph walk          player + site
        │                         conditions
 packages/importer (once)
```

Everything runs in the browser. There is no server and no database; answers
are kept in `localStorage`. Video files come from a media host (see
[DEPLOY.md](DEPLOY.md)).

### Engine (`packages/engine`)

A coaching is a graph of **nodes**; each node has outgoing **edges** with an
optional condition. Leaving a node picks an edge like the legacy API did:

1. the first edge whose condition holds,
2. if all edges lead to the same node, that node,
3. otherwise the first unconditional edge (the default),
4. otherwise the user is stuck, which is reported as a content problem.

Conditions (`krankheit is 'diab' and alter gt 40`) are parsed and interpreted;
the PHP original translated them to PHP and ran `eval()`. Comparison keeps
PHP's loose semantics because the models were written against them.

`AddValue`/`SetValue` nodes compute values silently. `#key|'fallback'` in
texts is replaced with answers.

### Importer (`packages/importer`)

Re-implements the legacy import: BizAgi XPDL → graph, flattening
*embedded sets*, *gateways* and *choice tasks* into conditional edges. It was
validated against a database dump of the legacy system: 160 of the 170
coachings the old importer produced come out **identical**; in the other 10
the legacy output had defects (dropped end edges, spurious start edges, a
half-imported nested model) and the new graph is the intended one.

After the migration the JSON files are the source of truth; the XPDL files
are kept only in the archived `motivado-modeling` repository.

### Player (`apps/web/src/player`)

One view per legacy object type (`views.tsx`), orchestrated by `Player.tsx`:
video stage on the page background (clips are composited onto it at build
time), timed `show`/`hide`/`slide` events, `Group` objects (several inputs on
one screen), per-coaching progress.

## Legacy → new

| Legacy                         | New                                              |
| ------------------------------ | ------------------------------------------------ |
| `motivado-modeling`            | `content/coachings/*.json`                       |
| `motivado-import`              | `packages/importer` (one-off)                    |
| `motivado-api`                 | `packages/engine`                                |
| `motivado-ui`                  | `apps/web/src/lib/store.ts` (browser storage)    |
| `motivado-build`, `-config`    | `.github/workflows`, `docs/DEPLOY.md`            |
| Flash/Flex player, Magento shop| `apps/web`; "buy" leads to `/bestellen/…`        |

## Known gaps

* `EnergyDemand` / `DieterCategory` (BMI and energy calculators, used by one
  coaching) show their text but do not calculate.
* The sleep coachings are filed under `slc-*` in the models and under
  `ges-schlaf-*` in the catalogue; the mapping in
  `content/site/model-map.json` is inferred and should be confirmed.
* Smoking cessation (`ges-rau-*`) and a few other catalogue coachings have no
  model in the legacy repositories.
* About 640 `ratgeber-*` article pages of the old site are not ported.
