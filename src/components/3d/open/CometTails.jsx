import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TAIL_GEOMETRY, cometActivity, tailMaterial } from '../../../lib/cometTail.js'
import { julianDate, smallBodyPosition } from '../../../lib/orbits.js'
import { KM_PER_AU, eclipticToWorld, renderDistance } from '../../../lib/openWorld.js'
import { ship } from '../../../lib/openWorldStore.js'

// Model: the tail length drawn at full activity (illustrative, not measured).
const MAX_TAIL_KM = 6e7
const scratch = [0, 0, 0]
const before = [0, 0, 0]
const head = new THREE.Vector3()
const tip = new THREE.Vector3()

/** True world position (km) to its compressed render position about the ship. */
function toRender(x, y, z, out) {
  const dx = x - ship.pos[0]
  const dy = y - ship.pos[1]
  const dz = z - ship.pos[2]
  const d = Math.hypot(dx, dy, dz) || 1
  const k = renderDistance(d) / d
  return out.set(dx * k, dy * k, dz * k)
}

function Tails({ obj }) {
  const tails = useMemo(() => {
    const out = { ion: tailMaterial('#7fc4ff', 0), dust: tailMaterial('#ffe2b0', 0.45) }
    // The shader writes premultiplied colour; blend it as such so the tails
    // keep their brightness against open space.
    out.ion.premultipliedAlpha = true
    out.dust.premultipliedAlpha = true
    return out
  }, [])
  useEffect(() => () => (tails.ion.dispose(), tails.dust.dispose()), [tails])

  useFrame(() => {
    const p = obj.pos
    const r = Math.hypot(p[0], p[1], p[2])
    const activity = cometActivity(r / KM_PER_AU)
    if (activity <= 0) {
      tails.ion.uniforms.uStrength.value = 0
      tails.dust.uniforms.uStrength.value = 0
      return
    }
    const length = MAX_TAIL_KM * activity
    // Motion from where the comet was a little earlier, in world km.
    const jd = julianDate(Date.now())
    smallBodyPosition(obj.comet, jd - Math.max(1, obj.comet.periodDays / 2000), scratch)
    eclipticToWorld(scratch[0] * KM_PER_AU, scratch[1] * KM_PER_AU, scratch[2] * KM_PER_AU, before)
    const lx = before[0] - p[0]
    const ly = before[1] - p[1]
    const lz = before[2] - p[2]
    const ll = Math.hypot(lx, ly, lz) || 1

    toRender(p[0], p[1], p[2], head)
    for (const [material, curve, width, strength] of [
      [tails.ion, 0, 0.025, 0.9],
      [tails.dust, 0.45, 0.07, 0.75],
    ]) {
      const L = material === tails.dust ? length * 0.75 : length
      const u = material.uniforms
      toRender(p[0] + (p[0] / r) * L, p[1] + (p[1] / r) * L, p[2] + (p[2] / r) * L, tip)
      u.uHead.value.copy(head)
      u.uAway.value.subVectors(tip, head)
      const renderLength = u.uAway.value.length() || 1e-6
      u.uAway.value.divideScalar(renderLength)
      // The lag direction in render space, from a point behind on the orbit.
      toRender(p[0] + (lx / ll) * L, p[1] + (ly / ll) * L, p[2] + (lz / ll) * L, tip)
      u.uLag.value.subVectors(tip, head).normalize()
      u.uLength.value = renderLength
      u.uCurve.value = curve
      u.uWidth.value = renderLength * width * (0.6 + activity)
      u.uStrength.value = strength * activity
    }
  })

  return (
    <>
      <mesh geometry={TAIL_GEOMETRY} material={tails.dust} frustumCulled={false} raycast={() => null} />
      <mesh geometry={TAIL_GEOMETRY} material={tails.ion} frustumCulled={false} raycast={() => null} />
    </>
  )
}

/**
 * Ion and dust tails for the catalogued comets near the Sun, drawn in the
 * compressed open-universe space. The comets' positions are JPL's; the tails
 * are a model (direction from the Sun and the orbit, length and brightness
 * illustrative).
 */
export default function CometTails({ world }) {
  const comets = useMemo(() => world.objects.filter((obj) => obj.comet), [world])
  return comets.map((obj) => <Tails key={obj.id} obj={obj} />)
}
