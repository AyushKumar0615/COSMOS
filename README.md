# COSMOS — Explore the Universe

An interactive 3D universe that runs in the browser. Search a catalogue of
over 150 real objects and fly to any of them, fall towards a ray-traced black
hole, explore planetary systems, walk through the life of a star, visit
galaxies and nebulae, and read the record of fourteen real space missions.

Everything is rendered in real time with WebGL. Nothing is downloaded at
runtime: planet surfaces, ring profiles, cloud textures and the black hole's
sky are generated on the GPU on first use, and the galaxies and nebulae are
built from seeded noise. There are no image dependencies that can break.

> **Status:** Phases 1–8 complete, plus the Black Hole Explorer, the
> Phenomena lab and the Universe atlas with its catalogue. Those additions
> exist locally only: the private Vercel build predates them, and nothing is
> public yet.
>
> **Testing note:** the automated suites in `tests/` run against the
> production build in Chrome on an Apple M4 GPU, at desktop, laptop,
> tablet, phone and phone-landscape viewport sizes, served with the
> production security headers. Phone and tablet runs are emulated. It has
> **not** been tested on physical phones or tablets, or in Safari or
> Firefox. The same browser suite also passed against the Vercel
> deployment, with its real headers and compression.

---

## Features

**Landing page.** A cinematic opening over a live starfield, with a
scripted intro and a single way in.

**Solar system.** The Sun and all eight planets on compressed orbits,
with procedurally generated surfaces, atmospheres, orbit paths, a debris
belt and Saturn's rings — which take the planet's shadow, computed
analytically rather than with a shadow map.

**Planet information.** Select any body for a panel of figures from the
NASA Planetary Fact Sheet, with the camera framing the planet clear of
the panel.

**Guided tour.** Ten stops — an introduction, the Sun and each planet —
each with its own camera angle, text and two facts. Advances every 16
seconds, with next, previous, pause and exit.

**Free flight.** Fly the camera yourself, in the solar system and in
both explorer scenes. Eased movement, a boundary, no flying into the
Sun, and a reset that glides home.

**Universe.** One map of everything, using real sky directions from archive
coordinates with distances compressed logarithmically about the Sun. A
procedural Milky Way of up to 220,000 stars is drawn in a single GPU layer:
blue giants, red giants, white dwarfs, neutron stars and more, each with its
own temperature colour, size and twinkle, plus binaries, open and globular
clusters, a galactic band and nebulae in star-forming regions. Choose any
object and the camera flies there, then opens its system.

**Catalogue.** Over 150 real objects: stars, the planets, dwarf planets,
moons, 41 exoplanets, clusters, nebulae, galaxies and black holes. Search,
filter by type, and sort by distance, radius, temperature, mass or orbital
period. Each has a profile with its measurements and sources, nearby objects
and connected neighbours. Bookmark favourites, and compare up to four side by
side, drawn to true relative scale where that is possible.

**Planetary systems.** The Solar System with its dwarf planets, the moons of
Earth, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto, and the systems of
exoplanet hosts such as TRAPPIST-1 and Proxima Centauri. Each body has its
own generated surface, orbit and rotation, with atmospheres and rings where
they apply. Orbit, zoom and pan while the camera follows a moving body.

**Discoveries.** Milestones, challenges, badges, distance travelled and a
personal log, kept in this browser only, with no account.

**Black Hole Explorer.** The flagship. Sagittarius A*, M87*, Cygnus X-1 and
TON 618, each ray-traced per pixel through Schwarzschild spacetime, so the
shadow, photon ring, lensed disc and distorted stars come from the physics
rather than from artwork. M87* has its jet, Cygnus X-1 its lensed companion
star, and Sagittarius A* a faint, flickering flow. Fly in by hand down to
1.12 r_s, or press **Enter** for a guided descent through the inner disc
edge, the photon sphere and the horizon, with live proper time, clock rate
and tidal readings. Below the horizon the view is an artistic impression and
is labelled as one. A **Science** tab calculates each hole's figures and
explains ten topics, each tagged Observed, Inferred, Model or Theory, and a
**Missions** tab tracks five objectives that complete from what you do.

