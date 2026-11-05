import { ISCO, PHOTON_SPHERE } from '../lib/relativity.js'

/**
 * Black hole explorer data.
 *
 * `facts` are published measurements, with their uncertainty where it matters.
 * `evidence` separates what was imaged from what was inferred. `render` feeds
 * the ray tracer (see lib/blackHoleShader.js). Scene units are Schwarzschild
 * radii, so every black hole shares one scene and the differences between
 * them come from `massSuns` and these parameters. Colours are representative:
 * a disc's real emission is mostly outside visible light.
 */

export const BLACK_HOLE_SCALE_NOTE =
  'Ray-traced simulation · light paths integrated through Schwarzschild spacetime · 1 unit = 1 Schwarzschild radius · colours are representative'

export const EVIDENCE = {
  observed: { label: 'Observed', tone: 'text-cyan' },
  inferred: { label: 'Inferred', tone: 'text-[#ffb37a]' },
  model: { label: 'Model', tone: 'text-[#b9a3ff]' },
  theory: { label: 'Theory', tone: 'text-[#ff9ab8]' },
}

export const BLACK_HOLES = [
  {
    id: 'sgr-a',
    name: 'Sagittarius A*',
    fullName: 'Sagittarius A*',
    color: '#ffb36b',
    category: 'Supermassive · Milky Way centre',
    massSuns: 4.0e6,
    evidence: 'observed',
    description:
      'The black hole at the centre of our own galaxy, imaged by the Event Horizon Telescope in 2022. It is starving: so little gas reaches it that its faint, puffed-up flow flickers from minute to minute instead of forming a bright flat disc.',
    facts: [
      { label: 'Mass', value: 'About 4 million Suns (EHT: 4.0 +1.1/−0.6 million)' },
      { label: 'Distance', value: 'About 26,000 light-years' },
      { label: 'Ring diameter on the sky', value: '51.8 ± 2.3 microarcseconds' },
      { label: 'First image', value: 'Published by the EHT in May 2022' },
    ],
    note: 'Simulated view. The EHT image shows radio emission at 1.3 mm; this model shows what the same geometry could look like in visible colours.',
    sources: [
      { label: 'EHT Collaboration 2022, Paper I', url: 'https://arxiv.org/abs/2311.08680' },
      { label: 'EHT Collaboration 2022, Paper IV', url: 'https://arxiv.org/abs/2311.08697' },
    ],
    pose: { position: [0, 4.4, 27], target: [0, 0, 0] },
    render: {
      cool: '#c8421c',
      hot: '#ffd9a0',
      diskInner: ISCO,
      diskOuter: 9,
      diskGain: 0.55,
      diskOpacity: 0.5,
      turbulence: 1,
      corona: 1.25,
      jet: 0,
      flare: 1,
    },
  },
  {
    id: 'm87',
    name: 'M87*',
    fullName: 'M87* (Powehi)',
    color: '#ff7a3d',
    category: 'Supermassive · jet-launching',
    massSuns: 6.5e9,
    evidence: 'observed',
    description:
      'The first black hole ever imaged, published in 2019. Sitting at the heart of the giant elliptical galaxy Messier 87, it drives a jet of plasma moving close to the speed of light, seen here as a pair of beams along the spin axis.',
    facts: [
      { label: 'Mass', value: '6.5 ± 0.7 billion Suns (EHT 2019; later analyses differ)' },
      { label: 'Distance', value: 'About 55 million light-years (16.8 Mpc)' },
      { label: 'Ring diameter on the sky', value: '42 ± 3 microarcseconds' },
      { label: 'First image', value: 'Published by the EHT in April 2019' },
    ],
    note: 'Simulated view. A 2018 follow-up campaign found the same ring size, so the shadow persists from year to year as general relativity predicts.',
    sources: [
      { label: 'EHT and ALMA overview, 2019', url: 'https://arxiv.org/abs/1910.10193' },
      { label: 'EHT 2024, The persistent shadow of M87', url: 'https://www.iaa.es/node/17618' },
    ],
    pose: { position: [11, 7, 31], target: [0, 0, 0] },
    render: {
      cool: '#b5300f',
      hot: '#ffcf8a',
      diskInner: ISCO,
      diskOuter: 13,
      diskGain: 1,
      diskOpacity: 0.78,
      turbulence: 0.7,
      corona: 0.5,
      jet: 1,
      jetColor: '#8fb7ff',
    },
  },
  {
    id: 'cygnus-x1',
    name: 'Cygnus X-1',
    fullName: 'Cygnus X-1',
    color: '#7cc3ff',
    category: 'Stellar-mass · X-ray binary',
    massSuns: 21.2,
    evidence: 'inferred',
    description:
      'One of the first objects widely accepted as a black hole. It is the collapsed remains of a massive star, now pulling a stream of gas from a blue supergiant companion it orbits every five and a half days. The gas heats until it shines in X-rays.',
    facts: [
      { label: 'Mass', value: '21.2 ± 2.2 Suns' },
      { label: 'Distance', value: 'About 7,200 light-years (2.22 kpc)' },
      { label: 'Companion', value: 'A blue supergiant, orbit about 5.6 days' },
      { label: 'How we know', value: 'Radio astrometry and the companion’s motion' },
    ],
    note: 'Simulated view. The companion is drawn far closer than scale so that it fits in frame: the real orbit is hundreds of thousands of Schwarzschild radii across.',
    sources: [
      { label: 'Miller-Jones et al. 2021, Science', url: 'https://arxiv.org/abs/2102.09091' },
    ],
    pose: { position: [-16, 6, 24], target: [0, 0, 0] },
    render: {
      cool: '#2f6bff',
      hot: '#e4f1ff',
      diskInner: ISCO,
      diskOuter: 11,
      diskGain: 1.15,
      diskOpacity: 0.72,
      turbulence: 0.9,
      corona: 0.7,
      jet: 0,
      companion: { position: [34, 7, -30], radius: 7, color: '#bcd6ff' },
    },
  },
  {
    id: 'ton-618',
    name: 'TON 618',
    fullName: 'TON 618',
    color: '#d8c4ff',
    category: 'Ultramassive · quasar',
    massSuns: 4.07e10,
    evidence: 'inferred',
    description:
      'A hyperluminous quasar and one of the most massive black holes known. Its mass comes from how fast gas moves around it, which is an indirect method, so estimates vary. A horizon this large has such gentle tides that you would cross it unharmed and not notice.',
    facts: [
      { label: 'Mass', value: 'Estimates of about 40–66 billion Suns' },
      { label: 'How we know', value: 'Spectral line widths; not imaged' },
      { label: 'What it is', value: 'A quasar, powered by intense accretion' },
      { label: 'Light we see', value: 'Left it billions of years ago' },
    ],
    note: 'Simulated view. This model uses 40.7 billion Suns, the lower of the published estimates. The method carries large uncertainty.',
    sources: [
      { label: 'TON 618 mass estimates, with primary references', url: 'https://en.wikipedia.org/wiki/TON_618' },
    ],
    pose: { position: [8, 3.2, 36], target: [0, 0, 0] },
    render: {
      cool: '#6a48ff',
      hot: '#f6f1ff',
      diskInner: ISCO,
      diskOuter: 19,
      diskGain: 1.5,
      diskOpacity: 0.9,
      turbulence: 0.5,
      corona: 0.9,
      jet: 0,
    },
  },
]

