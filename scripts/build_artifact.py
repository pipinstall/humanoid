#!/usr/bin/env python3
"""Single self-contained build of the /explore/ app for the Claude artifact mirror.

Inlines data + CSS + JS into dist/_artifact.html (no images, no external files except
Google Fonts). Publish that file to the existing artifact URL. The GitHub Pages site
is the primary deliverable; this is a lightweight private mirror.
"""

import json
import sys
from pathlib import Path

from lib import ROOT, validate_all

SITE = ROOT / "site"
OUT = ROOT / "dist" / "_artifact.html"

HEADER = """<header class="site-head"><div class="head-in">
<a class="wordmark" href="#/catalog"><b>Humanoid</b> Robot Index</a>
<nav class="nav">
<a href="#/catalog">Catalog</a><a href="#/timeline">Timeline</a>
<a href="#/milestones">Milestones</a><a href="#/news">News</a><a href="#/analysis">Analysis</a>
</nav>
<button class="theme-btn" id="themeBtn" type="button" aria-label="Toggle light or dark theme"><span aria-hidden="true">◐</span></button>
</div></header>"""

FOOT = ('<footer class="site-foot"><div class="foot-in">'
        '<span>Humanoid Robot Index — mirror of the explorer. Full site + images on GitHub Pages.</span>'
        '</div></footer>')


def main():
    res = validate_all()
    if not res["ok"]:
        print(f"✗ aborted — {len(res['errors'])} data errors.", file=sys.stderr)
        sys.exit(1)
    raw = res["data"]
    strip = lambda rows: [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]
    yk = lambda z: (z.get("year_revealed") or 0, str(z.get("name", "")))
    data = {
        "robots": sorted(strip(raw["robots"]), key=yk),
        "hands": sorted(strip(raw["hands"]), key=yk),
        "eras": raw["eras"],
        "milestones": sorted(raw["milestones"], key=lambda m: str(m.get("date", ""))),
        "news": raw["news"],
        "images": {},
    }

    css = "\n".join((SITE / "css" / f).read_text() for f in ("tokens.css", "base.css", "components.css"))
    js = "\n".join((SITE / "js" / f).read_text() for f in ("util.js", "charts.js", "explore.js"))
    body = (SITE / "templates" / "explore.html").read_text().replace("{{root}}", "")

    html = (
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,wght@0,400;0,500;1,400&display=swap">\n'
        "<title>Humanoid Robot Index</title>\n"
        f"<style>\n{css}\n</style>\n"
        f"{HEADER}\n<main id=\"main\" class=\"explore\">\n{body}\n</main>\n{FOOT}\n"
        f"<script>window.HRI_ROOT='';window.__HRI_DATA__={json.dumps(data, ensure_ascii=False, separators=(',', ':'))};</script>\n"
        f"<script>\n{js}\n</script>\n"
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"✓ wrote {OUT.relative_to(ROOT)} ({len(html.encode()) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
