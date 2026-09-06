# Sources & sourcing notes

## Approach

- Every entry carries **at least one** `sources` link. Per-field citations and confidence flags
  are a later pass.
- Prefer, in rough order: manufacturer spec pages and datasheets → peer-reviewed papers and
  official lab pages → Wikipedia (good for cross-checking dates and lineage) → reputable press.
- Record simulation-model links (`urdf` / `mjcf`) in `links`, not just `sources` — they are often
  the most precise public record of a robot's kinematics.

## Aggregator lists used to drive coverage

| Source | Strength | Notes |
|---|---|---|
| [korthos.xyz/ecosystem](https://korthos.xyz/ecosystem/products?category=humanoid) | modern products, structured specs | grouped spec model + per-product event timeline; ~50+ current humanoids. Basis for our schema shape. |
| [humanoid.guide](https://humanoid.guide/) | 211 humanoids, filterable (obsolete / wheeled / bipedal), market reports | good for the current cohort and for site-design inspiration; also funding + market-size data. |
| [jk4e/list-ai-humanoid-robots](https://github.com/jk4e/list-ai-humanoid-robots) | company → model tree with country / founded / official + YouTube + Wikipedia + Crunchbase | best structured company metadata for the 2022+ wave. |
| [Wikipedia: Category:Humanoid robots](https://en.wikipedia.org/wiki/Category:Humanoid_robots) + [Bipedal humanoid robots](https://en.wikipedia.org/wiki/Category:Bipedal_humanoid_robots) | historical depth | the reliable path back before ~2015: Gakutensoku (1928), Eric (1928), Honda E/P series, WABIAN, HRP, HUBO, Surena, Robonaut, etc. |
| [humanoidrobotlist.com](https://www.humanoidrobotlist.com/) | small curated directory | noisy (includes non-humanoids); use only as a pointer. |
| [humanoidroboticstechnology.com](https://humanoidroboticstechnology.com/) | supply chain: actuators, hands, force sensors, drives | best for the `data/hands/` catalog and component context; also "Top N" roundup articles. |
| [keyirobot buying guide](https://keyirobot.com/blogs/buying-guide/the-complete-list-every-humanoid-robot-for-sale-on-the-market-today) | pricing, lead times, RaaS, ISO 13482 | source for `price_usd` / `price_note` and commercial `status`. |

## Recurring references

| Ref | Use |
|---|---|
| Waseda Humanoid Robotics Institute history | WABOT / WABIAN lineage, foundational era dates |
| Honda global robotics site | E-series, P-series, ASIMO specs and timeline |
| IEEE Spectrum Automaton | ongoing coverage of modern humanoids |
| MuJoCo Menagerie (github.com/google-deepmind/mujoco_menagerie) | MJCF models for Unitree G1/H1, and others |
| robot_descriptions.py (github.com/robot-descriptions/robot_descriptions.py) | index of URDF/MJCF packages by robot |
| ROS-Industrial / manufacturer `*_description` packages | URDF models |
| Humanoids / ICRA / IROS proceedings | research-platform specs (iCub, HRP, TALOS, Valkyrie) |
| Wikipedia (per-robot articles) | dates, lineage, discontinuation years |

## Secondary sources used in the wide pass

For 2023–2026 entries where no manufacturer datasheet or Wikipedia article exists yet, entries
cite reputable trade press and databases: **The Robot Report**, **IEEE Spectrum**, **Humanoids
Daily**, **Interesting Engineering**, **humanoid.guide** product pages, arXiv papers, and company
sites / press releases. These are marked implicitly by the source domain and should be upgraded to
primary specs in the verification pass.

## Verification pass (done)

Every cited URL was checked to resolve, and vendor-primary links are used wherever one exists.
Fixes made:

- Removed two fabricated Wikipedia articles (`/wiki/Apptronik`, `/wiki/Clone_Robotics` — neither
  exists) and repointed to vendor pages + trade press.
- Corrected dead / wrong vendor URLs: Foundation Robotics (`foundation.bot`, not
  `foundationrobotics.ai`), K-Scale (`www.kscale.dev`), Apptronik Apollo
  (`/apollo/apollo-2`), TU Munich LOLA, Hexagon AEON press release, iCub docs (GitHub repo),
  BarrettHand (`barrett.com`), ROBOTIS DARwIn-OP (`ROBOTIS-OP-Series-Data`).
- Spec corrections against vendor pages: LOLA (176 cm / 68 kg / 26 DOF), REEM-C (68 DOF),
  WABIAN-2 (153 cm / 64.5 kg), THOR (150 cm / 54 kg / 31 DOF), Valkyrie (129 kg), Ameca
  (62 kg / 61 DOF), electric Atlas (190 cm / 90 kg / 56 DOF / 30 kg payload), Digit (4 h),
  Unitree G1 (~US$13.5k), Noetix N2 (~US$5.5k), Reachy 2, Sophia (167 cm).

## Remaining data-quality gaps

- 30 entries still have no `height_cm` / `mass_kg` / `dof_total`. Most are un-specifiable by
  nature: pre-war automata, expressive-head androids, legless research torsos, legs-only series
  (Honda E), or concept-stage robots with nothing official published. Left blank rather than
  guessed.
- A few real vendor URLs could not be machine-fetched (Russian sites `npo-at.com`,
  `promo-bot.ai`; some JS-only SPAs like `gotokepler.com`, `fftai.com`) — they come from search
  results and resolve in a browser, but were not spec-scraped.
- Two entries share the display name "R1" (`iit-r1`, `unitree-r1`) — distinct robots, disambiguate
  in any UI by maker.

## To verify in a later pass

- DOF counts vary by source and configuration (base vs. dexterous-hand variants). Where a range
  is given (e.g. Unitree G1 "23–43"), the `dof_total` holds the base figure and `dof_breakdown`
  notes the range.
- Masses often quoted with vs. without battery. Schema convention: **with** battery.
- "Reveal year" vs. "first walk" vs. "commercial availability" are distinct; `year_revealed` is
  the first public demonstration.
