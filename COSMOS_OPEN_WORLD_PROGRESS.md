# COSMOS open-world universe — progress

Mission: a continuous open-world exploration mode (astronaut, 6-direction
flight, speed levels, directional discovery HUD, autopilot, map, bookmarks),
added as a new scene without breaking existing ones. Local commits allowed;
no push, no deploy.

## Design (decided 2026-11-19)

- New scene `open` ("Open Universe" in the nav), lazy like the others:
  3D in `src/scenes/OpenUniverse.jsx`, HUD in
  `src/components/interface/open/OpenUniverseHud.jsx`. They share state
  through `src/lib/openWorldStore.js` (plain module, no React re-render per
  frame).
- One continuous world in **galactic coordinates, kilometres, float64**
  (Sun at the origin, +X to the Galactic Centre, +Y to the north galactic
  pole), the same frame as the catalogue's `truePosition`.
- Floating origin: the camera always sits at the render origin. Each object
  is drawn in its true direction at a compressed distance
  `R(d) = R0 + A·ln(1 + d/D0)` and scaled by `R/d`. That is a uniform scale
  about the camera, so every object's angular size and direction are exact;
  only mutual depth is compressed (monotonic, so ordering holds).
- Objects (`src/lib/worldCatalogue.js`): Sun, planets, dwarfs, moons and
  small bodies from JPL elements at the current date (ecliptic → galactic);
  catalogue stars, exoplanet hosts, exoplanets (orbit phase illustrative),
  clusters, nebulae, galaxies, black holes at SIMBAD positions; deep-space
  probes from Horizons.
- Level of detail: everything is a point/glow in one GPU buffer; nearby
  objects mount real meshes (planet surfaces, star surface, GalaxyModel,
  NebulaModel, cluster cloud).
- Procedural field stars are generated per cell (deterministic hash) with
  the Milky Way model's disc density. They are never named or listed as
  discoveries, and the HUD says they are simulated.
- Sizes or positions that are not measured are drawn but labelled Model.

## Status

- [x] lib: units, compression, procedural stars, autopilot profile (`src/lib/openWorld.js`)
- [x] world catalogue (`src/lib/worldCatalogue.js`, 198 objects; positions match
      the catalogue to 1e-10 apart from the mirrored axis below)
- [x] 3D scene (`src/scenes/OpenUniverse.jsx`, `src/components/3d/open/*`)
- [x] HUD (`src/components/interface/open/*`), store (`src/lib/openWorldStore.js`)
- [x] map, bookmarks/saved places, inspection, notices, audio, touch, short-screen layout
- [x] wired into App, nav ("Open Universe" / Explore), SpaceEnvironment
- [x] checked by eye in real Chrome (scratch script): Earth start, Saturn,
      Sirius, Orion Nebula, Pleiades, Andromeda, Milky Way from outside,
      Sgr A*, first person, phone portrait and landscape
- [ ] unit + browser tests, full regression, screenshot review
- [ ] docs, local commit

Findings to report:
- The atlas's `truePosition` swaps galactic y/z (l = 90° on +Z), which is a
  mirror image in a right-handed renderer. The open world uses the correct
  frame (l = 90° on -Z). The atlas was left alone (needs approval).
- Solar planets in the open world use the atlas `Surface` (lighter textures),
  not the solar scene's full planet material.

## Next step

Add tests to tests/site.test.mjs and tests/browser.test.mjs, then run the
full suites.
