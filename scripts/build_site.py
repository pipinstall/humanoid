#!/usr/bin/env python3
"""Render site/templates + data into a multi-page static site in dist/.

Layout produced:
  dist/index.html                 home
  dist/explore/index.html         the interactive explorer (hash-routed)
  dist/robot/<id>/index.html      one server-rendered page per robot
  dist/hand/<id>/index.html       one per hand
  dist/credits/index.html         image attributions
  dist/404.html
  dist/data/*.json                the bundled data
  dist/css/  dist/js/  dist/img/  copied from site/

Paths inside pages are RELATIVE, prefixed with {{root}} ("" at /, "../../" at /robot/<id>/),
so the site works when served from a GitHub Pages sub-path.

Stdlib only.
"""

import hashlib
import html
import json
import re
import shutil
import sys
from pathlib import Path

from lib import DIST, ROOT, validate_all

SITE = ROOT / "site"
TPL = SITE / "templates"

ERA_ORDER = ["automata", "foundational", "dynamic-bipedalism", "drc", "commercial-pivot", "explosion"]

LINK_GROUPS = [
    ("Official", ["official"]),
    ("Code & models", ["github", "urdf", "mjcf"]),
    ("Reference", ["wikipedia", "paper", "docs", "datasheet", "article"]),
    ("Video", ["video"]),
]

NAV = [
    ("Home", ""),
    ("Catalog", "explore/"),
    ("Timeline", "explore/#/timeline"),
    ("Milestones", "explore/#/milestones"),
    ("News", "explore/#/news"),
    ("Analysis", "explore/#/analysis"),
]


def e(s):
    return html.escape("" if s is None else str(s), quote=True)


def title_case(s):
    return re.sub(r"(^|[\s\-/])([a-z])", lambda m: m.group(1) + m.group(2).upper(), str(s))


# ---------- config / images ----------

def load_config():
    p = SITE / "config.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return {}


def image_index():
    """map entry id -> relative img filename (under img/), from site/img/*"""
    out = {}
    d = SITE / "img"
    if d.is_dir():
        for f in d.iterdir():
            if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                out[f.stem] = f.name
    return out


def load_credits():
    p = SITE / "credits.json"
    if p.exists():
        try:
            return {c["id"]: c for c in json.loads(p.read_text())}
        except Exception:
            pass
    return {}


# ---------- shell ----------

def nav_html(root, active):
    home = root or "./"
    items = []
    for label, href in NAV:
        cur = ' aria-current="page"' if label == active else ""
        dest = home if href == "" else root + href
        items.append(f'<a href="{dest}"{cur}>{e(label)}</a>')
    return (
        '<a class="skip" href="#main">Skip to content</a>'
        '<header class="site-head"><div class="head-in">'
        f'<a class="wordmark" href="{home}"><b>Humanoid</b> Robot Index</a>'
        f'<nav class="nav">{"".join(items)}</nav>'
        '<button class="theme-btn" id="themeBtn" type="button" aria-label="Toggle light or dark theme">'
        '<span aria-hidden="true">◐</span></button>'
        '</div></header>'
    )


def foot_html(root, updated):
    repo = CONFIG.get("repo_url")
    src = (f'<a href="{e(repo)}" rel="noopener">Source on GitHub</a> · ' if repo else "")
    return (
        '<footer class="site-foot"><div class="foot-in">'
        f'<span>Humanoid Robot Index · data updated {e(updated)}</span>'
        f'<span><a href="{root}credits/">Image credits</a> · {src}'
        'no framework, no tracker</span>'
        '</div></footer>'
    )


_ASSET_V = {}


def asset_v(rel):
    """Short content hash for site/<rel>, cached. Appended to asset URLs so a
    new HTML page can never be served alongside a stale cached CSS/JS file —
    the pair must match or the page breaks in confusing ways."""
    if rel not in _ASSET_V:
        p = SITE / rel
        h = hashlib.sha1(p.read_bytes()).hexdigest()[:8] if p.exists() else "0"
        _ASSET_V[rel] = h
    return _ASSET_V[rel]


STYLESHEETS = ["css/tokens.css", "css/base.css", "css/components.css"]


