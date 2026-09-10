# A short history of humanoid robots

This is the narrative companion to the catalog in [`../data/robots/`](../data/robots). It traces
how the field moved from mechanical figures that only imitated the human form to machines that
balance, walk, manipulate and — increasingly — decide for themselves. Robot names in **bold**
have an entry in the catalog (the `id` is given in parentheses on first mention). Dated turning
points are in [`../data/milestones.json`](../data/milestones.json).

---

## 1. Automata & pre-history (to 1949)

For most of its history the "humanoid robot" was a figure, not a system. Around 1495 Leonardo
sketched a cable-and-pulley knight (**Leonardo's Mechanical Knight**, `leonardo-mechanical-knight`)
that could sit, move its arms and open its jaw — an engineering design for an artificial human
centuries before the means to build a useful one existed. The eighteenth-century automata of
Vaucanson and the Jaquet-Droz family refined clockwork limbs and cam "programming" to an
extraordinary degree, but they were sealed performances: no sensing, no adaptation.

Electricity changed the presentation but not the substance. Japan's first robot, **Gakutensoku**
(`gakutensoku`, 1928), used air pressure to change its facial expression for enthronement
celebrations. Britain's **Eric** (`eric-robot`, 1928) toured giving radio-relayed "speeches" in a
suit of aluminum armor. Westinghouse's **Elektro** (`elektro`, 1939) walked on rollered feet
and recited 700 words from records before World's Fair crowds. All three were showpieces operated
by a hidden human — the popular image of "a robot" was set decades before the technology behind
one existed.

## 2. Foundational research (1950–1985)

Postwar robotics went to work in factories as arms, not humanoids. The humanoid became a serious
academic problem in Japan, where Ichiro Kato's group at Waseda University worked systematically up
from legs to a whole body. The hydraulically actuated **WL-5** (`waseda-wl-5`, 1972) completed a
slow but genuine three-dimensional static walking cycle; a year later those legs were combined
with arms, camera vision and a Japanese speech system to make **WABOT-1** (`wabot-1`, 1973), the
first full-scale anthropomorphic robot to integrate locomotion, manipulation, vision and
conversation in one machine. **WABOT-2** (`waseda-wabot-2`, 1984) narrowed the target to a hard,
dexterous task: sight-reading a musical score and playing an organ with ten fingers and two feet.
Motion in this era was quasi-static — shift weight carefully, pause, repeat — but it produced the
first workable theories of bipedal balance.

## 3. Dynamic bipedalism (1986–2011)

Two threads ran in parallel, and the field usually remembers only one of them.

The first began in a laboratory with no humanoid in it at all. Marc Raibert's **Leg Laboratory** —
at Carnegie Mellon from 1980, at MIT from 1987 — started with a machine that hopped on one leg,
and took from it a heretical idea: a robot does not need to be stable at every instant, it needs
to be *actively balanced*. Control hopping height, forward speed and body posture, and gait takes
care of itself. In 1985 the **Planar Biped** (`mit-planar-biped`) became the first robot to run on
two legs, by treating a biped as a hopper with one active leg at a time. It was doing flips and
aerials by 1986, hit 13.1 mph and climbed a stairway by 1989. The unconstrained **3D Biped**
(`mit-3d-biped`) followed, turning a tucked somersault in 1992. Then the lab swapped hydraulics
for force control: **Spring Turkey** (`mit-spring-turkey`, 1994) was built around a spring placed
deliberately in series with every motor — the **Series Elastic Actuator**, Gill Pratt and Matthew
Williamson's invention, which is why almost every humanoid today can absorb a shove instead of
snapping. **Spring Flamingo** (`mit-spring-flamingo`, 1996) added feet and ankles and walked 15
miles across 200 demonstrations on 15 watts; **M2** (`mit-m2`, 1998) took it into 3D. Raibert left
in 1992 to found Boston Dynamics; Rob Playter, who taught the 3D Biped to somersault, runs it
today. Nearly every backflip you have seen a robot do traces back to this room.

The second thread was Honda's, pursued in secret and aimed squarely at a humanoid. The legs-only
**Honda E0–E6** series (`honda-e-series`, 1986–1993) went from 20-second static steps to dynamic
stair climbing; **Honda P2** (`honda-p2`, 1996) put a computer, battery and radio in a backpack to
become the first fully self-contained bipedal humanoid; **P3** (`honda-p3`, 1998) shrank it; and
**ASIMO** (`honda-asimo`, 2000) shrank it again into the robot that, for a decade, simply *was*
"the humanoid robot" to the public.

Then everyone else. Sony's **QRIO** (`sony-qrio`, 2003) became the first *self-contained* humanoid
to run — eighteen years after the Planar Biped, but with a torso, arms and everything onboard.
Japan's national project produced the **HRP** line (**HRP-2**, `aist-hrp-2`,
which could fall and get back up; **HRP-4C**, `aist-hrp-4c`, a life-sized android that walked
catwalks). Korea's **HUBO** (`kaist-hubo`, 2004) and Waseda's human-gait-focused **WABIAN-2**
(`waseda-wabian-2`) pushed walking further. In parallel, a research-platform tradition took hold:
the open child-sized **iCub** (`iit-icub`, 2009) and the small, cheap **NAO** (`aldebaran-nao`,
2008) and open **DARwIn-OP** (`robotis-darwin-op`, 2010) put the same hardware into hundreds of
labs and classrooms. Below them sat a scene the labs largely ignored: Kondo Kagaku's **KHR-1**
(`kondo-khr-1`, 2004) made a programmable walking humanoid a ¥128,000 hobby purchase and became
the standard chassis of Japan's ROBO-ONE fighting league — the platform on which Masahiko
Yamaguchi, "Dr. GUERO", built a modified Kondo that rides a fixed-gear bicycle by steering to
keep its own balance. Meanwhile **CHARLI** (`romela-charli`, 2010) became the first full-size
autonomous walking humanoid built in the US, and Germany's **LOLA** (`tum-lola`, 2010) and DLR's
torque-controlled **TORO** (`dlr-toro`) pushed fast and compliant walking. A separate branch
chased appearance over locomotion: Hiroshi Ishiguro's tele-operated **Geminoid** androids
(`ishiguro-geminoid`, 2006), the commercial **Actroid** (`kokoro-actroid`, 2003), and Engineered
Arts' museum-circuit **RoboThespian** (`engineered-arts-robothespian`, 2005). A third,
long-running branch pursued biology directly — the University of Tokyo's tendon-and-bone
musculoskeletal robots **Kenshiro** (`utokyo-kenshiro`, 2012) and **Kengoro** (`utokyo-kengoro`,
2016), which sweats to cool itself. NASA's **Robonaut 2** (`nasa-robonaut-2`) reached the ISS in
2011 — the first humanoid in space.

