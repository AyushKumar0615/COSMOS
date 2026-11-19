# COSMOS overnight progress — Infinite Universe Evolution

Committed on local `main` (476c67f..8bedc09, on top of `e1a817e Initial COSMOS
universe release`), together with the earlier realism upgrade (planets, Sun,
spacecraft, meteors, Effects menu). Not pushed to GitHub or deployed.

## Checkpoint 1 — orbital data and simulation clock (verified by build + scripted checks)

Done:
- `scripts/build-orbits.mjs` (`npm run orbits`) writes
  - `src/data/catalogue/orbits.json` (13 kB): JPL Table 1 planet elements + rates,
    JPL satellite mean elements (21 moons, incl. precession periods), JPL SBDB
    elements for 5 dwarf planets, 3 asteroids, 3 near-Earth asteroids, 5 comets;
    physical values copied from measured.json.
  - `src/data/catalogue/trajectories.json` (70 kB): JPL Horizons heliocentric
    ecliptic vectors for Voyager 1/2, New Horizons (2024–2029, 30 d), Parker Solar
    Probe (2025-06 → 2027-12, 1 d), Juno (2024–2027, 2 d).
- `src/lib/orbits.js`: Kepler solver, planet/small-body/moon positions, Meeus
  low-precision lunar terms, log-distance radius map, eclipse geometry.
  Checked against 11 known eclipses 2024–2026: all detected within ±3 h.
- `src/lib/simClock.js`: shared clock (educational / real dates, pause, speeds).
- Planets now move by the shared clock, start at today's real longitudes, and in
  real-dates mode follow JPL elements; spins use JPL rotation periods.

## Checkpoint 2 — moons, small bodies, belts, comets, eclipses (verified visually)

Done:
- `src/data/solarBodies.js`, `src/data/solarNames.js`, `src/lib/solarEvents.js`.
- `src/components/3d/SolarExtras.jsx` (lazy chunk): 20 moons + Pluto–Charon binary
  (barycentre outside Pluto), tidal locking, moon phases from real lighting,
  eclipse shadows gated by real geometry (copper Moon in total lunar eclipse),
  moon shadow transits on giant planets, Ceres/Haumea/Makemake/Eris, Vesta/Pallas/
  Hygiea, Eros/Bennu/Apophis, 5 comets with coma, ion tail (anti-sunward) and
  curved dust tail, asteroid belt with Kirkwood gaps, Kuiper belt with plutinos.
- `planetMaterial.js`: up to four eclipse occluders per body.
- Interface: `TimePanel.jsx` (pause, speeds, real dates, date picker, eclipse
  banner), `FindPanel.jsx` (search everything), `BodyPanel.jsx` (JPL facts and
  sources), moon chips in planet panels, arrow keys step through peers.

## Checkpoint 3 — auroras and CMEs (verified visually and by the full suites)

- `src/components/3d/Aurora.jsx`: auroral ovals on Earth (green with a red
  fringe) and Jupiter and Saturn (false colour), Effects switch "Auroras".