def render(base, *, root, title, description, main, page_class,
           scripts, active="", extra_head="", og=""):
    style_tags = "\n".join(
        f'<link rel="stylesheet" href="{root}{s}?v={asset_v(s)}">' for s in STYLESHEETS
    )
    script_tags = "\n".join(
        f'<script src="{root}js/{s}?v={asset_v("js/" + s)}" defer></script>' for s in scripts
    )
    out = base
    repl = {
        "{{styles}}": style_tags,
        "{{root}}": root,
        "{{title}}": e(title),
        "{{description}}": e(description),
        "{{page_class}}": page_class,
        "{{extra_head}}": extra_head,
        "{{og}}": og,
        "{{header}}": nav_html(root, active),
        "{{footer}}": foot_html(root, CONFIG.get("updated", "")),
        "{{scripts}}": script_tags,
        "{{main}}": main,
    }
    for k, v in repl.items():
        out = out.replace(k, v)
    return out


# ---------- entry pages ----------

def stat_tiles(x, is_hand):
    def t(label, val):
        return (label, val if val not in (None, "") else "—")
    if not is_hand:
        rows = [
            t("Height", f'{x["height_cm"]} cm' if x.get("height_cm") is not None else None),
            t("Mass", f'{x["mass_kg"]} kg' if x.get("mass_kg") is not None else None),
            t("Total DOF", x.get("dof_total")),
            t("Actuation", title_case(x["actuation"]) if x.get("actuation") else None),
            t("Power", title_case(x["power"]) if x.get("power") else None),
            t("Runtime", f'{x["runtime_h"]} h' if x.get("runtime_h") is not None else None),
            t("Payload", f'{x["payload_kg"]} kg' if x.get("payload_kg") is not None else None),
            t("Price", f'${x["price_usd"]:,}' if x.get("price_usd") is not None else None),
        ]
    else:
        rows = [
            t("Total DOF", x.get("dof_total")),
            t("Actuated DOF", x.get("actuated_dof")),
            t("Fingers", x.get("fingers")),
            t("Actuation", title_case(x["actuation"]) if x.get("actuation") else None),
            t("Weight", f'{x["weight_g"]} g' if x.get("weight_g") is not None else None),
            t("Grip force", f'{x["grip_force_n"]} N' if x.get("grip_force_n") is not None else None),
            t("Tactile", title_case(x["tactile"]) if x.get("tactile") else None),
        ]
    return "".join(
        f'<div class="tile"><div class="tl">{e(k)}</div><div class="tv">{e(v)}</div></div>'
        for k, v in rows
    )


def link_group_html(x):
    by_type = {}
    for lk in x.get("links", []) or []:
        by_type.setdefault(lk["type"], []).append(lk)
    out = []
    for gl, types in LINK_GROUPS:
        items = [lk for tp in types for lk in by_type.get(tp, [])]
        if not items:
            continue
        btns = "".join(
            f'<a href="{e(lk["url"])}" target="_blank" rel="noopener">'
            f'<span class="lt">{e(lk["type"])}</span>{e(lk["title"])}</a>'
            for lk in items
        )
        out.append(f'<div class="lg"><h4>{e(gl)}</h4><div class="linkrow">{btns}</div></div>')
    return "".join(out)


