/**
 * The Phenomena lab: experiences built around one idea each, rather than one
 * object. `evidence` uses the same vocabulary as the black hole explorer, and
 * every description says plainly which parts are simulated or hypothetical.
 */

export const PHENOMENA_SCALE_NOTE = 'Simulations and models · not to scale unless stated · colours are representative'

export const SUPERNOVA_STAGES = [
  { at: 0, label: 'Red supergiant', caption: 'A massive star near the end of its life, swollen and cool on the outside. Deep inside, fusion has built up an iron core that cannot release any more energy.' },
  { at: 0.2, label: 'Core collapse', caption: 'Fusion stops, nothing supports the core, and it collapses in under a second. Protons and electrons merge into neutrons, releasing a flood of neutrinos.' },
  { at: 0.27, label: 'Shock breakout', caption: 'The collapse rebounds and a shock wave drives outward. When it reaches the surface, the star becomes briefly brighter than billions of stars.' },
  { at: 0.46, label: 'Expanding ejecta', caption: 'The outer layers fly apart at thousands of kilometres per second, carrying newly made elements into space.' },
  { at: 0.8, label: 'Remnant', caption: 'A glowing shell of debris surrounds what remains of the core: a neutron star or, for the heaviest stars, a black hole.' },
]

export const SCALE_STOPS = [
  { log: 7.2, label: 'Earth', detail: 'Our planet, about 12,700 km across.' },
  { log: 8.9, label: 'Moon’s orbit', detail: 'Light takes about 1.3 seconds to reach the Moon.' },
  { log: 12.9, label: 'Solar system', detail: 'Out to Neptune, about 30 times Earth’s distance from the Sun.' },
  { log: 17, label: 'Nearest stars', detail: 'Proxima Centauri lies about 4.2 light-years away.' },
  { log: 20.9, label: 'Milky Way', detail: 'About 100,000 light-years across.' },
  { log: 22.7, label: 'Local Group', detail: 'The Milky Way, Andromeda, Triangulum and dozens of small galaxies.' },
  { log: 26.65, label: 'Observable universe', detail: 'About 93 billion light-years across: bigger than 13.8 billion light-years because space has expanded while the light travelled.' },
]

/**
 * Stellar evolution. `star` gives colour temperature and on-screen radius
 * (radius is illustrative: real sizes span a factor of millions). `gas` is the
 * shape of the surrounding material: cloud, disc or shell. Lifetimes are
 * rounded textbook values for each mass range.
 */
const CLOUD = { id: 'cloud', label: 'Molecular cloud', gas: { shape: 'cloud', color: '#b078c8', radius: 30, brightness: 1 }, caption: 'Cold, dark clouds of hydrogen and dust. When a region grows dense enough, gravity beats gas pressure and it begins to collapse.' }
const PROTOSTAR = { id: 'protostar', label: 'Protostar', star: { t: 3200, r: 3.4 }, gas: { shape: 'disc', color: '#d9823f', radius: 22 }, caption: 'A collapsing core heats up as gravity squeezes it, wrapped in a spinning disc of gas. It shines from gravitational energy, before fusion starts.' }

