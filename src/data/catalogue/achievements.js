const visited = (state, ids) => ids.every((id) => state.visited[id])
const countOf = (state, type) => Object.values(state.visited).filter((entry) => entry === type).length
const total = (state) => Object.keys(state.visited).length

export const MILESTONES = [
  { id: 'first-light', title: 'First Light', description: 'Discover your first object.', progress: (s) => [total(s), 1] },
  { id: 'surveyor', title: 'Surveyor', description: 'Discover 10 objects.', progress: (s) => [total(s), 10] },
  { id: 'cartographer', title: 'Cartographer', description: 'Discover 40 objects.', progress: (s) => [total(s), 40] },
  { id: 'astronomer', title: 'Astronomer', description: 'Discover 100 objects.', progress: (s) => [total(s), 100] },
  { id: 'neighbour', title: 'Good Neighbour', description: 'Travel 100 light-years.', progress: (s) => [s.distanceLy, 100] },
  { id: 'interstellar', title: 'Interstellar', description: 'Travel 10,000 light-years.', progress: (s) => [s.distanceLy, 1e4] },
  { id: 'intergalactic', title: 'Intergalactic', description: 'Travel a million light-years.', progress: (s) => [s.distanceLy, 1e6] },
  { id: 'cosmologist', title: 'Cosmologist', description: 'Travel a billion light-years.', progress: (s) => [s.distanceLy, 1e9] },
]

export const CHALLENGES = [
  { id: 'grand-tour', title: 'Grand Tour', description: 'Visit all eight planets.', ids: ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] },
  { id: 'dwarf-planets', title: 'Small Worlds', description: 'Visit all five dwarf planets.', ids: ['ceres', 'pluto', 'haumea', 'makemake', 'eris'] },
  { id: 'ocean-worlds', title: 'Hidden Oceans', description: 'Visit Europa, Enceladus and Ganymede.', ids: ['europa', 'enceladus', 'ganymede'] },
  { id: 'trappist', title: 'Seven Worlds', description: 'Visit every TRAPPIST-1 planet.', ids: ['trappist-1-b', 'trappist-1-c', 'trappist-1-d', 'trappist-1-e', 'trappist-1-f', 'trappist-1-g', 'trappist-1-h'] },
  { id: 'stellar-zoo', title: 'Stellar Zoo', description: 'Visit a blue supergiant, a red supergiant, a white dwarf and a neutron star.', ids: ['rigel', 'betelgeuse', 'sirius-b', 'crab-pulsar'] },
  { id: 'local-group', title: 'Local Group', description: 'Visit Andromeda, Triangulum and both Magellanic Clouds.', ids: ['andromeda', 'triangulum', 'lmc', 'smc'] },
  { id: 'imaged', title: 'Seen by the EHT', description: 'Visit both imaged black holes.', ids: ['sgr-a', 'm87-star'] },
]

const BADGES_EXTRA = [
  { id: 'collector', title: 'Collector', description: 'Bookmark five objects.', test: (s) => s.bookmarks.length >= 5 },
  { id: 'comparative', title: 'Side by Side', description: 'Compare objects from the catalogue.', test: (s) => s.compared >= 1 },
  { id: 'exo-hunter', title: 'Exoplanet Hunter', description: 'Visit 15 exoplanets.', test: (s) => countOf(s, 'exoplanet') >= 15 },
  { id: 'past-the-horizon', title: 'Past the Horizon', description: 'Finish a guided descent into a black hole.', test: (s) => s.descents >= 1 },
]

/** Every way to earn a badge, as rules the discovery store can evaluate. */
export const BADGE_RULES = [
  ...MILESTONES.map((milestone) => ({ ...milestone, kind: 'Milestone', test: (s) => milestone.progress(s)[0] >= milestone.progress(s)[1] })),
  ...CHALLENGES.map((challenge) => ({ ...challenge, kind: 'Challenge', test: (s) => visited(s, challenge.ids) })),
  ...BADGES_EXTRA.map((badge) => ({ ...badge, kind: 'Badge' })),
]