def entry_page(base, entry_tpl, x, is_hand, siblings, images, credits):
    root = "../../"
    eid = x["id"]
    kind = "hand" if is_hand else "robot"
    era = None if is_hand else next((z for z in ERAS if z["id"] == x["era"]), None)
    era_color_var = f'--era-{x["era"]}' if not is_hand else "--accent"

    img_html = ""
    og = ""
    if eid in images:
        src = f'{root}img/{images[eid]}'
        cr = credits.get(eid, {})
        cap = ""
        if cr:
            who = e(cr.get("author") or "Unknown")
            lic = e(cr.get("license") or "")
            lu = cr.get("license_url") or cr.get("source_url") or "#"
            cap = f'<figcaption>Photo: {who} · <a href="{e(lu)}" target="_blank" rel="noopener">{lic}</a></figcaption>'
        img_html = f'<figure class="entry-photo"><img src="{e(src)}" alt="{e(x["name"])}" loading="lazy">{cap}</figure>'
        ogimg = (CONFIG.get("base_url", "").rstrip("/") + f"/img/{images[eid]}") if CONFIG.get("base_url") else src
        og = f'<meta property="og:image" content="{e(ogimg)}">'

    prev_next = ""
    if siblings:
        idx = [s["id"] for s in siblings].index(eid)
        parts = []
        if idx > 0:
            parts.append(f'<a class="pn prev" href="{root}{kind}/{e(siblings[idx-1]["id"])}/">← {e(siblings[idx-1]["name"])}</a>')
        else:
            parts.append("<span></span>")
        if idx < len(siblings) - 1:
            parts.append(f'<a class="pn next" href="{root}{kind}/{e(siblings[idx+1]["id"])}/">{e(siblings[idx+1]["name"])} →</a>')
        prev_next = f'<nav class="prevnext">{"".join(parts)}</nav>'

    notable = ""
    if x.get("notable"):
        lis = "".join(f"<li>{e(n)}</li>" for n in x["notable"])
        notable = f'<h4>Notable</h4><ul class="notable">{lis}</ul>'

    sources = ""
    if x.get("sources"):
        ss = " · ".join(
            f'<a href="{e(s["url"])}" target="_blank" rel="noopener">{e(s["title"])}</a>'
            for s in x["sources"]
        )
        sources = f'<h4>Sources</h4><p class="srcs">{ss}</p>'

    sub_bits = [e(x["maker"]), e(x["country"]), str(x["year_revealed"]) + (f'–{x["year_status_end"]}' if x.get("year_status_end") else "")]
    subtitle = " · ".join(b for b in sub_bits if b)

    kicker = (e(era["name"]) if era else "Robotic hand")
    used_on = ""
    if is_hand and x.get("used_on"):
        chips = " ".join(
            f'<a href="{root}robot/{e(u)}/">{e(ROBOT_NAME.get(u, u))}</a>' for u in x["used_on"]
        )
        used_on = f'<h4>Used on</h4><p class="srcs">{chips}</p>'

    dof_detail = ""
    if not is_hand and x.get("dof_breakdown"):
        db = x["dof_breakdown"]
        dof_detail = f'<p class="dofdetail"><span>DOF breakdown</span> {e(db if isinstance(db, str) else json.dumps(db))}</p>'

    body = (entry_tpl
            .replace("{{era_color_var}}", era_color_var)
            .replace("{{photo_class}}", "has-photo" if img_html else "no-photo")
            .replace("{{kicker}}", kicker)
            .replace("{{name}}", e(x["name"]))
            .replace("{{subtitle}}", subtitle)
            .replace("{{status}}", e(title_case(x["status"])))
            .replace("{{status_raw}}", e(x["status"]))
            .replace("{{openness}}", e(title_case(x["openness"])))
            .replace("{{photo}}", img_html)
            .replace("{{tiles}}", stat_tiles(x, is_hand))
            .replace("{{summary}}", e(x["summary"]))
            .replace("{{dof_detail}}", dof_detail)
            .replace("{{notable}}", notable)
            .replace("{{links}}", link_group_html(x))
            .replace("{{used_on}}", used_on)
            .replace("{{sources}}", sources)
            .replace("{{prevnext}}", prev_next)
            .replace("{{explore_link}}", f'{root}explore/#/{kind}/{e(eid)}')
            .replace("{{back_link}}", f'{root}explore/')
            .replace("{{root}}", root))

    canonical = ""
    if CONFIG.get("base_url"):
        canonical = f'<link rel="canonical" href="{e(CONFIG["base_url"].rstrip("/"))}/{kind}/{e(eid)}/">'

    return render(
        base, root=root,
        title=f'{x["name"]} — Humanoid Robot Index',
        description=x["summary"][:200],
        main=body, page_class="entry-page", scripts=["util.js"],
        extra_head=canonical,
        og=(f'<meta property="og:title" content="{e(x["name"])}">'
            f'<meta property="og:description" content="{e(x["summary"][:200])}">'
            f'<meta property="og:type" content="article">{og}'
            '<meta name="twitter:card" content="summary_large_image">'),
    )


# ---------- home page pieces (server-rendered so the page needs no JS) ----------

FEATURED_PREF = ["wabot-1", "honda-asimo", "boston-dynamics-atlas-drc",
                 "unitree-g1", "tesla-optimus", "figure-02", "iit-icub"]


