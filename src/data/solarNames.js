/**
 * Names and kinds of every selectable body in the solar system scene beyond
 * the Sun and planets: ids only, no measurements, so the interface can name
 * and list them without loading any orbital data.
 */
const moon = (id, host, name) => ({ id, host, kind: 'moon', name: name ?? id[0].toUpperCase() + id.slice(1) })

export const SOLAR_BODIES = [
  moon('moon', 'earth', 'Moon'),
  moon('phobos', 'mars'),
  moon('deimos', 'mars'),
  moon('io', 'jupiter'),
  moon('europa', 'jupiter'),
  moon('ganymede', 'jupiter'),
  moon('callisto', 'jupiter'),
  moon('mimas', 'saturn'),
  moon('enceladus', 'saturn'),
  moon('tethys', 'saturn'),
  moon('dione', 'saturn'),
  moon('rhea', 'saturn'),
  moon('titan', 'saturn'),
  moon('iapetus', 'saturn'),
  moon('miranda', 'uranus'),
  moon('ariel', 'uranus'),
  moon('umbriel', 'uranus'),
  moon('titania', 'uranus'),
  moon('oberon', 'uranus'),
  moon('triton', 'neptune'),
  { id: 'ceres', kind: 'dwarf', name: 'Ceres' },
  { id: 'pluto', kind: 'dwarf', name: 'Pluto' },
  moon('charon', 'pluto'),
  { id: 'haumea', kind: 'dwarf', name: 'Haumea' },
  { id: 'makemake', kind: 'dwarf', name: 'Makemake' },
  { id: 'eris', kind: 'dwarf', name: 'Eris' },
  { id: 'vesta', kind: 'asteroid', name: 'Vesta' },
  { id: 'pallas', kind: 'asteroid', name: 'Pallas' },
  { id: 'hygiea', kind: 'asteroid', name: 'Hygiea' },
  { id: 'eros', kind: 'near-earth', name: 'Eros' },
  { id: 'bennu', kind: 'near-earth', name: 'Bennu' },
  { id: 'apophis', kind: 'near-earth', name: 'Apophis' },
  { id: 'halley', kind: 'comet', name: '1P/Halley' },
  { id: 'encke', kind: 'comet', name: '2P/Encke' },
  { id: 'churyumov-gerasimenko', kind: 'comet', name: '67P/Churyumov–Gerasimenko' },
  { id: 'swift-tuttle', kind: 'comet', name: '109P/Swift–Tuttle' },
  { id: 'hale-bopp', kind: 'comet', name: 'C/1995 O1 (Hale–Bopp)' },
]

export const SOLAR_BODIES_BY_ID = Object.fromEntries(SOLAR_BODIES.map((b) => [b.id, b]))
export const isSolarBody = (id) => Boolean(SOLAR_BODIES_BY_ID[id])

export const KIND_LABEL = {
  moon: 'Moon',
  dwarf: 'Dwarf planet',
  asteroid: 'Main-belt asteroid',
  'near-earth': 'Near-Earth asteroid',
  comet: 'Comet',
}
