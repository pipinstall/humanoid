"""Shared loader + validator. Enforces data/schema.md. Standard library only (Python 3.8+)."""

import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DIST = ROOT / "dist"

CURRENT_YEAR = date.today().year
YEAR_MIN = -3000
YEAR_MAX = CURRENT_YEAR + 2

ENUMS = {
    "maker_type": ["company", "academic", "government", "nonprofit", "individual"],
    "openness": ["proprietary", "open-source", "partially-open", "research-only"],
    "status": ["concept", "prototype", "research-platform", "limited-production", "commercial", "discontinued"],
    "era": ["automata", "foundational", "dynamic-bipedalism", "drc", "commercial-pivot", "explosion"],
    "form_factor": ["humanoid-biped", "mini-humanoid", "android-static", "biped-no-torso", "wheeled-humanoid"],
    "hands": ["none", "gripper", "dexterous"],
    "actuation": ["electric", "hydraulic", "pneumatic", "mixed"],
    "power": ["tethered", "battery"],
    "purpose": ["research", "manufacturing", "logistics", "domestic", "social", "defense", "space", "education", "general-purpose"],
    "link_type": ["official", "github", "docs", "datasheet", "wikipedia", "paper", "video", "article", "urdf", "mjcf"],
    "hand_actuation": ["tendon", "linkage", "direct-drive", "pneumatic", "soft"],
    "tactile": ["none", "basic", "fingertip", "full-coverage"],
    "milestone_category": ["first", "competition", "commercial", "research", "cultural"],
}

_ID_RE = re.compile(r"^[a-z0-9-]+$")
_DATE_RE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")


# ---------- loading ----------

def _read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise ValueError(f"{path}: invalid JSON - {err}")


def _read_dir(dirpath):
    if not dirpath.is_dir():
        return []
    return sorted(p for p in dirpath.iterdir() if p.suffix == ".json")


def load_all():
    eras = _read_json(DATA / "eras.json")
    milestones = _read_json(DATA / "milestones.json")
    robots = []
    for p in _read_dir(DATA / "robots"):
        entry = _read_json(p)
        entry["_file"] = p.name
        entry["_id"] = p.stem
        robots.append(entry)
    hands = []
    for p in _read_dir(DATA / "hands"):
        entry = _read_json(p)
        entry["_file"] = p.name
        entry["_id"] = p.stem
        hands.append(entry)
    return {"eras": eras, "milestones": milestones, "robots": robots, "hands": hands}


# ---------- helpers ----------

def _is_nonempty_str(v):
    return isinstance(v, str) and v.strip() != ""


def _is_pos_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0


def _is_year(v):
    return isinstance(v, int) and not isinstance(v, bool) and YEAR_MIN <= v <= YEAR_MAX


def _is_url(v):
    if not isinstance(v, str):
        return False
    try:
        parsed = urlparse(v)
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def _absent(v):
    return v is None


def _check_sources(val, ctx, errors):
    if not isinstance(val, list) or len(val) < 1:
        errors.append(f'{ctx}: "sources" must be a non-empty array')
        return
    for i, s in enumerate(val):
        if not isinstance(s, dict) or not _is_nonempty_str(s.get("title")) or not _is_url(s.get("url")):
            errors.append(f"{ctx}: sources[{i}] must be {{ title: string, url: http(s) url }}")


def _check_links(val, ctx, errors):
    if _absent(val):
        return
    if not isinstance(val, list):
        errors.append(f'{ctx}: "links" must be an array')
        return
    for i, l in enumerate(val):
        if not isinstance(l, dict):
            errors.append(f"{ctx}: links[{i}] must be an object")
            continue
        if l.get("type") not in ENUMS["link_type"]:
            errors.append(f'{ctx}: links[{i}].type {l.get("type")!r} not in {", ".join(ENUMS["link_type"])}')
        if not _is_nonempty_str(l.get("title")):
            errors.append(f"{ctx}: links[{i}].title must be a non-empty string")
        if not _is_url(l.get("url")):
            errors.append(f'{ctx}: links[{i}].url {l.get("url")!r} is not an http(s) url')


def _check_enum(obj, field, enum_key, ctx, errors, required):
    v = obj.get(field)
    if _absent(v):
        if required:
            errors.append(f'{ctx}: missing required "{field}"')
        return
    if v not in ENUMS[enum_key]:
        errors.append(f'{ctx}: "{field}" = {v!r} not in {", ".join(ENUMS[enum_key])}')


