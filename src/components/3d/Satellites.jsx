import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SATELLITES, isProbe } from '../../data/satellites.js'

// Probes in orbit round the Sun are drawn by Probes.jsx.
const ORBITERS = SATELLITES.filter((craft) => !isProbe(craft))
import { PLANETS_BY_ID } from '../../data/planets.js'
import { satelliteMaterials, satelliteModel } from '../../lib/satelliteModels.js'
import { clock as simClock } from '../../lib/simClock.js'

const DEG = Math.PI / 180
const HIT = new THREE.SphereGeometry(1, 10, 8)
const UP = new THREE.Vector3(0, 1, 0)

const lightVertex = /* glsl */ `
  attribute vec3 color;
  attribute float phase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vOn;
  void main() {
    vColor = color;
    // A short flash once every 1.4 s, each light offset from the next.
    float cycle = fract(uTime / 1.4 + phase);
    vOn = 0.25 + 0.75 * (1.0 - smoothstep(0.0, 0.12, cycle));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(10.0 * uPixelRatio * (0.6 + vOn), 2.0, 20.0);
    gl_Position = projectionMatrix * mv;
  }
`

const lightFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vOn;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    float a = (exp(-r * r * 9.0) + exp(-r * 3.5) * 0.25) * vOn;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`

function orbitGeometry(radius) {
  const points = []
  for (let i = 0; i <= 128; i += 1) {
    const a = (i / 128) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

const hostPosition = new THREE.Vector3()
const worldPosition = new THREE.Vector3()
const tangent = new THREE.Vector3()
const radial = new THREE.Vector3()
const normal = new THREE.Vector3()
const basis = new THREE.Matrix4()

/**
 * One spacecraft. Its outer group follows the host planet; inside, an orbit
 * frame is tilted by the host's axial tilt, then by the orbit's inclination
 * and node, and the craft moves round a circle in that frame, oriented along
 * its velocity with its belly to the planet.
 *
 * Detail by distance: the model and its click target only exist on screen
 * when the camera is close enough to see them; between that and twice the
 * distance only the navigation lights show, as glints; beyond, nothing.
 */
function Satellite({ satellite, hosts, selected, showOrbit, onSelect, onRegister, lightMaterial }) {
  const camera = useThree((state) => state.camera)
  const host = PLANETS_BY_ID[satellite.host]
  const hostRadius = host.sim.radius
  const { radius, inclination = 0, node = 0, phase, size, period, l2, halo } = satellite.sim
  const orbitRadius = radius * hostRadius

  const followRef = useRef(null)
  const craftRef = useRef(null)
  const modelRef = useRef(null)
  const lightsRef = useRef(null)
  const hitRef = useRef(null)
  const orbitRef = useRef(null)

  const model = useMemo(() => satelliteModel(satellite.model), [satellite.model])
  const materials = satelliteMaterials()
  const orbit = useMemo(() => (l2 ? null : orbitGeometry(orbitRadius)), [l2, orbitRadius])
  const orbitMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.32, depthWrite: false }),
    [],
  )
  useEffect(
    () => () => {
      orbit?.dispose()
      orbitMaterial.dispose()
    },
    [orbit, orbitMaterial],
  )

  useLayoutEffect(() => {
    onRegister(satellite.id, craftRef.current)
    return () => onRegister(satellite.id, null)
  }, [satellite.id, onRegister])

  useFrame(() => {
    const hostNode = hosts.current.get(satellite.host)
    const follow = followRef.current
    const craft = craftRef.current
    if (!hostNode || !follow || !craft) return

    follow.position.copy(hostNode.position)
    // Shared simulation clock: pauses and speeds up with everything else.
    // Spacecraft keep compressed periods in both time modes.
    const angle = phase + simClock.t * ((Math.PI * 2) / period)

    if (l2) {
      // Directly away from the Sun, with a slow halo loop around the point.
      hostPosition.copy(hostNode.position).normalize()
      tangent.crossVectors(UP, hostPosition).normalize()
      craft.position
        .copy(hostPosition)
        .multiplyScalar(orbitRadius)
        .addScaledVector(tangent, Math.cos(angle) * halo * hostRadius)
        .addScaledVector(UP, Math.sin(angle) * halo * 0.6 * hostRadius)
      // Sunshield towards the Sun, mirror in its shade facing up (+z).
      normal.copy(UP).addScaledVector(hostPosition, -UP.dot(hostPosition)).normalize()
      radial.crossVectors(hostPosition, normal)
      basis.makeBasis(radial, hostPosition, normal)
      craft.quaternion.setFromRotationMatrix(basis)
    } else {
      craft.position.set(Math.cos(angle) * orbitRadius, 0, -Math.sin(angle) * orbitRadius)
      // Nose along the velocity, belly (−y) towards the planet.
      radial.copy(craft.position).normalize()
      tangent.set(-Math.sin(angle), 0, -Math.cos(angle))
      normal.crossVectors(radial, tangent)
      basis.makeBasis(normal, radial, tangent)
      craft.quaternion.setFromRotationMatrix(basis)
    }

    craft.getWorldPosition(worldPosition)
    const distance = camera.position.distanceTo(worldPosition)
    const near = hostRadius * 9
    const showModel = selected || distance < near
    const showLights = showModel || distance < near * 2.2
    if (modelRef.current) modelRef.current.visible = showModel
    if (hitRef.current) hitRef.current.visible = showModel
    if (lightsRef.current) lightsRef.current.visible = showLights
    if (orbitRef.current) orbitRef.current.visible = (showOrbit || selected) && distance < near * 3
  })

  const tilt = (host.sim.tilt ?? 0) * DEG

  return (
    <group ref={followRef}>
      <group rotation={[0, 0, tilt]}>
        <group rotation={l2 ? [0, 0, -tilt] : [0, node, 0]}>
          <group rotation={l2 ? [0, 0, 0] : [inclination * DEG, 0, 0]}>
            {orbit && (
              <lineLoop ref={orbitRef} geometry={orbit} material={orbitMaterial} visible={false} raycast={() => null} />
            )}
            <group ref={craftRef}>
              <group scale={size}>
                <group ref={modelRef} visible={false}>
                  {model.meshes.map((mesh) => (
                    <mesh key={mesh.material} geometry={mesh.geometry} material={materials[mesh.material]} raycast={() => null} />
                  ))}
                </group>
                {model.lights && (
                  <points ref={lightsRef} geometry={model.lights} material={lightMaterial} frustumCulled={false} visible={false} raycast={() => null} />
                )}
              </group>
              <mesh
                ref={hitRef}
                geometry={HIT}
                scale={size * 1.6}
                visible={false}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(satellite.id)
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
          </group>
        </group>
      </group>
    </group>
  )
}

/**
 * Every spacecraft, following the planets registered in `hosts`. Mounted
 * inside the solar system's scaled group, so it unfolds and collapses with it.
 */
export default function Satellites({ hosts, selectedId, showOrbits, onSelect, onRegister, reducedMotion }) {
  const gl = useThree((state) => state.gl)
  const lightMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: lightVertex,
        fragmentShader: lightFragment,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => lightMaterial.dispose(), [lightMaterial])
  useFrame((_, delta) => {
    // Steady lights under reduced motion: no blinking.
    if (!reducedMotion) lightMaterial.uniforms.uTime.value += Math.min(delta, 0.1)
    lightMaterial.uniforms.uPixelRatio.value = gl.getPixelRatio()
  })
  useEffect(
    () => () => {
      document.body.style.cursor = 'auto'
    },
    [],
  )

  return ORBITERS.map((satellite) => (
    <Satellite
      key={satellite.id}
      satellite={satellite}
      hosts={hosts}
      selected={selectedId === satellite.id}
      showOrbit={showOrbits}
      onSelect={onSelect}
      onRegister={onRegister}
      lightMaterial={lightMaterial}
    />
  ))
}
