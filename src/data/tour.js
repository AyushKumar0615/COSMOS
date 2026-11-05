/**
 * Guided tour of the solar system.
 *
 * Each stop names the body to visit (null = the whole system), its own
 * camera framing, and the text shown while the camera is there. Facts are
 * restricted to well-established figures from NASA's planetary material;
 * on-screen distances and sizes remain compressed, as everywhere else.
 *
 * `view` (all optional):
 *   azimuth       degrees around the body; 0 = between body and Sun (fully
 *                 lit), 90 = side-on (half lit), 180 = backlit crescent
 *   elevation     degrees above the orbital plane
 *   distanceScale multiplier on the default focus distance
 */

export const TOUR_DWELL_SECONDS = 16

export const TOUR_STOPS = [
  {
    id: 'intro',
    body: null,
    eyebrow: 'Introduction',
    title: 'The solar system',
    text: 'One star, eight planets and countless smaller bodies, all held together by the Sun’s gravity. This tour visits each world in order, outward from the Sun. On screen, sizes, distances and speeds are compressed so everything fits.',
    facts: [
      'The Sun holds about 99.8% of all the mass in the solar system.',
      'Sunlight takes about 8 minutes 20 seconds to reach Earth.',
    ],
    view: { elevation: 52, distanceScale: 1.02 },
  },
  {
    id: 'sun',
    body: 'sun',
    eyebrow: 'Our star',
    title: 'The Sun',
    text: 'A middle-aged star about 4.6 billion years old. Nuclear fusion in its core converts roughly four million tonnes of matter into energy every second, and that energy drives the climate of every planet.',
    facts: [
      'Its core reaches about 15 million °C.',
      'It is roughly halfway through its life as a stable, hydrogen-burning star.',
    ],
    view: { azimuth: 25, elevation: 20, distanceScale: 1.35 },
  },
  {
    id: 'mercury',
    body: 'mercury',
    eyebrow: 'Planet 1',
    title: 'Mercury',
    text: 'The smallest planet and the fastest, circling the Sun every 88 days. With almost no atmosphere to hold heat, its surface swings between about 430 °C by day and −180 °C at night.',
    facts: [
      'One solar day on Mercury, sunrise to sunrise, lasts 176 Earth days.',
      'NASA’s MESSENGER spacecraft confirmed water ice in permanently shadowed craters near its poles.',
    ],
    view: { azimuth: 70, elevation: 14, distanceScale: 1.1 },
  },
  {
    id: 'venus',
    body: 'venus',
    eyebrow: 'Planet 2',
    title: 'Venus',
    text: 'Close to Earth in size, but smothered by a carbon-dioxide atmosphere with clouds of sulfuric acid. A runaway greenhouse effect makes it hotter than Mercury, even though it is almost twice as far from the Sun.',
    facts: [
      'Surface pressure is about 90 times Earth’s, like being 900 m under the sea.',
      'A day on Venus (243 Earth days) is longer than its year (225 Earth days), and it spins backwards.',
    ],
    view: { azimuth: 60, elevation: 12, distanceScale: 1.05 },
  },
  {
    id: 'earth',
    body: 'earth',
    eyebrow: 'Planet 3',
    title: 'Earth',
    text: 'The only world known to host life, and the only one with stable liquid water on its surface. Its air is 78% nitrogen and 21% oxygen, an oxygen level maintained by living things.',
    facts: [
      'Earth is the densest planet in the solar system.',
      'Tides raised by the Moon are very slowly lengthening Earth’s day.',
    ],
    view: { azimuth: 55, elevation: 18, distanceScale: 1 },
  },
  {
    id: 'mars',
    body: 'mars',
    eyebrow: 'Planet 4',
    title: 'Mars',
    text: 'A cold, dusty world about half Earth’s width. Iron-oxide dust gives it its colour, and dried river channels, deltas and water-formed minerals show it was once much wetter.',
    facts: [
      'Olympus Mons rises about 22 km, roughly two and a half times the height of Everest.',
      'Valles Marineris is a canyon system about 4,000 km long.',
    ],
    view: { azimuth: 40, elevation: 12, distanceScale: 1.05 },
  },
  {
    id: 'jupiter',
    body: 'jupiter',
    eyebrow: 'Planet 5',
    title: 'Jupiter',
    text: 'The largest planet, with more than twice the mass of all the other planets combined. Its striped clouds are stretched into belts and zones by the fastest spin in the solar system: a day lasts under ten hours.',
    facts: [
      'The Great Red Spot is a storm wider than Earth.',
      'Its moon Ganymede is the largest moon in the solar system, bigger than the planet Mercury.',
    ],
    view: { azimuth: 60, elevation: 8, distanceScale: 1.1 },
  },
  {
    id: 'saturn',
    body: 'saturn',
    eyebrow: 'Planet 6',
    title: 'Saturn',
    text: 'A gas giant less dense than water, wrapped in the most spectacular ring system known. The main rings span hundreds of thousands of kilometres, yet are typically only about 10 metres thick.',
    facts: [
      'The rings are made mostly of water ice, in pieces from dust grains to boulders.',
      'Its moon Titan has a thick atmosphere and lakes of liquid methane and ethane.',
    ],
    view: { azimuth: 50, elevation: 24, distanceScale: 1.15 },
  },
  {
    id: 'uranus',
    body: 'uranus',
    eyebrow: 'Planet 7',
    title: 'Uranus',
    text: 'An ice giant tipped onto its side, with its axis tilted about 98°. As it circles the Sun, each pole gets roughly 42 years of continuous sunlight followed by 42 years of darkness.',
    facts: [
      'It was the first planet discovered with a telescope, by William Herschel in 1781.',
      'Its atmosphere has been measured as cold as −224 °C, the coldest of any planet.',
    ],
    view: { azimuth: 20, elevation: 30, distanceScale: 1.05 },
  },
  {
    id: 'neptune',
    body: 'neptune',
    eyebrow: 'Planet 8',
    title: 'Neptune',
    text: 'The outermost planet, so distant that sunlight takes about four hours to reach it. Even so, it has the fastest winds measured in the solar system, at more than 2,000 km/h.',
    facts: [
      'It was found in 1846 by mathematics: its position was predicted from irregularities in Uranus’s orbit.',
      'Its largest moon, Triton, orbits backwards and is probably a captured Kuiper Belt object.',
    ],
    view: { azimuth: 60, elevation: 15, distanceScale: 1.05 },
  },
]

/** Stop index for each body, so clicking a planet mid-tour jumps to it. */
export const TOUR_INDEX_BY_BODY = Object.fromEntries(
  TOUR_STOPS.map((stop, index) => [stop.body, index]).filter(([body]) => body),
)