- `Sun.jsx`: coronal mass ejections from about half the flares (under "Distant
  events"); flare sites prefer the hemisphere facing the viewer.
- Fixed after review: aurora and CME shaders squared their alpha under additive
  blending and were invisible; aurora rays were an even dashed ring; eclipse
  banners stacked while an eclipse changed from partial to total.
- Test fix: the context-loss test measured "the nearest textured sphere", which
  is now often a moon; it now measures the body at the camera's focus.

Results on 2026-11-12, final code: build passes; lint 0 errors; `npm test` 23/23;
`npm run test:browser` 31/32 on the full run, the one failure being the test
helper above, which passes after the fix (rerun on its own). Frame rates 60 fps
in every measured scene (solar, Sun and Earth close-ups, galaxies, nebulae, black
hole, supernova, universe, system); live heap 11.9 → 12.0 MB across scene cycles;
GPU memory unchanged across scene changes.

## Checkpoint 4 — spacecraft from JPL Horizons (verified visually and by tests)

- `src/lib/trajectories.js` (lazy chunk with `trajectories.json`, 27.9 kB gzip):
  positions for the simulated date, interpolated between Horizons samples
  (cubic in distance, longitude and latitude). Parker, on one fixed orbit since
  November 2024, uses a two-body fit to its samples (residual < 0.002 AU), so
  its perihelion is 0.0462 AU each lap (Horizons 0.0459) instead of being cut
  through. Outside the downloaded span nothing is drawn and the panel says so.
- `src/components/3d/Probes.jsx` (lazy): Voyager 1, Voyager 2, New Horizons,
  Parker, placed by real direction with compressed distance, a glint to find
  them from afar, and their downloaded tracks (with "Orbit lines" or selected).
  Educational mode: far probes stay at today's position; Parker loops whole
  orbits of its data at the compressed Kepler pace.
- Juno joins the Jupiter orbiters (compressed circular polar orbit, labelled).
- New models in `satelliteModels.js`: Voyager, New Horizons, Parker, Juno.
- `radiusFromAu` gains the Sun's surface (IAU nominal radius) as its inner
  anchor, so a Sun-grazing probe stays outside the drawn Sun.
- Spacecraft panel: distance from the Sun and from Earth and the radio signal
  time for the shown date, labelled "JPL Horizons ephemeris … Not live tracking".
- Camera views a probe from the side and a little sunward, so it shows lit.
- Tests: unit test for tracks (coverage, no extrapolation, Voyager 1 > 160 AU,
  Parker period and perihelion, fit residual, educational loop, monotonic
  distance map); browser test selects Voyager 1 and Parker through Find, checks
  the readout and the out-of-range notice in real-dates mode.
- Jupiter's aurora is now confirmed in a screenshot (behind Juno).

Results on 2026-11-12, final code: build passes; lint 0 errors; `npm test`
24/24; `npm run test:browser` 33/33 on one full run. 60 fps in every measured
scene; live heap 12.4 → 12.5 MB across scene cycles; GPU memory unchanged.
Main bundle 32.3 kB gzip (was 29.6: spacecraft facts and panel readout);
Probes 1.7 kB and trajectories 27.9 kB load lazily.

## Checkpoint 5 — tests for orbits, eclipses, moons and time (verified)

- Unit (`tests/site.test.mjs`): Kepler solver to 1e-9 up to e = 0.995; Earth's
  perihelion and aphelion distances and the March equinox (which sits 0.37°
  behind 0° in JPL's fixed J2000 frame, the precession since 2000 — correct,
  not a bug); 6 solar and 6 lunar eclipses 2024–2026 found within ±3 h, the
  three total lunar eclipses classed total, and 4 non-eclipse new and full
  moons give nothing; moon data present, named, and drawn in real order of
  distance and period; every named solar body has data and vice versa.
  (The tiny partial lunar eclipse of 18 Sep 2024 is classed penumbral: the
  Moon model's ~1° error, within its stated precision.)
- Browser: pause holds the clock; real dates from 13 Mar 2025 at 1 hour/s reach
  the lunar eclipse banner ("computed for this date"); Europa's panel, Next to
  Ganymede, Back to Jupiter and its "Moons shown" list.
- Fixed from the screenshots: on desktop the eclipse banner overlapped the Time
  button; it now sits below the toolbar (phones unchanged).

Results on 2026-11-12, final code: build passes; lint 0 errors; `npm test`
26/26; `npm run test:browser` 34/34 on one full run; 60 fps in every measured
scene; live heap 12.4 → 12.5 MB; GPU memory unchanged across scene changes.

## Checkpoint 6 — full regression and screenshot review (verified)

Reviewed all 26 desktop and 27 phone walkthrough screenshots plus the effects,
probes and time sets. Fixed:
- Universe atlas (pre-existing bug): entering a system, the fade-in was killed
  by the React effect re-run that the swap itself triggers, leaving a 95%
  opaque veil — the system looked black with no stars. Timing-dependent; it
  showed after visiting the solar system first. Reproduced headless (veil
  stuck at 0.95), fixed in `AtlasExplorer.jsx`, veil now clears in under 1 s.
- Atlas planet systems: moons were lit by a point light at their own planet,
  so a moon seen from the far side was black. Now lit by sunlight only, and
  the focus camera eases towards a body's sunlit side (`SystemView.jsx`).
- Phones: the "About …" pill in Phenomena ran into the Exit button for long
  names; it now truncates (`ExplorerHud.jsx`).
- About page listed a time control and moons, asteroids and comets as future
  ideas; it now lists what exists, with counts from `navigation.js` ids.

Results on 2026-11-12, final code: build passes; lint 0 errors; `npm test`
26/26; `npm run test:browser` 34/34 on one full run; 58–61 fps in every
measured scene; live heap 12.4 → 12.5 MB; GPU memory unchanged across scene
changes; main bundle 32.1 kB gzip.

Noted, not changed: in phone landscape the atlas info panel covers part of a
focused moon (existing layout); Europa's surface reads pale tan.

## Checkpoint 7 — documentation and final report (verified)

- README: moons and small bodies, time and real dates, Find, deep-space
  probes, `npm run orbits`, test coverage, new limitations, JPL sources.
- CLAUDE.md: status, new features, orbital-data rule.
- `COSMOS_FINAL_REPORT.md`: the ten deliverable parts.

Results on 2026-11-12, final code: build passes; lint 0 errors; `npm test`
26/26; `npm run test:browser` 34/34; 60 fps in every measured scene; first
contentful paint 324 ms; live heap 12.4 → 12.5 MB; GPU memory unchanged.

The mission's task list is complete. Committed afterwards; not pushed or deployed.

## Next tasks (in order)

Committed in four pieces. Suggested (needs approval): push; deploy a preview (not production) and run the browser suite against
it; test on Safari and real phones. Possible further work: on-screen labels,
true-scale mode, Cassini's archived trajectory, measuring tool.

## Continuation prompt

"Continue the COSMOS overnight mission from COSMOS_OVERNIGHT_PROGRESS.md: do the
next unfinished task, run `npm test` and `npm run test:browser`, update this file.
Do not commit, push or deploy."

---

# Mission 2 — open-world universe (2026-11-19)

Detailed notes: `COSMOS_OPEN_WORLD_PROGRESS.md`. Prioritised list: `COSMOS_OVERNIGHT_TODO.md`.
Branch `main`; local commits allowed, nothing pushed or deployed.

## Cycle A–D — open universe core (verified)

- New scene `open` ("Open Universe" in the nav): continuous galactic-coordinate
  world in float64 km with a floating origin and compressed depth (true
  directions and angular sizes); 198 catalogued objects from JPL, SIMBAD and
  the Exoplanet Archive; level of detail from points to meshes and models;
  procedural field stars per hashed cell; Milky Way band inside, model outside.
- Astronaut (EVA suit, visor, backpack, joints, gloves), third/first person.
- Flight: WASD, Space/Ctrl/C, Shift ×10, Q/E roll, drag or pointer-lock look,
  nine speed presets 1 km/s–10²¹ km/s, response and dampers, touch joystick.
- Discovery HUD: ahead list, nearby, markers hidden behind planets, compass,
  radar, position, target bar, autopilot, map, search, bookmarks, saved
  places, discovery notices, optional generated sound.
- Tests: unit 34/34; open-universe browser tests 5/5 (six axes in the ship
  frame, speeds, camera modes, astronaut orientation, discovery, distances vs
  true geometry, autopilot arrival/cancel, map, bookmarks, touch, phone,
  landscape, reduced motion); performance 60 fps idle and in fast travel,
  heap flat (13.9 → 13.9 MB).

## Cycle E–J — refinement (verified)

- Full planet materials in the open universe (shader takes an optional Sun
  direction), planets and moons oriented to the ecliptic, belts (shared
  sampling with the solar scene), route line, acceleration readout, history
  tab, display and sound settings with volume, interface tones, explorer
  hand-off, touch/tablet/phone layout fixes from screenshot review.
- Committed `68e4161` on branch `open-universe` (main untouched), then the
  acceleration readout and the final docs.
- Results on the final code: build passes; lint 0 errors; unit 34/34;
  browser 38/38; 60 fps everywhere (open universe idle and travelling);
  heap 14.0 → 13.9 MB; first contentful paint 176 ms.
- Final report: `COSMOS_OVERNIGHT_FINAL_REPORT.md`.

## Cycle K — comet tails, lensing, star sizes (2026-11-19, continued)

- Comet tails in the open universe (`components/3d/open/CometTails.jsx`):
  ion and dust tails drawn through the compressed space from JPL positions;
  shader shared with the solar scene (`lib/cometTail.js`). Fixed the tail
  ribbon being back-face culled from one side (also in the solar scene).
- Weak-field lensing of the sky around the strongest black hole (`open/Sky.jsx`,
  deflection 2Rs/b, shadow at 2.6 Rs); verified at Sgr A* and Cygnus X-1.
- Stars without a measured radius: inferred from magnitude, distance and
  temperature (`radiusFromMagnitude` in `lib/openWorld.js`), labelled Inferred.
  Supergiants were drawn at 3.4 solar radii before.
- Markers no longer show through the translucent HUD panels.
- Commits on `open-universe`: `0546ea0`, `dc69234`, `130c2a2`, `3efb9c5`. Unit 36/36; full browser suite 38/38 on the final build.

## Cycle L — comets up close, UI review (2026-11-19)

- Coma glow (`CometTails.jsx`, `comaMaterial` in `lib/cometTail.js`): true
  angular size from a modelled radius, greenish (C2 emission), fades from inside.
- Nucleus close-ups (`DetailBodies.jsx` `SmallBody`): comets and asteroids as a
  smooth irregular rock (`ROCK`, shared with the solar scene, now with merged
  vertices); dark nucleus with a faint inner coma.
- Station-keeping: after autopilot arrival the ship rides along with the body
  across the 2 s position refreshes (`L.anchor` in `OpenUniverse.jsx`); Encke
  used to drift out of view at its 10 km stop distance.
- Screenshot review of all scenes: fixed the phone Discover button overlapping
  the toolbar; stronger marker label shadows.
- Commits: `1947f7f`, `ade3391`. Unit 36/36; lint 0 errors; full browser suite 38/38 on the final build; 60 fps in every scene; heap 14.2 → 14.1 MB; first contentful paint 164 ms.

## Cycle M — atlas mirror fix and sourced extras (2026-11-19)

- Atlas mirror (approved): `truePosition` and `mapPosition` used
  z = +r·cos b·sin l, a reflection (determinant −1). Both now call
  `galacticToScene` (z = −r·cos b·sin l), a rotation of the right-handed
  galactic frame into the Y-up scene. Distances, nearby lists, map radii,
  selection and fly-to are unchanged (they read the same positions).
  Before/after: Cygnus X-1 (l ≈ 71°) moved from the near side to the far side
  with the Galactic Centre on the right, i.e. the view from the north
  galactic pole, as it should be. Tests: handedness (x × y = z), sign of z
  for every catalogued object, invariants, the open world now agrees on all
  three axes.
- `npm run extras` (`scripts/build-extras.mjs`): constellation figures
  (`constellations.json`, d3-celestial, BSD-3), rover positions and ISS/Hubble
  elements (`extras.json`). Constellations: open-universe overlay, off by
  default, fades out beyond 15–60 ly. Rovers: Mars's panel. Orbiters: open
  universe for one day after retrieval (error measured against Horizons
  vectors: ISS 122/300/840 km and Hubble 254/975/2,832 km after 0.25/1/3 days).
- Commit `bf86533`. Unit 40/40; lint 0 errors; full browser suite 38/38 on the final build (atlas search, system view and navigation included); 60 fps in every scene; heap 14.4 → 14.2 MB.

## Cycle N — SGP4 orbiters (approved 2026-11-19)

- `satellite.js` 6.0.2 (MIT; 7.x bundles a WASM worker Vite cannot build).
- `npm run extras` now fetches CelesTrak TLEs for ISS (25544), Hubble (20580)
  and Tiangong's Tianhe module (48274) instead of Horizons osculating elements.
- `orbiterPosition` (`lib/worldCatalogue.js`): SGP4, then TEME → J2000 by IAU
  1976 precession (`precessToJ2000`). Against Horizons J2000 vectors: 0.3 km at
  the epoch; ISS 1.4 / 6.4 km and Hubble 0.5 / 1.7 km after 1 / 3 days
  (Horizons has no Tiangong record). Window: 14 days after the TLE epoch.
- Commit `1350f8d`. Unit 40/40; lint 0 errors; full browser suite 38/38 on the final build; 60 fps in every scene.

Next task: none independently actionable; see "Needs a decision or data from
the user" in `COSMOS_OVERNIGHT_TODO.md`.

## Resume

``` bash
cd ~/Documents/projects/COSMOS
git checkout open-universe && git status && git log --oneline -3
npm test && npm run test:browser
```
Then take the first open item in COSMOS_OVERNIGHT_TODO.md.
