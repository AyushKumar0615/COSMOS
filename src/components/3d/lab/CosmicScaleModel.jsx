import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import PointCloud from '../PointCloud.jsx'
import GlowSprite from '../GlowSprite.jsx'
import { generateGalaxy } from '../../../lib/galaxyGenerator.js'
import { getPlanetTextures } from '../../../lib/planetTextures.js'
import { createPointBuffer, createRandom, rgb, scaleRgb } from '../../../lib/random.js'
import { scaleCount } from '../../../lib/quality.js'
import { GALAXIES } from '../../../data/galaxies.js'

const VIEW = 12 // scene units across which the current scale is drawn
const SPHERE = new THREE.SphereGeometry(1, 56, 40)

/** Opacity of a layer whose own size is 10^own metres, at view size 10^log. */
function presence(log, own, reach = 1.5) {
  return THREE.MathUtils.clamp(1.25 - Math.abs(log - own) / reach, 0, 1)
}

function circle(radius) {
  const points = []
  for (let i = 0; i < 128; i += 1) {
    const a = (i / 128) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

function neighbourhood() {
  const rng = createRandom(42)
  const stars = createPointBuffer()
  const tints = [rgb('#ffd9b0'), rgb('#fff2dc'), rgb('#bcd2ff'), rgb('#ff9f7a')]
  for (let i = 0; i < 900; i += 1) {
    const [x, y, z] = rng.direction()
    const r = Math.pow(rng.next(), 0.34) * 3
    stars.add([x * r, y * r, z * r], scaleRgb(rng.pick(tints), rng.range(0.5, 1)), rng.range(0.8, 2.4))
  }
  return stars.build()
}

function localGroup() {
  const rng = createRandom(77)
  const stars = createPointBuffer()
  const spots = [[-0.3, 0, 0], [0.42, 0.1, 0.16], [0.56, -0.12, 0.3]]
  const sizes = [0.09, 0.12, 0.05]
  spots.forEach((center, index) => {
    for (let i = 0; i < 1800; i += 1) {
      const a = rng.next() * Math.PI * 2
      const r = Math.abs(rng.gauss()) * sizes[index]
      stars.add([center[0] + Math.cos(a) * r, center[1] + rng.gauss() * 0.012, center[2] + Math.sin(a) * r], scaleRgb(rgb('#cfdcff'), rng.range(0.4, 1)), rng.range(0.4, 1))
    }
  })
  for (let i = 0; i < 46; i += 1) {
    const [x, y, z] = rng.direction()
    const r = rng.range(0.15, 1)
    for (let k = 0; k < 40; k += 1) {
      stars.add([x * r + rng.gauss() * 0.012, y * r + rng.gauss() * 0.012, z * r + rng.gauss() * 0.012], scaleRgb(rgb('#ffe2bc'), 0.7), 0.5)
    }
  }
  return stars.build()
}

/** Filaments between random nodes: a stand-in for the large-scale structure. */
function cosmicWeb() {
  const rng = createRandom(13)
  const stars = createPointBuffer()
  const nodes = Array.from({ length: 150 }, () => {
    const [x, y, z] = rng.direction()
    const r = Math.pow(rng.next(), 0.4)
    return [x * r, y * r, z * r]
  })
  const total = scaleCount(60000, 9000)
  for (let i = 0; i < total; i += 1) {
    const a = rng.pick(nodes)
    let b = rng.pick(nodes)
    for (let tries = 0; tries < 3; tries += 1) {
      const candidate = rng.pick(nodes)
      if (Math.hypot(a[0] - candidate[0], a[1] - candidate[1], a[2] - candidate[2]) < Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])) b = candidate
    }
    const t = rng.next()
    const spread = 0.012 + 0.018 * Math.abs(t - 0.5)
    const heat = rng.next()
    stars.add(
      [a[0] + (b[0] - a[0]) * t + rng.gauss() * spread, a[1] + (b[1] - a[1]) * t + rng.gauss() * spread, a[2] + (b[2] - a[2]) * t + rng.gauss() * spread],
      scaleRgb(heat < 0.3 ? rgb('#ffcf9a') : rgb('#9fb9ff'), rng.range(0.35, 0.9)),
      rng.range(0.3, 0.9),
    )
  }
  return stars.build()
}

/**
 * One slider across twenty orders of magnitude. Every layer sits at its true
 * size relative to the view, so each is only on screen near its own scale.
 * `control.log` is the base-10 logarithm of the view's width in metres.
 */
