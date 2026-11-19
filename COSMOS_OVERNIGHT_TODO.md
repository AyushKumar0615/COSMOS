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
9. [x] Earth-orbit spacecraft: ISS, Hubble and Tiangong by SGP4 (satellite.js 6) from CelesTrak TLEs fetched by `npm run extras`, precessed TEME → J2000; within 0.3 km of JPL Horizons at the epoch and 1.7–6.4 km after 3 days; shown for 14 days after the TLE epoch.
10. [x] Mars rovers: Perseverance and Curiosity latest localised positions from NASA's MMGIS rover maps, shown in Mars's panel (not on the globe, whose surface is a model).
11. [x] Atlas mirror fixed (approved 2026-11-19): `galacticToScene` in `src/data/catalogue/index.js`, used by `truePosition` and `mapPosition`; regression tests added.
12. [ ] Safari and real-device testing (needs the user).
13. [x] Stars with no measured radius: radius inferred from measured magnitude, distance and temperature (labelled Inferred).
14. [x] Markers hidden beneath HUD panels (`writeMarkers`, `.glass` rects); browser suite 38/38, checked at Saturn.
15. [x] Constellation figures (d3-celestial, BSD-3) as an optional overlay in the open universe near the Sun; Display settings → Constellation figures.
16. [x] Comet coma (true angular size, fades from inside), dark irregular nucleus with inner coma for close-ups, station-keeping after arrival.
17. [x] Phone: Discover button no longer overlaps the toolbar; marker labels readable over bright planets.

## Needs a decision or data from the user

- **Keeping orbiters current:** re-run `npm run extras` at least every 14 days (or schedule it); after that the orbiters are hidden rather than shown stale.
- **Rovers on the 3D globe:** needs a real Mars map and the IAU Mars rotation model in the data
  pipeline; today's Mars texture is procedural.
- **Safari and real devices (item 12):** needs testing on your hardware.
- **Merge / push / deploy:** branch `open-universe` is local and unmerged; nothing is pushed.
- **Refreshing data:** `npm run extras` updates rover positions, orbiter elements and
  constellations; `npm run catalogue` and `npm run orbits` as before.

Nothing else on this list can be done without one of the above.
