#!/usr/bin/env node
/**
 * Builds src/data/catalogue/measured.json from primary archives, so figures in
 * the catalogue are fetched rather than typed from memory:
 *
 *   NASA Exoplanet Archive  exoplanets and their host stars (pscomppars)
 *   SIMBAD (CDS)            stars, galaxies, nebulae, clusters
 *   JPL Solar System Dyn.   planets, moons, small bodies
 *
 * Run by hand with `npm run catalogue`, then review the diff. It is not part
 * of the build: the site never contacts these services at runtime.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(import.meta.dirname, '../src/data/catalogue/measured.json')
const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync' // CDS mirror
const LY_PER_PC = 3.26156

const EXOPLANETS = [
  'TRAPPIST-1 b', 'TRAPPIST-1 c', 'TRAPPIST-1 d', 'TRAPPIST-1 e', 'TRAPPIST-1 f', 'TRAPPIST-1 g', 'TRAPPIST-1 h',
  'Proxima Cen b', 'Proxima Cen d', '51 Peg b', 'HD 209458 b', 'HD 189733 b', 'WASP-12 b', 'WASP-39 b', 'WASP-76 b',
  'WASP-121 b', 'KELT-9 b', '55 Cnc e', 'GJ 1214 b', 'GJ 436 b', 'K2-18 b', 'LHS 1140 b', 'LHS 1140 c', 'Kepler-22 b',
  'Kepler-186 f', 'Kepler-452 b', 'Kepler-16 b', 'Kepler-442 b', 'Kepler-10 b', 'TOI-700 d', 'TOI-700 e', 'TOI-270 d',
  'HR 8799 b', 'HR 8799 c', 'HR 8799 d', 'HR 8799 e', 'bet Pic b', 'PSR B1257+12 c', 'LTT 1445 A b', 'GJ 667 C c', 'eps Eri b',
]

const STARS = {
  sirius: '* alf CMa', 'sirius-b': '* alf CMa B', canopus: '* alf Car', arcturus: '* alf Boo', vega: '* alf Lyr',
  capella: '* alf Aur', rigel: '* bet Ori', procyon: '* alf CMi', betelgeuse: '* alf Ori', achernar: '* alf Eri',
  altair: '* alf Aql', aldebaran: '* alf Tau', antares: '* alf Sco', spica: '* alf Vir', pollux: '* bet Gem',
  fomalhaut: '* alf PsA', deneb: '* alf Cyg', regulus: '* alf Leo', polaris: '* alf UMi', 'alpha-cen-a': '* alf Cen A',
  'alpha-cen-b': '* alf Cen B', proxima: 'NAME Proxima Centauri', barnard: "NAME Barnard's star", 'wolf-359': 'V* CN Leo',
  'tau-ceti': '* tau Cet', 'epsilon-eridani': '* eps Eri', '61-cygni-a': 'V* V1803 Cyg', mira: '* omi Cet',
  'eta-carinae': '* eta Car', 'vy-cma': 'V* VY CMa', 'uy-scuti': 'V* UY Sct', algol: '* bet Per', albireo: '* bet Cyg A',
  mizar: '* zet UMa', castor: '* alf Gem', 'wr-104': 'WR 104', 'van-maanen': "NAME van Maanen's Star",
  'psr-b1919': 'PSR B1919+21', 'crab-pulsar': 'PSR B0531+21', 'vela-pulsar': 'PSR B0833-45', 'trappist-1': 'TRAPPIST-1',
}

// SIMBAD stores catalogue numbers right-aligned, so spacing here is exact.
const DEEP = {
  andromeda: 'M  31', triangulum: 'M  33', whirlpool: 'M  51', pinwheel: 'M 101', sombrero: 'M 104',
  lmc: 'NAME LMC', smc: 'NAME SMC', cartwheel: 'ESO 350-40', 'black-eye': 'M  64', 'centaurus-a': 'NGC  5128',
  bode: 'M  81', cigar: 'M  82', m87: 'M  87', 'ngc-1300': 'NGC  1300', 'southern-pinwheel': 'M  83', sunflower: 'M  63',
  orion: 'M  42', crab: 'M   1', eagle: 'M  16', carina: 'NGC  3372', horsehead: 'NAME Horsehead Nebula', ring: 'M  57', helix: 'NGC  7293',
  lagoon: 'M   8', rosette: 'NGC  2237', 'cats-eye': 'NGC  6543', trifid: 'M  20', tarantula: 'NAME Tarantula Nebula',
  pleiades: 'M  45', hyades: 'NAME Hyades', beehive: 'M  44', 'omega-centauri': 'NGC  5139', '47-tucanae': 'NGC   104',
  hercules: 'M  13', 'double-cluster': 'NGC   869', 'ngc-3603': 'NGC  3603',
  'sgr-a': 'NAME Sgr A*', 'cygnus-x1': 'V* V1357 Cyg', 'ton-618': 'Ton  618',
}

const quote = (id) => `'${id.replaceAll("'", "''")}'`

async function adql(query) {
  const body = new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'json', query })
  const response = await fetch(SIMBAD, { method: 'POST', body })
  const text = await response.text()
  if (!text.startsWith('{')) throw new Error(`SIMBAD: ${text.slice(0, 400)}`)
  const { metadata, data } = JSON.parse(text)
  return data.map((row) => Object.fromEntries(metadata.map((column, i) => [column.name, row[i]])))
}

const median = (values) => {
  const list = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  return list.length ? list[Math.floor(list.length / 2)] : null
}

const round = (value, digits = 4) => (value == null ? null : Number(value.toPrecision(digits)))

async function simbad(map, { trustParallax = true } = {}) {
  const names = Object.values(map)
  const inList = names.map(quote).join(',')
  const base = await adql(`SELECT i.id AS query_id, b.oid, b.main_id, b.ra, b.dec, b.plx_value, b.sp_type, b.otype, b.morph_type, b.rvz_redshift, f.V
    FROM ident i JOIN basic b ON i.oidref = b.oid LEFT JOIN allfluxes f ON f.oidref = b.oid WHERE i.id IN (${inList})`)
  const oids = base.map((row) => row.oid).join(',')
  const temperatures = await adql(`SELECT oidref, teff FROM mesFe_h WHERE oidref IN (${oids}) AND teff IS NOT NULL`)
  const distances = await adql(`SELECT oidref, dist, unit FROM mesDistance WHERE oidref IN (${oids})`)
  const diameters = await adql(`SELECT oidref, diameter, unit, filter FROM mesDiameter WHERE oidref IN (${oids})`).catch(() => [])

  const out = {}
  for (const [id, name] of Object.entries(map)) {
    const row = base.find((entry) => entry.query_id === name)
    if (!row) {
      console.warn('  not found in SIMBAD:', name)
      continue
    }
    const unit = { pc: 1, kpc: 1e3, Mpc: 1e6, Gpc: 1e9 }
    const measured = distances
      .filter((d) => d.oidref === row.oid)
      .map((d) => d.dist * (unit[(d.unit ?? '').trim()] ?? NaN) * LY_PER_PC)
    // A parallax on a galaxy is noise from a foreground source, not a distance.
    const parallax = trustParallax && row.plx_value > 0.5 ? (1000 / row.plx_value) * LY_PER_PC : null
    const distanceLy = parallax ?? median(measured)
    const angular = median(diameters.filter((d) => d.oidref === row.oid && (d.unit ?? '').trim() === 'mas').map((d) => d.diameter))
    // R / R☉ from angular diameter: 1 mas at 1 pc spans 10⁻³ AU, and 1 AU is 215.03 R☉.
    const radiusSun = angular && distanceLy ? (angular * (distanceLy / LY_PER_PC) * 0.215) / 2 : null
    out[id] = {
      simbad: row.main_id,
      ra: round(row.ra, 7),
      dec: round(row.dec, 7),
      distanceLy: round(distanceLy),
      distanceMethod: parallax ? 'parallax' : measured.length ? 'published median' : null,
      spectralType: row.sp_type?.trim() || null,
      otype: row.otype?.trim() || null,
      morphology: row.morph_type?.trim() || null,
      redshift: round(row.rvz_redshift),
      magnitude: round(row.V, 3),
      teffK: round(median(temperatures.filter((t) => t.oidref === row.oid).map((t) => t.teff)), 4),
      radiusSun: round(radiusSun, 3),
    }
  }
  return out
}

async function exoplanets() {
  const list = EXOPLANETS.map((name) => `'${name}'`).join(',')
  const query = `select pl_name,hostname,sy_dist,pl_rade,pl_bmasse,pl_orbper,pl_orbsmax,pl_orbeccen,pl_eqt,st_spectype,st_teff,st_rad,st_mass,disc_year,discoverymethod,ra,dec from pscomppars where pl_name in (${list})`
  const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(query).replaceAll('%20', '+')}&format=json`
  const response = await fetch(url)
  const rows = await response.json()
  const missing = EXOPLANETS.filter((name) => !rows.some((row) => row.pl_name === name))
  if (missing.length) console.warn('  not found in the archive:', missing.join(', '))
  return rows.map((row) => ({
    name: row.pl_name,
    host: row.hostname,
    distanceLy: round(row.sy_dist * LY_PER_PC),
    radiusEarth: round(row.pl_rade, 3),
    massEarth: round(row.pl_bmasse, 3),
    periodDays: round(row.pl_orbper, 5),
    semiMajorAu: round(row.pl_orbsmax, 3),
    eccentricity: round(row.pl_orbeccen, 3),
    equilibriumK: round(row.pl_eqt, 3),
    starType: row.st_spectype?.trim() || null,
    starTeffK: round(row.st_teff, 4),
    starRadiusSun: round(row.st_rad, 3),
    starMassSun: round(row.st_mass, 3),
    discovered: row.disc_year,
    method: row.discoverymethod,
    ra: round(row.ra, 7),
    dec: round(row.dec, 7),
  }))
}

const cells = (row) =>
  [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').trim())
const number = (text) => Number.parseFloat(String(text).split(/\s+/)[0])

async function planets() {
  const html = await (await fetch('https://ssd.jpl.nasa.gov/planets/phys_par.html')).text()
  const out = {}
  for (const [, row] of html.matchAll(/<tr>(.*?)<\/tr>/gs)) {
    const c = cells(row)
    if (!/^(Mercury|Venus|Earth|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)$/.test(c[0])) continue
    // JPL's table lists Pluto's mass in other units than the 10^24 kg heading.
    const mass = number(c[3]) * (c[0] === 'Pluto' ? 1e-6 : 1)
    out[c[0].toLowerCase()] = {
      radiusKm: number(c[2]),
      massE24Kg: mass,
      density: number(c[4]),
      rotationDays: number(c[5]),
      orbitYears: number(c[6]),
      albedo: number(c[8]),
      gravity: number(c[9]),
      escapeKmS: number(c[10]),
    }
  }
  return out
}

async function moons() {
  const wanted = ['Moon', 'Io', 'Europa', 'Ganymede', 'Callisto', 'Mimas', 'Enceladus', 'Tethys', 'Dione', 'Rhea', 'Titan', 'Iapetus', 'Miranda', 'Ariel', 'Umbriel', 'Titania', 'Oberon', 'Triton', 'Charon', 'Phobos', 'Deimos']
  const physical = await (await fetch('https://ssd.jpl.nasa.gov/sats/phys_par/')).text()
  const elements = await (await fetch('https://ssd.jpl.nasa.gov/sats/elem/')).text()
  const out = {}
  for (const [, row] of physical.matchAll(/<tr>(.*?)<\/tr>/gs)) {
    const c = cells(row)
    if (!wanted.includes(c[1])) continue
    out[c[1].toLowerCase()] = { planet: c[0].toLowerCase(), gm: number(c[3]), radiusKm: number(c[4]), density: number(c[5]) }
  }
  for (const [, row] of elements.matchAll(/<tr>(.*?)<\/tr>/gs)) {
    const c = cells(row)
    const entry = out[(c[2] ?? '').toLowerCase()]
    if (entry && entry.orbitKm == null) {
      entry.orbitKm = number(c[7])
      entry.eccentricity = number(c[8])
      entry.periodDays = number(c[13])
    }
  }
  return out
}

async function smallBodies() {
  const ids = { ceres: 1, eris: 136199, haumea: 136108, makemake: 136472, pluto: 134340 }
  const out = {}
  for (const [id, number_] of Object.entries(ids)) {
    const data = await (await fetch(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${number_}&phys-par=1`)).json()
    const phys = Object.fromEntries((data.phys_par ?? []).map((p) => [p.name, p.value]))
    const orbit = Object.fromEntries(data.orbit.elements.map((e) => [e.name, e.value]))
    out[id] = {
      semiMajorAu: Number(orbit.a),
      eccentricity: Number(orbit.e),
      periodDays: Number(orbit.per),
      rotationHours: phys.rot_per ? Math.abs(Number(phys.rot_per)) : null,
      diameterKm: phys.diameter ? Number(phys.diameter) : null,
      density: phys.density ? Number(phys.density) : null,
    }
  }
  return out
}

console.log('NASA Exoplanet Archive…')
const exo = await exoplanets()
console.log(`  ${exo.length} planets`)
console.log('JPL…')
const [planetData, moonData, small] = [await planets(), await moons(), await smallBodies()]
console.log(`  ${Object.keys(planetData).length} planets, ${Object.keys(moonData).length} moons, ${Object.keys(small).length} small bodies`)
console.log('SIMBAD…')
const stars = await simbad(STARS)
const deep = await simbad(DEEP, { trustParallax: false })
console.log(`  ${Object.keys(stars).length} stars, ${Object.keys(deep).length} deep-sky objects`)

fs.writeFileSync(
  OUT,
  `${JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), exoplanets: exo, planets: planetData, moons: moonData, smallBodies: small, stars, deep }, null, 1)}\n`,
)
console.log('Wrote', path.relative(process.cwd(), OUT))
