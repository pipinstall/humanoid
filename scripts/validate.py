#!/usr/bin/env python3
"""Validate every entry against data/schema.md. Exits non-zero on any error."""

import sys

from lib import validate_all


def main():
    result = validate_all()
    if not result["ok"]:
        errs = result["errors"]
        print(f"✗ {len(errs)} validation error(s):\n", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    d = result["data"]
    n = d.get("news") or {}
    print(
        f"✓ valid — {len(d['robots'])} robots, {len(d['hands'])} hands, "
        f"{len(d['eras'])} eras, {len(d['milestones'])} milestones, "
        f"{len(n.get('developments', []))} news items"
    )


if __name__ == "__main__":
    main()