export const BLACK_HOLES_BY_ID = Object.fromEntries(BLACK_HOLES.map((hole) => [hole.id, hole]))

/** Explanations for the Science tab. `value` may fill in the selected hole. */
export const BLACK_HOLE_TOPICS = [
  {
    id: 'schwarzschild',
    title: 'Schwarzschild radius',
    evidence: 'theory',
    body: 'The radius r_s = 2GM/c² to which a mass must be squeezed for its escape speed to reach light speed. It grows in direct proportion to mass, so every other distance in this explorer is measured in units of it.',
  },
  {
    id: 'horizon',
    title: 'Event horizon',
    evidence: 'theory',
    body: 'A one-way boundary at r_s. It is not a surface: nothing marks it, and a falling observer passes it without a jolt. Once inside, every future path leads inward, so no signal can ever come back out.',
  },
  {
    id: 'photon-sphere',
    title: 'Photon sphere',
    evidence: 'theory',
    body: `At ${PHOTON_SPHERE} r_s gravity bends light into a circle. These orbits are unstable: a nudge sends the light inward or away. Light that skims this region and escapes forms the bright ring at the edge of the shadow.`,
  },
  {
    id: 'shadow',
    title: 'Shadow and photon ring',
    evidence: 'observed',
    body: 'The dark centre is not the horizon itself. It is about 2.6 r_s in radius because light passing inside the photon sphere is captured. The Event Horizon Telescope images of M87* and Sagittarius A* show this ring and central depression.',
  },
  {
    id: 'disk',
    title: 'Accretion disc',
    evidence: 'model',
    body: `Gas spirals inward, heating through friction until it glows. Its inner edge sits near ${ISCO} r_s, the innermost stable circular orbit. One side looks far brighter because gas moving towards you is beamed by relativistic Doppler shift, and the top and bottom arcs are the far side of the disc lensed into view.`,
  },
  {
    id: 'lensing',
    title: 'Gravitational lensing',
    evidence: 'observed',
    body: 'Spacetime curvature bends light, so stars behind the black hole appear displaced, stretched and duplicated. The same effect was measured for starlight near the Sun in 1919 and is now routine across astronomy.',
  },
  {
    id: 'dilation',
    title: 'Gravitational time dilation',
    evidence: 'observed',
    body: 'Clocks deep in a gravity well tick slowly compared with distant ones, by √(1 − r_s/r). The effect is measured directly, even in GPS satellites. A distant observer never sees anything cross the horizon: it dims and freezes instead, while the faller’s own clock runs normally.',
  },
  {
    id: 'spaghettification',
    title: 'Spaghettification',
    evidence: 'theory',
    body: 'Gravity pulls harder on your feet than your head. Tides scale as M/r³ while the horizon scales as M, so tides at the horizon fall as 1/M². A stellar-mass black hole shreds you far outside its horizon, while a supermassive one lets you cross intact.',
  },
  {
    id: 'singularity',
    title: 'Singularity',
    evidence: 'theory',
    body: 'General relativity predicts that inside the horizon all paths end at r = 0, where density and curvature diverge. Most physicists read this as the theory failing, not as a real infinity. No one knows what actually happens there.',
  },
  {
    id: 'hawking',
    title: 'Hawking radiation',
    evidence: 'theory',
    body: 'Quantum effects near the horizon should make black holes radiate like faint blackbodies, slowly losing mass. It has never been detected: for an astrophysical black hole the temperature is far below that of the cosmic microwave background.',
  },
]

