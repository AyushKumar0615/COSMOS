import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import GlowSprite from '../GlowSprite.jsx'
import { NOISE_GLSL } from '../shaders/noise.glsl.js'
import { temperatureColor } from '../../../lib/starPopulations.js'

const SPHERE = new THREE.SphereGeometry(1, 64, 44)
const ALWAYS = { current: { value: 1 } }

const vertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  ${NOISE_GLSL}
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    float cells = fbm3(vPosition * uScale + uTime * 0.04) * 0.5 + 0.5;
    float fine = fbm3(vPosition * uScale * 3.4 - uTime * 0.06) * 0.5 + 0.5;
    float limb = pow(max(vNormal.z, 0.0), 0.55);
    vec3 color = mix(uColor * 0.62, mix(uColor, vec3(1.0), 0.45), cells) * (0.72 + 0.5 * fine);
    gl_FragColor = vec4(color * (0.42 + 0.78 * limb) * 1.25, 1.0);
  }
`

/** A star, coloured by its temperature, with convection cells and a glow. */
export default function StarBody({ temperature, radius = 2, cells = 3.4, reducedMotion }) {
  const color = useMemo(() => {
    const [r, g, b] = temperatureColor(temperature)
    return new THREE.Color(r, g, b)
  }, [temperature])
  const hex = `#${color.getHexString()}`
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uColor: { value: color }, uTime: { value: 0 }, uScale: { value: cells } },
      }),
    [color, cells],
  )
  useEffect(() => () => material.dispose(), [material])
  const clock = useRef(0)
  useFrame((_, delta) => {
    if (!reducedMotion) clock.current += Math.min(delta, 0.1)
    material.uniforms.uTime.value = clock.current
  })
  return (
    <group>
      <mesh geometry={SPHERE} material={material} scale={radius} raycast={() => null} />
      <GlowSprite position={[0, 0, 0]} size={radius * 7} color={hex} intensity={0.5} power={2.6} opacityRef={ALWAYS} />
    </group>
  )
}
