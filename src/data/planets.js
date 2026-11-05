/**
 * Planetary data for COSMOS.
 *
 * TWO KINDS OF NUMBER LIVE IN THIS FILE, AND THEY MUST NOT BE CONFUSED:
 *
 *   `facts`  — real, published astronomy. Physical and orbital values come
 *              from the NASA Planetary Fact Sheet. Moon counts come from
 *              NASA Space Place and are current as of mid-2026; they change
 *              as surveys confirm new satellites, which is why the UI shows
 *              the "as of" date alongside them.
 *
 *   `sim`    — made-up numbers chosen so the system fits on a screen.
 *              Radii, orbital distances and speeds are compressed. Nothing
 *              in `sim` is to scale and none of it should ever be presented
 *              to the user as astronomy.
 *
 * Orbital speeds in `sim` are derived from Kepler's third law applied to the
 * COMPRESSED radii (period proportional to r^1.5), not from real periods.
 * Using real period ratios would leave Neptune visually frozen: it takes
 * 680x longer than Mercury. This keeps the ordering honest — inner planets
 * visibly outrun outer ones — while every planet still moves on screen.
 */

export const DATA_SOURCES = {
  physical: 'NASA Planetary Fact Sheet',
  moons: 'NASA Space Place',
  moonsAsOf: 'mid-2026',
}

export const SUN = {
  id: 'sun',
  name: 'Sun',
  color: '#ffb347',
  sim: { radius: 1.5 },
  facts: {
    description:
      'The star at the centre of the solar system: a sphere of hot plasma holding over 99% of the system’s mass. Its fusion-powered output drives every planetary climate.',
    diameter: '1,391,400 km',
    distance: '—',
    orbitalPeriod: '—',
    rotationPeriod: '609.1 hours (25.4 days) at the equator',
    temperature: '5,500 °C at the surface',
    moons: '—',
  },
}

/**
 * Planets in orbital order. `sim.phase` is the starting angle in radians,
 * chosen only so the planets do not begin in a straight line.
 */