def _check_string(obj, field, ctx, errors, required):
    v = obj.get(field)
    if _absent(v):
        if required:
            errors.append(f'{ctx}: missing required "{field}"')
        return
    if not _is_nonempty_str(v):
        errors.append(f'{ctx}: "{field}" must be a non-empty string')


def _check_opt_pos_number(obj, field, ctx, errors):
    v = obj.get(field)
    if _absent(v):
        return
    if not _is_pos_number(v):
        errors.append(f'{ctx}: "{field}" must be a positive number or null')


def _check_str_array(obj, field, ctx, errors):
    v = obj.get(field)
    if _absent(v):
        return
    if not isinstance(v, list) or any(not _is_nonempty_str(x) for x in v):
        errors.append(f'{ctx}: "{field}" must be an array of non-empty strings or null')


# ---------- entity validators ----------

def _validate_era(era, ctx, errors):
    if era.get("id") not in ENUMS["era"]:
        errors.append(f'{ctx}: id {era.get("id")!r} not in {", ".join(ENUMS["era"])}')
    _check_string(era, "name", ctx, errors, True)
    _check_string(era, "summary", ctx, errors, True)
    for f in ("start", "end"):
        if not _absent(era.get(f)) and not _is_year(era.get(f)):
            errors.append(f'{ctx}: "{f}" must be an integer year or null')
    _check_str_array(era, "themes", ctx, errors)


def _validate_robot(r, era_ids, errors):
    ctx = f"robots/{r['_file']}"
    if r.get("id") != r["_id"]:
        errors.append(f'{ctx}: "id" ({r.get("id")!r}) must equal filename {r["_id"]!r}')
    if not _ID_RE.match(r["_id"]):
        errors.append(f"{ctx}: filename must be kebab-case [a-z0-9-]")

    _check_string(r, "name", ctx, errors, True)
    _check_string(r, "maker", ctx, errors, True)
    _check_string(r, "country", ctx, errors, True)
    _check_string(r, "summary", ctx, errors, True)
    _check_enum(r, "maker_type", "maker_type", ctx, errors, True)
    _check_enum(r, "openness", "openness", ctx, errors, True)
    _check_enum(r, "status", "status", ctx, errors, True)
    _check_enum(r, "form_factor", "form_factor", ctx, errors, True)

    _check_enum(r, "era", "era", ctx, errors, True)
    if r.get("era") in ENUMS["era"] and r.get("era") not in era_ids:
        errors.append(f'{ctx}: "era" {r.get("era")} has no entry in eras.json')

    if not _is_year(r.get("year_revealed")):
        errors.append(f'{ctx}: "year_revealed" must be an integer year in [{YEAR_MIN}, {YEAR_MAX}]')
    yse = r.get("year_status_end")
    if not _absent(yse):
        if not _is_year(yse):
            errors.append(f'{ctx}: "year_status_end" must be an integer year or null')
        elif _is_year(r.get("year_revealed")) and yse < r["year_revealed"]:
            errors.append(f'{ctx}: "year_status_end" ({yse}) is before "year_revealed" ({r["year_revealed"]})')

    for f in ("height_cm", "mass_kg", "dof_total", "runtime_h", "payload_kg"):
        _check_opt_pos_number(r, f, ctx, errors)

    db = r.get("dof_breakdown")
    if not _absent(db) and not _is_nonempty_str(db) and not isinstance(db, dict):
        errors.append(f'{ctx}: "dof_breakdown" must be a string, an object, or null')

    for field, enum_key in (("hands", "hands"), ("actuation", "actuation"), ("power", "power")):
        v = r.get(field)
        if not _absent(v) and v not in ENUMS[enum_key]:
            errors.append(f'{ctx}: "{field}" not in {", ".join(ENUMS[enum_key])}')

    purpose = r.get("purpose")
    if not _absent(purpose):
        if not isinstance(purpose, list) or any(p not in ENUMS["purpose"] for p in purpose):
            errors.append(f'{ctx}: "purpose" must be an array drawn from {", ".join(ENUMS["purpose"])}')

    _check_str_array(r, "notable", ctx, errors)
    for f in ("image_url", "video_url"):
        if not _absent(r.get(f)) and not _is_url(r.get(f)):
            errors.append(f'{ctx}: "{f}" is not an http(s) url')
    _check_links(r.get("links"), ctx, errors)
    _check_sources(r.get("sources"), ctx, errors)


