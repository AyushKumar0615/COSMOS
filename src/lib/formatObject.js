const number = (value, digits = 3) => Number(value.toPrecision(digits)).toLocaleString('en-GB', { maximumFractionDigits: 6 })

function power(value) {
  const [mantissa, exponent] = value.toExponential(2).split('e')
  return `${Number(mantissa)} × 10^${Number(exponent)}`
}

export function formatDistance(ly) {
  if (ly == null) return null
  if (ly === 0) return 'In the solar system'
  if (ly >= 1e9) return `${number(ly / 1e9)} billion light-years`
  if (ly >= 1e6) return `${number(ly / 1e6)} million light-years`
  return `${number(ly)} light-years`
}

export function formatRadius(km) {
  if (km == null) return null
  const earths = km / 6371
  if (km >= 500000) return `${number(km / 695700)} × the Sun`
  return `${number(km)} km (${number(earths)} × Earth)`
}

export function formatMass(kg) {
  if (kg == null) return null
  const earths = kg / 5.972e24
  if (earths >= 0.01) return `${number(earths)} × Earth`
  return `${power(kg)} kg`
}

export function formatPeriod(days) {
  if (days == null) return null
  if (days >= 730) return `${number(days / 365.25)} years`
  if (days < 1) return `${number(days * 24)} hours`
  return `${number(days)} days`
}

export function formatTemperature(k) {
  return k == null ? null : `${number(k)} K`
}

/** Every property an object has, each tagged with where it stands. */
export function objectProperties(entry) {
  const rows = [
    ['Distance from Earth', formatDistance(entry.distanceLy), entry.distanceNote, entry.estimated],
    ['Radius', formatRadius(entry.radiusKm), entry.radiusNote],
    ['Mass', formatMass(entry.massKg)],
    ['Mass', entry.massSuns ? `${number(entry.massSuns)} Suns` : null],
    ['Density', entry.density ? `${number(entry.density)} g/cm³` : null],
    ['Surface gravity', entry.gravity ? `${number(entry.gravity)} m/s²` : null],
    [entry.temperatureLabel ?? 'Temperature', formatTemperature(entry.temperatureK) ?? entry.temperatureText],
    ['Spectral type', entry.spectralType],
    ['Morphology', entry.morphology && Number.isNaN(Number(entry.morphology)) ? entry.morphology : null],
    ['Apparent magnitude', entry.magnitude != null ? String(entry.magnitude) : null],
    ['Redshift', entry.redshift != null && entry.redshift > 0.01 ? String(entry.redshift) : null],
    ['Orbital period', formatPeriod(entry.periodDays)],
    ['Orbit size', entry.semiMajorAu ? `${number(entry.semiMajorAu)} AU` : entry.orbitKm ? `${number(entry.orbitKm)} km` : null],
    ['Eccentricity', entry.eccentricity != null ? String(entry.eccentricity) : null],
    ['Rotation', formatPeriod(entry.rotationDays)],
    ['Moons', entry.moonsText],
    ['Host star', entry.host ? `${entry.host}${entry.hostType ? ` (${entry.hostType})` : ''}` : null],
    ['Discovered', entry.discovered ? `${entry.discovered}, by ${entry.method.toLowerCase()}` : null],
  ]
  return rows.filter((row) => row[1] != null).map(([label, value, note, estimated]) => ({ label, value, note, estimated }))
}

export const SORTS = {
  name: { label: 'Name', value: (entry) => entry.name, text: true },
  distance: { label: 'Distance', value: (entry) => entry.distanceLy },
  radius: { label: 'Radius', value: (entry) => entry.radiusKm },
  temperature: { label: 'Temperature', value: (entry) => entry.temperatureK },
  mass: { label: 'Mass', value: (entry) => entry.massKg },
  period: { label: 'Orbital period', value: (entry) => entry.periodDays },
}
