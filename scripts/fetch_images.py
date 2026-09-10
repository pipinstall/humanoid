#!/usr/bin/env python3
"""Fetch a lead image for each robot from Wikimedia Commons, keeping only
permissively-licensed files. Writes site/img/<id>.<ext> and appends to
site/credits.json. Stdlib only. Wikimedia requires a descriptive User-Agent.

  python3 scripts/fetch_images.py                 # all robots with a Wikipedia link
  python3 scripts/fetch_images.py --only iit-icub # one
  python3 scripts/fetch_images.py --refresh       # re-download even if present

Review the results before committing — a Wikipedia "page image" is sometimes a
logo or a diagram. Delete any bad file from site/img/ and its row from
site/credits.json (or re-run with --only after fixing the TITLE_OVERRIDES map).
"""

import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "site" / "img"
CREDITS = ROOT / "site" / "credits.json"
UA = "HumanoidRobotIndex/1.0 (https://github.com/pipinstall/humanoid; humanoid robot catalog)"
API = "https://en.wikipedia.org/w/api.php"
PAUSE = 1.3  # seconds between requests — Wikimedia asks for serial, ~1/s

# id -> Wikipedia article title, when the robot's own wikipedia link points at a
# company/project page (whose page-image is a logo) rather than a robot article.
TITLE_OVERRIDES = {
    "aist-hrp-4c": "HRP-4C",
    "boston-dynamics-atlas-drc": "Atlas (robot)",
    "boston-dynamics-atlas-electric": "Atlas (robot)",
    "honda-e-series": "Honda E series",
    "honda-p2": "Honda P series",
    "honda-p3": "Honda P series",
    "nasa-robonaut-2": "Robonaut",
    "nasa-robonaut-1": "Robonaut",
    "kaist-drc-hubo-plus": "HUBO",
}

OK_LICENSE = re.compile(r"(cc0|cc[ \-]?by(-sa)?|public\s*domain|^pd|no restrictions)", re.I)
BAD_LICENSE = re.compile(r"(fair use|non-?free|-nc|-nd|all rights reserved|copyright)", re.I)


class _Strip(HTMLParser):
    def __init__(self):
        super().__init__()
        self.out = []

    def handle_data(self, d):
        self.out.append(d)


def strip_html(s):
    p = _Strip()
    p.feed(s or "")
    return re.sub(r"\s+", " ", "".join(p.out)).strip()


_last = [0.0]


def _throttle():
    dt = time.time() - _last[0]
    if dt < PAUSE:
        time.sleep(PAUSE - dt)
    _last[0] = time.time()


