import { PLANETS_BY_ID } from './planets.js'

/**
 * Spacecraft shown in the solar system.
 *
 * As in planets.js, two kinds of number live here:
 *
 *   `facts` — published figures, shown in the information panel. Sources:
 *             NASA (ISS orbit tutorial, Hubble, Webb and MRO mission pages),
 *             ESA (Hubble fact sheet), GPS.gov, and the China Manned Space
 *             Agency via published orbital data. Hubble's altitude is from
 *             2026 reports of its decaying orbit. Juno, Voyager, New
 *             Horizons and Parker: NASA and APL mission pages. Checked
 *             November 2026.
 *             Where a figure was not confirmed, the field is left out.
 *
 *   `sim`   — chosen so spacecraft are visible at all. Orbit radii are in
 *             host radii and heavily compressed; models are enlarged roughly
 *             twenty-thousand-fold. Periods keep their real ordering through a
 *             compressed power law, and a geostationary orbit keeps exactly
 *             the host's rotation period, so it really does hang over one
 *             spot. Nothing in `sim` is shown as data.
 *
 * Two entries are representatives of a class rather than one named craft,
 * and say so: a GPS III satellite and a geostationary communications
 * satellite.
 */

const SIDEREAL_DAY_MIN = 1436.07
const MARS_DAY_MIN = 1477.4
const JUPITER_DAY_MIN = 595.5

/** Compressed period: the host's simulated day scaled by (real/day)^0.4. */
function simPeriod(host, realMinutes, dayMinutes) {
  const day = (Math.PI * 2) / Math.abs(PLANETS_BY_ID[host].sim.rotationSpeed)
  return day * Math.pow(realMinutes / dayMinutes, 0.4)
}

