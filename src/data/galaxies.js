/**
 * Galaxy explorer data.
 *
 * `facts` are published figures (NASA, Hubble, and the 2025 Nature
 * Astronomy study by Sawala et al. on the Milky Way-Andromeda encounter).
 * Where measurements disagree, the range is given rather than one number.
 *
 * `model` drives the procedural representation: 1 scene unit = 1,000
 * light-years, so the three galaxies are shown at their true relative
 * sizes. Arm shapes, star placement and colours are an artistic model, not
 * a map of individual stars.
 */

const PI = Math.PI

export const GALAXY_SCALE_NOTE =
  'Procedural model · 1 unit = 1,000 light-years · tens of thousands of points stand in for billions of stars'

const CORE_GALAXIES = [
  {
    id: 'milky-way',
    name: 'Milky Way',
    color: '#9fc2ff',
    category: 'Barred spiral · SBbc',
    description:
      'Our home galaxy: a barred spiral disc of gas, dust and several hundred billion stars, with the Sun about halfway out from the centre. No one has seen it from outside; this view is a model built from maps of its bar and arms.',
    facts: [
      { label: 'Diameter', value: 'About 100,000 light-years' },
      { label: 'Stars', value: 'An estimated 100–400 billion' },
      { label: 'Sun to centre', value: 'About 26,000 light-years' },
      { label: 'Central black hole', value: 'Sagittarius A*, about 4 million Suns' },
      { label: 'Sun’s orbit', value: 'About 230 million years per lap' },
    ],
    note: 'Marker shows the Sun’s approximate position.',
    pose: { position: [0, 26, 118], target: [0, 0, 0] },
    minDistance: 20,
    maxDistance: 420,
    model: {
      seed: 9001,
      radius: 50,
      scaleLength: 13,
      thickness: 0.9,
      pointScale: 1,
      bulge: { count: 9000, radius: 4.2, flatten: 0.6 },
      bar: { count: 8000, length: 28, width: 0.16, angle: 0.45 },
      arms: [
        { offset: 0.45, weight: 1 },
        { offset: 0.45 + PI, weight: 1 },
        { offset: 0.45 + PI / 2, weight: 0.45 },
        { offset: 0.45 + (3 * PI) / 2, weight: 0.45 },
      ],
      armStart: 14,
      pitch: 12.5,
      armWidth: 4.6,
      armFraction: 0.55,
      diskCount: 56000,
      dust: { count: 7000, offset: 0.12, width: 1.8 },
      knots: { count: 360 },
      palette: {
        core: '#ffe2b4',
        bulge: '#ffbe7e',
        disk: '#f1e3cb',
        arm: '#a9c8ff',
        young: '#cfe0ff',
        dust: '#24160f',
        hii: '#ff6fa8',
        blueKnot: '#9fc2ff',
      },
      coreGlow: { size: 30, color: '#ffcf96', intensity: 0.5 },
      rotation: [PI / 2 - 0.95, 0, 0.35],
      sunMarker: { radius: 26, armIndex: 0, offset: 0.55 },
    },
  },
  {
    id: 'andromeda',
    name: 'Andromeda',
    fullName: 'Andromeda Galaxy (M31)',
    color: '#ffd6a0',
    category: 'Spiral · SA(s)b',
    description:
      'The nearest large galaxy to our own and the most distant object most people can see without a telescope. It is moving towards the Milky Way, but a 2025 study using Hubble and Gaia data put the chance of a merger within the next 10 billion years at only about 50%.',
    facts: [
      { label: 'Distance', value: 'About 2.5 million light-years' },
      { label: 'Diameter', value: 'About 150,000–220,000 light-years, depending on where the edge is drawn' },
      { label: 'Stars', value: 'Roughly 1 trillion (estimate)' },
      { label: 'Companions shown', value: 'Dwarf galaxies M32 and M110' },
    ],
    note: 'Tilted about 77° from face-on, as we see it from Earth. Companion positions are approximate.',
    pose: { position: [0, 8, 230], target: [0, 0, 0] },
    minDistance: 40,
    maxDistance: 700,
    model: {
      seed: 31,
      radius: 110,
      scaleLength: 22,
      thickness: 1.6,
      pointScale: 1.7,
      bulge: { count: 16000, radius: 9, flatten: 0.75 },
      bar: null,
      arms: [
        { offset: 0, weight: 1 },
        { offset: PI, weight: 1 },
      ],
      armStart: 18,
      pitch: 7.5,
      armWidth: 7.5,
      armFraction: 0.5,
      diskCount: 64000,
      ring: { radius: 50, width: 4, count: 6000 },
      dust: { count: 9000, offset: 0.1, width: 2.6 },
      knots: { count: 420 },
      palette: {
        core: '#ffe8bf',
        bulge: '#ffc58a',
        disk: '#efe2cc',
        arm: '#b6cdfa',
        young: '#d6e4ff',
        dust: '#20130d',
        hii: '#ff7ab0',
        blueKnot: '#a8c6ff',
      },
      coreGlow: { size: 62, color: '#ffd6a0', intensity: 0.55 },
      rotation: [0.227, 0, -0.62],
      companions: [
        { name: 'M32', position: [16, 9, 26], radius: 3, count: 2600, flatten: 0.8, color: '#ffd9a8', glow: 9 },
        { name: 'M110', position: [-46, -14, -58], radius: 7, count: 3800, flatten: 0.55, color: '#f6dcb6', glow: 15 },
      ],
    },
  },
  {
    id: 'whirlpool',
    name: 'Whirlpool',
    fullName: 'Whirlpool Galaxy (M51)',
    color: '#ff8fbf',
    category: 'Spiral · SA(s)bc pec',
    description:
      'A face-on spiral whose two sharply defined arms are thought to have been stirred up by its smaller companion, NGC 5195, which passed through its disc a few hundred million years ago. It was the first galaxy recognised as a spiral, by Lord Rosse in 1845.',
    facts: [
      { label: 'Distance', value: 'About 23–31 million light-years (estimates vary by method)' },
      { label: 'Diameter', value: 'About 77,000 light-years' },
      { label: 'Companion', value: 'NGC 5195, a dwarf galaxy at the tip of one arm' },
      { label: 'Structure', value: 'Grand-design spiral: two long, well-defined arms' },
      { label: 'Constellation', value: 'Canes Venatici' },
    ],
    note: 'Seen almost face-on, as from Earth.',
    pose: { position: [6, 4, 96], target: [4, 2, 0] },
    minDistance: 15,
    maxDistance: 340,
    model: {
      seed: 51,
      radius: 38,
      scaleLength: 10,
      thickness: 0.8,
      pointScale: 1,
      bulge: { count: 5000, radius: 2.6, flatten: 0.7 },
      bar: null,
      arms: [
        { offset: 0, weight: 1 },
        { offset: PI, weight: 1 },
      ],
      armStart: 4,
      pitch: 19,
      armWidth: 3.6,
      armFraction: 0.68,
      diskCount: 44000,
      dust: { count: 6000, offset: 0.14, width: 1.2 },
      knots: { count: 600 },
      palette: {
        core: '#ffe8c4',
        bulge: '#ffcf96',
        disk: '#efe4d2',
        arm: '#b2ccff',
        young: '#dbe7ff',
        dust: '#221410',
        hii: '#ff5f9e',
        blueKnot: '#a6c6ff',
      },
      coreGlow: { size: 18, color: '#ffd9a8', intensity: 0.5 },
      rotation: [PI / 2 - 0.32, 0, 0.2],
      companions: [
        {
          name: 'NGC 5195',
          armTip: { arm: 0, radiusFactor: 1.22 },
          lift: -3,
          radius: 5.5,
          count: 6500,
          flatten: 0.7,
          color: '#ffd7a0',
          glow: 16,
          bridge: 2400,
        },
      ],
    },
  },
  {
    id: 'sombrero',
    name: 'Sombrero',
    fullName: 'Sombrero Galaxy (M104)',
    color: '#ffd59a',
    category: 'Edge-on spiral · Sa',
    description:
      'Seen almost exactly edge-on, this galaxy pairs an enormous glowing bulge with a sharp ring of dust, like a brimmed hat. It carries about ten times as many globular star clusters as the Milky Way, shown here as tight knots around it.',
    facts: [
      { label: 'Distance', value: 'About 28–30 million light-years' },
      { label: 'Diameter', value: 'About 50,000 light-years' },
      { label: 'Central black hole', value: 'About 1 billion Suns' },
      { label: 'Globular clusters', value: 'Nearly 2,000' },
    ],
    note: 'Webb’s infrared view resolved clumps in the outer dust ring that look smooth in visible light.',
    sources: [
      { label: 'NASA Hubble Messier catalogue: M104', url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-104/' },
      { label: 'NASA: Webb’s view of the Sombrero', url: 'https://science.nasa.gov/missions/webb/hats-off-to-nasas-webb-sombrero-galaxy-dazzles-in-new-image/' },
    ],
    pose: { position: [0, 5, 62], target: [0, 0, 0] },
    minDistance: 12,
    maxDistance: 240,
    model: {
      seed: 104,
      radius: 25,
      scaleLength: 8,
      thickness: 0.7,
      pointScale: 1,
      bulge: { count: 42000, radius: 7.4, flatten: 0.72 },
      bar: null,
      arms: [
        { offset: 0, weight: 1 },
        { offset: PI, weight: 1 },
      ],
      armStart: 12,
      pitch: 6,
      armWidth: 2.6,
      armFraction: 0.3,
      diskCount: 24000,
      dust: { count: 500, offset: 0.1, width: 1 },
      dustRing: { radius: 18.5, width: 1.5, height: 0.34, count: 12000 },
      globulars: { clusters: 150, radius: 46, starsEach: 26 },
      knots: { count: 60 },
      palette: {
        core: '#fff0d4',
        bulge: '#ffd7a0',
        disk: '#f3dcb8',
        arm: '#e8d2b0',
        young: '#f1e3cc',
        dust: '#140b07',
        hii: '#ff9a7a',
        blueKnot: '#cfdcff',
      },
      coreGlow: { size: 30, color: '#ffe0b0', intensity: 0.55 },
      rotation: [0.11, 0, -0.1],
    },
  },
  {
    id: 'triangulum',
    name: 'Triangulum',
    fullName: 'Triangulum Galaxy (M33)',
    color: '#ff7fb0',
    category: 'Flocculent spiral · Scd',
    description:
      'The third-largest member of our Local Group, with no bar, hardly any bulge, and patchy arms crowded with pink star-forming regions. It is one of the most distant objects a sharp-eyed observer can see without a telescope.',
    facts: [
      { label: 'Distance', value: 'About 2.4–3.1 million light-years' },
      { label: 'Diameter', value: 'Over 50,000 light-years' },
      { label: 'Stars', value: 'Estimated at tens of billions' },
      { label: 'Group', value: 'Third-largest in the Local Group' },
    ],
    note: 'Distance estimates vary by method; the range covers most published values.',
    sources: [
      { label: 'NASA APOD: Messier 33', url: 'https://science.nasa.gov/image-article/apod-2026-september-18-messier-33-the-triangulum-galaxy/' },
    ],
    pose: { position: [0, 42, 62], target: [0, 0, 0] },
    minDistance: 14,
    maxDistance: 260,
    model: {
      seed: 33,
      radius: 30,
      scaleLength: 9,
      thickness: 0.55,
      pointScale: 1,
      bulge: { count: 1100, radius: 1.3, flatten: 0.8 },
      bar: null,
      arms: [
        { offset: 0.2, weight: 1 },
        { offset: 1.3, weight: 0.7 },
        { offset: 2.4, weight: 0.85 },
        { offset: 3.5, weight: 1 },
        { offset: 4.5, weight: 0.65 },
        { offset: 5.5, weight: 0.8 },
      ],
      armStart: 3,
      pitch: 24,
      armWidth: 5.2,
      armFraction: 0.5,
      diskCount: 42000,
      dust: { count: 3000, offset: 0.15, width: 2.6 },
      knots: { count: 1500 },
      palette: {
        core: '#ffeccb',
        bulge: '#ffd7a8',
        disk: '#cfd9f2',
        arm: '#b7cdf8',
        young: '#d5e4ff',
        dust: '#1a1214',
        hii: '#ff4f93',
        blueKnot: '#9dc0ff',
      },
      coreGlow: { size: 8, color: '#ffe6c4', intensity: 0.22 },
      rotation: [0.46, 0, 0.3],
    },
  },
]

/**
 * The wider catalogue, as compact recipes: each changes only what makes that
 * galaxy itself. Distances are NASA's where stated, otherwise SIMBAD's median
 * of published values. Model sizes are approximate.
 */
const HUBBLE = (number) => ({
  label: `NASA Hubble Messier catalogue: M${number}`,
  url: `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-${number}/`,
})
const SIMBAD = { label: 'SIMBAD (CDS)', url: 'https://simbad.cds.unistra.fr/simbad/' }
const MODEL_NOTE = 'Procedural model at approximate size.'

const twoArms = (offset = 0) => [
  { offset, weight: 1 },
  { offset: offset + PI, weight: 1 },
]

const spiralPalette = {
  core: '#ffe8c4',
  bulge: '#ffcf96',
  disk: '#e6dfd2',
  arm: '#b2ccff',
  young: '#dbe7ff',
  dust: '#221410',
  hii: '#ff5f9e',
  blueKnot: '#a6c6ff',
}

const oldPalette = { ...spiralPalette, disk: '#f2d8ae', arm: '#ecd2a8', young: '#f4e2c4', hii: '#ffb08a', blueKnot: '#ffd8b0' }

function recipe({ id, name, fullName, color, category, description, facts, radius, sources, rotation = [0.5, 0, 0.2], view = 1.25, tilt = 0.35, ...model }) {
  const reach = Math.max(radius, 12) * 2.3 * view
  return {
    id,
    name,
    fullName: fullName ?? name,
    color,
    category,
    description,
    facts,
    note: MODEL_NOTE,
    sources: [...(sources ?? []), SIMBAD],
    pose: { position: [0, reach * tilt, reach], target: [0, 0, 0] },
    minDistance: Math.max(4, radius * 0.25),
    maxDistance: reach * 3,
    model: {
      seed: id.length * 977 + radius * 13,
      radius,
      scaleLength: radius * 0.27,
      thickness: Math.max(0.2, radius * 0.018),
      pointScale: 1,
      bar: null,
      armStart: radius * 0.1,
      pitch: 16,
      armWidth: radius * 0.09,
      armFraction: 0.6,
      diskCount: 42000,
      bulge: { count: 5000, radius: radius * 0.07, flatten: 0.7 },
      arms: twoArms(),
      dust: { count: 3000, offset: 0.14, width: radius * 0.03 },
      knots: { count: 500 },
      palette: spiralPalette,
      coreGlow: { size: radius * 0.42, color: '#ffe0b8', intensity: 0.4 },
      rotation,
      ...model,
    },
  }
}

export const GALAXIES = [
  ...CORE_GALAXIES,
  recipe({
    id: 'pinwheel', name: 'Pinwheel', fullName: 'Pinwheel Galaxy (M101)', color: '#8fb7ff', category: 'Face-on spiral · Scd', radius: 85, sources: [HUBBLE(101)],
    description: 'A huge, face-on spiral whose arms are lopsided, probably from past encounters with its smaller neighbours. Its arms are thick with star-forming regions.',
    facts: [{ label: 'Distance', value: 'About 21–23 million light-years' }, { label: 'Type', value: 'Spiral, seen face-on' }],
    arms: [{ offset: 0, weight: 1 }, { offset: 1.5, weight: 0.65 }, { offset: 3.3, weight: 1 }, { offset: 4.8, weight: 0.5 }],
    pitch: 26, knots: { count: 1300 }, rotation: [0.12, 0, 0.3], tilt: 0.75, view: 0.62,
  }),
  recipe({
    id: 'lmc', name: 'Large Magellanic Cloud', color: '#ffc4dd', category: 'Satellite galaxy · irregular', radius: 7, view: 1.8,
    description: 'The Milky Way’s brightest satellite, visible from the southern hemisphere. It has an off-centre bar, no organised arms, and in the Tarantula Nebula the most active star-forming region in the Local Group.',
    facts: [{ label: 'Distance', value: 'About 163,000 light-years' }, { label: 'Type', value: 'Barred irregular' }, { label: 'Famous for', value: 'SN 1987A and the Tarantula Nebula' }],
    arms: [{ offset: 0, weight: 1 }], armFraction: 0.1, diskCount: 16000, bulge: { count: 300, radius: 0.3, flatten: 0.6 },
    bar: { count: 9000, length: 6, width: 0.2, angle: 0.5 }, clumps: { count: 14, spread: 3.4, starsEach: 460 }, knots: { count: 60 }, rotation: [0.4, 0, 0.1], pointScale: 0.22,
    coreGlow: { size: 2, color: '#ffe0b8', intensity: 0.12 },
  }),
  recipe({
    id: 'smc', name: 'Small Magellanic Cloud', color: '#d8c8ff', category: 'Satellite galaxy · dwarf irregular', radius: 3.6, view: 2.4,
    description: 'A smaller companion of the Milky Way and of the Large Magellanic Cloud, joined to it by a bridge of gas and stars. It has been pulled out of shape by both.',
    facts: [{ label: 'Distance', value: 'About 196,000 light-years' }, { label: 'Type', value: 'Dwarf irregular' }],
    arms: [{ offset: 0, weight: 1 }], armFraction: 0.05, diskCount: 9000, bulge: { count: 200, radius: 0.2, flatten: 0.7 },
    bar: { count: 5000, length: 3.4, width: 0.32, angle: 1 }, clumps: { count: 8, spread: 1.7, starsEach: 340 }, knots: { count: 20 }, rotation: [0.7, 0.3, 0.4], pointScale: 0.14,
    coreGlow: { size: 1, color: '#e0d0ff', intensity: 0.1 },
  }),
  recipe({
    id: 'cartwheel', name: 'Cartwheel', fullName: 'Cartwheel Galaxy', color: '#7fb0ff', category: 'Ring galaxy', radius: 72, view: 1.05,
    description: 'A smaller galaxy plunged through this one, and the collision is rippling outward like a stone dropped in water. The bright outer ring is a wave of new stars, joined to the core by faint spokes.',
    facts: [{ label: 'Distance', value: 'About 400–500 million light-years' }, { label: 'Formed by', value: 'A head-on collision with a smaller galaxy' }],
    armFraction: 0, diskCount: 4000, bulge: { count: 9000, radius: 6, flatten: 0.8 }, ring: { radius: 66, width: 3.4, count: 26000 },
    spokes: { count: 7000, lanes: 16, reach: 62 }, dust: { count: 100, offset: 0.1, width: 2 }, knots: { count: 0 }, rotation: [0.42, 0, 0.1],
  }),
  recipe({
    id: 'black-eye', name: 'Black Eye', fullName: 'Black Eye Galaxy (M64)', color: '#c8a27a', category: 'Spiral', radius: 26, sources: [HUBBLE(64)],
    description: 'A band of dark dust in front of its bright nucleus earns this galaxy its name. Its outer gas turns the opposite way to its inner gas, a likely sign of a past merger.',
    facts: [{ label: 'Distance', value: 'About 17 million light-years' }, { label: 'Feature', value: 'A dark dust band over the nucleus' }],
    armFraction: 0.25, bulge: { count: 16000, radius: 3.4, flatten: 0.72 }, palette: oldPalette, knots: { count: 80 },
    dustRing: { radius: 8.5, width: 1, height: 0.4, count: 9000, arc: 3 }, rotation: [0.8, 0, 0.5],
  }),
  recipe({
    id: 'centaurus-a', name: 'Centaurus A', fullName: 'Centaurus A (NGC 5128)', color: '#ffb36b', category: 'Peculiar elliptical', radius: 30,
    description: 'A nearby active galaxy: a great ball of old stars crossed by a warped lane of dust and young stars, the remains of a smaller galaxy it swallowed. Its central black hole drives powerful jets.',
    facts: [{ label: 'Distance', value: 'About 12 million light-years' }, { label: 'Type', value: 'Peculiar elliptical, with an active nucleus' }],
    armFraction: 0, diskCount: 1500, bulge: { count: 52000, radius: 9.4, flatten: 0.86 }, palette: oldPalette, knots: { count: 0 }, dust: { count: 50, offset: 0.1, width: 1 },
    dustRing: { radius: 13, width: 1.4, height: 0.5, count: 15000, tilt: 0.36, warp: 2.2 }, globulars: { clusters: 60, radius: 42, starsEach: 22 }, rotation: [0.16, 0, 0.1], tilt: 0.1,
    coreGlow: { size: 16, color: '#ffdcb0', intensity: 0.42 },
  }),
  recipe({
    id: 'bode', name: 'Bode’s Galaxy', fullName: 'Bode’s Galaxy (M81)', color: '#b9d0ff', category: 'Grand-design spiral', radius: 45, sources: [HUBBLE(81)],
    description: 'A bright spiral with smooth, tightly wound arms, in gravitational contact with its neighbour M82.',
    facts: [{ label: 'Distance', value: 'About 12 million light-years' }, { label: 'Companion', value: 'Interacting with the Cigar Galaxy' }],
    pitch: 15, bulge: { count: 15000, radius: 5.6, flatten: 0.7 }, rotation: [0.86, 0, 0.5],
  }),
  recipe({
    id: 'cigar', name: 'Cigar Galaxy', fullName: 'Cigar Galaxy (M82)', color: '#ff7f6a', category: 'Starburst', radius: 18, sources: [HUBBLE(82)],
    description: 'Seen nearly edge-on, this galaxy is forming stars at a furious rate, stirred by its encounter with M81. The resulting winds drive plumes of hot gas out of both faces of the disc.',
    facts: [{ label: 'Distance', value: 'About 12 million light-years' }, { label: 'Type', value: 'Starburst' }],
    armFraction: 0.1, thickness: 1.1, knots: { count: 500 }, plumes: { count: 2600, length: 20, width: 4 }, rotation: [0.06, 0, 0.3], tilt: 0.08,
  }),
  recipe({
    id: 'virgo-a', name: 'Messier 87', fullName: 'Messier 87 (Virgo A)', color: '#ffd9a8', category: 'Giant elliptical', radius: 60, sources: [HUBBLE(87)], view: 1,
    description: 'A giant elliptical galaxy at the heart of the Virgo Cluster. Its central black hole, M87*, was the first ever imaged, and it is surrounded by a vast swarm of globular clusters.',
    facts: [{ label: 'Distance', value: 'About 55 million light-years' }, { label: 'Type', value: 'Giant elliptical' }, { label: 'Central black hole', value: 'M87*, about 6.5 billion Suns' }],
    armFraction: 0, diskCount: 500, bulge: { count: 70000, radius: 16, flatten: 0.92 }, palette: oldPalette, knots: { count: 0 }, dust: { count: 10, offset: 0.1, width: 1 },
    globulars: { clusters: 240, radius: 82, starsEach: 16 }, rotation: [0, 0, 0.1], coreGlow: { size: 40, color: '#ffdcb0', intensity: 0.5 },
  }),
  recipe({
    id: 'ngc-1300', name: 'NGC 1300', color: '#a8c4ff', category: 'Barred spiral', radius: 55,
    description: 'A textbook barred spiral: a long, straight bar of stars runs through the centre, with grand arms curling from either end.',
    facts: [{ label: 'Distance', value: 'About 61 million light-years' }, { label: 'Type', value: 'Barred spiral' }],
    bar: { count: 16000, length: 58, width: 0.1, angle: 0 }, armStart: 22, pitch: 13, bulge: { count: 6000, radius: 4, flatten: 0.7 }, rotation: [0.42, 0, 0.1], tilt: 0.7, view: 0.7,
  }),
  recipe({
    id: 'southern-pinwheel', name: 'Southern Pinwheel', fullName: 'Southern Pinwheel (M83)', color: '#ff9fc4', category: 'Barred spiral', radius: 27, sources: [HUBBLE(83)],
    description: 'A nearby barred spiral with a high rate of star formation, its arms beaded with pink regions of glowing hydrogen.',
    facts: [{ label: 'Distance', value: 'About 15 million light-years' }, { label: 'Type', value: 'Barred spiral' }],
    bar: { count: 7000, length: 14, width: 0.16, angle: 0.6 }, armStart: 6, pitch: 20, knots: { count: 1500 }, rotation: [0.2, 0, 0.2], tilt: 0.65,
  }),
  recipe({
    id: 'sunflower', name: 'Sunflower', fullName: 'Sunflower Galaxy (M63)', color: '#ffe08a', category: 'Flocculent spiral', radius: 49, sources: [HUBBLE(63)],
    description: 'Many short, patchy arm segments rather than two clean spirals give this galaxy the look of a sunflower head.',
    facts: [{ label: 'Distance', value: 'About 27 million light-years' }, { label: 'Type', value: 'Flocculent spiral' }],
    arms: Array.from({ length: 9 }, (_, i) => ({ offset: i * 0.7, weight: 0.5 + (i % 3) * 0.25 })), pitch: 12, armWidth: 8, knots: { count: 900 }, rotation: [0.9, 0, 0.3],
  }),
]

export const GALAXIES_BY_ID = Object.fromEntries(GALAXIES.map((g) => [g.id, g]))
