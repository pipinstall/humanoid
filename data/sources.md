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

## To verify in a later pass

- DOF counts vary by source and configuration (base vs. dexterous-hand variants). Where a range
  is given (e.g. Unitree G1 "23–43"), the `dof_total` holds the base figure and `dof_breakdown`
  notes the range.
- Masses often quoted with vs. without battery. Schema convention: **with** battery.
- "Reveal year" vs. "first walk" vs. "commercial availability" are distinct; `year_revealed` is
  the first public demonstration.
