import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getEffects } from '../../lib/effects.js'
import { scaleCount } from '../../lib/quality.js'

/**
 * Three illustrative layers behind and around the solar system, each one
 * draw call:
 *
 *  - distant galaxies: small spirals and ellipticals drawn per point in the
 *    fragment shader, scattered beyond the starfield;
 *  - cosmic dust: faint motes in a box that wraps around the camera, so
 *    there is always something drifting past to sense motion and depth;
 *  - a distant transient: now and then a far point brightens over a couple
 *    of seconds and fades over many more, cooling from blue-white to amber,
 *    in the manner of a supernova. Timing and brightness are not to scale.
 */

const galaxyVertex = /* glsl */ `
  attribute vec4 aShape;     // angle, flattening, type (0 spiral, 1 elliptical), arms phase
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec4 vShape;
  varying vec3 vColor;
  void main() {
    vShape = aShape;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / -mv.z, 2.0, 64.0);
    gl_Position = projectionMatrix * mv;
  }
`

const galaxyFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec4 vShape;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float c = cos(vShape.x);
    float s = sin(vShape.x);
    p = mat2(c, -s, s, c) * p;
    p.y /= max(vShape.y, 0.12);
    float r = length(p);
    if (r > 1.0) discard;

    float glow;
    if (vShape.z < 0.5) {
      // Two logarithmic arms around a bright bulge.
      float theta = atan(p.y, p.x);
      float arms = 0.5 + 0.5 * cos(2.0 * (theta - log(r + 0.05) * 3.2 + vShape.w));
      glow = exp(-r * 4.0) * 1.6 + arms * exp(-r * 2.6) * 0.55;
    } else {
      glow = exp(-r * r * 5.0) * 1.3;
    }
    glow *= 1.0 - smoothstep(0.8, 1.0, r);
    float alpha = glow * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor * alpha, alpha);
  }
`

const dustVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uBox;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    // Wrap each mote into a box centred on the camera.
    vec3 drift = vec3(0.07, 0.02, -0.05) * uTime;
    vec3 p = mod(position + drift - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5 + cameraPosition;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    // Fade in from the near plane and out towards the box edge, so motes
    // never pop at the wrap.
    vAlpha = smoothstep(0.4, 2.0, depth) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(p - cameraPosition)));
    vAlpha *= 0.5 + 0.5 * fract(aSeed * 7.31);
    gl_PointSize = clamp(1.6 * uPixelRatio * 6.0 / depth, 0.6, 3.0 * uPixelRatio);
    gl_Position = projectionMatrix * mv;
  }
`

const dustFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float a = (1.0 - smoothstep(0.2, 1.0, length(p))) * vAlpha * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vec3(0.72, 0.78, 0.95) * a, a);
  }
`

const flashVertex = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * mv;
  }
`

const flashFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBrightness;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    // A point source with diffraction spikes, as a bright star photographs.
    float core = exp(-r * r * 60.0);
    float halo = exp(-r * 6.0) * 0.35;
    float spikes = (exp(-abs(p.x) * 60.0) + exp(-abs(p.y) * 60.0)) * (1.0 - smoothstep(0.0, 1.0, r)) * 0.5;
    float a = (core + halo + spikes) * uBrightness;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`

function randomDirection(out) {
  const z = Math.random() * 2 - 1
  const t = Math.random() * Math.PI * 2
  const r = Math.sqrt(1 - z * z)
  return out.set(r * Math.cos(t), z, r * Math.sin(t))
}

function DistantGalaxies({ count = 36 }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const shapes = new Float32Array(count * 4)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const dir = new THREE.Vector3()
    for (let i = 0; i < count; i += 1) {
      randomDirection(dir).multiplyScalar(260 + Math.random() * 60)
      positions.set([dir.x, dir.y, dir.z], i * 3)
      const elliptical = Math.random() < 0.35
      shapes.set([Math.random() * Math.PI, 0.25 + Math.random() * 0.75, elliptical ? 1 : 0, Math.random() * 6.28], i * 4)
      sizes[i] = 2.2 + Math.pow(Math.random(), 3) * 7
      const warm = elliptical ? 1 : Math.random() * 0.6
      colors.set([0.75 + warm * 0.25, 0.75 + warm * 0.1, 0.95 - warm * 0.3], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aShape', new THREE.BufferAttribute(shapes, 4))
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    return g
  }, [count])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: galaxyVertex,
        fragmentShader: galaxyFragment,
        uniforms: { uScale: { value: 900 }, uOpacity: { value: 0.55 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material])
  return <points geometry={geometry} material={material} frustumCulled={false} />
}

function CosmicDust({ count, motion }) {
  const gl = useThree((state) => state.gl)
  const box = 14
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      positions.set([(Math.random() - 0.5) * box, (Math.random() - 0.5) * box, (Math.random() - 0.5) * box], i * 3)
      seeds[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    return g
  }, [count])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        uniforms: {
          uBox: { value: box },
          uTime: { value: 0 },
          uOpacity: { value: 0.35 },
          uPixelRatio: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material])
  useFrame((_, delta) => {
    material.uniforms.uTime.value += Math.min(delta, 0.1) * motion
    material.uniforms.uPixelRatio.value = gl.getPixelRatio()
    material.uniforms.uOpacity.value = 0.35 * getEffects().intensity
  })
  return <points geometry={geometry} material={material} frustumCulled={false} />
}

const COOL = new THREE.Color('#ffb46a')
const HOT = new THREE.Color('#cfe2ff')

function DistantTransient({ enabled }) {
  const gl = useThree((state) => state.gl)
  const pointRef = useRef(null)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    return g
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flashVertex,
        fragmentShader: flashFragment,
        uniforms: { uSize: { value: 48 }, uColor: { value: new THREE.Color() }, uBrightness: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material])
  const event = useRef({ time: 0, start: -100, next: 25 + Math.random() * 30 })
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const e = event.current
    e.time += Math.min(delta, 0.1)
    const { intensity } = getEffects()
    if (enabled && intensity > 0 && e.time > e.next) {
      randomDirection(dir).multiplyScalar(250)
      geometry.attributes.position.setXYZ(0, dir.x, dir.y, dir.z)
      geometry.attributes.position.needsUpdate = true
      e.start = e.time
      e.peak = 0.6 + Math.random() * 0.8
      e.next = e.time + (45 + Math.random() * 60) / Math.max(0.3, intensity)
    }
    const age = e.time - e.start
    const rise = Math.min(1, age / 2.2)
    const fade = Math.exp(-Math.max(0, age - 2.2) / 7)
    const brightness = enabled ? rise * rise * fade * (e.peak ?? 0) * Math.max(0.3, intensity) : 0
    material.uniforms.uBrightness.value = brightness
    // Cools as it fades: blue-white at peak, amber in decline.
    material.uniforms.uColor.value.copy(HOT).lerp(COOL, Math.min(1, Math.max(0, age - 2.2) / 14))
    material.uniforms.uSize.value = 56 * gl.getPixelRatio()
    if (pointRef.current) pointRef.current.visible = brightness > 0.003
  })

  return <points ref={pointRef} geometry={geometry} material={material} frustumCulled={false} visible={false} />
}

export default function DeepSky({ motion = 1, events = true }) {
  return (
    <>
      <DistantGalaxies />
      <CosmicDust count={scaleCount(700, 200)} motion={motion} />
      {motion > 0 && <DistantTransient enabled={events} />}
    </>
  )
}