def _validate_hand(h, robot_ids, errors):
    ctx = f"hands/{h['_file']}"
    if h.get("id") != h["_id"]:
        errors.append(f'{ctx}: "id" must equal filename {h["_id"]!r}')
    if not _ID_RE.match(h["_id"]):
        errors.append(f"{ctx}: filename must be kebab-case [a-z0-9-]")

    _check_string(h, "name", ctx, errors, True)
    _check_string(h, "maker", ctx, errors, True)
    _check_string(h, "country", ctx, errors, True)
    _check_string(h, "summary", ctx, errors, True)
    _check_enum(h, "maker_type", "maker_type", ctx, errors, True)
    _check_enum(h, "openness", "openness", ctx, errors, True)
    _check_enum(h, "status", "status", ctx, errors, True)
    if not _is_year(h.get("year_revealed")):
        errors.append(f'{ctx}: "year_revealed" must be an integer year')

    for f in ("dof_total", "actuated_dof", "fingers", "weight_g", "payload_kg", "grip_force_n"):
        _check_opt_pos_number(h, f, ctx, errors)

    if not _absent(h.get("actuation")) and h.get("actuation") not in ENUMS["hand_actuation"]:
        errors.append(f'{ctx}: "actuation" not in {", ".join(ENUMS["hand_actuation"])}')
    if not _absent(h.get("tactile")) and h.get("tactile") not in ENUMS["tactile"]:
        errors.append(f'{ctx}: "tactile" not in {", ".join(ENUMS["tactile"])}')

    used_on = h.get("used_on")
    if not _absent(used_on):
        if not isinstance(used_on, list):
            errors.append(f'{ctx}: "used_on" must be an array or null')
        else:
            for rid in used_on:
                if rid not in robot_ids:
                    errors.append(f'{ctx}: used_on "{rid}" has no entry in data/robots/')

    if not _absent(h.get("image_url")) and not _is_url(h.get("image_url")):
        errors.append(f'{ctx}: "image_url" is not an http(s) url')
    _check_links(h.get("links"), ctx, errors)
    _check_sources(h.get("sources"), ctx, errors)


def _validate_milestone(m, i, robot_ids, errors):
    ctx = f"milestones[{i}]"
    if not _is_nonempty_str(m.get("date")) or not _DATE_RE.match(m["date"]):
        errors.append(f'{ctx}: "date" must be "YYYY", "YYYY-MM", or "YYYY-MM-DD"')
    _check_string(m, "title", ctx, errors, True)
    _check_string(m, "description", ctx, errors, True)
    _check_string(m, "why_it_mattered", ctx, errors, True)
    if m.get("category") not in ENUMS["milestone_category"]:
        errors.append(f'{ctx}: "category" not in {", ".join(ENUMS["milestone_category"])}')
    rids = m.get("robot_ids")
    if not isinstance(rids, list):
        errors.append(f'{ctx}: "robot_ids" must be an array (may be empty)')
    else:
        for rid in rids:
            if rid not in robot_ids:
                errors.append(f'{ctx}: robot_ids "{rid}" has no entry in data/robots/')
    _check_sources(m.get("sources"), ctx, errors)


# ---------- entry point ----------

def validate_all():
    errors = []
    try:
        data = load_all()
    except (ValueError, OSError) as err:
        return {"ok": False, "errors": [str(err)], "data": None}

    eras = data["eras"]
    era_ids = set()
    if not isinstance(eras, list):
        errors.append("eras.json: must be an array")
    else:
        for i, e in enumerate(eras):
            _validate_era(e, f"eras[{i}]", errors)
            eid = e.get("id") if isinstance(e, dict) else None
            if eid:
                if eid in era_ids:
                    errors.append(f'eras.json: duplicate id "{eid}"')
                era_ids.add(eid)

    robot_ids = {r["_id"] for r in data["robots"]}
    hand_ids = {h["_id"] for h in data["hands"]}
    for r in data["robots"]:
        _validate_robot(r, era_ids, errors)
        hr = r.get("hand_ref")
        if not _absent(hr) and hr not in hand_ids:
            errors.append(f'robots/{r["_file"]}: hand_ref "{hr}" has no entry in data/hands/')
    for h in data["hands"]:
        _validate_hand(h, robot_ids, errors)

    milestones = data["milestones"]
    if not isinstance(milestones, list):
        errors.append("milestones.json: must be an array")
    else:
        for i, m in enumerate(milestones):
            _validate_milestone(m, i, robot_ids, errors)

    return {"ok": len(errors) == 0, "errors": errors, "data": data}
