# COSMOS — Project Instructions

## Project Overview
COSMOS is an interactive 3D universe exploration website built with React, Three.js and React Three Fiber.

Project directory: `~/Documents/projects/COSMOS`

## Development Status
Phases 1–8 are completed, plus the Black Hole Explorer, new destinations and the Phenomena lab. Those additions exist locally only: the private Vercel build predates them.

### Completed Features
- Interactive landing page and universe entry.
- 3D starfield and procedural nebula environment.
- Sun and eight planets with interactive orbits.
- Planet selection and information panels.
- Guided exploration tours.
- Free-flight mode with desktop and mobile controls.
- Procedural galaxies and nebulae.
- Space mission explorer.
- Responsive navigation and mobile interfaces.
- Performance quality tiers.
- Accessibility and reduced-motion support.
- WebGL fallback.
- SEO and production configuration.
- Black Hole Explorer: ray-traced Schwarzschild renderer, guided descent, science panels and missions.
- Sombrero and Triangulum galaxies; Pillars, Horsehead, Ring and Helix nebulae.
- Phenomena lab: supernova, pulsar, wormhole, curved spacetime, cosmic scale and exoplanets.
- Universe atlas: GPU star map, searchable catalogue, explorable systems, compare, bookmarks and discoveries.
- 17 galaxies, 13 nebulae, stellar life cycle in the Phenomena lab.
- Automated tests: `npm test` and `npm run test:browser`.

## Data Rules
- Measurements come from `src/data/catalogue/measured.json`, built by `npm run catalogue` from NASA, JPL and SIMBAD. Never type a measurement by hand.
- Corrections go in `OVERRIDES` in `src/data/catalogue/notes.js`, with the reason.
- Leave a missing value `null`. Never fill a gap with an estimate.
- Keep first-load data as ids only (`src/data/navigation.js`); anything larger belongs in a lazy chunk.

## Testing Notes
- Run `npm test` and `npm run test:browser`, then review the screenshots in `tests/.output/` by eye: the click helper scrolls elements itself, so it can pass things a real visitor cannot reach.
- The in-app browser pane is usually hidden and throttled, so never report frame rates from it. The browser suite uses real Chrome on the GPU.
- Label science as Observed, Inferred, Model or Theory. Do not add a figure that cannot be sourced.

## Essential Rules
1. Never rebuild existing completed functionality.
2. Always inspect existing code before editing.
3. Preserve the existing visual identity and design system.
4. Avoid unnecessary dependencies.
5. Avoid unnecessary code duplication.
6. Keep performance and responsiveness a priority.
7. Do not remove working features without approval.
8. Do not overwrite existing configuration without checking it.
9. Never claim tests passed without running them.
10. Keep responses and implementation token-efficient.

## Development Workflow
Before implementing a feature:
1. Inspect relevant files.
2. Understand existing architecture.
3. Identify dependencies and potential conflicts.
4. Implement the smallest reliable change.
5. Run production build and relevant tests.
6. Report modified files and test results.

## Current Priority
Real-device and Safari testing, then an approved deployment. The project's Vercel production domain is cosmos-kappa-six.vercel.app and is not yet attached to a build. Deployment Protection must be turned off before launching on a .vercel.app address.

Do not deploy to production without explicit approval.

## Communication
- Explain important changes briefly.
- Provide exact terminal commands when needed.
- Report errors honestly.
- Ask before making destructive changes.
- Preserve project continuity across sessions.