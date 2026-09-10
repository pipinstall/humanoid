# Humanoid DB

An exhaustive-as-practical catalog of **humanoid robots** — structured specs per machine
(maker, origin year, mass, height, degrees of freedom, actuation, links to code and sim models)
— paired with a **historical timeline** of how the field evolved from early automata to today's
explosion, and a set of curated **milestones**.

It ships as a static website (see `DEPLOY.md` for GitHub Pages): a home page, an interactive
explorer (filter / sort / timeline / milestones / news / charts) and a server-rendered page per
robot and per hand.

## Layout

```
data/
  schema.md          field definitions + controlled vocabularies (human-readable source of truth)
  eras.json          the 6 timeline eras
  milestones.json    dated, sourced turning points, each linked to robots
  news.json          evergreen insights + verified recent developments + a "follow" directory
  sources.md         master bibliography / notes on sourcing
  robots/*.json      one file per robot (filename = id)
  hands/*.json       one file per dexterous hand (filename = id), cross-linked to robots
timeline/
  history.md         the narrative: field evolution, one section per era
site/
  templates/  css/  js/    the static-site source
  img/                      committed CC/PD robot photos
  credits.json              image attributions
scripts/
  lib.py             shared loader + validator (enforces schema.md)
  validate.py        check every entry; exits non-zero on any error
  build_site.py      validate + render site/ + data into dist/ (the whole build)
  build_artifact.py  single self-contained build of the explorer (Claude artifact mirror)
  fetch_images.py    pull permissively-licensed robot photos from Wikimedia Commons
dist/                generated site (git-ignored; CI rebuilds and deploys it)
```

## Usage

Requires Python 3.8+ (standard library only, no `pip install`).

```bash
python3 scripts/validate.py                     # check all entries against the schema
python3 scripts/build_site.py                   # build the whole site into dist/
python3 -m http.server -d dist 8000             # preview at http://localhost:8000/
```

`dist/data/*.json` is the plain, language-agnostic data bundle the front-end consumes.

## Scope

Included: full bipedal humanoids; mini research/education humanoids (NAO, iCub, Poppy);
non-walking androids (Sophia, Ameca); bipedal legs without a torso (Cassie, Schaft). Every entry
carries a `form_factor` tag so any subset can be filtered out. Commercial products and
open-source / university prototypes both. Powered exoskeletons are out of scope.

Robotic **hands** are catalogued separately in `data/hands/` and linked from the robots that use
them.

## Contributing an entry

1. Copy an existing file in `data/robots/` (or `data/hands/`), rename it to the new `id`.
2. Fill in the fields per `data/schema.md`. Required fields must be present; unknown optional
   values should be omitted or `null` rather than guessed.
3. Every entry needs at least one `sources` link. Add every reference link you can find to
   `links` — official page, GitHub repo, docs, datasheet, Wikipedia, key paper, demo video, and
   URDF / MJCF simulation models.
4. Run `python3 scripts/validate.py`.
