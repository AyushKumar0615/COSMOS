// Fetches the sourced extras: constellation figures, Mars rover positions and
// Earth-orbit spacecraft two-line elements. Writes src/data/catalogue/constellations.json
// (figure lines, larger) and extras.json (rovers and orbiters, small).
// Run with `npm run extras`. Nothing here is typed in by hand.
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '../src/data/catalogue')
const retrieved = new Date().toISOString().slice(0, 10)

async function json(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.json()
}

// --- Constellation figures (d3-celestial, BSD-3-Clause; star positions J2000) --------
const D3 = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data'
async function constellations() {
  const [lines, names] = await Promise.all([json(`${D3}/constellations.lines.json`), json(`${D3}/constellations.json`)])
  const byId = Object.fromEntries(names.features.map((f) => [f.id, f]))
  const round = (v) => Math.round(v * 1e4) / 1e4
  return {
    source: { label: 'd3-celestial constellation lines (Olaf Frohn, BSD-3-Clause)', url: 'https://github.com/ofrohn/d3-celestial' },
    figures: lines.features.map((f) => ({
      id: f.id,
      name: byId[f.id]?.properties?.name ?? f.id,
      // RA is given as -180..180 degrees; stored as 0..360.
      lines: f.geometry.coordinates.map((line) => line.map(([ra, dec]) => [round((ra + 360) % 360), round(dec)])),
    })),
  }
}

// --- Mars rovers: latest localised position from NASA's MMGIS rover maps ----------------
const ROVERS = [
  { id: 'perseverance', name: 'Perseverance', mission: 'Mars 2020', url: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints_current.json' },
  { id: 'curiosity', name: 'Curiosity', mission: 'Mars Science Laboratory', url: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints_current.json' },
]
async function rovers() {
  const out = []
  for (const rover of ROVERS) {
    const data = await json(rover.url)
    const p = data.features.at(-1).properties
    out.push({
      id: rover.id,
      name: rover.name,
      mission: rover.mission,
      lat: p.lat,
      lonEast: p.lon,
      sol: p.sol,
      elevationM: p.elev_geoid > -9000 ? p.elev_geoid : null,
      drivenKm: p.dist_km ?? null,
      source: { label: 'NASA/JPL-Caltech rover location map (MMGIS)', url: rover.url },
    })
  }
  return out
}

// --- Earth-orbit spacecraft: two-line elements from CelesTrak (for SGP4) --------------------
const ORBITERS = [
  { id: 'iss', norad: 25544 },
  { id: 'hubble', norad: 20580 },
  { id: 'tiangong', norad: 48274 }, // the station's Tianhe core module
]
async function orbiters() {
  const out = []
  for (const craft of ORBITERS) {
    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${craft.norad}&FORMAT=TLE`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    const [name, line1, line2] = (await response.text()).trim().split(/\r?\n/).map((line) => line.trim())
    if (!line1?.startsWith('1 ') || !line2?.startsWith('2 ')) throw new Error(`No TLE for ${craft.id}`)
    out.push({ id: craft.id, norad: craft.norad, name, line1, line2, source: { label: 'CelesTrak two-line elements (SGP4)', url } })
  }
  return out
}

const sky = { retrieved, ...(await constellations()) }
const extras = { retrieved, rovers: await rovers(), orbiters: await orbiters() }
fs.writeFileSync(path.join(DIR, 'constellations.json'), `${JSON.stringify(sky)}\n`)
fs.writeFileSync(path.join(DIR, 'extras.json'), `${JSON.stringify(extras)}\n`)
console.log(`constellations.json: ${sky.figures.length} figures; extras.json: ${extras.rovers.length} rovers, ${extras.orbiters.length} orbiters`)
console.log(JSON.stringify({ rovers: extras.rovers, orbiters: extras.orbiters }, null, 1))
