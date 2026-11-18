import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import PointLayer from './PointLayer.jsx'
import { sampleBelt } from '../../../lib/belts.js'
import { J2000, julianDate } from '../../../lib/orbits.js'
import { KM_PER_AU, eclipticToWorld, prng, renderDistance } from '../../../lib/openWorld.js'
import { getOpenSettings, ship } from '../../../lib/openWorldStore.js'
import { scaleCount } from '../../../lib/quality.js'

// Beyond this distance from the Sun the belts are below a pixel: skip them.
const REACH_KM = 3000 * KM_PER_AU

function beltPositions(kind, count, seed) {
  const orbits = sampleBelt(kind, count, prng(seed))
  const days = julianDate(Date.now()) - J2000
  const out = new Float64Array(count * 3)
  const p = [0, 0, 0]
  for (let n = 0; n < count; n += 1) {
    const [a, incl, node, phase] = orbits.subarray(n * 4, n * 4 + 4)
    // Circular orbits, placed for today by Kepler's third law (period a^1.5 years).
    const u = phase + ((Math.PI * 2) / (365.25 * a ** 1.5)) * days
    const x = Math.cos(u)
    const y = Math.sin(u) * Math.cos(incl)
    const z = Math.sin(u) * Math.sin(incl)
    const r = a * KM_PER_AU
    eclipticToWorld(r * (x * Math.cos(node) - y * Math.sin(node)), r * (x * Math.sin(node) + y * Math.cos(node)), r * z, p)
    out.set(p, n * 3)
  }
  return out
}

/**
 * The asteroid belt and Kuiper belt as points of light in the open universe:
 * the same modelled population as the solar system scene (real resonances,
 * invented particles), positioned for today in true kilometres.
 */
export default function Belts() {
  const layer = useRef(null)
  const belts = useMemo(() => {
    const asteroid = scaleCount(3000, 900)
    const kuiper = scaleCount(3500, 900)
    return [
      { positions: beltPositions('asteroid', asteroid, 11), color: [0.62, 0.55, 0.46], size: 1.3, alpha: 0.42 },
      { positions: beltPositions('kuiper', kuiper, 29), color: [0.55, 0.62, 0.74], size: 1.4, alpha: 0.32 },
    ]
  }, [])
  const capacity = belts.reduce((sum, b) => sum + b.positions.length / 3, 0)

  useFrame(() => {
    const l = layer.current
    if (!l) return
    if (!getOpenSettings().belts || Math.hypot(...ship.pos) > REACH_KM) {
      l.commit(0)
      return
    }
    let count = 0
    for (const belt of belts) {
      const pos = belt.positions
      for (let i = 0; i < pos.length; i += 3) {
        const dx = pos[i] - ship.pos[0]
        const dy = pos[i + 1] - ship.pos[1]
        const dz = pos[i + 2] - ship.pos[2]
        const d = Math.max(Math.hypot(dx, dy, dz), 1)
        const k = renderDistance(d) / d
        l.position.array[count * 3] = dx * k
        l.position.array[count * 3 + 1] = dy * k
        l.position.array[count * 3 + 2] = dz * k
        l.color.array.set(belt.color, count * 3)
        l.size.array[count] = belt.size
        l.alpha.array[count] = belt.alpha
        count += 1
      }
    }
    l.commit(count)
  })

  return <PointLayer capacity={capacity} layer={layer} renderOrder={-15} />
}