def api(params):
    params = dict(params, format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        _throttle()
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            if ex.code == 429 and attempt < 4:
                time.sleep(4 * (attempt + 1))
                continue
            raise


def title_for(robot):
    if robot["id"] in TITLE_OVERRIDES:
        return TITLE_OVERRIDES[robot["id"]]
    for lk in robot.get("links", []) or []:
        if lk["type"] == "wikipedia" and "/wiki/" in lk["url"]:
            return urllib.parse.unquote(lk["url"].split("/wiki/", 1)[1]).replace("_", " ")
    for s in robot.get("sources", []) or []:
        if "en.wikipedia.org/wiki/" in s["url"]:
            return urllib.parse.unquote(s["url"].split("/wiki/", 1)[1]).replace("_", " ")
    return None


def lead_image(title):
    d = api({"action": "query", "prop": "pageimages", "piprop": "name|thumbnail",
             "pithumbsize": 1024, "titles": title, "redirects": 1})
    pages = d.get("query", {}).get("pages", [])
    if not pages or "pageimage" not in pages[0]:
        return None, None
    return pages[0]["pageimage"], pages[0].get("thumbnail", {}).get("source")


def license_info(filename):
    d = api({"action": "query", "prop": "imageinfo", "titles": "File:" + filename,
             "iiprop": "url|extmetadata",
             "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired"})
    pages = d.get("query", {}).get("pages", [])
    if not pages or not pages[0].get("imageinfo"):
        return None
    ii = pages[0]["imageinfo"][0]
    m = ii.get("extmetadata", {})
    return {
        "descriptionurl": ii.get("descriptionurl", ""),
        "license": (m.get("LicenseShortName", {}) or {}).get("value", ""),
        "license_url": (m.get("LicenseUrl", {}) or {}).get("value", ""),
        "author": strip_html((m.get("Artist", {}) or {}).get("value", ""))
                  or strip_html((m.get("Credit", {}) or {}).get("value", "")),
    }


_SIPS = shutil.which("sips")


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    dest.write_bytes(data)
    return len(data)


def optimize(path):
    """cap longest edge ~1100px and re-encode as JPEG q70 (macOS 'sips'); no-op elsewhere."""
    if not _SIPS:
        return path
    out = path.with_suffix(".jpg")
    try:
        subprocess.run([_SIPS, "-s", "format", "jpeg", "-s", "formatOptions", "70",
                        "-Z", "1100", str(path), "--out", str(out)],
                       check=True, capture_output=True)
        if out != path and path.exists():
            path.unlink()
        return out
    except Exception:
        return path


def main():
    args = sys.argv[1:]
    only = None
    refresh = "--refresh" in args
    if "--only" in args:
        only = args[args.index("--only") + 1]

    robots = [json.loads(p.read_text()) for p in sorted((ROOT / "data" / "robots").glob("*.json"))]

    IMG.mkdir(parents=True, exist_ok=True)
    credits = {c["id"]: c for c in json.loads(CREDITS.read_text())} if CREDITS.exists() else {}

    fetched, rejected, noimg, skipped, errors = [], [], [], [], []
    for r in robots:
        rid = r["id"]
        if only and rid != only:
            continue
        existing = list(IMG.glob(rid + ".*"))
        if existing and not refresh:
            skipped.append(rid)
            continue
        title = title_for(r)
        if not title:
            noimg.append((rid, "no wikipedia article"))
            continue
        try:
            fname, thumb = lead_image(title)
            if not fname or not thumb:
                noimg.append((rid, "no page image on " + title))
                continue
            info = license_info(fname)
            lic = (info or {}).get("license", "") or "unknown"
            if not info or BAD_LICENSE.search(lic) or not OK_LICENSE.search(lic):
                rejected.append((rid, lic or "no license data"))
                continue
            ext = ".jpg"
            low = thumb.lower()
            if ".png" in low:
                ext = ".png"
            elif ".webp" in low:
                ext = ".webp"
            for old in existing:
                old.unlink()
            tmp = IMG / (rid + ext)
            size = download(thumb, tmp)
            if size < 15000:  # a lead "image" this small is a logo/icon, not a photo
                tmp.unlink()
                rejected.append((rid, f"file too small ({size} B) — likely a logo"))
                continue
            final = optimize(tmp)
            size = final.stat().st_size
            credits[rid] = {
                "id": rid,
                "title": fname,
                "source_url": info["descriptionurl"] or ("https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fname)),
                "author": info["author"] or "Unknown",
                "license": lic,
                "license_url": info["license_url"],
            }
            fetched.append((rid, lic, size // 1024))
        except Exception as ex:  # noqa: BLE001
            errors.append((rid, repr(ex)))

    CREDITS.write_text(json.dumps(sorted(credits.values(), key=lambda c: c["id"]), indent=2, ensure_ascii=False) + "\n")

    print(f"\n✓ fetched {len(fetched)}   ✗ rejected {len(rejected)}   – no image {len(noimg)}   "
          f"↷ skipped {len(skipped)}   ! errors {len(errors)}\n")
    if fetched:
        print("FETCHED:")
        for rid, lic, kb in fetched:
            print(f"  {rid:32} {kb:5} KB  {lic}")
    if rejected:
        print("\nREJECTED (license):")
        for rid, lic in rejected:
            print(f"  {rid:32} {lic}")
    if noimg:
        print("\nNO IMAGE:")
        for rid, why in noimg:
            print(f"  {rid:32} {why}")
    if errors:
        print("\nERRORS:")
        for rid, ex in errors:
            print(f"  {rid:32} {ex}")
    print("\nReview site/img/ before committing. Then: git add site/img site/credits.json")


if __name__ == "__main__":
    main()