def home_spectrum(data):
    by_era = {}
    for r in data["robots"]:
        by_era[r["era"]] = by_era.get(r["era"], 0) + 1
    out = []
    for eid in ERA_ORDER:
        era = next(z for z in data["eras"] if z["id"] == eid)
        rng = f'{era["start"] if era["start"] is not None else "–"}–{era["end"] if era["end"] is not None else "now"}'
        line = era["summary"].split(". ")[0] + "."
        out.append(
            f'<a href="explore/#/timeline" style="--era-c:var(--era-{eid})">'
            f'<span class="sp-n">{by_era.get(eid, 0)}</span>'
            f'<span class="sp-rng">{e(rng)}</span>'
            f'<span class="sp-name">{e(era["name"])}</span>'
            f'<span class="sp-line">{e(line)}</span></a>'
        )
    return "".join(out)


def home_featured(data, images):
    by_id = {r["id"]: r for r in data["robots"]}
    with_img = [i for i in FEATURED_PREF if i in images and i in by_id]
    pick = (with_img + [i for i in FEATURED_PREF if i in by_id])[:3]
    seen, cards = set(), []
    for rid in pick:
        if rid in seen:
            continue
        seen.add(rid)
        r = by_id[rid]
        img = (f'<div class="fimg"><img src="img/{images[rid]}" alt="{e(r["name"])}" loading="lazy"></div>'
               if rid in images else "")
        cards.append(
            f'<a class="feat" href="robot/{e(rid)}/">{img}<div class="fbody">'
            f'<div class="fname">{e(r["name"])}</div>'
            f'<div class="fmeta">{e(r["maker"])} · {r["year_revealed"]}</div>'
            f'<div class="fdesc">{e(r["summary"].split(". ")[0])}.</div></div></a>'
        )
    return "".join(cards)


def home_devteaser(data):
    devs = sorted(data["news"].get("developments", []), key=lambda x: str(x.get("date", "")), reverse=True)[:3]
    out = []
    for d in devs:
        out.append(
            f'<a href="explore/#/news"><span class="dt-date">{e(d["date"])}</span>'
            f'<span><span class="dt-title">{e(d["title"])}</span>'
            f'<span class="dt-sum">{e(d["summary"][:140])}…</span></span></a>'
        )
    return "".join(out)


# ---------- main ----------

CONFIG = {}
ERAS = []
ROBOT_NAME = {}


def _strip(rows):
    return [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]


