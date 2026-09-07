#!/usr/bin/env python3
"""Inline dist/*.json into site/index.html -> dist/index.html (self-contained, publishable)."""

import json
import sys
from pathlib import Path

from lib import DIST, ROOT, validate_all

SITE_SRC = ROOT / "site" / "index.html"
TOKEN = "__HUMANOID_DATA__"


def main():
    result = validate_all()
    if not result["ok"]:
        print(f"✗ site build aborted — data has {len(result['errors'])} validation error(s).", file=sys.stderr)
        sys.exit(1)

    # build.py must have produced dist/ already; run it if not
    needed = ["robots.json", "hands.json", "eras.json", "milestones.json"]
    if not all((DIST / n).exists() for n in needed):
        print("✗ dist/*.json missing — run scripts/build.py first.", file=sys.stderr)
        sys.exit(1)

    payload = {name.replace(".json", ""): json.loads((DIST / name).read_text()) for name in needed}
    data_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)

    template = SITE_SRC.read_text(encoding="utf-8")
    if TOKEN not in template:
        print(f"✗ {SITE_SRC} has no {TOKEN} placeholder.", file=sys.stderr)
        sys.exit(1)
    html = template.replace(TOKEN, data_json)

    out = DIST / "index.html"
    out.write_text(html, encoding="utf-8")
    kb = len(html.encode("utf-8")) / 1024
    print(
        f"✓ built dist/index.html ({kb:.0f} KB) — "
        f"{len(payload['robots'])} robots, {len(payload['hands'])} hands, "
        f"{len(payload['milestones'])} milestones"
    )


if __name__ == "__main__":
    main()
