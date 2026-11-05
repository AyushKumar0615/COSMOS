/**
 * Primary navigation. `status` is what the interface is allowed to claim:
 * only entries marked `live` are implemented, everything else renders as
 * an explicit upcoming module.
 */
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', status: 'live' },
  { id: 'universe', label: 'Universe', status: 'live' },
  { id: 'solar-system', label: 'Solar System', short: 'Solar', status: 'live' },
  { id: 'tours', label: 'Guided Tours', short: 'Tours', status: 'live' },
  { id: 'flight', label: 'Free Flight', short: 'Flight', status: 'live' },
  { id: 'black-holes', label: 'Black Holes', status: 'live' },
  { id: 'galaxies', label: 'Galaxies', status: 'live' },
  { id: 'nebulae', label: 'Nebulae', status: 'live' },
  { id: 'phenomena', label: 'Phenomena', status: 'live' },
  { id: 'missions', label: 'Missions', status: 'live' },
  { id: 'about', label: 'About', status: 'live' },
]

export const BOOT_MESSAGES = [
  'Initialising render context',
  'Seeding starfield',
  'Compositing nebula',
  'Calibrating camera rig',
]

// Just the ids, so the first load need not carry the full data for scenes it
// has not visited. tests/site.test.mjs keeps these in step with the data.
export const GALAXY_IDS = [
  'milky-way', 'andromeda', 'whirlpool', 'sombrero', 'triangulum', 'pinwheel', 'lmc', 'smc', 'cartwheel',
  'black-eye', 'centaurus-a', 'bode', 'cigar', 'virgo-a', 'ngc-1300', 'southern-pinwheel', 'sunflower',
]
export const NEBULA_IDS = [
  'orion', 'crab', 'eagle', 'carina', 'pillars', 'horsehead', 'ring', 'helix', 'lagoon', 'trifid', 'rosette', 'cats-eye', 'tarantula',
]
export const BLACK_HOLE_IDS = ['sgr-a', 'm87', 'cygnus-x1', 'ton-618']
export const PHENOMENON_IDS = [
  'supernova',
  'pulsar',
  'wormhole',
  'spacetime',
  'scale',
  'life-cycle',
  'trappist-1e',
  'proxima-b',
  '55-cancri-e',
  'hd-189733-b',
]
