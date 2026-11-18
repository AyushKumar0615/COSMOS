# COSMOS — open-world universe: final report

Date: 2026-11-19. Branch `open-universe` (local, from `main` at `68a3b3a`).
Nothing pushed or deployed. Earlier mission's report: `COSMOS_FINAL_REPORT.md`.

## Features completed

**Open universe** (new scene; "Open Universe" in the nav, "Explore" in the bar)
- One continuous world from a few thousand km above Earth to quasars, no
  scene boundaries. Galactic coordinates in float64 km with a floating
  origin: the camera never leaves the render origin, so there is no
  floating-point jitter at any distance.
- Compressed depth, labelled in the HUD and every profile: each object is
  drawn in its true direction at `R(d) = 12 + 110·ln(1 + d/1000 km)` and
  scaled by R/d, so angular sizes and directions are exact and every
  distance shown is the real one.
- 198 objects: Sun, planets, dwarf planets, 21 moons and small bodies at their
  JPL positions for today; Voyager 1/2, New Horizons and Parker from Horizons;
  stars, exoplanet hosts, exoplanets, clusters, nebulae, galaxies and black
  holes from SIMBAD and the NASA Exoplanet Archive.
- Level of detail and streaming: points for everything; real meshes mount
  near (solar planets with the solar scene's full materials — relief, city
  lights, clouds, haze, rings; star surfaces; black-hole shadow and disc;
  galaxy, nebula and cluster models scaled to their catalogue sizes); the
  Milky Way is a sky band inside and the galaxy model outside.
- Spatial indexing: procedural field stars in hashed cells (two tiers),
  following the Milky Way model's disc; asteroid and Kuiper belts with real
  resonance structure. All marked as models; never named or listed.
- Correct handedness: the sky is not mirrored (see limitations for the atlas).

**Astronaut** — EVA suit built from primitives: hard upper torso, life-support
backpack, display and control module, gold visor, helmet lamps, joint
bearings, gloves, boots, stripes. Floats, leans into thrust, banks into
turns, faces where the ship faces; third/first person with an eased change
and a helmet rim in first person. Lit by the brightest star plus a helmet-lamp fill.

**Flight** — W/S forward and reverse thrust, A/D sideways, Space and Ctrl/C
up and down, Shift ×10, Q/E roll, drag or arrows to look, pointer-lock mouse
steering, wheel and nine presets from 1 km/s to 10²¹ km/s, response
(gentle/normal/snappy) and inertial dampers, pause, reset, collision with
planets and stars, touch joystick, up/down and boost.

**Readouts** — velocity in km/s, AU/s, multiples of c and ly/s;
acceleration; a status line comparing against real spacecraft (Voyager 1
today ≈ 16.9 km/s and Parker at perihelion ≈ 192 km/s, both measured from
the Horizons tracks, not typed); galactic position, distance from the Sun
and the Galactic Centre, and heading.

**Directional discovery** — objects within 14° of the view, nearest first,
with class, distance (km, AU, ly or Mpc) and travel time at cruise speed;
"behind Earth" when hidden; nearby list; markers that follow objects, hide
behind planets and avoid stacking; an edge arrow for an off-screen target;
compass; radar.

**Navigation** — target lock from the list, a marker, search, the map or
the profile; a route line; autopilot in log distance (3–22 s for any trip),
cancelled by any thrust; face-target; bookmarks (shared with the atlas),
saved places; a logarithmic map of the galactic plane, filterable and
zoomable; exploration history; discovery notices for every catalogued region
entered, recorded in the shared discoveries; an offer to open the
ray-traced black hole or the detailed galaxy or nebula explorer from inside
their region.

**Audio and settings** — optional generated ambience, thruster sound
following thrust, interface tones (lock, engage, arrive, cancel) and a
discovery chime, with volume; display switches for markers, route, streaks,
field stars and belts, saved between visits.

## Features partially completed

- Gravitational lensing in the open universe: a visual shadow and disc only;
  the real ray tracing stays in the Black Hole Explorer, offered from inside
  the region.
- Planet axial orientation: tilted from the ecliptic pole by the obliquity;
  the pole's longitude is not in the data. Moons of the outer planets: orbit
  planes tilted by the obliquity only.
