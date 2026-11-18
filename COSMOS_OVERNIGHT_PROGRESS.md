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
