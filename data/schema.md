# Schema

This file is the human-readable source of truth. `scripts/lib.py` enforces it; if you change a
vocabulary here, change it there too.

General rules:

- One JSON file per entry. The filename (without `.json`) must equal the entry's `id`.
- `id` is lowercase kebab-case: `[a-z0-9-]+`. Prefer `maker-model` (`honda-asimo`,
  `unitree-g1`), or `maker-model-variant` when a robot has distinct generations
  (`boston-dynamics-atlas-drc` vs `boston-dynamics-atlas-electric`).
- Required fields must be present and non-empty. Optional fields should be **omitted or `null`**
  when unknown — never guessed. "Wide but shallow" is fine; invented numbers are not.
- `year_*` are integers. Negative = BCE. Range-checked to `[-3000, currentYear + 2]`.
- Every URL must be `http(s)` and parseable.

---

## Robot (`data/robots/*.json`)

### Required

| Field | Type | Notes |
|---|---|---|
| `id` | string | kebab-case, == filename |
| `name` | string | display name, e.g. `ASIMO` |
| `maker` | string | company or lab, e.g. `Honda`, `Waseda University` |
| `maker_type` | enum | `company` \| `academic` \| `government` \| `nonprofit` \| `individual` |
| `country` | string | primary country of origin |
| `openness` | enum | `proprietary` \| `open-source` \| `partially-open` \| `research-only` |
| `year_revealed` | int | first public reveal / demonstration |
| `status` | enum | `concept` \| `prototype` \| `research-platform` \| `limited-production` \| `commercial` \| `discontinued` |
| `era` | enum | id from `eras.json` (see list below) |
| `form_factor` | enum | `humanoid-biped` \| `mini-humanoid` \| `android-static` \| `biped-no-torso` \| `wheeled-humanoid` \| `torso` (legless fixed / bench-top upper body) |
| `summary` | string | 2–3 sentences: what it is and why it matters |
| `sources` | array | ≥1 `{ "title": string, "url": url }` |

### Optional

| Field | Type | Notes |
|---|---|---|
| `year_status_end` | int \| null | year it was retired / discontinued; `null` if active |
| `height_cm` | number \| null | standing height |
| `mass_kg` | number \| null | with battery where applicable |
| `dof_total` | number \| null | total degrees of freedom |
| `dof_breakdown` | string \| object \| null | e.g. `"legs 12, arms 14, hands 12, waist 1, neck 2"` or `{ "legs": 12, ... }` |
| `hands` | enum \| null | `none` \| `gripper` \| `dexterous` |
| `hand_ref` | string \| null | id of an entry in `data/hands/` |
| `actuation` | enum \| null | `electric` \| `hydraulic` \| `pneumatic` \| `mixed` |
| `power` | enum \| null | `tethered` \| `battery` |
| `runtime_h` | number \| null | battery runtime in hours |
| `payload_kg` | number \| null | rated payload / arm load |
| `price_usd` | number \| null | approximate base price in USD (lowest advertised config) |
| `price_note` | string \| null | context for the price — e.g. "EDU config", "RaaS only, ~$3/hr", "target at scale" |
| `purpose` | array \| null | any of `research`, `manufacturing`, `logistics`, `domestic`, `social`, `defense`, `space`, `education`, `general-purpose` |
| `notable` | array \| null | short achievement strings ("first predictive dynamic walking") — feeds milestones |
| `image_url` | url \| null | |
| `video_url` | url \| null | canonical demo video |
| `links` | array \| null | `{ "type": enum, "title": string, "url": url }`; type ∈ `official`, `github`, `docs`, `datasheet`, `wikipedia`, `paper`, `video`, `article`, `urdf`, `mjcf` |

Link priority: capture **every** reference that exists. Open-source robots should carry their
`github` + `docs` links; whenever a sim model exists, link the `urdf` (ROS `*_description`,
`robot_descriptions.py`) and/or `mjcf` (MuJoCo Menagerie, Isaac / Genesis assets).

---

## Hand (`data/hands/*.json`)

### Required

| Field | Type | Notes |
|---|---|---|
| `id` | string | kebab-case, == filename |
| `name` | string | |
| `maker` | string | |
| `maker_type` | enum | same vocab as robot |
| `country` | string | |
| `openness` | enum | same vocab as robot |
| `year_revealed` | int | |
| `status` | enum | same vocab as robot |
| `summary` | string | |
| `sources` | array | ≥1 `{ title, url }` |

### Optional

| Field | Type | Notes |
|---|---|---|
| `dof_total` | number \| null | total joints |
| `actuated_dof` | number \| null | independently driven joints |
| `fingers` | number \| null | |
| `actuation` | enum \| null | `tendon` \| `linkage` \| `direct-drive` \| `pneumatic` \| `soft` |
| `weight_g` | number \| null | |
| `payload_kg` | number \| null | |
| `grip_force_n` | number \| null | |
| `tactile` | enum \| null | `none` \| `basic` \| `fingertip` \| `full-coverage` |
| `used_on` | array \| null | ids of entries in `data/robots/` |
| `image_url` | url \| null | |
| `links` | array \| null | same shape / vocab as robot `links` |

---

## Era (`data/eras.json`) — array

| Field | Type | Notes |
|---|---|---|
| `id` | enum | `automata` \| `foundational` \| `dynamic-bipedalism` \| `drc` \| `commercial-pivot` \| `explosion` |
| `name` | string | |
| `start` | int \| null | first year (null = open-ended past) |
| `end` | int \| null | last year (null = ongoing) |
| `summary` | string | one paragraph |
| `themes` | array | short strings |

Era edges are thematic, not strict. Assign the era whose *story* the robot belongs to, not just
its calendar year: a 2011 robot central to the DRC belongs in `drc`; a 2016 academic
musculoskeletal robot belongs in `dynamic-bipedalism` (the research-lab locomotion tradition);
`explosion` is the 2022-onward general-purpose commercial wave.

---

## News (`data/news.json`) — object

Refreshed periodically (a scheduled agent re-researches `developments`). Shape:

| Field | Type | Notes |
|---|---|---|
| `updated` | string | `YYYY-MM-DD` — last refresh date |
| `insights` | array | evergreen, data-grounded takeaways: `{ title, body, cta? }` where `cta` is `{ label, view (`catalog`\|`timeline`\|`milestones`\|`analysis`\|`news`), dataset? (`robots`\|`hands`), filters? (object) }` |
| `developments` | array | dated recent items: `{ date (YYYY / YYYY-MM / YYYY-MM-DD), title, summary, sources[≥1 {title,url}] }` — every URL verified to resolve; primary sources preferred |
| `follow` | array | `{ name, url, note }` — a stable directory of where to follow the field |

---

## Milestone (`data/milestones.json`) — array

| Field | Type | Notes |
|---|---|---|
| `date` | string | `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` |
| `title` | string | |
| `category` | enum | `first` \| `competition` \| `commercial` \| `research` \| `cultural` |
| `description` | string | what happened |
| `why_it_mattered` | string | the significance |
| `robot_ids` | array | ids of entries in `data/robots/` (may be empty for non-robot-specific events) |
| `sources` | array | ≥1 `{ title, url }` |
