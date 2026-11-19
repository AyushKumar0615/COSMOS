# COSMOS overnight — prioritised TODO (open-world mission, 2026-11-19)

Done items move to COSMOS_OVERNIGHT_PROGRESS.md. Highest priority first.

1. [x] Full browser regression on the open universe build; review screenshots; local commit.
2. [x] Navigation route drawn in 3D from the ship to the target.
3. [x] Clear "depth compressed" label in the HUD (directions and sizes true).
4. [x] Audio: volume control, target-lock / autopilot confirmation sounds.
5. [x] Open universe: exploration history tab (shared discovery log); effects toggles (dust streaks, field stars, markers).
6. [x] Open universe: asteroid and Kuiper belts (labelled models); comet ion and dust tails (model, JPL positions).
7. [x] Open universe: solar planets with the solar scene's full materials (night lights, clouds, bump).
8. [x] Lensing: weak-field lensing of the sky around the strongest black hole (sky shader) plus the ray-traced hand-off. Not lensed: the accretion disc, beacons and field stars.
9. [~] Earth-orbit spacecraft: ISS and Hubble from JPL Horizons osculating elements (`npm run extras`), two-body propagation, shown only for 1 day after retrieval (measured error: ~300 km ISS / ~1,000 km Hubble after a day). Staying visible needs a daily refresh or an SGP4 propagator with live TLEs (user decision).
10. [x] Mars rovers: Perseverance and Curiosity latest localised positions from NASA's MMGIS rover maps, shown in Mars's panel (not on the globe, whose surface is a model).
11. [x] Atlas mirror fixed (approved 2026-11-19): `galacticToScene` in `src/data/catalogue/index.js`, used by `truePosition` and `mapPosition`; regression tests added.
12. [ ] Safari and real-device testing (needs the user).
13. [x] Stars with no measured radius: radius inferred from measured magnitude, distance and temperature (labelled Inferred).
14. [x] Markers hidden beneath HUD panels (`writeMarkers`, `.glass` rects); browser suite 38/38, checked at Saturn.
15. [x] Constellation figures (d3-celestial, BSD-3) as an optional overlay in the open universe near the Sun; Display settings → Constellation figures.
16. [x] Comet coma (true angular size, fades from inside), dark irregular nucleus with inner coma for close-ups, station-keeping after arrival.
17. [x] Phone: Discover button no longer overlaps the toolbar; marker labels readable over bright planets.

## Needs a decision or data from the user

- **Earth orbiters staying visible (item 9):** either refresh `npm run extras` daily (a scheduled
  job), or add an SGP4 propagator (e.g. the `satellite.js` package) with CelesTrak TLEs, which
  stays accurate to a few km for days. Both need your choice; the second adds a dependency.
- **Rovers on the 3D globe:** needs a real Mars map and the IAU Mars rotation model in the data
  pipeline; today's Mars texture is procedural.
- **Safari and real devices (item 12):** needs testing on your hardware.
- **Merge / push / deploy:** branch `open-universe` is local and unmerged; nothing is pushed.
- **Refreshing data:** `npm run extras` updates rover positions, orbiter elements and
  constellations; `npm run catalogue` and `npm run orbits` as before.

Nothing else on this list can be done without one of the above.
