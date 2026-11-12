import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SATELLITES, isProbe } from '../../data/satellites.js'
import { radiusFromAu } from '../../data/solarBodies.js'
import { satelliteMaterials, satelliteModel } from '../../lib/satelliteModels.js'
import { clock } from '../../lib/simClock.js'
import { eclipticToScene, julianDate } from '../../lib/orbits.js'
import { probeJd, trajectoryPeriod, trajectoryPosition, trajectoryRange } from '../../lib/trajectories.js'

/**
 * Deep-space probes placed from JPL Horizons ephemerides for the simulated
 * date: Voyager 1 and 2, New Horizons and Parker Solar Probe. Distances are
 * compressed onto the scene exactly as for the planets and comets; the
 * direction from the Sun is real. A faint glint marks each probe from afar,
 * and its downloaded track is drawn when selected or when orbit lines are on.
 */
const PROBES = SATELLITES.filter(isProbe)
const NOW = julianDate(Date.now())
const HIT = new THREE.SphereGeometry(1, 10, 8)
const UP_Y = new THREE.Vector3(0, 1, 0)
const UP_Z = new THREE.Vector3(0, 0, 1)

const helio = [0, 0, 0]
const scene = [0, 0, 0]
const sunward = new THREE.Vector3()

function toScene(p, out) {
  const r = Math.hypot(p[0], p[1], p[2])
  const k = radiusFromAu(r) / r
  eclipticToScene(p[0] * k, p[1] * k, p[2] * k, scene)
  return out.set(scene[0], scene[1], scene[2])
}

/** The downloaded track, densified wherever it turns quickly. */
function trackGeometry(id) {
  const range = trajectoryRange(id)
  const period = trajectoryPeriod(id)
  // A repeating orbit needs one lap; a probe leaving the system, the whole span.
  const end = period ? Math.min(range[1], range[0] + period) : range[1]
  const points = []
  const v = new THREE.Vector3()
  let jd = range[0]
  while (jd <= end) {
    const p = trajectoryPosition(id, jd, helio)
    points.push(toScene(p, v).clone())
    // A fraction of a degree per step even at an eccentric perihelion,
    // between half an hour and ten days.
    const r = Math.hypot(p[0], p[1], p[2])
    jd += Math.min(10, Math.max(1 / 48, 0.2 * Math.pow(r, 1.5)))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

const glintVertex = /* glsl */ `
  uniform float uPixelRatio;
  void main() {
    gl_PointSize = 9.0 * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const glintFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    float a = (exp(-r * r * 10.0) + exp(-r * 3.0) * 0.2) * uStrength;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`
const GLINT_POINT = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))

function Probe({ craft, selected, showTrack, onSelect, onRegister, glint }) {
  const camera = useThree((state) => state.camera)
  const groupRef = useRef(null)
  const modelRef = useRef(null)
  const model = useMemo(() => satelliteModel(craft.model), [craft.model])
  const materials = satelliteMaterials()
  const loops = Boolean(trajectoryPeriod(craft.trajectory))
  const track = useMemo(() => {
    const line = new THREE.Line(
      trackGeometry(craft.trajectory),
      new THREE.LineBasicMaterial({ color: '#9ad8ff', transparent: true, opacity: 0.3, depthWrite: false }),
    )
    line.visible = false
    line.raycast = () => null
    return line
  }, [craft.trajectory])
  useEffect(() => () => (track.geometry.dispose(), track.material.dispose()), [track])

  useLayoutEffect(() => {
    onRegister(craft.id, groupRef.current)
    return () => onRegister(craft.id, null)
  }, [craft.id, onRegister])

  // Parker faces the Sun with its heat shield (+z); the others point their
  // dishes (+y) home, which from this far is the Sun's direction too.
  const facing = craft.model === 'parker' ? UP_Z : UP_Y

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const jd = probeJd(craft.trajectory, clock, NOW, loops)
    const p = trajectoryPosition(craft.trajectory, jd, helio)
    group.visible = Boolean(p)
    track.visible = showTrack || selected
    if (!p) return
    toScene(p, group.position)
    sunward.copy(group.position).negate().normalize()
    group.quaternion.setFromUnitVectors(facing, sunward)
    // The model only matters close up; the glint carries it from afar.
    if (modelRef.current) {
      const distance = camera.position.distanceTo(group.getWorldPosition(sunward))
      modelRef.current.visible = selected || distance < craft.sim.size * 160
    }
  })

  return (
    <>
      <primitive object={track} />
      <group ref={groupRef}>
        <group ref={modelRef} scale={craft.sim.size}>
          {model.meshes.map((mesh) => (
            <mesh key={mesh.material} geometry={mesh.geometry} material={materials[mesh.material]} raycast={() => null} />
          ))}
        </group>
        <points geometry={GLINT_POINT} material={glint} frustumCulled={false} raycast={() => null} />
        <mesh
          geometry={HIT}
          scale={Math.max(craft.sim.size * 2, 0.16)}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(craft.id)
          }}
          onPointerOver={(event) => {
            event.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto'
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </group>
    </>
  )
}

export default function Probes({ selectedId, showTracks, onSelect, onRegister }) {
  const gl = useThree((state) => state.gl)
  const glint = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glintVertex,
        fragmentShader: glintFragment,
        uniforms: { uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color('#cfeaff') }, uStrength: { value: 0.85 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => glint.dispose(), [glint])
  useFrame(() => {
    glint.uniforms.uPixelRatio.value = gl.getPixelRatio()
  })
  useEffect(
    () => () => {
      document.body.style.cursor = 'auto'
    },
    [],
  )
  return PROBES.map((craft) => (
    <Probe
      key={craft.id}
      craft={craft}
      selected={selectedId === craft.id}
      showTrack={showTracks}
      onSelect={onSelect}
      onRegister={onRegister}
      glint={glint}
    />
  ))
}
