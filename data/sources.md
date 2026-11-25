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
| [korthosrobotics.com/ecosystem](https://korthosrobotics.com/ecosystem/products?category=humanoid) | modern products, structured specs | grouped spec model + per-product event timeline; 121 humanoids as of Sept 2026. Basis for our schema shape, and swept for omissions (see below). Pagination is client-side — `&page=N` returns page 1, so the Next control has to be clicked. |
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

## Korthos sweep (Sept 2026)

All 121 humanoids listed on `korthosrobotics.com/ecosystem/products?category=humanoid` were read
across its three pages and diffed against the catalog. **54 entries were added or rewritten** from
that diff. Every URL in the added entries was checked to resolve; vendor-primary pages are used
wherever one exists.

Deliberately **not** added, with the reason:

| Korthos entry | Why not |
|---|---|
| Certis MAX | not a distinct robot — an AgiBot unit under evaluation by Certis (Singapore) under an MoU. Recorded as a deployment, not a model. |
| Fourier GR Mini | no vendor page and no press coverage found; Fourier's published GRx line runs GR-1 / GR-2 / GR-3. Not invented. |
| UWORLD U1 | UWORLD is UBTECH's consumer brand, whose launch product is Walker C1 — captured there. |
| Kepler K2 | already present as `kepler-forerunner` ("Forerunner K2"). |
| Domo Plus | configuration of Rotaku Domo, captured in that entry's `price_note`. |
| Ti5 T170D, EngineAI variants, Noetix E1 / W1, Lumos LUS 2, MagicBot variants, Digit China trio (Xialan S02, Xingxingxia P01, Xiaqi X02), Highlanders HL Human, Asimov v1, VinDynamics Dyno, APLUX Ultra Magnus, Zerith Z1, Cyborg-R01, DroidUp Moya, AeiROBOT ALICE 4, Haribit, TLIBOT, Borg 01, ORBIT HELIOS, JAKA π | either a close sibling of an entry already present, or no source outside resale listings and directory scrapes. Left out rather than filled with unverifiable numbers — see the standing rule at the top of this file. |

## November 2026 refresh

Covers 7 September – 21 November 2026, plus older gaps. Sources swept:

- **Humanoids Daily** — every article in its sitemap modified since 5 September 2026 (~375 slugs), read in full
  where it announced hardware.
- **humanoid.guide** — all ~355 product pages with a spec table, parsed and diffed against the catalog by maker +
  model. Their spec tables are uneven: Galbot ET1 is listed at 173 cm / 65 kg / 48 DoF, while Galbot's own page
  gives 125 cm / 32 kg / 26 DoF, and many values are `~` estimates. So numbers were taken from vendor pages or
  press first, and from humanoid.guide only when a value was exact and not contradicted.
- **The Robot Report**, **Korthos** — not reachable this pass (403 / 404 from the fetcher). Robot Report items came
  in through search results and other outlets' citations instead.

**+38 robots** (183 → 221) and **+10 hands** (15 → 25).

- New this period: Galbot ET1, ASUS Gallop, Genki Robotics' prototype, Feather, Flourish 1, Astribot T1, O-ID,
  Vesoma 1, RoboParty RP1, Minerva Roger, KAIST Humanoid, Foundation Phantom MKII, NeodraDynamics Neo1, Meta Max,
  PrimeBOT Q1, Embodied AI AIR, Pink Robotics P0, Sharpa D01, Agility Digit 5 (split from `agility-digit`,
  following the generation convention), Genesis AI Eno.
- Older gaps: Kawasaki Kaleido, IHMC Nadia, KIT ARMAR-7, PAL Kangaroo, PAL ARI, Enchanted Tools Mirokaï,
  Rainbow RB-Y1, AgiBot X1, AgiBot G2, LG CLOiD, KIST KAPEX, WIRobotics ALLEX, XPeng PX5, ROBOTIS AI Worker,
  Dexmate Vega, Cartwheel Yogi, Menlo Asimov 1.
- From the owner's shared leads: Somnia Lab Model L (android), and the AmazingHand, D'Manus, Yale OpenHand and
  Allonic Hand MK2 hands (ORCA from the same lead was already present).
- Hands: SharpaWave, Unitree Dex5-S, PHYBOT PhyHand, NJIT PHD-Hand, the Atlas four-finger hand, Robotera XHAND 1 Pro-U.
- Updated: Unitree G1 (G1+), electric Atlas (new hands, `hand_ref`), XPeng IRON (mass production → `limited-production`),
  NEURA 4NE1 (Gen 4), Digit (pointer to Digit 5); 11 `news.json` developments; insight counts refreshed.

**URL checks.** 63 of the 119 new URLs were fetched and resolve. The other 56 are on vendor and press hosts outside
this session's network allowlist, plus two GitHub repos the proxy refused. They were taken from search results or
from links in the articles that were read, but were **not** fetched here. Check them in the next verification pass.

Deliberately **not** added:

| Candidate | Why not |
|---|---|
| Lightberry Lumi, Dynamic Creatures Hugo | a Unitree G1 underneath (Hugo's is unconfirmed) — derivatives, not new robots |
| Faraday Future Master Mini / All-New Futurist | rebadged Booster K1 / AgiBot A3 per Humanoids Daily's comparison |
| Unitree G1+, AgiBot A3 Ultra, AgiBot G2 Max, Agile ONE SN | variants; recorded in the parent entry |
| Unitree "Superman" | speed-record prototype with a nickname only; covered as news, no spec sheet |
| MindOn Mind-1, Archon, Matic, Samsung RX, LG's 2027 GR00T humanoid, BYD design patent | software demos, teasers or no hardware shown |
| Sunday Memo, Lumos MOS 2, Nori, Tuesday Labs Voxel, NYU MABEL, CMU Pixel, Nucleus II | mobile manipulators their makers do not present as humanoids, or too little published |
| AiMOGA Mobo, Tuya Doova | companion devices, not humanoid bodies |
| ~150 further humanoid.guide listings (e.g. Tlibot, YMBot, RealMan, Glroad, StarBot) | directory-only sourcing; the standing rule above applies |

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