export default function CosmicScaleModel({ control }) {
  const gl = useThree((state) => state.gl)
  const earthMap = useMemo(() => getPlanetTextures(gl).surfaces.earth, [gl])
  const refs = {
    earth: useRef(null),
    moon: useRef(null),
    system: useRef(null),
    stars: useRef(null),
    galaxy: useRef(null),
    group: useRef(null),
    web: useRef(null),
  }
  // Each in the { current: { value } } shape the shared point and glow
  // components read their opacity from.
  const fade = useRef({
    stars: { current: { value: 0 } },
    galaxy: { current: { value: 0 } },
    group: { current: { value: 0 } },
    web: { current: { value: 0 } },
    sun: { current: { value: 0 } },
  })
  const orbitMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#8fb7ff', transparent: true, opacity: 0 }), [])
  const moonMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#cfd8e8', transparent: true, opacity: 0 }), [])
  const orbits = useMemo(() => [0.39, 0.72, 1, 1.52, 5.2, 9.58, 19.2, 30.1].map((au) => circle(au / 30.1)), [])
  const moonOrbit = useMemo(() => circle(1), [])
  const data = useMemo(
    () => ({
      stars: neighbourhood(),
      galaxy: generateGalaxy(GALAXIES[0].model),
      group: localGroup(),
      web: cosmicWeb(),
    }),
    [],
  )

  useEffect(
    () => () => {
      orbits.forEach((orbit) => orbit.dispose())
      moonOrbit.dispose()
      orbitMaterial.dispose()
      moonMaterial.dispose()
    },
    [orbits, moonOrbit, orbitMaterial, moonMaterial],
  )

  useFrame(() => {
    const log = control.current.log
    const at = (ref, ownLog, radius = 1) => {
      if (!ref.current) return
      const scale = Math.pow(10, ownLog - log) * VIEW * radius
      ref.current.scale.setScalar(scale)
      ref.current.visible = scale > 1e-3 && scale < 1e4
    }
    at(refs.earth, 6.8)
    at(refs.moon, 8.58)
    at(refs.system, 12.65)
    at(refs.stars, 16.9, 0.32)
    at(refs.galaxy, 20.68, 1 / 50)
    at(refs.group, 22.6)
    at(refs.web, 26.64)

    orbitMaterial.opacity = presence(log, 12.9) * 0.55
    moonMaterial.opacity = presence(log, 8.9, 1.2) * 0.5
    const f = fade.current
    f.sun.current.value = presence(log, 12.9, 3)
    f.stars.current.value = presence(log, 17, 1.4)
    f.galaxy.current.value = presence(log, 20.9, 1.3)
    f.group.current.value = presence(log, 22.7, 1.1)
    f.web.current.value = presence(log, 26.4, 1.7)
  })

  return (
    <group>
      <ambientLight intensity={0.5} />
      <directionalLight position={[-20, 8, 16]} intensity={2.6} />
      <mesh ref={refs.earth} geometry={SPHERE} raycast={() => null}>
        <meshStandardMaterial map={earthMap} roughness={0.8} metalness={0} />
      </mesh>
      <group ref={refs.moon}>
        <lineLoop geometry={moonOrbit} material={moonMaterial} raycast={() => null} />
      </group>
      <group ref={refs.system}>
        {orbits.map((orbit, index) => (
          <lineLoop key={index} geometry={orbit} material={orbitMaterial} raycast={() => null} />
        ))}
      </group>
      <GlowSprite position={[0, 0, 0]} size={3.4} color="#ffe2a8" intensity={0.8} power={2.6} opacityRef={fade.current.sun} />
      <group ref={refs.stars}>
        <PointCloud {...data.stars} alpha={1} scale={1} maxSize={7} opacityRef={fade.current.stars} />
      </group>
      <group ref={refs.galaxy} rotation={[0.6, 0, 0.2]}>
        <PointCloud {...data.galaxy.stars} alpha={0.8} scale={0.5} maxSize={5} opacityRef={fade.current.galaxy} />
      </group>
      <group ref={refs.group}>
        <PointCloud {...data.group} alpha={0.9} scale={0.5} maxSize={5} opacityRef={fade.current.group} />
      </group>
      <group ref={refs.web}>
        <PointCloud {...data.web} alpha={0.8} scale={0.5} maxSize={4} opacityRef={fade.current.web} />
      </group>
    </group>
  )
}