/**
 * Exploration missions. Each `check` runs against live telemetry; a mission
 * completes once its condition has held for `hold` seconds.
 */
export const BLACK_HOLE_MISSIONS = [
  {
    id: 'horizon',
    title: 'Approach the Event Horizon',
    objective: 'Fly within 1.3 r_s of the centre.',
    how: 'Press Fly and descend towards the shadow. Space and Shift move you up and down; the wheel or the +/− buttons set speed.',
    learned: 'Below about 1.5 r_s no circular orbit exists at all: staying here takes constant thrust, and only the outside of the horizon is reachable.',
    hold: 0.4,
    check: (t) => t.r <= 1.3,
    progress: (t) => clamp01((20 - t.r) / (20 - 1.3)),
  },
  {
    id: 'photon',
    title: 'Explore the Photon Sphere',
    objective: 'Hold between 1.4 and 1.7 r_s for 5 seconds.',
    how: 'Fly in and stay close to 1.5 r_s, the radius where light itself can orbit.',
    learned: 'Here, light you send sideways would circle and return to you. Looking along the sphere, you would see the back of your own head.',
    hold: 5,
    check: (t) => t.r >= 1.4 && t.r <= 1.7,
    progress: (t, held) => clamp01(held / 5),
  },
  {
    id: 'lensing',
    title: 'Observe Gravitational Lensing',
    objective: 'View the disc from within 8° of its plane for 3 seconds.',
    how: 'Drag down until you are level with the disc, between 6 and 40 r_s out. The far side rises over the top of the shadow.',
    learned: 'The arc over the shadow is the back of the disc. You are seeing behind the black hole because its gravity bends that light up and over.',
    hold: 3,
    check: (t) => t.inclination <= 8 && t.r >= 6 && t.r <= 40,
    progress: (t, held) => clamp01(held / 3),
  },
  {
    id: 'disk',
    title: 'Journey Through the Accretion Disc',
    objective: 'Fly through the disc plane between 3 and 10 r_s.',
    how: 'In flight, cross from above to below the disc, close enough to be inside its bright inner region.',
    learned: 'A real disc this hot would be lethal plasma. Its gas orbits at a large fraction of light speed, which is why one side looks so much brighter.',
    hold: 0,
    check: (t) => t.diskCrossed,
    progress: (t) => (t.diskCrossed ? 1 : clamp01((30 - t.r) / 22) * 0.6),
  },
  {
    id: 'dilation',
    title: 'Understand Time Dilation',
    objective: 'Reach a depth where distant clocks run twice as fast, and hold for 3 seconds.',
    how: 'A static clock runs at half rate at 1.33 r_s. Watch the two clocks in the gauge separate as you descend.',
    learned: 'Nothing feels different locally: your clock seems normal to you. It is only by comparing the two that the slowdown appears.',
    hold: 3,
    check: (t) => t.r <= 4 / 3,
    progress: (t, held) => (t.r <= 4 / 3 ? clamp01(held / 3) : clamp01((12 - t.r) / 10.7) * 0.7),
  },
]

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

