#!/usr/bin/env python3
"""Validate, then bundle everything into dist/ for the future site."""

import json
import shutil
import sys
from datetime import datetime, timezone

from lib import DIST, validate_all


def _strip(rows):
    return [{k: v for k, v in row.items() if not k.startswith("_")} for row in rows]


def _year_name_key(row):
    return (row.get("year_revealed") or 0, str(row.get("name", "")))


def _write(name, obj):
    (DIST / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    result = validate_all()
    if not result["ok"]:
        print(
            f"✗ build aborted — {len(result['errors'])} validation error(s). "
            "Run validate.py for details.",
            file=sys.stderr,
        )
        sys.exit(1)

    data = result["data"]
    robots = sorted(_strip(data["robots"]), key=_year_name_key)
    hands = sorted(_strip(data["hands"]), key=_year_name_key)
    milestones = sorted(data["milestones"], key=lambda m: str(m.get("date", "")))
    eras = data["eras"]

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    _write("robots.json", robots)
    _write("hands.json", hands)
    _write("eras.json", eras)
    _write("milestones.json", milestones)
    _write(
        "meta.json",
        {
            "generated": datetime.now(timezone.utc).isoformat(),
            "counts": {
                "robots": len(robots),
                "hands": len(hands),
                "eras": len(eras),
                "milestones": len(milestones),
            },
            "robots_by_era": {
                e["id"]: sum(1 for r in robots if r.get("era") == e["id"]) for e in eras
            },
        },
    )

    print(
        f"✓ built dist/ — {len(robots)} robots, {len(hands)} hands, "
        f"{len(eras)} eras, {len(milestones)} milestones"
    )


if __name__ == "__main__":
    main()