## 4. The DARPA Robotics Challenge era (2012–2015)

After the Fukushima meltdown, DARPA funded a competition for humanoids that could drive, clear
rubble, open doors and use power tools in a wrecked building. Boston Dynamics' hydraulic **Atlas**
(`boston-dynamics-atlas-drc`, 2013), descended from the suit-testing **PETMAN**
(`boston-dynamics-petman`, 2011), was the shared platform for seven teams; NASA's all-electric
**Valkyrie** (`nasa-valkyrie`, 2013) and Europe's **WALK-MAN** (`iit-walk-man`, 2015) ran their
own hardware. **SCHAFT** (`schaft-s-one`) won the 2013 trials with high-power electric actuation,
then vanished into Google. **DRC-HUBO+** (`kaist-drc-hubo-plus`) won the 2015 finals by rolling on
knee wheels between tasks. A quieter answer to the same problem came from Sangbae Kim's MIT lab:
**HERMES** (`mit-hermes`, 2015) gave up on autonomy entirely and fed the robot's balance back into
a human operator's body, borrowing the reflexes evolution already tuned — a trick later carried
into dynamic running by the third-scale **Little HERMES** (`mit-little-hermes`, 2019). The finals were the most rigorous public test of whole-body humanoid
capability yet — and, with robots toppling on live television, an honest measure of how far
real-world reliability still had to go.

## 5. The commercial pivot (2016–2021)