**Galaxy explorer.** Seventeen galaxies, from the Milky Way and Andromeda to
the Magellanic Clouds, the Cartwheel, the Black Eye, Centaurus A and M87, at
about 1 unit = 1,000 light-years. Recipes combine log-spiral and flocculent
arms, bars, rings and spokes, warped dust lanes, starburst plumes, irregular
clumps, globular clusters and companions. Sizes of the first five are
published figures; the rest are approximate.

**Nebula explorer.** Thirteen nebulae, built from layered camera-facing
cloud sprites over a baked noise texture. Each has its own builder: the
Ring's stepped shells, the Helix's cometary knots, the Horsehead's silhouette
traced from an outline, the Rosette's hollow centre, the Tarantula's radiating
filaments and the Cat's Eye's nested shells.

**Phenomena lab.** The life of a star, with four evolutionary paths by mass,
from molecular cloud to white dwarf, neutron star or black hole; a
core-collapse supernova on a scrubbable timeline; a
pulsar with its dipole field and sweeping beams; a ray-traced Ellis wormhole
you can travel through, clearly marked as hypothetical; a curved spacetime
grid where you place masses; a cosmic scale slider from Earth to the
observable universe; and four exoplanets with their own light and surfaces.

**Space missions.** Fourteen missions from NASA, ISRO, ESA and JAXA,
each with its objective, spacecraft, discoveries, a dated status, an
event timeline and links to the agency's own pages. Searchable and
filterable by agency, type and status.

---

## Technology stack

| Technology | Role |
| --- | --- |
| React 19 | Interface |
| Vite 8 (rolldown) | Dev server and build |
| Three.js 0.180 | WebGL rendering |
| React Three Fiber 9 | React renderer for Three.js |
| Drei 10 | Camera controls, performance monitor |
| GSAP 3 | Camera transitions and the landing intro |
| Framer Motion 14 | Interface transitions |
| Tailwind CSS 4 | Styling, via `@tailwindcss/vite` |
| oxlint | Linting |
| Node test runner + installed Chrome | Automated tests, with no test dependencies |

Three.js is pinned to 0.180 deliberately: later releases deprecate
`THREE.Clock`, which React Three Fiber 9 still constructs, and the
warning fires every frame.

---

## Installation

Requires Node 20 or newer.

``` bash
git clone <your-repository-url> cosmos
cd cosmos
npm install
```

## Local development

``` bash
npm run dev
```

Open the URL Vite prints. Two query parameters help while developing:

| Parameter | Effect |
| --- | --- |
| `?quality=low\|medium\|high` | Force a rendering tier instead of detecting one |
| `?debug` | Expose the renderer state on `window.__cosmos` |

## Build

``` bash
npm run build     # static output in dist/
npm run preview   # serve dist/ locally
npm run lint      # oxlint
```

`npm run catalogue` re-fetches the archive data into
`src/data/catalogue/measured.json`. It is run by hand and the result reviewed:
the site never contacts these services at runtime, and the build does not
either.

## Testing

``` bash
npm test              # build, then check content, metadata and configuration
npm run test:browser  # build, then drive the site in Chrome (about 14 minutes)
```

`npm test` needs nothing but Node. `npm run test:browser` uses the Chrome
already on the machine (set `CHROME_PATH` if it is somewhere unusual) over
the DevTools Protocol, serving `dist/` with the headers from `vercel.json`.
It walks every feature at five viewport sizes and covers keyboard and touch
input, the catalogue, losing the GPU context, GPU memory across scene
changes, running without WebGL, reduced motion and blocked fonts. Screenshots of every state and the performance figures land
in `tests/.output/`, which is not committed.

To run the browser suite against a deployment instead of a local build, set
`COSMOS_TEST_URL` to its address, and `COSMOS_BYPASS` to a Deployment
Protection bypass secret if the deployment is protected:

``` bash
COSMOS_TEST_URL=https://your-deployment.vercel.app node --test --test-concurrency=1 tests/browser.test.mjs
```

The build also generates `robots.txt` and `sitemap.xml` from
`VITE_SITE_URL`, so the domain lives in one place rather than in three
files that drift apart.

---

## Deployment

The build is a fully static `dist/` — no server code, no runtime API
calls, no secrets. Any static host will serve it; the repository is
configured for Vercel.

### Environment

One variable, and it is public by design:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SITE_URL` | see below | Origin used for the canonical link, Open Graph and Twitter metadata, `robots.txt` and `sitemap.xml` |

The origin comes from the first of these that exists:

1. `VITE_SITE_URL`, from the environment or a local `.env`.
2. On Vercel, the project's production domain
   (`VERCEL_PROJECT_PRODUCTION_URL`, which Vercel provides to every build).
   This follows a custom domain automatically, so on Vercel the variable
   is optional.
3. `http://localhost:4173`, with a warning in the build output. A build
   that prints that warning is not fit to publish.

Everything prefixed `VITE_` is compiled into the JavaScript that ships to
the browser, so nothing secret may go there.

### Deploying to Vercel

``` bash
npx vercel login                 # opens a browser to authenticate
npx vercel                       # preview deployment
npx vercel deploy --prod         # production deployment
```

A project's first deployment must be a production one; Vercel refuses a
preview until then. `npx vercel deploy --prod --skip-domain` satisfies that
without attaching a domain, so nothing reaches the public address until it
is promoted. `cosmos.vercel.app` belongs to someone else, so Vercel assigns
a different address.

**Vercel Authentication hides `.vercel.app` addresses behind a login by
default**, including the production one. Custom domains are exempt. To
launch without a custom domain, turn it off under Settings → Deployment
Protection. Either way, confirm the launched site loads in a private window
and no longer sends `x-robots-tag: noindex`.

`vercel link` adds `.env*` to `.gitignore` and writes a token to
`.env.local`. Remove that line if it appears, because it stops
`.env.example` being committed. `vercel.json` sets the build command, the output
directory, the SPA rewrite, the security headers and the caching rules, so
nothing needs configuring in the dashboard.

Deploying from Git works the same way: push the repository to GitHub and
import it in the Vercel dashboard, which reads `vercel.json`.

Before promoting a preview to production, check it on real hardware and
confirm the headers:

``` bash
curl -sI https://your-preview-url.vercel.app | grep -iE 'content-security|strict-transport|x-frame|cache-control'
```

**After adding a custom domain, redeploy**, so the canonical link, social
preview and sitemap pick it up.

### What `vercel.json` configures

- **SPA rewrite.** Everything that is not a real file falls back to
  `index.html`. COSMOS keeps its state in memory and has no routes, so
  this only matters for deep links and refreshes.
- **Caching.** Hashed files under `/assets/` are immutable for a year;
  images and icons get a day with a week of stale-while-revalidate;
  `index.html` is never cached, so a deploy is picked up immediately.
- **Security headers.** A content security policy that allows only this
  origin plus Google Fonts, HSTS, `nosniff`, `SAMEORIGIN` framing, a
  strict referrer policy, a permissions policy that denies camera,
  microphone, geolocation and the rest, and a same-origin opener policy.

HSTS deliberately covers this host only. `includeSubDomains` and `preload`
are hard to undo and would bind every subdomain of a custom domain to
HTTPS, so add them only as a considered decision about that domain.

The browser tests serve the build with these headers (minus HSTS and
`upgrade-insecure-requests`, which need HTTPS) and fail on any policy
violation. The headers, caching and rewrite have also been confirmed on a
real Vercel deployment.

---

## Project structure

