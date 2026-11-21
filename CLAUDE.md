# Humanoid Robot Index

A curated dataset and static website cataloguing humanoid robots (1495 to present) and dexterous hands, with an era timeline, milestones, trend charts and a News & Insights section. Live at https://pipinstall.github.io/humanoid/.

## Layout and build
- **Data:** JSON in `data/`, one file per robot or hand, plus `eras.json`, `milestones.json` and `news.json`. `data/schema.md` is the source of truth, and `scripts/lib.py` enforces it.
- **Python 3.9 stdlib only.** No Node, npm or framework.
- **Site source:** `site/`, which holds `templates/`, `css/`, `js/`, `img/` (committed CC/PD photos) and `credits.json`. `site/config.json` holds the base_url.
- **Build:** `python3 scripts/build_site.py` builds the multi-page site into `dist/` (git-ignored). `python3 scripts/build_artifact.py` builds `dist/_artifact.html`, a single-file explorer. `scripts/fetch_images.py` pulls license-filtered Wikimedia images (it uses macOS `sips`).
- **Preview:** `python3 -m http.server -d dist 8000`.
- **Publish:** `.github/workflows/pages.yml` rebuilds and redeploys on every push to `main`.
- **Artifact mirror:** https://claude.ai/code/artifact/8be52845-a9ee-4a83-a7b5-73c5b5995443. Republish `dist/_artifact.html` to that URL. The Pages site supersedes it.

## Rules
- **Sources:** never invent URLs. Every `url` in `sources`, `links` or `news` must be one actually seen in a search result or fetched and confirmed. Order of preference: the manufacturer's spec page or press release, then a peer-reviewed paper or official lab page, then Wikipedia (good for dates and lineage), then reputable trade press (IEEE Spectrum, The Robot Report, Humanoids Daily). Don't assume a company has a Wikipedia article. Leave a spec blank rather than guess. The same applies to images: use permissive licenses only and attribute each in `credits.json`.
- **Commit identity:** author as `pipinstall <20631643+pipinstall@users.noreply.github.com>`. This repo is public, so never put a personal email in source or commit metadata.
- **News refresh** is manual, on request. Re-research recent developments and rewrite the `news.json` `developments` list (about the 12 newest, every URL verified). Bump `updated`, run both build scripts, and republish.

## Deferred ideas (the user's call; not started)
- A "Hall of Fame" of the people behind the field (Raibert, Yamaguchi/"Dr. GUERO", Ichiro Kato, Sangbae Kim, the Pratts, Ishiguro, Playter and others). It needs a `data/people/` collection, a schema and a site view.
- Custom domain. `humanoidarchive.org` was recommended (available as of 2026-09-10). To set it up: add `site/CNAME` and have `build_site.py` copy it into `dist/`, update `config.json`, set the domain and enforce HTTPS in the Pages settings, and point DNS at GitHub Pages (4 apex A records 185.199.108–111.153, plus a `www` CNAME to `pipinstall.github.io`).
- A scheduled news refresh as a cloud routine.
- More robot images.
- Bump the GitHub Actions versions (Node 20 deprecation warnings).