The question shifted from "can it walk?" to "what is it *for*?". Agility Robotics turned the
torso-less research legs **Cassie** (`agility-cassie`, 2017) into **Digit** (`agility-digit`,
2019), a bipedal robot pointed at warehouse work. SoftBank shipped tens of thousands of the
wheeled social robot **Pepper** (`softbank-pepper`, 2014); Diligent's **Moxi** (`diligent-moxi`)
started fetching supplies in hospitals; Engineered Arts moved from RoboThespian to the expressive
**Ameca** (`engineered-arts-ameca`, 2021); Hanson's **Sophia** (`hanson-sophia`, 2016) became the
lightning rod for the era's hype. Research hardware matured too — PAL's **TALOS** (`pal-talos`,
2017), Toyota's force-feedback **T-HR3** (`toyota-t-hr3`, 2017), the open **Poppy**
(`poppy-project`) and **Reachy** (`pollen-reachy`). Then, at its 2021 AI Day, Tesla announced
**Optimus** and said it would build a general-purpose humanoid at car scale and car prices.

## 6. The explosion (2022–present)

Three things converged: cheap high-torque electric actuators, cheap compute, and — decisively —
vision-language-action models that map camera images and spoken instructions straight to whole-body
motion. Dozens of well-funded general-purpose humanoids appeared almost at once.

In the US: **Optimus** (`tesla-optimus`), **Figure** (`figure-01` → `figure-02`, which in 2025
switched to the in-house Helix VLA), **Apptronik Apollo** (`apptronik-apollo`), and Boston
Dynamics' **all-electric Atlas** (`boston-dynamics-atlas-electric`), which replaced the hydraulic
one in 2024. From Norway, **1X**'s home-focused **NEO** (`1x-neo`). From Canada, **Sanctuary**'s
dexterity-first **Phoenix** (`sanctuary-phoenix`). From Germany, **NEURA**'s **4NE-1**
(`neura-4ne1`); from Israel, **Mentee** (`mentee-menteebot`). And a very large Chinese cohort:
**Unitree** (`unitree-h1`, then `unitree-g1` at ~US$16k, then `unitree-r1` at ~US$6k) collapsing
the price floor; **Fourier** (`fourier-gr-1`), **UBTECH** (`ubtech-walker-s`, in car-plant
pilots), **XPeng** (`xpeng-iron`), **Xiaomi** (`xiaomi-cyberone`), **AgiBot** (`agibot-a2`),
**Galbot** (`galbot-g1`), **Kepler** (`kepler-forerunner`), **Booster** (`booster-t1`),
**PNDbotics** (`pndbotics-adam`), **RobotEra** (`robotera-star1`), **Astribot** (`astribot-s1`),
**LimX** (`limx-cl-1`), **EngineAI** (`engineai-se01`) and **MagicLab**
(`magiclab-magicbot`) among many more. Poland's **Clone Robotics** went the opposite way with the
muscle-and-bone **Protoclone** (`clone-protoclone`).

Two counter-currents run through the noise. One is **open source**: Beijing's state-backed
**Tiangong** (`xhumanoid-tiangong`, 2024) was released as open hardware and software, followed by
**Fourier N1** (`fourier-n1`) and UC Berkeley's sub-$5,000 **Humanoid Lite**
(`berkeley-humanoid-lite`). The other is **stripping the robot back**: Reflex
(`reflex-robotics`) and many Chinese "humanoids" drop the legs for a wheeled base to buy
reliability and cost, betting that arms and autonomy matter more than a bipedal gait.

## Where things stand

Locomotion — the problem that consumed the first fifty years — is now close to a commodity: a
sub-$10k robot can walk, run and recover from a shove. The open problems have moved:

- **Manipulation.** General-purpose, reliable, dexterous hands and the perception to use them
  remain hard. Much of the current hardware diversity (`data/hands/`) is a bet on this.
- **Autonomy.** Most impressive 2024–2025 demos still lean on teleoperation or narrow scripting.
  Whether VLA models close that gap, and how fast, is the central open question.
- **Economics.** Automotive-plant pilots (2024) are the first at-scale test of whether the numbers
  work against human labor and against fixed automation.
- **Reliability, safety, and trust** — the things the DARPA finals exposed in 2015 — are still the
  difference between a viral video and a product.