``` text
cosmos/
├── public/
│   ├── cosmos.svg              favicon
│   ├── favicon-32.png          favicon for browsers without SVG support
│   ├── apple-touch-icon.png    iOS home screen icon, 180×180
│   └── og-image.png            social preview, 1200×630
├── src/
│   ├── App.jsx                 phase/scene/mode state, keyboard routing
│   ├── main.jsx
│   ├── index.css               Tailwind theme, type scale, glass surfaces
│   ├── components/
│   │   ├── 3d/                 everything inside the Canvas
│   │   ├── interface/          HUDs, panels, loader, overlays
│   │   ├── layout/             navbar
│   │   └── missions/           explorer, detail panel, illustrations
│   ├── scenes/
│   │   ├── SpaceEnvironment.jsx  picks the scene for the current state
│   │   ├── SolarScene.jsx        sun, planets, orbits, tour, flight
│   │   ├── GalaxyExplorer.jsx    lazy chunk
│   │   ├── NebulaExplorer.jsx    lazy chunk
│   │   ├── BlackHoleExplorer.jsx lazy chunk
│   │   ├── PhenomenaExplorer.jsx lazy chunk
│   │   ├── AtlasExplorer.jsx     lazy chunk: the Universe scene
│   │   └── MissionBackdrop.jsx   starfield behind the mission pages
│   ├── data/                   planets, tour, galaxies, nebulae, black
│   │                           holes, phenomena, missions, navigation
│   │   └── catalogue/          archive data, notes, achievements
│   ├── hooks/                  tour timer, media queries, crossfade, view
│   │                           shift, telemetry, black hole missions
│   └── lib/                    generators, texture baking, ray tracing
│                               shaders, relativity, quality tiers
├── scripts/                    fetches catalogue data from the archives
├── tests/                      site checks and browser suites, no dependencies
├── .env.example
├── vercel.json
├── vite.config.js
└── package.json
```

**How it fits together.** There is one `<Canvas>` for the whole site.
`SpaceEnvironment` chooses which scene lives inside it, so moving
between the solar system, the galaxies and the nebulae never tears down
the renderer — the view fades through black and the scene graph is
swapped underneath. `App.jsx` owns the state the scenes read: the phase
(loading → landing → entering → universe), the current scene, the mode
(explore, tour, flight) and the selection.

Every explorer scene and the mission explorer are `React.lazy` chunks, so
the first load carries only the landing page and the solar system.

**The Universe scene.** The map and a system are never on screen together.
The map has no per-object meshes: stars are one `Points` draw call animated in
the vertex shader, and picking and labels work from positions projected in
JavaScript, with a fixed pool of DOM labels moved directly. The star buffer is
shuffled, so level of detail is simply drawing less of it when frames run
long. Meshes exist only in `SystemView`, for the one system open. Surfaces are
baked on first use into a cache that frees its least recently used entry, so
touring the catalogue cannot pile up on the GPU. All interface text for the
Universe, galaxies, nebulae, black holes and the lab is in lazy chunks, leaving
only ids in the first load.

**The black hole renderer.** `lib/blackHoleShader.js` follows each pixel's
light backwards with the Schwarzschild orbit equation u'' + u = (3/2)u²,
written as a flat-space acceleration of −(3/2)h²x/r⁵. The trace runs into its
own half-float target at a resolution set by the quality tier and the frame
rate (`BlackHoleModel.jsx`), then a composite pass tone-maps it and takes
bloom from the target's mip chain. Scene units are Schwarzschild radii, so
all four holes share one scene, and `lib/relativity.js` turns positions into
real distances, clock rates and tides for the chosen mass. The 3D scene
writes the camera's state to a ref every frame, and the interface samples
that ref on its own timer, so moving never re-renders React.

---

## Controls

### Everywhere

| Input | Action |
| --- | --- |
| Drag | Orbit the view |
| Right-drag | Pan |
| Scroll / pinch | Zoom |
| `Esc` | Back out: close a panel, leave flight, return to the landing page |
| `←` `→` | Previous / next planet, galaxy or nebula |

### Guided tour

