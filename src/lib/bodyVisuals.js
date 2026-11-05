import { PLANETS_BY_ID } from '../data/planets.js'

/**
 * How each body looks. These are appearance choices, not measurements: real
 * colours where a body has been imaged, and an informed guess from size and
 * temperature for exoplanets, none of which has been seen as more than a dot.
 */

const SOLID = {
  moon: ['rocky', ['#6d6a66', '#9c9892', '#4a4845']],
  phobos: ['rocky', ['#4a4238', '#6a5f52', '#332d27']],
  deimos: ['rocky', ['#5a5046', '#7a6e60', '#3e3730']],
  io: ['rocky', ['#c9a53a', '#e8d262', '#8a4a1e']],
  europa: ['ice', ['#e9e2d2', '#f6f1e6', '#a8835f']],
  ganymede: ['rocky', ['#6a6258', '#a59c8e', '#4d463e']],
  callisto: ['rocky', ['#4c443c', '#7a7064', '#2f2a25']],
  mimas: ['rocky', ['#a8a6a2', '#d0cec9', '#7c7a76']],
  enceladus: ['cloudy', ['#dfe9f0', '#f8fbff', '#a9c8dc']],
  tethys: ['rocky', ['#b8b6b2', '#e2e0dc', '#8e8c88']],
  dione: ['rocky', ['#a6a4a0', '#d4d2ce', '#7a7874']],
  rhea: ['rocky', ['#9c9a96', '#c8c6c2', '#73716d']],
  titan: ['cloudy', ['#b97a2a', '#e0a64a', '#8f5a1c']],
  iapetus: ['rocky', ['#2e2820', '#e0dcd2', '#5a5044']],
  miranda: ['rocky', ['#8c8a88', '#bcbab6', '#62605c']],
  ariel: ['rocky', ['#a09e9c', '#cccac6', '#747270']],
  umbriel: ['rocky', ['#4e4c4a', '#716f6c', '#363432']],
  titania: ['rocky', ['#8f8a84', '#b5afa8', '#68635e']],
  oberon: ['rocky', ['#7a7068', '#a0958a', '#574f49']],
  triton: ['rocky', ['#c9a89a', '#e8d4ca', '#9c7a6c']],
  charon: ['rocky', ['#7c736c', '#ada49c', '#5a2e24']],
  ceres: ['rocky', ['#5e5a56', '#847f7a', '#d8d4cc']],
  pluto: ['rocky', ['#8c6a4e', '#e4d2b8', '#4c3226']],
  haumea: ['rocky', ['#c8c8cc', '#efeff2', '#9a9a9f']],
  makemake: ['rocky', ['#a4663e', '#d49a6c', '#7a4628']],
  eris: ['rocky', ['#c4c2c0', '#eceae8', '#98969a']],
}

const ATMOSPHERES = {
  titan: { color: '#e8a64a', glow: 1.4 },
  triton: { color: '#a8c8ff', glow: 0.2 },
  pluto: { color: '#8fb4ff', glow: 0.25 },
  venus: { color: '#ffd89a', glow: 0.9 },
  earth: { color: '#6fb6ff', glow: 1.3 },
  mars: { color: '#ff9b70', glow: 0.35 },
  jupiter: { color: '#ffe2b8', glow: 0.45 },
  saturn: { color: '#ffeccc', glow: 0.4 },
  uranus: { color: '#a8f2f5', glow: 1 },
  neptune: { color: '#7aa6ff', glow: 1.1 },
}

const RINGS = {
  saturn: { inner: 1.25, outer: 2.3, opacity: 1 },
  uranus: { inner: 1.6, outer: 2, opacity: 0.22 },
  neptune: { inner: 1.7, outer: 2.5, opacity: 0.1 },
  jupiter: { inner: 1.4, outer: 1.8, opacity: 0.06 },
  haumea: { inner: 1.6, outer: 1.85, opacity: 0.3 },
}

const seedFrom = (text) => {
  let hash = 0
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) % 9973
  return (hash / 9973) * 9 + 0.5
}

