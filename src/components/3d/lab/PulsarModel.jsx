import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import GlowSprite from '../GlowSprite.jsx'
import { NOISE_GLSL } from '../shaders/noise.glsl.js'

const TILT = THREE.MathUtils.degToRad(28)
const ALWAYS = { current: { value: 1 } }

const beamMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        float edge = pow(abs(vNormal.z), 1.6);
        float fade = pow(vUv.y, 1.8);
        gl_FragColor = vec4(vec3(0.5, 0.74, 1.0) * edge * fade * 0.5, 1.0);
      }
    `,
  })

const surfaceMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        float crust = fbm3(vPosition * 5.0) * 0.5 + 0.5;
        float polar = smoothstep(0.82, 1.0, abs(normalize(vPosition).y));
        vec3 color = mix(vec3(0.42, 0.6, 1.0), vec3(0.92, 0.96, 1.0), crust);
        color += vec3(0.8, 0.9, 1.0) * polar * 1.6;
        gl_FragColor = vec4(color * (0.4 + 0.75 * pow(max(vNormal.z, 0.0), 0.6)), 1.0);
      }
    `,
  })

/** Points along one dipole field line: r = L sin²θ, in the plane at `azimuth`. */
function fieldLine(reach, azimuth) {
  const points = []
  for (let i = 0; i <= 64; i += 1) {
    const theta = 0.16 + (Math.PI - 0.32) * (i / 64)
    const r = reach * Math.sin(theta) ** 2
    const planar = r * Math.sin(theta)
    points.push(new THREE.Vector3(Math.cos(azimuth) * planar, r * Math.cos(theta), Math.sin(azimuth) * planar))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

/**
 * A pulsar: the star and its dipole field turn together about the spin axis,
 * with the magnetic axis tilted away from it, so the beams sweep the sky.
 */
export default function PulsarModel({ control, reducedMotion }) {
  const spin = useRef(null)
  const surface = useMemo(surfaceMaterial, [])
  const beam = useMemo(beamMaterial, [])
  const lines = useMemo(() => {
    const list = []
    for (const reach of [7, 12, 19]) {
      for (let i = 0; i < 6; i += 1) list.push(fieldLine(reach, (i / 6) * Math.PI * 2 + reach))
    }
    return list
  }, [])
  const lineMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#6fa8ff', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  )
  const cone = useMemo(() => new THREE.ConeGeometry(5.2, 62, 40, 1, true), [])
  const sphere = useMemo(() => new THREE.SphereGeometry(2, 64, 44), [])

  useEffect(
    () => () => {
      lines.forEach((line) => line.dispose())
      cone.dispose()
      sphere.dispose()
      surface.dispose()
      beam.dispose()
      lineMaterial.dispose()
    },
    [lines, cone, sphere, surface, beam, lineMaterial],
  )

  useFrame((_, delta) => {
    if (spin.current && !reducedMotion) spin.current.rotation.y += Math.min(delta, 0.1) * control.current.speed
  })

  return (
    <group ref={spin}>
      <group rotation={[0, 0, TILT]}>
        <mesh geometry={sphere} material={surface} raycast={() => null} />
        {lines.map((line, index) => (
          <lineLoop key={index} geometry={line} material={lineMaterial} raycast={() => null} />
        ))}
        <mesh geometry={cone} material={beam} position={[0, 33, 0]} rotation={[Math.PI, 0, 0]} raycast={() => null} />
        <mesh geometry={cone} material={beam} position={[0, -33, 0]} raycast={() => null} />
      </group>
      <GlowSprite position={[0, 0, 0]} size={16} color="#a8ccff" intensity={0.55} power={2.6} opacityRef={ALWAYS} />
    </group>
  )
}
