import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import StarBody from './StarBody.jsx'
import PointCloud from '../PointCloud.jsx'
import PlanetAtmosphere from '../PlanetAtmosphere.jsx'
import SaturnRings from '../SaturnRings.jsx'
import { generateCluster } from '../../../lib/starPopulations.js'
import { getPlanetTextures, getWorldTexture } from '../../../lib/planetTextures.js'
import { scaleCount } from '../../../lib/quality.js'

const SPHERE = new THREE.SphereGeometry(1, 56, 40)
const HIT = new THREE.SphereGeometry(1, 12, 10)
const ALWAYS = { current: { value: 1 } }
const worldPosition = new THREE.Vector3()
const offset = new THREE.Vector3()
const projected = new THREE.Vector3()

function orbitLine(radius) {
  const points = []
  for (let i = 0; i < 160; i += 1) {
    const a = (i / 160) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

function Surface({ visual, size, reducedMotion }) {
  const gl = useThree((state) => state.gl)
  const texture = useMemo(() => {
    if (visual.solar) return null
    return getWorldTexture(gl, visual, [512, 256])
  }, [gl, visual])
  const solar = useMemo(() => (visual.solar ? getPlanetTextures(gl) : null), [gl, visual])
  const map = texture ?? solar?.surfaces[visual.solarId]
  const spin = useRef(null)
  useFrame((_, delta) => {
    if (spin.current && !reducedMotion) spin.current.rotation.y += Math.min(delta, 0.1) * 0.12
  })
  return (
    <group scale={size} rotation={[0, 0, THREE.MathUtils.degToRad(visual.tilt ?? 8)]}>
      <mesh ref={spin} geometry={SPHERE} scale={[1, visual.stretch ?? 1, 1]} raycast={() => null}>
        <meshStandardMaterial
          map={map}
          roughness={0.9}
          metalness={0}
          emissive={visual.emissive ? '#ffffff' : '#000000'}
          emissiveMap={visual.emissive ? map : null}
          emissiveIntensity={visual.emissive ?? 0}
        />
      </mesh>
      {visual.atmosphere && <PlanetAtmosphere geometry={SPHERE} color={visual.atmosphere.color} intensity={visual.atmosphere.glow} />}
      {visual.rings && solar === null && <Rings rings={visual.rings} />}
      {visual.rings && solar && <SaturnRings inner={visual.rings.inner} outer={visual.rings.outer} texture={solar.rings} opacity={visual.rings.opacity} />}
    </group>
  )
}

function Rings({ rings }) {
  const gl = useThree((state) => state.gl)
  const textures = useMemo(() => getPlanetTextures(gl), [gl])
  return <SaturnRings inner={rings.inner} outer={rings.outer} texture={textures.rings} opacity={rings.opacity} />
}

function Body({ body, selected, onSelect, register, reducedMotion }) {
  const orbitRef = useRef(null)
  const clock = useRef(body.phase)
  const line = useMemo(() => orbitLine(body.orbit), [body.orbit])
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#8fa4d0', transparent: true, opacity: 0.2 }), [])
  useEffect(
    () => () => {
      line.dispose()
      material.dispose()
    },
    [line, material],
  )
  useEffect(() => {
    register(body.entry.id, orbitRef.current, body.size)
    return () => register(body.entry.id, null)
  }, [body, register])

  useFrame((_, delta) => {
    if (!reducedMotion) clock.current += Math.min(delta, 0.1) * body.speed * 0.14
    orbitRef.current.position.set(Math.cos(clock.current) * body.orbit, 0, Math.sin(clock.current) * body.orbit)
    material.opacity = selected ? 0.5 : 0.2
  })

  return (
    <>
      <lineLoop geometry={line} material={material} raycast={() => null} />
      <group ref={orbitRef}>
        <Surface visual={body.visual} size={body.size} reducedMotion={reducedMotion} />
        <mesh
          geometry={HIT}
          scale={Math.max(body.size * 1.5, 0.75)}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(body.entry.id)
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </group>
    </>
  )
}

function Cluster({ entry }) {
  const data = useMemo(() => {
    const globular = entry.class === 'Globular cluster'
    let seed = 7
    for (const character of entry.id) seed = (seed * 31 + character.charCodeAt(0)) % 100000
    return generateCluster(globular ? 'globular' : 'open', seed, scaleCount(globular ? 22000 : 2600, 900))
  }, [entry])
  return <PointCloud {...data} alpha={0.95} scale={0.6} maxSize={12} opacityRef={ALWAYS} />
}

/**
 * One system up close. A handful of real meshes, created only while the
 * system is on screen. The camera follows whatever is selected: moving the
 * rig with the body keeps zoom and pan working while it orbits.
 */
export default function SystemView({ system, selectedId, onSelect, view, reducedMotion }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const controls = useRef(null)
  const nodes = useRef(new Map())
  const followed = useRef({ id: null, last: new THREE.Vector3(), arriving: 0 })

  const register = useMemo(
    () => (id, node, bodySize) => {
      if (node) nodes.current.set(id, { node, size: bodySize })
      else nodes.current.delete(id)
    },
    [],
  )

  const reach = system.bodies.length ? system.bodies[system.bodies.length - 1].orbit : 14

  // A fresh view of the whole system each time one opens.
  useEffect(() => {
    camera.position.set(0, reach * 0.62 + 4, reach * 1.25 + 6)
    camera.lookAt(0, 0, 0)
    if (controls.current) {
      controls.current.target.set(0, 0, 0)
      controls.current.update()
    }
    followed.current.id = null
  }, [system, camera, reach])

  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return
    const f = followed.current
    const entry = nodes.current.get(selectedId)
    const dt = Math.min(delta, 0.1)

    if (entry) {
      entry.node.getWorldPosition(worldPosition)
      if (f.id !== selectedId) {
        f.id = selectedId
        f.arriving = 1
        f.last.copy(c.target)
      }
      if (f.arriving > 0) {
        // Ease in, then lock on.
        const k = reducedMotion ? 1 : 1 - Math.exp(-3.4 * dt)
        offset.copy(worldPosition).sub(c.target).multiplyScalar(k)
        c.target.add(offset)
        camera.position.add(offset)
        const wanted = Math.max(entry.size * 5.2, 3)
        const current = camera.position.distanceTo(c.target)
        offset.copy(camera.position).sub(c.target).normalize()
        camera.position.addScaledVector(offset, (wanted - current) * k)
        if (c.target.distanceTo(worldPosition) < 0.02 && Math.abs(wanted - current) < 0.08) f.arriving = 0
      } else {
        offset.copy(worldPosition).sub(f.last)
        c.target.add(offset)
        camera.position.add(offset)
      }
      f.last.copy(worldPosition)
    } else {
      f.id = null
    }
    c.update()

    // Name each body with the shared label pool.
    const root = view.current.labels
    if (!root) return
    const list = root.children
    let used = 0
    for (const body of system.bodies) {
      const node = nodes.current.get(body.entry.id)
      if (!node || used >= list.length) continue
      node.node.getWorldPosition(projected)
      projected.project(camera)
      if (projected.z > 1 || Math.abs(projected.x) > 0.96 || Math.abs(projected.y) > 0.9) continue
      const label = list[used]
      used += 1
      if (label.textContent !== body.entry.name) label.textContent = body.entry.name
      label.dataset.id = body.entry.id
      label.dataset.selected = body.entry.id === selectedId
      const x = ((projected.x + 1) / 2) * size.width
      const width = body.entry.name.length * 6.6 + 8
      const left = x + 8 + width > size.width - 8 ? x - 8 - width : x + 8
      label.style.transform = `translate(${Math.round(left)}px, ${Math.round(((1 - projected.y) / 2) * size.height - 8)}px)`
      label.style.opacity = '1'
      label.style.pointerEvents = 'auto'
    }
    for (let i = used; i < list.length; i += 1) {
      list[i].style.opacity = '0'
      list[i].style.pointerEvents = 'none'
    }
  })

  const center = system.center
  const stars = center?.kind === 'star' ? center : null
  const binary = stars?.entry.binary

  return (
    <>
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} rotateSpeed={0.55} zoomSpeed={0.8} panSpeed={0.7} screenSpacePanning minDistance={1.2} maxDistance={reach * 3 + 30} />
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 0, 0]} intensity={140} decay={1.4} color="#fff4e4" />

      {system.cluster && <Cluster entry={system.cluster} />}

      {stars && (
        <group position={binary ? [-3.2, 0, 0] : [0, 0, 0]}>
          <StarBody temperature={stars.look.temperature} radius={system.centerSize * Math.min(stars.look.relative / 1.4, 1.5)} reducedMotion={reducedMotion} cells={stars.look.relative > 2 ? 1.8 : 3.4} />
        </group>
      )}
      {binary && (
        <group position={[3.8, 0.4, -1]}>
          <StarBody temperature={binary.temperature} radius={system.centerSize * binary.size} reducedMotion={reducedMotion} />
        </group>
      )}
      {center?.kind === 'body' && (
        <group ref={(node) => node && register(center.entry.id, node, system.centerSize)}>
          <Surface visual={{ ...center.visual, solarId: center.entry.id }} size={system.centerSize} reducedMotion={reducedMotion} />
          <directionalLight position={[-30, 12, 22]} intensity={2.4} color="#fff2e0" />
        </group>
      )}

      {system.bodies.map((body) => (
        <Body
          key={body.entry.id}
          body={{ ...body, visual: { ...body.visual, solarId: body.entry.id } }}
          selected={body.entry.id === selectedId}
          onSelect={onSelect}
          register={register}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  )
}