export const LIFE_PATHS = {
  low: {
    label: 'Red dwarf',
    range: 'Under about 0.5 Suns',
    stages: [
      CLOUD,
      PROTOSTAR,
      { id: 'main', label: 'Red dwarf', star: { t: 3000, r: 2.6 }, caption: 'A small, cool star fusing hydrogen very slowly. Red dwarfs are the most common stars, and they burn for hundreds of billions of years or more.' },
      { id: 'future', label: 'The far future', star: { t: 9000, r: 1 }, caption: 'Models predict a slow fade into a white dwarf. No red dwarf has reached this stage: the universe is too young. This stage is theory only.', theory: true },
    ],
  },
  sun: {
    label: 'Sun-like star',
    range: 'About 0.5–8 Suns',
    stages: [
      CLOUD,
      PROTOSTAR,
      { id: 'main', label: 'Main sequence', star: { t: 5772, r: 4 }, caption: 'Hydrogen fuses into helium in the core, and the outward pressure balances gravity. The Sun will stay here for about 10 billion years in all.' },
      { id: 'giant', label: 'Red giant', star: { t: 3600, r: 11 }, caption: 'With hydrogen gone from the core, the core shrinks and the outer layers swell and cool. The Sun will grow to roughly the size of Earth’s orbit.' },
      { id: 'nebula', label: 'Planetary nebula', star: { t: 30000, r: 1 }, gas: { shape: 'shell', color: '#58d6c0', radius: 26 }, caption: 'The star gently sheds its outer layers, and the hot exposed core lights them up. It has nothing to do with planets: the name is a historical accident.' },
      { id: 'dwarf', label: 'White dwarf', star: { t: 20000, r: 0.9 }, caption: 'A hot, Earth-sized core with no fusion left. It will cool slowly for an immensely long time.' },
    ],
  },
  massive: {
    label: 'Massive star',
    range: 'About 8–25 Suns',
    stages: [
      CLOUD,
      PROTOSTAR,
      { id: 'main', label: 'Blue main sequence', star: { t: 26000, r: 6 }, caption: 'Hot, blue and extremely luminous. Such a star burns its fuel in only millions of years.' },
      { id: 'giant', label: 'Red supergiant', star: { t: 3500, r: 15 }, caption: 'It fuses heavier and heavier elements in nested shells, until the core is iron, which can release no more energy.' },
      { id: 'supernova', label: 'Supernova', star: { t: 12000, r: 3 }, gas: { shape: 'shell', color: '#ff9a4a', radius: 40 }, caption: 'The iron core collapses in under a second and rebounds, blasting the star apart and seeding space with heavy elements.' },
      { id: 'neutron', label: 'Neutron star', star: { t: 40000, r: 0.55 }, gas: { shape: 'shell', color: '#7f9ae0', radius: 46 }, caption: 'The core survives as a ball of neutrons about 20 km across. If it spins with its beams towards us, we see a pulsar.' },
    ],
  },
  giant: {
    label: 'Very massive star',
    range: 'Above about 25 Suns',
    stages: [
      CLOUD,
      PROTOSTAR,
      { id: 'main', label: 'Blue giant', star: { t: 38000, r: 8 }, caption: 'Among the rarest and brightest stars, with lives of only a few million years.' },
      { id: 'giant', label: 'Supergiant', star: { t: 9000, r: 15 }, caption: 'Fierce winds strip the star of much of its mass as it nears the end.' },
      { id: 'supernova', label: 'Collapse', star: { t: 12000, r: 3 }, gas: { shape: 'shell', color: '#ff7a4a', radius: 38 }, caption: 'The core collapses. Depending on mass, there may be a supernova, or much of the star may fall straight inward.' },
      { id: 'hole', label: 'Black hole', hole: true, gas: { shape: 'disc', color: '#ff9a4a', radius: 16 }, caption: 'No known force can stop the collapse. See the Black Holes section for a ray-traced view; this one is a simple diagram.' },
    ],
  },
}

export const MASS_TYPES = {
  planet: { label: 'Planet', mass: 0.5, width: 3.2, radius: 0.5, color: '#6fb6ff' },
  star: { label: 'Star', mass: 2.2, width: 2.6, radius: 1.05, color: '#ffd28a' },
  neutron: { label: 'Neutron star', mass: 4, width: 1.2, radius: 0.34, color: '#bcd6ff' },
  hole: { label: 'Black hole', mass: 7.5, width: 0.7, radius: 0.5, color: '#05060c' },
}

