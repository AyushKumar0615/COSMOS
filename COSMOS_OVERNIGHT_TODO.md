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
9. [ ] Earth-orbit spacecraft in the open universe (needs real orbital elements; JPL/CelesTrak TLEs are not in the data — label illustrative or leave out).
10. [ ] Mars rovers (need mission-provided coordinates; not in the data).
11. [ ] Fix the atlas's mirrored galactic axis (needs approval: changes an existing view).
12. [ ] Safari and real-device testing (needs the user).
13. [x] Stars with no measured radius: radius inferred from measured magnitude, distance and temperature (labelled Inferred).
14. [x] Markers hidden beneath HUD panels (`writeMarkers`, `.glass` rects); browser suite 38/38, checked at Saturn.
15. [ ] Constellation lines (needs Hipparcos positions for the figure stars via `npm run catalogue`; not in the data).
16. [ ] Comet coma glow in the open universe (tails only today; the beacon marks the head).