def main():
    global CONFIG, ERAS, ROBOT_NAME
    res = validate_all()
    if not res["ok"]:
        print(f"✗ site build aborted — {len(res['errors'])} data validation error(s). Run validate.py.", file=sys.stderr)
        sys.exit(1)

    raw = res["data"]
    yk = lambda z: (z.get("year_revealed") or 0, str(z.get("name", "")))
    data = {
        "robots": sorted(_strip(raw["robots"]), key=yk),
        "hands": sorted(_strip(raw["hands"]), key=yk),
        "eras": raw["eras"],
        "milestones": sorted(raw["milestones"], key=lambda m: str(m.get("date", ""))),
        "news": raw["news"],
    }
    data["news"]["developments"] = sorted(
        data["news"].get("developments", []), key=lambda x: str(x.get("date", "")), reverse=True
    )
    ERAS = data["eras"]
    ROBOT_NAME = {r["id"]: r["name"] for r in data["robots"]}
    CONFIG = load_config()
    CONFIG.setdefault("updated", data["news"].get("updated", ""))
    images = image_index()
    credits = load_credits()

    base = (TPL / "_base.html").read_text()
    home_tpl = (TPL / "home.html").read_text()
    explore_tpl = (TPL / "explore.html").read_text()
    entry_tpl = (TPL / "entry.html").read_text()
    credits_tpl = (TPL / "credits.html").read_text()

    # wipe & recreate dist (keep nothing stale)
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    # data + static assets
    (DIST / "data").mkdir()
    for key in ("robots", "hands", "eras", "milestones", "news"):
        (DIST / "data" / f"{key}.json").write_text(json.dumps(data[key], ensure_ascii=False))
    (DIST / "data" / "images.json").write_text(json.dumps(images, ensure_ascii=False))
    for sub in ("css", "js", "img"):
        s = SITE / sub
        if s.is_dir():
            shutil.copytree(s, DIST / sub)

    n_pages = 0

    # home
    counts = {"robots": len(data["robots"]), "hands": len(data["hands"]), "eras": len(ERAS)}
    home_main = (home_tpl
                 .replace("{{root}}", "")
                 .replace("{{n_robots}}", str(counts["robots"]))
                 .replace("{{n_hands}}", str(counts["hands"]))
                 .replace("{{spectrum}}", home_spectrum(data))
                 .replace("{{featured}}", home_featured(data, images))
                 .replace("{{devteaser}}", home_devteaser(data)))
    (DIST / "index.html").write_text(render(
        base, root="", title="Humanoid Robot Index",
        description="Every humanoid robot from a 1495 sketch to the 2020s gold rush — "
                    f"{counts['robots']} machines and {counts['hands']} hands, with specs, "
                    "provenance and a visual history.",
        main=home_main, page_class="home", scripts=["util.js", "charts.js", "home.js"],
        active="Home",
        og='<meta property="og:title" content="Humanoid Robot Index">'
           '<meta property="og:type" content="website">',
    ))
    n_pages += 1

    # explore
    (DIST / "explore").mkdir()
    (DIST / "explore" / "index.html").write_text(render(
        base, root="../", title="Explore — Humanoid Robot Index",
        description="Filter and sort the full humanoid-robot catalog; era timeline, milestones, "
                    "recent developments and trend charts.",
        main=explore_tpl.replace("{{root}}", "../"),
        page_class="explore", scripts=["util.js", "charts.js", "explore.js"], active="Catalog",
    ))
    n_pages += 1

    # per-entry pages
    robots_by_era = {}
    for r in data["robots"]:
        robots_by_era.setdefault(r["era"], []).append(r)
    for k in robots_by_era:
        robots_by_era[k].sort(key=lambda z: (z["year_revealed"], z["name"]))

    for r in data["robots"]:
        d = DIST / "robot" / r["id"]
        d.mkdir(parents=True)
        (d / "index.html").write_text(
            entry_page(base, entry_tpl, r, False, robots_by_era.get(r["era"], []), images, credits)
        )
        n_pages += 1

    hands_sorted = sorted(data["hands"], key=lambda z: (z["year_revealed"], z["name"]))
    for hnd in data["hands"]:
        d = DIST / "hand" / hnd["id"]
        d.mkdir(parents=True)
        (d / "index.html").write_text(
            entry_page(base, entry_tpl, hnd, True, hands_sorted, images, credits)
        )
        n_pages += 1

    # credits
    rows = []
    cr_list = json.loads((SITE / "credits.json").read_text()) if (SITE / "credits.json").exists() else []
    for c in sorted(cr_list, key=lambda z: ROBOT_NAME.get(z["id"], z["id"])):
        nm = ROBOT_NAME.get(c["id"], c["id"])
        rows.append(
            f'<tr><td><a href="../robot/{e(c["id"])}/">{e(nm)}</a></td>'
            f'<td>{e(c.get("author") or "—")}</td>'
            f'<td>{e(c.get("license") or "—")}</td>'
            f'<td><a href="{e(c.get("source_url") or "#")}" target="_blank" rel="noopener">source</a></td></tr>'
        )
    (DIST / "credits").mkdir()
    (DIST / "credits" / "index.html").write_text(render(
        base, root="../", title="Image credits — Humanoid Robot Index",
        description="Attribution for every robot image on the site.",
        main=credits_tpl.replace("{{rows}}", "".join(rows)).replace("{{count}}", str(len(rows))).replace("{{root}}", "../"),
        page_class="credits", scripts=["util.js"], active="",
    ))
    n_pages += 1

    # 404
    (DIST / "404.html").write_text(render(
        base, root="", title="Not found — Humanoid Robot Index",
        description="Page not found.",
        main='<section class="wrap notfound"><h1>404</h1><p>That page isn’t here. '
             '<a href="./">Go to the index</a> or <a href="explore/">open the explorer</a>.</p></section>',
        page_class="notfound", scripts=["util.js"], active="",
    ))
    n_pages += 1

    total_kb = sum(f.stat().st_size for f in DIST.rglob("*") if f.is_file()) / 1024
    print(f"✓ built dist/ — {n_pages} pages "
          f"({len(data['robots'])} robots + {len(data['hands'])} hands + home/explore/credits/404), "
          f"{len(images)} images, {total_kb:.0f} KB total")


if __name__ == "__main__":
    main()