- Missions 5–8 and 10 (solar-system realism, moons, meteors, spacecraft,
  deep-space scenes) were already implemented in earlier missions; this one
  brought the planets' full materials, belts and probes into the open universe
  rather than re-working those scenes.

## Features remaining

See `COSMOS_OVERNIGHT_TODO.md`. In short: Earth-orbit spacecraft in the open
universe (needs real orbital elements), Mars rovers (needs mission
coordinates), comet tails in the open universe, screen-space lensing, the
atlas's mirrored axis (needs approval), constellation overlays, Safari and
real-device testing.

## Files

New: `src/lib/openWorld.js`, `worldCatalogue.js`, `openWorldStore.js`,
`spaceAudio.js`, `belts.js`; `src/scenes/OpenUniverse.jsx`;
`src/components/3d/open/` (`Astronaut`, `Belts`, `DetailBodies`,
`PointLayer`, `Sky`, `SpaceDust`, `useFlightInput`);
`src/components/interface/open/` (`OpenUniverseHud`, `UniverseMap`);
`COSMOS_OPEN_WORLD_PROGRESS.md`, `COSMOS_OVERNIGHT_TODO.md`, this report.

Modified: `src/App.jsx`, `src/scenes/SpaceEnvironment.jsx`,
`src/data/navigation.js`, `src/lib/discovery.js` (getter),
`src/lib/planetMaterial.js` (optional Sun direction),
`src/lib/galaxyGenerator.js` (marker angle), `src/components/3d/`
`PointCloud`, `CloudSprites`, `GalaxyModel`, `NebulaModel` (opt-in
`followScale`), `Planet` (exported look table), `SolarExtras` (shared belt
sampling), `atlas/SystemView` (exported `Surface`),
`src/components/interface/FlightHud.jsx` (exported helpers), `AboutPanel`,
`tests/site.test.mjs`, `tests/browser.test.mjs`, `README.md`, `CLAUDE.md`,
`COSMOS_OVERNIGHT_PROGRESS.md`.

## Test results

| Check | Result |
|---|---|
| `npm run build` | Passes |
| `npm run lint` | 0 errors, 134 warnings (frame-loop mutation hints, as before) |
| `npm test` | 34/34 (8 new open-universe tests) |
| `npm run test:browser` | 38/38 on the final code (real Chrome, Apple M4 GPU) |
| Open-universe browser tests on the final code | 4/4 |

The unit tests caught two real bugs (arriving at a galaxy did not count as
entering it; an unlabelled model size). Screenshot review caught Mars and
Saturn drawn with galactic rather than ecliptic poles, the map under the
navigation bar, touch controls over the phone sheet, tablet overlaps and a
clipped close button; all fixed.

## Performance (real Chrome, Apple M4)

- 60 fps in every scene, including the open universe at rest and during a
  long autopilot trip (procedural cells rebuilding every frame).
- Live JS heap 14.0 → 13.9 MB across repeated scene cycles that include the
  open universe; GPU geometries, textures and programs unchanged.
- First contentful paint 160–180 ms (local build). Main bundle 32.7 kB gzip;
  the open universe loads lazily (`OpenUniverse` 12 kB, its HUD 11 kB gzip).

## Known limitations

- Depth is compressed (labelled); two objects in the same direction at
  different distances look closer together in depth than they are.
- Most stars have no measured radius: their discs are drawn at a size for
  their class (labelled Model). Galaxies keep their explorer models' tilt.
- Exoplanets are at their measured distance from their star, at an
  illustrative orbital phase.
- Procedural stars, belts and the Milky Way band are models; speeds above
  light are a convenience, labelled.
- Ctrl+W closes the tab in browsers; C also descends.
- The atlas places l = 90° on +Z (a mirror image); distances there are right.
- Tested in Chrome only (desktop GPU and simulated touch viewports).

## Git status

Branch `open-universe`, commits on top of `main` (`68a3b3a`); `main` is 6 commits ahead of
`origin/main` and unchanged by this mission. `.claude/` deliberately
untracked. Nothing pushed or deployed.

## Next steps

1. Review the branch: `git log main..open-universe`, then try it with `npm run dev`
   → "Open Universe".
2. If happy, fast-forward `main` (`git merge --ff-only open-universe`).
3. Safari and real-device testing, then an approved preview deployment.
4. Continue `COSMOS_OVERNIGHT_TODO.md` from the top.