Next, previous, pause/resume and exit are on the card. Dragging the view
pauses the tour; clicking a planet jumps to its stop.

### Free flight

| Desktop | Touch |
| --- | --- |
| `W` `A` `S` `D` or arrow keys: move | Joystick: move |
| Drag: look around | Drag anywhere: look around |
| `Space` / `Shift`: up / down | Up / down buttons |
| Mouse wheel: speed | − / + buttons: speed |
| `Esc`: exit | *Exit flight* |

Around a black hole, flight slows as you approach, and stops just outside
the horizon: crossing it is left to the guided descent.

### Black holes

| Input | Action |
| --- | --- |
| *Fly* | Free flight, with a live gauge of distance, clock rate and tide |
| *Enter* | Start the guided descent |
| Ring icon | Show the shadow edge, horizon grid and innermost stable orbit |
| `Space` (in the descent) | Pause or resume |
| Timeline and stage chips | Move anywhere along the descent |
| `Esc` or *Return to exterior* | Leave the descent |

With reduced motion the descent never moves on its own: you step through it.

### Phenomena lab

Each experience has its own dock: a timeline for the supernova, a spin rate
for the pulsar, *Go through* for the wormhole, mass chips and clicking the
grid for curved spacetime, and a slider with named stops for cosmic scale.

Looking around is drag-based rather than pointer lock, so the cursor
never disappears and `Esc` always reaches the app. Held keys are
released if the window loses focus or the tab is switched.

### Mission explorer

Search by name, target, agency or country; filter by agency, type and
status; sort by date. Cards open with `Enter`, move with the arrow keys,
and close with `Esc` — focus returns to the card you came from.

---

## Performance

The site picks a quality tier once, on load, from what the browser will
tell it: CPU threads, the device-memory hint where it exists, whether
the pointer is coarse, and how many pixels the display asks for. There
is no reliable way to identify a GPU from JavaScript, so this is a
conservative starting point rather than a measurement.

| Tier | Particles | Max resolution | Nebula detail |
| --- | --- | --- | --- |
| low | 45% | 1.0× | 55% |
| medium | 70% | 1.5× | 80% |
| high | 100% | 1.75× | 100% |

The tier also sets the ray tracer's budget: 44, 64 or 96 steps per ray, at
0.5×, 0.7× or 1× of the canvas resolution, with a 2K or 4K sky map, and the
star map's size: 45,000, 110,000 or 220,000 stars.

The tier scales the starfield, debris belt, galaxy point counts and
nebula sprite layers. Thinning spreads removals evenly through each
layer and slightly enlarges what remains, so a lower tier looks fainter
rather than patchy.

On top of that, resolution follows the frame rate: `PerformanceMonitor`
steps the pixel ratio down while frames are slow and back up when they
recover, between 0.75× and the tier's ceiling. The ray tracer adds its own
loop on top: its target shrinks when the frame rate falls below about 38 fps
and grows back above 55, so the heaviest scene degrades in sharpness first.

**Measured on the production build** (Chrome, Apple M4, 1440×900, served
locally). The solar system, galaxies, nebulae, black holes and supernova all
hold 60 frames per second. Throttled to
1.6 Mbps, the landing page is interactive before the 3D bundle has finished
downloading — it is gated by the intro sequence, not by WebGL. Repeated
scene switches do not grow the JS heap. Geometries are disposed on unmount;
baked textures are cached and reused for the page's lifetime. Phones and
integrated graphics have not been measured.

**Bundles.** The first load is 164 kB of gzipped JavaScript: application
code (22 kB), React (68 kB), Motion (46 kB) and GSAP (27 kB). Three.js and
its helpers are a separate 237 kB chunk that the landing page does not wait
for. Every library has its own chunk, so shipping a change to COSMOS does
not make returning visitors re-download any of them, and the mission
explorer, galaxy explorer and nebula explorer are chunks of their own.

There are no texture or model files to optimise: every surface is generated
on the GPU, so the only images in the build are the icons and the social
preview.

