# Sources & sourcing notes

## Approach

- Every entry carries **at least one** `sources` link. Per-field citations and confidence flags
  are a later pass.
- Prefer, in rough order: manufacturer spec pages and datasheets → peer-reviewed papers and
  official lab pages → Wikipedia (good for cross-checking dates and lineage) → reputable press.
- Record simulation-model links (`urdf` / `mjcf`) in `links`, not just `sources` — they are often
  the most precise public record of a robot's kinematics.

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
