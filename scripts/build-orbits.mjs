/**
 * Fetches the orbital data the solar system scene uses for real positions,
 * and writes src/data/catalogue/orbits.json. Run with `npm run orbits`.
 *
 *  - Planets: JPL "Keplerian Elements for Approximate Positions of the Major
 *    Planets", Table 1 (valid 1800–2050), elements and rates per century.
 *  - Moons: JPL planetary satellite mean elements (inclination, node,
 *    argument of periapsis and mean anomaly at epoch, and the frame they are
 *    measured in).
 *  - Dwarf planets, asteroids and comets: JPL Small-Body Database API.
 *  - Spacecraft: heliocentric ecliptic positions from JPL Horizons, sampled
 *    over a date range and interpolated in the browser. These are ephemeris
 *    values (reconstructed or predicted by JPL), not live tracking.
 *
 * Nothing here is typed by hand: every number comes from those services.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').trim()
const cells = (row) => [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((m) => strip(m[1]))
const number = (s) => {
  const n = Number(String(s ?? '').replace(/[^0-9eE.+-]/g, ''))
  return Number.isFinite(n) && String(s ?? '').trim() !== '' && s !== '-' ? n : null
}

async function planets() {
  const html = await (await fetch('https://ssd.jpl.nasa.gov/planets/approx_pos.html')).text()
  const start = html.indexOf('<h4>Table 1</h4>')
  const block = html.slice(start, html.indexOf('<h4>Table 2', start))
  const lines = strip(block).split('\n').map((l) => l.trim()).filter(Boolean)
  const names = { Mercury: 'mercury', Venus: 'venus', 'EM Bary': 'earth', Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn', Uranus: 'uranus', Neptune: 'neptune' }
  const out = {}
  for (let i = 0; i < lines.length; i += 1) {
    const name = Object.keys(names).find((n) => lines[i].startsWith(n + ' '))
    if (!name) continue
    const values = lines[i].slice(name.length).trim().split(/\s+/).map(Number)
    // The table's footnote also starts with "EM Bary"; only data rows have six numbers.
    if (values.length !== 6 || values.some(Number.isNaN)) continue
    const rates = lines[i + 1].split(/\s+/).map(Number)
    if (values.length !== 6 || rates.length !== 6 || values.some(Number.isNaN)) throw new Error(`Could not parse ${name}`)
    const [a, e, I, L, peri, node] = values
    const [da, de, dI, dL, dperi, dnode] = rates
    out[names[name]] = { a, e, I, L, peri, node, rates: { a: da, e: de, I: dI, L: dL, peri: dperi, node: dnode } }
  }
  if (Object.keys(out).length !== 8) throw new Error('Expected eight planets in Table 1')
  return out
}

async function moons() {
  const wanted = ['Moon', 'Phobos', 'Deimos', 'Io', 'Europa', 'Ganymede', 'Callisto', 'Mimas', 'Enceladus', 'Tethys', 'Dione', 'Rhea', 'Titan', 'Iapetus', 'Miranda', 'Ariel', 'Umbriel', 'Titania', 'Oberon', 'Triton', 'Charon']
  const html = await (await fetch('https://ssd.jpl.nasa.gov/sats/elem/')).text()
  const out = {}
  for (const [, row] of html.matchAll(/<tr>(.*?)<\/tr>/gs)) {
    const c = cells(row)
    const id = (c[2] ?? '').toLowerCase()
    if (!wanted.includes(c[2]) || out[id]) continue
    out[id] = {
      frame: c[5],
      epoch: c[6],
      w: number(c[9]),
      M: number(c[10]),
      i: number(c[11]),
      node: number(c[12]),
      periodDays: number(c[13]),
      // Precession periods in years: of the periapsis and of the node.
      apsidalYears: number(c[14]),
      nodalYears: number(c[15]),
    }
  }
  return out
}

const SMALL = {
  ceres: '1',
  pluto: '134340',
  haumea: '136108',
  makemake: '136472',
  eris: '136199',
  vesta: '4',
  pallas: '2',
  hygiea: '10',
  eros: '433',
  bennu: '101955',
  apophis: '99942',
  halley: '1P',
  encke: '2P',
  'churyumov-gerasimenko': '67P',
  'swift-tuttle': '109P',
  'hale-bopp': 'C/1995 O1',
}

async function smallBodies() {
  const out = {}
  for (const [id, designation] of Object.entries(SMALL)) {
    const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(designation)}&phys-par=1&full-prec=1`
    const data = await (await fetch(url)).json()
    const el = Object.fromEntries(data.orbit.elements.map((e) => [e.name, e.value]))
    const phys = Object.fromEntries((data.phys_par ?? []).map((p) => [p.name, p.value]))
    out[id] = {
      name: data.object.fullname,
      kind: data.object.kind,
      orbitClass: data.object.orbit_class?.name ?? null,
      epochJd: Number(data.orbit.epoch),
      a: number(el.a),
      e: number(el.e),
      i: number(el.i),
      node: number(el.om),
      peri: number(el.w),
      M: number(el.ma),
      perihelionJd: number(el.tp),
      q: number(el.q),
      Q: number(el.ad),
      periodDays: number(el.per),
      diameterKm: number(phys.diameter),
      rotationHours: number(phys.rot_per),
      albedo: number(phys.albedo),
    }
  }
  return out
}

const SPACECRAFT = {
  'voyager-1': { code: '-31', step: '30 d' },
  'voyager-2': { code: '-32', step: '30 d' },
  'new-horizons': { code: '-98', step: '30 d' },
  // Daily samples: the probe sweeps through perihelion in a few days.
  'parker-solar-probe': { code: '-96', step: '1 d', start: '2025-06-01', stop: '2027-12-31' },
  juno: { code: '-61', step: '2 d' },
}

async function horizons(code, start, stop, step) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${code}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
    VEC_TABLE: "'1'",
    OUT_UNITS: "'AU-D'",
    REF_PLANE: "'ECLIPTIC'",
    CSV_FORMAT: "'YES'",
  })
  const data = await (await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`)).json()
  const result = data.result ?? ''
  const body = result.slice(result.indexOf('$$SOE') + 5, result.indexOf('$$EOE'))
  if (!result.includes('$$SOE')) return null
  return body
    .trim()
    .split('\n')
    .map((line) => line.split(',').map((s) => s.trim()))
    .map((c) => [Number(c[0]), Number(c[2]), Number(c[3]), Number(c[4])].map((v, i) => (i === 0 ? v : Math.round(v * 1e5) / 1e5)))
}

async function spacecraft() {
  const out = {}
  for (const [id, { code, step, start: from, stop: to }] of Object.entries(SPACECRAFT)) {
    // Try the full window, then narrower ones: an ephemeris can end early
    // (a mission's predicted trajectory) and Horizons then rejects the span.
    let samples = null
    const windows = from ? [[from, to]] : []
    for (const [start, stop] of [...windows, ['2024-01-01', '2029-12-31'], ['2024-01-01', '2027-12-31'], ['2024-01-01', '2026-06-30'], ['2024-01-01', '2025-09-30']]) {
      samples = await horizons(code, start, stop, step)
      if (samples?.length) break
    }
    if (!samples?.length) {
      console.warn(`  no Horizons data for ${id}`)
      continue
    }
    out[id] = { code, samples }
    console.log(`  ${id}: ${samples.length} samples to JD ${samples.at(-1)[0]}`)
  }
  return out
}

console.log('JPL planet elements…')
const planetData = await planets()
console.log('JPL satellite elements…')
const moonData = await moons()
console.log(`  ${Object.keys(moonData).length} moons`)
console.log('JPL Small-Body Database…')
const small = await smallBodies()
console.log(`  ${Object.keys(small).length} bodies`)
console.log('JPL Horizons…')
const craft = await spacecraft()

const retrieved = new Date().toISOString().slice(0, 10)
const write = (name, data) => {
  const file = path.join(root, 'src/data/catalogue', name)
  fs.writeFileSync(file, JSON.stringify({ retrieved, ...data }) + '\n')
  console.log(`Wrote ${path.relative(root, file)} (${Math.round(fs.statSync(file).size / 1024)} kB)`)
}
// Two files: the orbits are small and load with the solar system; the
// spacecraft samples are larger and load only with the spacecraft layer.
// Physical values the scene needs, copied from the catalogue's own archive
// data (measured.json, from JPL), so the solar system never has to load the
// whole catalogue.
const measured = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalogue/measured.json'), 'utf8'))
for (const [id, planet] of Object.entries(planetData)) {
  const m = measured.planets[id]
  Object.assign(planet, { radiusKm: m.radiusKm, rotationDays: m.rotationDays })
}
for (const [id, moon] of Object.entries(moonData)) {
  const m = measured.moons[id]
  Object.assign(moon, { planet: m.planet, radiusKm: m.radiusKm, orbitKm: m.orbitKm, eccentricity: m.eccentricity })
}
const pluto = measured.planets.pluto
small.pluto.radiusKm = pluto.radiusKm
small.pluto.massE24Kg = pluto.massE24Kg
small.pluto.charonGm = measured.moons.charon.gm
// Where the Small-Body Database has no diameter, the catalogue's sourced
// NASA figure (notes.js, with its reason) is used and marked as such.
const { DWARF_DIAMETERS_KM } = await import('../src/data/catalogue/notes.js')
for (const [id, stated] of Object.entries(DWARF_DIAMETERS_KM)) {
  if (small[id] && small[id].diameterKm == null) Object.assign(small[id], { diameterKm: stated.value, diameterNote: stated.note })
}
write('orbits.json', { planets: planetData, moons: moonData, small })
write('trajectories.json', { spacecraft: craft })