export const PLANETS = [
  {
    id: 'mercury',
    name: 'Mercury',
    color: '#a8a29e',
    surface: 'rocky',
    sim: {
      radius: 0.17,
      orbitRadius: 3.4,
      orbitPeriod: 10.2,
      rotationSpeed: 0.127,
      tilt: 0.03,
      phase: 0.4,
      palette: ['#6b6560', '#9c948c', '#45403c'],
    },
    facts: {
      description:
        'The smallest planet and the closest to the Sun. Airless and heavily cratered, its surface swings between extremes of heat and cold across a single long solar day.',
      diameter: '4,879 km',
      distance: '57.9 million km (0.39 AU)',
      orbitalPeriod: '88.0 Earth days',
      rotationPeriod: '1,407.6 hours (58.6 days)',
      temperature: '167 °C mean',
      moons: '0',
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    color: '#e8c48a',
    surface: 'cloudy',
    sim: {
      radius: 0.26,
      orbitRadius: 4.6,
      orbitPeriod: 16.1,
      rotationSpeed: -0.077,
      tilt: 177.4,
      phase: 2.1,
      palette: ['#d9a441', '#f3e0b0', '#a87a2c'],
    },
    facts: {
      description:
        'Close to Earth in size, but wrapped in a dense carbon-dioxide atmosphere that traps heat and makes it the hottest planet in the solar system. It rotates backwards relative to the other planets.',
      diameter: '12,104 km',
      distance: '108.2 million km (0.72 AU)',
      orbitalPeriod: '224.7 Earth days',
      rotationPeriod: '5,832.5 hours (243.0 days), retrograde',
      temperature: '464 °C mean',
      moons: '0',
    },
  },
  {
    id: 'earth',
    name: 'Earth',
    color: '#4a90d9',
    surface: 'terrestrial',
    sim: {
      radius: 0.28,
      orbitRadius: 6.0,
      orbitPeriod: 24.0,
      rotationSpeed: 0.526,
      tilt: 23.4,
      phase: 4.3,
      palette: ['#1b4f8a', '#3f7d3a', '#d8e8f5'],
    },
    facts: {
      description:
        'The only world known to support life. Liquid water covers roughly 71% of its surface, and a nitrogen-oxygen atmosphere together with a magnetic field shields it from the solar wind.',
      diameter: '12,756 km',
      distance: '149.6 million km (1.00 AU)',
      orbitalPeriod: '365.2 days',
      rotationPeriod: '23.9 hours',
      temperature: '15 °C mean',
      moons: '1',
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    color: '#c1603f',
    surface: 'rocky',
    sim: {
      radius: 0.2,
      orbitRadius: 7.5,
      orbitPeriod: 33.5,
      rotationSpeed: 0.521,
      tilt: 25.2,
      phase: 5.6,
      palette: ['#8c3a22', '#c9743f', '#5e2616'],
    },
    facts: {
      description:
        'A cold desert world coloured by iron-oxide dust. It holds the tallest volcano and one of the deepest canyon systems in the solar system, along with clear geological evidence of ancient liquid water.',
      diameter: '6,792 km',
      distance: '228.0 million km (1.52 AU)',
      orbitalPeriod: '687.0 Earth days',
      rotationPeriod: '24.6 hours',
      temperature: '−65 °C mean',
      moons: '2',
    },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    color: '#d8a46b',
    surface: 'banded',
    sim: {
      radius: 0.75,
      orbitRadius: 10.6,
      orbitPeriod: 56.3,
      rotationSpeed: 0.717,
      tilt: 3.1,
      phase: 1.2,
      palette: ['#c99a63', '#f0ddc0', '#8a5f3c'],
      spot: { lat: -0.22, lon: 2.1, size: 0.14, color: '#b4543a' },
    },
    facts: {
      description:
        'The largest planet: a gas giant whose banded clouds are stretched into belts and zones by a ten-hour rotation. The Great Red Spot is a storm wider than Earth that has been tracked for at least 190 years.',
      diameter: '142,984 km',
      distance: '778.5 million km (5.20 AU)',
      orbitalPeriod: '4,331 Earth days (11.9 years)',
      rotationPeriod: '9.9 hours',
      temperature: '−110 °C mean',
      moons: '115',
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    color: '#e0c389',
    surface: 'banded',
    rings: true,
    sim: {
      radius: 0.62,
      orbitRadius: 13.6,
      orbitPeriod: 81.8,
      rotationSpeed: 0.699,
      tilt: 26.7,
      phase: 3.4,
      palette: ['#cbab6e', '#f4e6c4', '#9a7b47'],
      ring: { inner: 1.35, outer: 2.3 },
    },
    facts: {
      description:
        'A gas giant encircled by the brightest ring system in the solar system, made mostly of water ice. Its mean density is lower than that of water.',
      diameter: '120,536 km',
      distance: '1,432.0 million km (9.57 AU)',
      orbitalPeriod: '10,747 Earth days (29.4 years)',
      rotationPeriod: '10.7 hours',
      temperature: '−140 °C mean',
      moons: '293',
    },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    color: '#8fd3d9',
    surface: 'ice',
    sim: {
      radius: 0.42,
      orbitRadius: 16.4,
      orbitPeriod: 108.3,
      rotationSpeed: -0.59,
      tilt: 97.8,
      phase: 0.9,
      palette: ['#7ec6cf', '#cdeef2', '#4f9aa6'],
    },
    facts: {
      description:
        'An ice giant tipped almost onto its side, so each pole spends about 42 years in continuous sunlight. Methane in its upper atmosphere absorbs red light and leaves it pale blue-green.',
      diameter: '51,118 km',
      distance: '2,867.0 million km (19.17 AU)',
      orbitalPeriod: '30,589 Earth days (83.7 years)',
      rotationPeriod: '17.2 hours, retrograde',
      temperature: '−195 °C mean',
      moons: '29',
    },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    color: '#4166c4',
    surface: 'ice',
    sim: {
      radius: 0.4,
      orbitRadius: 18.8,
      orbitPeriod: 132.9,
      rotationSpeed: 0.604,
      tilt: 28.3,
      phase: 2.7,
      palette: ['#2b4fae', '#7fa3e8', '#15306e'],
      spot: { lat: -0.3, lon: 4.0, size: 0.11, color: '#16255c' },
    },
    facts: {
      description:
        'The most distant planet and the outer ice giant, with the fastest winds measured anywhere in the solar system. Like Uranus, atmospheric methane gives it a deep blue cast.',
      diameter: '49,528 km',
      distance: '4,515.0 million km (30.18 AU)',
      orbitalPeriod: '59,800 Earth days (163.7 years)',
      rotationPeriod: '16.1 hours',
      temperature: '−200 °C mean',
      moons: '16',
    },
  },
]

export const PLANETS_BY_ID = Object.fromEntries(
  PLANETS.map((planet) => [planet.id, planet]),
)

export const BODIES_BY_ID = { ...PLANETS_BY_ID, sun: SUN }

/** Field order used by the information panel. */
export const FACT_FIELDS = [
  { key: 'diameter', label: 'Diameter' },
  { key: 'distance', label: 'Distance from Sun' },
  { key: 'orbitalPeriod', label: 'Orbital period' },
  { key: 'rotationPeriod', label: 'Rotation period' },
  { key: 'temperature', label: 'Mean temperature' },
  { key: 'moons', label: 'Known moons' },
]

/** Outermost orbit, used to frame the overview camera. */
export const SYSTEM_EXTENT = Math.max(
  ...PLANETS.map((planet) => planet.sim.orbitRadius),
)

/** Selection order for menus and previous/next navigation. */
export const BODY_ORDER = ['sun', ...PLANETS.map((planet) => planet.id)]

export const CATEGORY = {
  sun: 'Star · G-type main sequence',
  mercury: 'Terrestrial planet',
  venus: 'Terrestrial planet',
  earth: 'Terrestrial planet',
  mars: 'Terrestrial planet',
  jupiter: 'Gas giant',
  saturn: 'Gas giant',
  uranus: 'Ice giant',
  neptune: 'Ice giant',
}