function exoplanetLook(entry) {
  const t = entry.temperatureK ?? 300
  const klass = entry.class
  if (entry.name === 'HD 189733 b') return { surface: 'banded', palette: ['#123a8a', '#3f7fe0', '#b8d4ff'], atmosphere: { color: '#7fb0ff', glow: 1.2 } }
  if (klass === 'Hot Jupiter') {
    return t > 2000
      ? { surface: 'banded', palette: ['#5a1d08', '#e0702a', '#ffd08a'], atmosphere: { color: '#ffb36b', glow: 1.3 }, emissive: 0.5 }
      : { surface: 'banded', palette: ['#5a3a22', '#c88a4e', '#f0d2a0'], atmosphere: { color: '#ffd9a8', glow: 0.9 } }
  }
  if (klass === 'Gas giant') return { surface: 'banded', palette: ['#6a4a34', '#b89878', '#e8d8c0'], atmosphere: { color: '#ffe2c0', glow: 0.5 } }
  if (klass === 'Ice giant' || klass === 'Hot Neptune') return { surface: 'ice', palette: ['#2a5a9a', '#5a9ad0', '#bfe0f0'], atmosphere: { color: '#8fc8ff', glow: 1.1 } }
  if (klass === 'Sub-Neptune') return { surface: 'ice', palette: ['#3a6a7a', '#7ab0b0', '#d0e4e0'], atmosphere: { color: '#a8e0e0', glow: 1 } }
  if (t > 900) return { surface: 'rocky', palette: ['#2a0e08', '#c8401a', '#ffb24a'], atmosphere: { color: '#ff7a3a', glow: 0.7 }, emissive: 0.85 }
  if (t > 340) return { surface: 'rocky', palette: ['#5a3a28', '#a0704c', '#d8b48c'], atmosphere: { color: '#ffc48a', glow: 0.4 } }
  if (entry.temperate) return { surface: 'terrestrial', palette: ['#1d4a6b', '#6a5a44', '#dfe6ea'], atmosphere: { color: '#7fb6ff', glow: 0.9 } }
  return { surface: 'rocky', palette: ['#8a96a4', '#c8d2dc', '#eef2f6'], atmosphere: null }
}

/** Appearance for a planet, moon or exoplanet. */
export function bodyVisual(entry) {
  const planet = PLANETS_BY_ID[entry.id]
  if (planet) {
    return { solar: true, surface: planet.surface, palette: planet.sim.palette, atmosphere: ATMOSPHERES[entry.id] ?? null, rings: RINGS[entry.id] ?? null, tilt: planet.sim.tilt }
  }
  if (entry.type === 'exoplanet') return { id: entry.id, seed: seedFrom(entry.id), rings: null, ...exoplanetLook(entry) }
  const [surface, palette] = SOLID[entry.id] ?? ['rocky', ['#6a6a6a', '#9a9a9a', '#4a4a4a']]
  return {
    id: entry.id,
    seed: seedFrom(entry.id),
    surface,
    palette,
    atmosphere: ATMOSPHERES[entry.id] ?? null,
    rings: RINGS[entry.id] ?? null,
    stretch: entry.id === 'haumea' ? 0.62 : 1,
  }
}

const STAR_FALLBACK = { 'Red supergiant': 3500, 'Red hypergiant': 3400, 'Pulsating giant': 3000, 'Luminous blue variable': 25000, 'Wolf-Rayet star': 45000, 'Neutron star': 40000, 'Red dwarf': 3000 }

/** Temperature to colour a star by, and whether it is only a stand-in. */
export function starLook(entry) {
  const measured = entry.temperatureK ?? entry.hostTeffK
  const k = entry.class ?? ''
  const relative = /hypergiant|supergiant/i.test(k) ? 3.4 : /giant/i.test(k) ? 2.4 : /White dwarf/.test(k) ? 0.42 : /Neutron/.test(k) ? 0.24 : /Red dwarf|Ultracool/.test(k) ? 0.7 : 1.4
  return { temperature: measured ?? STAR_FALLBACK[k] ?? 6000, relative, pulsar: /Neutron/.test(k) }
}