/**
 * Stops on the guided descent, as a fraction of the journey. `r` is the
 * radius reached at `at`, and the caption describes what the view shows.
 */
export const DIVE_STAGES = [
  {
    id: 'approach',
    at: 0,
    label: 'Approach',
    evidence: 'model',
    caption: 'Falling freely from far away. The view is ray traced: every pixel’s light has been bent by the black hole’s gravity.',
  },
  {
    id: 'isco',
    at: 0.34,
    label: 'Inner disc edge',
    evidence: 'model',
    caption: 'At 3 r_s gas can no longer hold a stable orbit and plunges inward. The disc is left behind.',
  },
  {
    id: 'photon',
    at: 0.52,
    label: 'Photon sphere',
    evidence: 'model',
    caption: 'At 1.5 r_s light can orbit. Your own speed bunches the sky ahead of you, while the shadow fills the view below.',
  },
  {
    id: 'horizon',
    at: 0.72,
    label: 'Event horizon',
    evidence: 'theory',
    caption: 'You cross r_s with no jolt or wall. From now on every future path leads inward. A distant observer never sees this moment.',
  },
  {
    id: 'interior',
    at: 0.76,
    label: 'Interior',
    evidence: 'theory',
    caption: 'Hypothetical visualization. No light from here has ever reached anyone: this is an artistic impression of predictions from general relativity, not a calculation or an observation.',
  },
  {
    id: 'singularity',
    at: 0.97,
    label: 'Singularity',
    evidence: 'theory',
    caption: 'General relativity predicts an end at r = 0, and stops working there. What lies at this point is unknown, so the view simply ends.',
  },
]

/** Radius (in r_s) at a point in the journey, from `start` down to zero. */
export function diveRadius(progress, start) {
  const horizon = DIVE_STAGES[3].at
  if (progress <= horizon) return start * Math.pow(1 / start, progress / horizon)
  return Math.max(0, 1 - (progress - horizon) / (1 - horizon))
}