export const PHENOMENA = [
  {
    id: 'supernova',
    name: 'Supernova',
    fullName: 'Core-collapse supernova',
    color: '#ff8a3d',
    category: 'Simulation · stellar death',
    kind: 'supernova',
    evidence: 'model',
    description:
      'How the most massive stars die, compressed from days and years into a minute. Use the timeline to move through each stage. The sequence follows the standard core-collapse picture, confirmed in outline by neutrinos detected from SN 1987A.',
    facts: [
      { label: 'Trigger', value: 'An iron core that can no longer support itself' },
      { label: 'Best-studied example', value: 'SN 1987A, about 160,000 light-years away' },
      { label: 'Neutrinos', value: 'A burst of about 10 seconds, detected in 1987' },
      { label: 'What remains', value: 'A neutron star or a black hole' },
    ],
    note: 'Simulated and heavily sped up. In 2024 Webb found the best evidence yet for a neutron star inside SN 1987A.',
    sources: [
      { label: 'NASA: Webb and the neutron star in SN 1987A', url: 'https://science.nasa.gov/missions/webb/webb-finds-evidence-for-neutron-star-at-heart-of-young-supernova-remnant/' },
      { label: 'NASA HEASARC: the collapsed core of SN 1987A', url: 'https://heasarc.gsfc.nasa.gov/docs/objects/heapow/archive/compact_objects/sn1987a_jwst_cxo.html' },
    ],
    pose: { position: [0, 16, 118], target: [0, 0, 0] },
    minDistance: 18,
    maxDistance: 260,
  },
  {
    id: 'pulsar',
    name: 'Neutron Star',
    fullName: 'Pulsar',
    color: '#8fc4ff',
    category: 'Model · stellar remnant',
    kind: 'pulsar',
    evidence: 'model',
    description:
      'The crushed core left by a supernova: more than the Sun’s mass in a ball about the size of a city. Its magnetic axis is tilted from its spin axis, so radio beams sweep around like a lighthouse. Seen from Earth, that is a pulsar.',
    facts: [
      { label: 'Diameter', value: 'About 20 km' },
      { label: 'Mass', value: 'About 1–2 Suns' },
      { label: 'Magnetic field', value: 'Up to trillions of times Earth’s' },
      { label: 'Crab pulsar spin', value: 'About 30 turns per second' },
    ],
    note: 'Rotation is slowed for viewing, and the magnetic field is drawn as an idealised dipole.',
    sources: [
      { label: 'Chandra: neutron star infographic', url: 'https://chandra.cfa.harvard.edu/graphics/resources/illustrations/neutron_infograph.pdf' },
      { label: 'NASA Goddard: an introduction to neutron stars', url: 'https://asd.gsfc.nasa.gov/Tod.Strohmayer/ns_intro.html' },
    ],
    pose: { position: [14, 7, 34], target: [0, 0, 0] },
    minDistance: 6,
    maxDistance: 90,
  },
  {
    id: 'wormhole',
    name: 'Wormhole',
    fullName: 'Ellis wormhole',
    color: '#b9a3ff',
    category: 'Hypothetical · ray-traced',
    kind: 'wormhole',
    evidence: 'theory',
    description:
      'A solution of Einstein’s equations with no known real counterpart. Holding one open would take exotic matter with negative energy density, which is not known to exist in useful amounts. The view is computed by tracing light through the Ellis geometry; the far side’s grid is an invention, added so you can see the distortion.',
    facts: [
      { label: 'Status', value: 'Hypothetical: none has ever been observed' },
      { label: 'Early idea', value: 'Einstein–Rosen bridge, 1935: not traversable' },
      { label: 'Traversable model', value: 'Morris and Thorne, 1988' },
      { label: 'The catch', value: 'Requires exotic matter to stay open' },
    ],
    note: 'Light paths are calculated, but nothing here depicts a real object. Travelling through one is purely imaginary.',
    sources: [
      { label: 'Review: macroscopic traversable wormholes', url: 'https://arxiv.org/html/2409.16184v1' },
    ],
    pose: { position: [3, 2, 13], target: [0, 0, 0] },
    minDistance: 3.2,
    maxDistance: 40,
  },
  {
    id: 'spacetime',
    name: 'Curved Spacetime',
    fullName: 'Curved spacetime',
    color: '#22d3ee',
    category: 'Interactive model',
    kind: 'spacetime',
    evidence: 'model',
    description:
      'Choose a mass, then click the grid to place it. Compact objects dig narrow, deep wells: a neutron star bends space far more sharply than a star of similar mass because you can get so much closer to it.',
    facts: [
      { label: 'The idea', value: 'Mass and energy tell spacetime how to curve' },
      { label: 'Tested by', value: 'Starlight bending, GPS clocks, gravitational waves' },
      { label: 'What this shows', value: 'An analogy for curvature, in one fewer dimension' },
    ],
    note: 'An illustrative analogy: real curvature cannot be drawn this simply, and depths here are compressed for comparison.',
    pose: { position: [0, 19, 27], target: [0, -1, 0] },
    minDistance: 8,
    maxDistance: 70,
  },
  {
    id: 'scale',
    name: 'Cosmic Scale',
    fullName: 'Cosmic scale',
    color: '#ffd28a',
    category: 'Interactive model',
    kind: 'scale',
    evidence: 'model',
    description:
      'Twenty orders of magnitude on one slider, from Earth to the edge of what we can see. Each step along the slider multiplies the view by the same factor, because nothing else can hold these distances together.',
    facts: [
      { label: 'Earth', value: 'About 12,700 km across' },
      { label: 'Milky Way', value: 'About 100,000 light-years across' },
      { label: 'Observable universe', value: 'About 93 billion light-years across' },
    ],
    note: 'Each layer is a schematic model at its own true size relative to the view. The cosmic web is procedural.',
    sources: [
      { label: 'NASA Cosmic Times: age and size of the universe', url: 'https://imagine.gsfc.nasa.gov/educators/programs/cosmictimes/educators/guide/age_size.html' },
    ],
    pose: { position: [0, 3, 32], target: [0, 0, 0] },
    minDistance: 18,
    maxDistance: 60,
  },
  {
    id: 'life-cycle',
    name: 'Life of a Star',
    fullName: 'The life of a star',
    color: '#ffd28a',
    category: 'Interactive model',
    kind: 'lifecycle',
    evidence: 'model',
    description:
      'A star’s mass decides almost everything about how it lives and dies. Choose a mass, then step through each stage. Each stage has been observed in other stars, apart from the end of a red dwarf’s life, which is still in the future.',
    facts: [
      { label: 'Decided by', value: 'Mostly the star’s initial mass' },
      { label: 'The Sun', value: 'About 4.6 billion years old' },
      { label: 'Heaviest stars', value: 'Live for only a few million years' },
    ],
    note: 'Sizes on screen are illustrative, and mass boundaries between paths are approximate.',
    sources: [{ label: 'NASA: stars', url: 'https://science.nasa.gov/universe/stars/' }],
    pose: { position: [0, 9, 62], target: [0, 0, 0] },
    minDistance: 10,
    maxDistance: 140,
  },
  {
    id: 'trappist-1e',
    name: 'TRAPPIST-1 e',
    fullName: 'TRAPPIST-1 e',
    color: '#7fd3a0',
    category: 'Exoplanet · rocky',
    kind: 'exoplanet',
    evidence: 'model',
    description:
      'One of seven rocky planets around a cool red dwarf, and among the best-placed for liquid water. Whether it has an atmosphere at all is still an open question, so the world shown here is one possibility, not a picture.',
    facts: [
      { label: 'Distance', value: 'About 40 light-years' },
      { label: 'Radius', value: 'About 0.92 Earth' },
      { label: 'Year', value: 'About 6.1 days' },
      { label: 'Orbit', value: '0.029 AU from a cool red dwarf' },
      { label: 'Habitable zone', value: 'Inside it' },
    ],
    note: 'Artist-style model: no exoplanet surface has ever been imaged.',
    sources: [{ label: 'NASA Exoplanet Catalog', url: 'https://science.nasa.gov/exoplanet-catalog/trappist-1-e/' }],
    world: { id: 'trappist-1e', surface: 'terrestrial', seed: 1.9, palette: ['#1d4a6b', '#6a5a44', '#dfe6ea'], atmosphere: '#7fb6ff', atmosphereGlow: 1.1, star: '#ff8a5c', starSize: 26 },
    pose: { position: [0, 2, 24], target: [0, 0, 0] },
    minDistance: 10,
    maxDistance: 60,
  },
  {
    id: 'proxima-b',
    name: 'Proxima b',
    fullName: 'Proxima Centauri b',
    color: '#c9a27a',
    category: 'Exoplanet · nearest known',
    kind: 'exoplanet',
    evidence: 'model',
    description:
      'The closest known exoplanet, orbiting the nearest star to the Sun. It sits in its star’s habitable zone, but the star is a flaring red dwarf whose outbursts may strip any atmosphere away.',
    facts: [
      { label: 'Distance', value: 'About 4.2 light-years' },
      { label: 'Radius', value: 'About 1 Earth (estimated)' },
      { label: 'Year', value: 'About 11.2 days' },
      { label: 'Orbit', value: '0.048 AU from a red dwarf' },
      { label: 'Habitable zone', value: 'Inside it' },
    ],
    note: 'Its radius is estimated: the planet has not been seen to cross its star. The surface shown is hypothetical.',
    sources: [{ label: 'NASA Exoplanet Catalog', url: 'https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/' }],
    world: { id: 'proxima-b', surface: 'rocky', seed: 3.3, palette: ['#4a3a30', '#8a6a4c', '#c8b49a'], atmosphere: '#ffb68a', atmosphereGlow: 0.35, star: '#ff7a4d', starSize: 34 },
    pose: { position: [8, 3, 22], target: [0, 0, 0] },
    minDistance: 10,
    maxDistance: 60,
  },
  {
    id: '55-cancri-e',
    name: '55 Cancri e',
    fullName: '55 Cancri e',
    color: '#ff5a2e',
    category: 'Exoplanet · lava world',
    kind: 'exoplanet',
    evidence: 'model',
    description:
      'A super-Earth so close to its star that a year lasts under a day. It is far too hot for liquid water, and is usually pictured with a molten surface. Shown here is that interpretation.',
    facts: [
      { label: 'Distance', value: 'About 40 light-years' },
      { label: 'Radius', value: 'About 1.88 Earth' },
      { label: 'Year', value: 'About 0.7 days' },
      { label: 'Orbit', value: '0.015 AU from its star' },
      { label: 'Habitable zone', value: 'Far inside it: much too hot' },
    ],
    note: 'Artist-style model based on NASA’s description. No surface has been imaged.',
    sources: [{ label: 'NASA Exoplanet Catalog', url: 'https://science.nasa.gov/exoplanet-catalog/55-cancri-e/' }],
    world: { id: '55-cancri-e', surface: 'rocky', seed: 5.1, palette: ['#2a0e08', '#c8401a', '#ffb24a'], atmosphere: '#ff7a3a', atmosphereGlow: 0.9, star: '#ffd9a0', starSize: 58, emissive: 0.85 },
    pose: { position: [-9, 2, 22], target: [0, 0, 0] },
    minDistance: 10,
    maxDistance: 60,
  },
  {
    id: 'hd-189733-b',
    name: 'HD 189733 b',
    fullName: 'HD 189733 b',
    color: '#4f8fe8',
    category: 'Exoplanet · hot Jupiter',
    kind: 'exoplanet',
    evidence: 'model',
    description:
      'The closest hot Jupiter to Earth: a gas giant slightly larger than Jupiter, circling its star in just over two days. Its deep blue colour has been measured, not guessed, using how it dims its star’s light.',
    facts: [
      { label: 'Distance', value: 'About 63 light-years' },
      { label: 'Radius', value: 'About 1.13 Jupiter' },
      { label: 'Year', value: 'About 2.2 days' },
      { label: 'Orbit', value: '0.031 AU from its star' },
      { label: 'Habitable zone', value: 'Far inside it: much too hot' },
    ],
    note: 'Banding is illustrative.',
    sources: [
      { label: 'NASA Exoplanet Catalog', url: 'https://science.nasa.gov/exoplanet-catalog/hd-189733-b/' },
      { label: 'NASA: Exoplanet HD 189733b', url: 'https://www.nasa.gov/image-article/exoplanet-hd-189733b/' },
    ],
    world: { id: 'hd-189733-b', surface: 'banded', seed: 7.7, palette: ['#123a8a', '#3f7fe0', '#b8d4ff'], atmosphere: '#7fb0ff', atmosphereGlow: 1.2, star: '#ffe2b8', starSize: 46 },
    pose: { position: [4, 5, 25], target: [0, 0, 0] },
    minDistance: 10,
    maxDistance: 60,
  },
]

export const PHENOMENA_BY_ID = Object.fromEntries(PHENOMENA.map((entry) => [entry.id, entry]))