**Without WebGL** the site falls back to a CSS starfield and stays fully
usable — tested by denying WebGL contexts outright.

**If the GPU context is lost**, which phones do to background tabs, the
baked textures are redrawn when it returns. If it has not returned after
six seconds the site falls back to the same CSS starfield.

---

## Accuracy

**Solar system.** Every figure in the information panels — diameter,
distance, periods, temperature, moon counts — comes from the NASA
Planetary Fact Sheet and NASA Space Place, and lives in
`src/data/planets.js`. Moon counts are current as of mid-2026 and change
as new moons are confirmed. Planet sizes, orbital distances and speeds
are compressed for legibility; orbital speeds still follow Kepler's
third law applied to the compressed radii, so inner planets outrun outer
ones. Surfaces are generated, not photographed: Earth has oceans,
continents and clouds, but not Earth's actual geography.

**Galaxies and nebulae.** Facts come from NASA, Hubble and ESA; where
measurements differ, a range is given. Andromeda's description reflects
the 2025 *Nature Astronomy* study (Sawala et al.) that found roughly
even odds of a merger with the Milky Way within 10 billion years. The
models themselves are artistic reconstructions from published
descriptions.

**Missions.** Every figure, date and status was checked against NASA,
JPL, ISRO, ESA and JAXA pages in November 2026, and each mission lists
its sources. Statuses record *when* they were current (`statusAsOf`),
because they go out of date. Events that have not happened yet are
marked as planned.

**Catalogue.** Measurements are fetched from primary archives by
`scripts/build-catalogue.mjs`: planets and moons from JPL Solar System
Dynamics, small bodies from the JPL Small-Body Database, exoplanets from the
NASA Exoplanet Archive, and stars, galaxies, nebulae and clusters from SIMBAD.
A gap in the data stays a gap: `—` means the source gave nothing, and nothing
is filled in by guesswork. Where SIMBAD's median disagrees with a NASA
statement, or a value is missing, `src/data/catalogue/notes.js` records the
override and the reason, and the profile shows it. Distances of deep-sky
objects are medians of published values, so they can differ from individual
papers. Stellar radii are mostly missing, because SIMBAD's table rarely has
them in usable form.

**Illustrative, not measured.** The numbers in a profile are measurements.
Everything drawn around them is not to scale: map distances are logarithmic,
and system orbits, body sizes and speeds are compressed. Colours of exoplanets
are informed guesses from size and temperature, since none has been seen as
more than a point of light. "Temperate" is a simple test of size and
equilibrium temperature, not a claim of habitability. Background stars and
unnamed clusters are procedural: no point corresponds to a particular star.

**Black holes.** Sizes, shadows and redshifts come from the Schwarzschild
solution, so spin is left out, and with it the frame dragging and shifted
inner edge that real black holes have. Disc colours are representative: real
emission is mostly outside visible light. Measured figures follow the
references below. TON 618's mass is an indirect estimate and carries large
uncertainty. **The view below the horizon is an artistic impression**, not a
calculation or an observation, and the interface says so while it is shown.
The descent's playback is not real time, though its proper-time readings are
calculated. Hawking radiation is theoretical and has never been detected.

**Evidence labels.** *Observed* means directly measured or imaged. *Inferred*
means deduced from measurements. *Model* means a simulation or schematic.
*Theory* means predicted but unobserved, or hypothetical.

**Mission artwork** is original illustration drawn in code, labelled as
such in the interface, with a link to the agency's own image gallery
beside it. To use a real photograph instead, put the file in `public/`
and add a `photo` field to that mission in `src/data/missions.js`.

---

## Known limitations

- Discovery progress lives in one browser and is lost if site data is cleared.
- Tested only in Chrome, at simulated viewport sizes for phones and
  tablets. Safari, Firefox and physical devices are untested.
- Galaxies and nebulae are artistic models, not scientific
  reconstructions, and each galaxy rotates as one rigid body.