export const SATELLITES = [
  {
    id: 'iss',
    name: 'International Space Station',
    short: 'ISS',
    host: 'earth',
    model: 'iss',
    category: 'Crewed space station',
    facts: {
      description:
        'A laboratory in low Earth orbit, built by the space agencies of the United States, Russia, Europe, Japan and Canada. It has been continuously crewed since November 2000.',
      operator: 'NASA, Roscosmos, ESA, JAXA, CSA',
      launched: '1998 (first module)',
      orbit: 'Low Earth orbit',
      altitude: 'About 400–420 km',
      inclination: '51.6°',
      period: 'About 93 minutes',
    },
    sim: { radius: 1.22, inclination: 51.6, node: 0.6, phase: 0.2, size: 0.032, period: simPeriod('earth', 92.9, SIDEREAL_DAY_MIN) },
  },
  {
    id: 'tiangong',
    name: 'Tiangong',
    short: 'Tiangong',
    host: 'earth',
    model: 'tiangong',
    category: 'Crewed space station',
    facts: {
      description:
        'China’s modular space station. Its core module, Tianhe, launched in 2021, and the station was completed in 2022 with the Wentian and Mengtian laboratory modules.',
      operator: 'China Manned Space Agency',
      launched: '2021 (core module)',
      orbit: 'Low Earth orbit',
      altitude: 'About 390 km',
      inclination: '41.5°',
      period: 'About 92 minutes',
    },
    sim: { radius: 1.19, inclination: 41.5, node: 2.4, phase: 2.9, size: 0.024, period: simPeriod('earth', 92, SIDEREAL_DAY_MIN) },
  },
  {
    id: 'hubble',
    name: 'Hubble Space Telescope',
    short: 'Hubble',
    host: 'earth',
    model: 'hubble',
    category: 'Space telescope',
    facts: {
      description:
        'A 2.4-metre optical telescope above the blurring of the atmosphere, observing in ultraviolet, visible and near-infrared light. It has no engine of its own, so atmospheric drag is slowly lowering its orbit.',
      operator: 'NASA and ESA',
      launched: '24 April 1990',
      orbit: 'Low Earth orbit, decaying',
      altitude: 'About 470–485 km in 2026',
      inclination: '28.5°',
    },
    sim: { radius: 1.28, inclination: 28.5, node: 4.1, phase: 4.4, size: 0.022, period: simPeriod('earth', 94, SIDEREAL_DAY_MIN) },
  },
  {
    id: 'gps',
    name: 'GPS III satellite',
    short: 'GPS III',
    host: 'earth',
    model: 'gps',
    category: 'Navigation satellite · representative',
    facts: {
      description:
        'One of the Global Positioning System constellation: satellites in six orbital planes broadcasting precisely timed signals, from which a receiver works out its position. This model stands for the constellation, not one particular satellite.',
      operator: 'U.S. Space Force',
      launched: '2018 onwards (GPS III series)',
      orbit: 'Medium Earth orbit',
      altitude: 'About 20,200 km',
      inclination: '55°',
      period: 'About 12 hours (two orbits per sidereal day)',
    },
    sim: { radius: 1.9, inclination: 55, node: 1.4, phase: 1.1, size: 0.024, period: simPeriod('earth', 718, SIDEREAL_DAY_MIN) },
  },
  {
    id: 'geo-comms',
    name: 'Geostationary communications satellite',
    short: 'GEO comsat',
    host: 'earth',
    model: 'geo',
    category: 'Communications satellite · representative',
    facts: {
      description:
        'A satellite over the equator that orbits once per sidereal day, so it stays fixed above one point and a ground dish can point at it permanently. Used for television, data relay and weather imaging. This model stands for the class.',
      orbit: 'Geostationary orbit',
      altitude: '35,786 km',
      inclination: 'About 0°',
      period: '23 hours 56 minutes (one sidereal day)',
    },
    sim: { radius: 2.5, inclination: 0, node: 0, phase: 5.2, size: 0.028, period: simPeriod('earth', SIDEREAL_DAY_MIN, SIDEREAL_DAY_MIN) },
  },
  {
    id: 'jwst',
    name: 'James Webb Space Telescope',
    short: 'Webb',
    host: 'earth',
    model: 'jwst',
    category: 'Space telescope',
    facts: {
      description:
        'An infrared observatory with a 6.5-metre gold-coated mirror, kept cold behind a five-layer sunshield the size of a tennis court. It does not orbit Earth: it loops around the Sun–Earth L2 point, on the side of Earth facing away from the Sun.',
      operator: 'NASA, ESA and CSA',
      launched: '25 December 2021',
      orbit: 'Halo orbit around Sun–Earth L2',
      altitude: 'About 1.5 million km from Earth',
    },
    // Held on the night side of Earth, looping slowly around the L2 point.
    sim: { radius: 4.8, l2: true, halo: 0.35, phase: 0, size: 0.032, period: 60 },
  },
  {
    id: 'mro',
    name: 'Mars Reconnaissance Orbiter',
    short: 'MRO',
    host: 'mars',
    model: 'mro',
    category: 'Planetary orbiter',
    facts: {
      description:
        'A Mars orbiter carrying HiRISE, the most powerful camera sent to another planet, and one of the main relays for rovers on the surface. It has been at Mars since 2006, well past its planned lifetime.',
      operator: 'NASA',
      launched: '12 August 2005',
      orbit: 'Low, near-polar, Sun-synchronous orbit of Mars',
    },
    sim: { radius: 1.3, inclination: 93, node: 0.9, phase: 0.5, size: 0.024, period: simPeriod('mars', 112, MARS_DAY_MIN) },
  },
  {
    id: 'juno',
    name: 'Juno',
    short: 'Juno',
    host: 'jupiter',
    model: 'juno',
    trajectory: 'juno',
    category: 'Planetary orbiter',
    facts: {
      description:
        'NASA’s solar-powered Jupiter orbiter, studying the planet’s interior, magnetic field and auroras from a long, looping polar orbit. In its extended mission it has also flown close past Ganymede, Europa and Io.',
      operator: 'NASA',
      launched: '5 August 2011',
      orbit: 'Long, highly elliptical polar orbit of Jupiter',
      milestones: 'Arrived at Jupiter in July 2016',
    },
    // A circle stands in for its long ellipse; the period is visual only.
    sim: { radius: 2.2, inclination: 90, node: 1.8, phase: 1.2, size: 0.05, period: simPeriod('jupiter', 33 * 1440, JUPITER_DAY_MIN) },
  },
  // Heliocentric probes: placed for the simulated date from JPL Horizons
  // ephemerides (catalogue/trajectories.json, `npm run orbits`), with the
  // distance compressed like everything else. Not live tracking.
  {
    id: 'voyager-1',
    name: 'Voyager 1',
    short: 'Voyager 1',
    host: 'sun',
    model: 'voyager',
    trajectory: 'voyager-1',
    category: 'Interstellar probe',
    facts: {
      description:
        'After flying past Jupiter and Saturn, it became the first spacecraft to cross the heliopause into interstellar space, in August 2012. It is the most distant object ever built.',
      operator: 'NASA / JPL',
      launched: '5 September 1977',
      orbit: 'Escaping the solar system',
      milestones: 'Jupiter 1979 · Saturn 1980 · interstellar space 2012',
    },
    sim: { size: 0.07 },
  },
  {
    id: 'voyager-2',
    name: 'Voyager 2',
    short: 'Voyager 2',
    host: 'sun',
    model: 'voyager',
    trajectory: 'voyager-2',
    category: 'Interstellar probe',
    facts: {
      description:
        'The only spacecraft to have visited Uranus and Neptune. It crossed into interstellar space in November 2018, heading south of the ecliptic.',
      operator: 'NASA / JPL',
      launched: '20 August 1977',
      orbit: 'Escaping the solar system',
      milestones: 'Jupiter 1979 · Saturn 1981 · Uranus 1986 · Neptune 1989 · interstellar space 2018',
    },
    sim: { size: 0.07 },
  },
  {
    id: 'new-horizons',
    name: 'New Horizons',
    short: 'New Horizons',
    host: 'sun',
    model: 'newHorizons',
    trajectory: 'new-horizons',
    category: 'Kuiper belt probe',
    facts: {
      description:
        'The first mission to Pluto, which it flew past in July 2015, returning the first close views of its heart-shaped plain. On 1 January 2019 it passed Arrokoth, the most distant object yet explored.',
      operator: 'NASA / Johns Hopkins APL',
      launched: '19 January 2006',
      orbit: 'Escaping the solar system through the Kuiper belt',
      milestones: 'Jupiter 2007 · Pluto 2015 · Arrokoth 2019',
    },
    sim: { size: 0.1 },
  },
  {
    id: 'parker-solar-probe',
    name: 'Parker Solar Probe',
    short: 'Parker',
    host: 'sun',
    model: 'parker',
    trajectory: 'parker-solar-probe',
    category: 'Solar probe',
    facts: {
      description:
        'The closest any spacecraft has come to the Sun: on 24 December 2024 it passed 6.1 million km from the surface, through the corona, behind a heat shield facing the Sun.',
      operator: 'NASA / Johns Hopkins APL',
      launched: '12 August 2018',
      orbit: 'Around the Sun every 88 days, since its last Venus flyby in November 2024',
    },
    sim: { size: 0.05 },
  },
]

export const SATELLITES_BY_ID = Object.fromEntries(SATELLITES.map((satellite) => [satellite.id, satellite]))

export const SATELLITE_FACT_FIELDS = [
  { key: 'orbit', label: 'Orbit' },
  { key: 'altitude', label: 'Altitude' },
  { key: 'inclination', label: 'Inclination' },
  { key: 'period', label: 'Period' },
  { key: 'operator', label: 'Operated by' },
  { key: 'launched', label: 'Launched' },
  { key: 'milestones', label: 'Milestones' },
]

/** Spacecraft placed by JPL Horizons ephemerides rather than a simulated orbit. */
export const isProbe = (craft) => craft?.host === 'sun'

export const isSatellite = (id) => Boolean(SATELLITES_BY_ID[id])