- The ray tracer assumes non-rotating black holes and a thin disc. The
  drifting motes around the disc are ordinary points, not lensed light, so
  they are kept out of the inner region.
- Exoplanet surfaces are invented: none has ever been imaged.
- Most stars have no radius in the catalogue, so sorting by radius mainly
  ranks planets and moons.
- Close-up views of a star are generic for its class, and binaries are drawn
  as a simple pair without orbital motion. Multiple-star systems such as
  Castor are shown as two stars.
- Rings on Uranus, Neptune, Jupiter and Haumea are faint stand-ins that reuse
  Saturn's ring profile.
- The Sun's planets in the Solar System scene and in the Universe are separate
  views. The dwarf planets and moons appear only in the Universe.
- Curved spacetime is an analogy, with depths compressed for comparison.
- Wormholes are hypothetical, and the far side's grid is invented.
- Carina's Homunculus is drawn larger than scale so it is visible, and
  the Crab's pulsar flash is slowed far below its real 30 Hz.
- Mission statuses will drift; `statusAsOf` says when each was checked.
- Free flight is bounded around each subject and has no collision — you
  can fly through a galaxy.
- Orbital speeds and body sizes are not to scale with each other.
- Fonts are loaded from Google Fonts, the one external runtime
  dependency. The system-font fallback is sound — the site was tested
  with the request blocked — but self-hosting would remove it: download
  the Space Grotesk and IBM Plex Mono `woff2` files into
  `public/fonts/`, declare them with `@font-face` in `src/index.css`,
  and drop the `<link>` tags and the font entries from the content
  security policy in `vercel.json`.
- `npm run lint` reports no errors and about 80 warnings. Nearly all are
  React Compiler hints about mutating refs from frame loops and event
  handlers, and calling `Math.random` in `useMemo`, both ordinary in React
  Three Fiber code.

---

## Scientific references

**Black holes.** EHT Collaboration 2022, Sagittarius A* Papers I and IV
([arXiv:2311.08680](https://arxiv.org/abs/2311.08680),
[arXiv:2311.08697](https://arxiv.org/abs/2311.08697)). EHT and M87*
([arXiv:1910.10193](https://arxiv.org/abs/1910.10193)). Miller-Jones et al.
2021, Cygnus X-1 ([arXiv:2102.09091](https://arxiv.org/abs/2102.09091)).

**Destinations.** NASA Hubble Messier catalogue for
[M104](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-104/),
[M16](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-16)
and [M57](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-57/);
NASA's [Webb image of the Sombrero](https://science.nasa.gov/missions/webb/hats-off-to-nasas-webb-sombrero-galaxy-dazzles-in-new-image/).

**Catalogue archives.** [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/),
[JPL Solar System Dynamics](https://ssd.jpl.nasa.gov/) and
[SIMBAD](https://simbad.cds.unistra.fr/simbad/) (queried through the CDS mirror
at Harvard). ESA's Gaia archive was unavailable when the data was fetched, and
the catalogue does not query it directly: SIMBAD's parallaxes largely derive
from Gaia.

**Phenomena.** NASA on [the neutron star in SN 1987A](https://science.nasa.gov/missions/webb/webb-finds-evidence-for-neutron-star-at-heart-of-young-supernova-remnant/);
the [NASA Exoplanet Catalog](https://science.nasa.gov/exoplanet-catalog/) for
every exoplanet; [NASA Cosmic Times](https://imagine.gsfc.nasa.gov/educators/programs/cosmictimes/educators/guide/age_size.html)
on the size of the universe. Each panel lists its own sources.

One source is weaker than the rest: TON 618's mass range comes from
Wikipedia's summary of primary papers, because the primary sources could not
be confirmed directly. Its panel says the estimate is uncertain.

---

## Licence and content

Code in this repository is the project's own. Astronomy and mission
facts are cited to NASA, ISRO, ESA, JAXA, Hubble and the papers named
above; the illustrations, generated textures and procedural models are
original work. No third-party photographs or models are bundled or
hot-linked.
