import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { NOISE_GLSL } from './shaders/noise.glsl.js'
import { SUN } from '../../data/planets.js'
import { quality } from '../../lib/quality.js'
import { useEffects } from '../../lib/effects.js'

const surfaceVertex = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vLocal = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

// Runs every frame on a body that can fill the viewport, so the costly part
// (a 27-cell Voronoi search for granulation) is dropped on the low tier.
const surfaceFragment = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uTime;
  uniform float uMotion;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHot;
  uniform vec4 uFlare;       // xyz: direction on the surface, w: brightness

  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  // Granulation: convection cells with bright centres and dark lanes,
  // the cell centres drifting slowly so the pattern boils.
  float granules(vec3 p, float t) {
  #ifdef SUN_CHEAP
    return noise3(p + t * 0.2) * 0.5 + 0.5;
  #else
    vec3 i = floor(p);
    vec3 f = fract(p);
    float f1 = 8.0;
    float f2 = 8.0;
    for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
    for (int z = -1; z <= 1; z++) {
      vec3 o = vec3(float(x), float(y), float(z));
      vec3 c = i + o;
      vec3 jitter = vec3(hash13(c), hash13(c + 4.1), hash13(c + 8.7));
      jitter = 0.5 + 0.38 * sin(t * 0.35 + 6.2831 * jitter);
      float d = length(o + jitter - f);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
    // Bright cells, thin darker lanes between them.
    return 0.35 + 0.65 * smoothstep(0.0, 0.18, f2 - f1);
  #endif
  }

  void main() {
    float t = uTime * uMotion;
    vec3 n = normalize(vLocal);

    // Granules are far below a pixel from across the system: fade their
    // contrast by screen-space footprint so the disc never sparkles.
    vec3 gp = n * 72.0;
    float footprint = length(fwidth(gp));
    float g = mix(0.5, granules(gp, t), 1.0 - smoothstep(0.25, 0.7, footprint));
    float supergranules = fbm3(n * 7.0 + vec3(0.0, t * 0.012, 0.0)) * 0.5 + 0.5;
    float convection = fbm3(n * 2.6 + vec3(t * 0.01, 0.0, 0.0)) * 0.5 + 0.5;

    float heat = g * 0.32 + supergranules * 0.4 + convection * 0.28;
    vec3 color = mix(uDeep, uMid, smoothstep(0.15, 0.6, heat));
    color = mix(color, uHot, smoothstep(0.55, 0.95, heat));

    // Sunspots sit in two belts either side of the equator: a dark umbra
    // inside a lighter penumbra, with bright faculae scattered round them.
    float lat = abs(n.y);
    float belt = smoothstep(0.08, 0.16, lat) * (1.0 - smoothstep(0.42, 0.55, lat));
    float spotField = fbm3(n * 3.2 + 11.0 + vec3(0.0, 0.0, t * 0.004));
    float penumbra = smoothstep(0.33, 0.38, spotField) * belt;
    float umbra = smoothstep(0.42, 0.46, spotField) * belt;
    float faculae = smoothstep(0.18, 0.3, spotField) * (1.0 - penumbra) * belt;

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float mu = max(dot(normalize(vWorldNormal), viewDirection), 0.0);

    color = mix(color, color * 1.25 + vec3(0.08), faculae * (1.0 - mu) * 0.8);
    color = mix(color, uDeep * 0.55, penumbra * 0.75);
    color = mix(color, uDeep * 0.16, umbra);

    // Flares: a brief white flash where magnetic field lines reconnect.
    float flare = exp(-pow(length(n - uFlare.xyz) / 0.06, 2.0)) * uFlare.w;
    color += vec3(1.0, 0.95, 0.85) * flare * 2.2;

    // Limb darkening: the edge of the disc shows cooler, higher layers, so
    // it is dimmer and redder (I ~ 1 - 0.6(1 - mu) in visible light).
    float limb = 1.0 - 0.6 * (1.0 - mu);
    color *= limb;
    color = mix(color, color * vec3(1.0, 0.72, 0.5), pow(1.0 - mu, 2.0) * 0.6);
    // A thin chromospheric rim.
    color += vec3(1.0, 0.45, 0.25) * pow(1.0 - mu, 8.0) * 0.6;

    gl_FragColor = vec4(color * 1.15, 1.0);
  }
`

const coronaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const coronaFragment = /* glsl */ `
  ${NOISE_GLSL}

  uniform float uTime;
  uniform float uMotion;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uRayStrength;
  uniform float uInner;
  uniform float uProminence;
  uniform vec3 uColor;

  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - 0.5;
    float radius = length(centered) * 2.0;
    if (radius > 1.0) discard;

    float angle = atan(centered.y, centered.x);
    float t = uTime * uMotion;

    // Streamers: noise sampled around a ring so it wraps without a seam.
    float streamer = noise3(
      vec3(cos(angle), sin(angle), t * 0.04) * 3.0 + radius * 1.5
    );
    float rays = 1.0 - uRayStrength + uRayStrength * (0.5 + 0.5 * streamer);

    // Fall off from the Sun's own limb outwards, not from the centre of
    // the quad. Everything inside uInner is behind the Sun's disc, so a
    // centre-based falloff spends almost all its brightness where it
    // cannot be seen and leaves the visible corona invisibly faint.
    float reach = clamp((radius - uInner) / max(1.0 - uInner, 0.001), 0.0, 1.0);
    float falloff = pow(1.0 - reach, uPower);
    float alpha = falloff * rays * uIntensity;
    vec3 color = uColor * alpha;

    // Prominences: arcs of cooler plasma standing just off the limb, seen
    // in hydrogen-alpha red. Thresholded noise around the ring, rising and
    // sinking slowly.
    if (uProminence > 0.0) {
      float height = (radius - uInner) / uInner;
      float arcs = noise3(vec3(cos(angle) * 5.0, sin(angle) * 5.0, t * 0.03));
      float tall = 0.05 + 0.1 * smoothstep(0.1, 0.5, arcs);
      float loop = smoothstep(0.26, 0.42, arcs) * smoothstep(-0.005, 0.01, height) * (1.0 - smoothstep(tall * 0.6, tall, height));
      float strands = 0.6 + 0.4 * noise3(vec3(angle * 40.0, height * 60.0, t * 0.1));
      float p = loop * strands * uProminence;
      color += vec3(1.0, 0.32, 0.22) * p;
      alpha += p * 0.6;
    }
    if (alpha < 0.002) discard;

    gl_FragColor = vec4(color, alpha);
  }
`


const cmeVertex = /* glsl */ `
  attribute vec4 aSpray;     // direction offset (xy), speed factor, phase
  uniform vec3 uAxis;
  uniform float uAge;
  uniform float uRadius;
  uniform float uPixel;
  varying float vFade;
  void main() {
    // Basis around the eruption axis.
    vec3 helper = abs(uAxis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 u = normalize(cross(uAxis, helper));
    vec3 v = cross(uAxis, u);
    vec3 dir = normalize(uAxis + u * aSpray.x + v * aSpray.y);
    // A loop-shaped front: points near the rim lag behind the centre.
    float lag = 1.0 - 0.45 * length(aSpray.xy) / 0.35;
    float travel = uAge * aSpray.z * lag;
    vec3 p = dir * uRadius * (1.02 + travel * 0.22);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = smoothstep(0.0, 0.6, uAge) * (1.0 - smoothstep(3.0, 8.0, uAge)) * (0.6 + 0.4 * sin(aSpray.w + uAge));
    // Large soft points that overlap into one glowing cloud.
    gl_PointSize = clamp(uRadius * 130.0 / -mv.z, 4.0, 30.0) * uPixel;
    gl_Position = projectionMatrix * mv;
  }
`
const cmeFragment = /* glsl */ `
  varying float vFade;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    float a = exp(-r * r * 3.0) * vFade * 0.1;
    if (a < 0.004) discard;
    // Not premultiplied: additive blending applies alpha once.
    gl_FragColor = vec4(1.0, 0.72, 0.45, a);
  }
`

/**
 * A coronal mass ejection: a cloud of plasma thrown off after some flares,
 * drawn as a loop-fronted spray of points expanding from the flare site.
 * Timing, size and speed are illustrative (real ones take days to cross to
 * Earth).
 */
function CoronalMassEjection({ radius, event }) {
  const gl = useThree((state) => state.gl)
  const pointsRef = useRef(null)
  const geometry = useMemo(() => {
    const count = 900
    const spray = new Float32Array(count * 4)
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * 0.35
      spray.set([Math.cos(a) * r, Math.sin(a) * r, 0.6 + Math.random() * 0.8, Math.random() * 6.28], i * 4)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aSpray', new THREE.BufferAttribute(spray, 4))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 8)
    return g
  }, [radius])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: cmeVertex,
        fragmentShader: cmeFragment,
        uniforms: { uAxis: { value: new THREE.Vector3(0, 1, 0) }, uAge: { value: 99 }, uRadius: { value: radius }, uPixel: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [radius],
  )
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material])
  useFrame((state) => {
    const e = event.current
    const age = state.clock.elapsedTime - e.start
    material.uniforms.uAge.value = age
    material.uniforms.uAxis.value.copy(e.axis)
    material.uniforms.uPixel.value = gl.getPixelRatio()
    if (pointsRef.current) pointsRef.current.visible = e.active && age < 9
  })
  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} visible={false} raycast={() => null} />
}

const SPHERE = new THREE.SphereGeometry(1, 64, 48)
const QUAD = new THREE.PlaneGeometry(1, 1)

function CoronaLayer({ scale, color, intensity, power, rayStrength, motion, radius, prominence = 0 }) {
  const materialRef = useRef(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMotion: { value: motion },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uRayStrength: { value: rayStrength },
      // Fraction of the quad's half-width taken up by the Sun itself.
      uInner: { value: radius / (scale / 2) },
      uProminence: { value: prominence },
      uColor: { value: new THREE.Color(color) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    materialRef.current.uniforms.uMotion.value = motion
  })

  return (
    <mesh geometry={QUAD} scale={scale} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={coronaVertex}
        fragmentShader={coronaFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/**
 * The Sun: an animated emissive surface and a two-layer corona that always
 * faces the camera. The light it casts lives in SceneLights so the scene's
 * light count never changes (changing it recompiles every lit material).
 */
export default function Sun({ reducedMotion, onSelect, selected }) {
  const materialRef = useRef(null)
  const meshRef = useRef(null)
  const radius = SUN.sim.radius
  const motion = reducedMotion ? 0 : 1

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMotion: { value: motion },
      uDeep: { value: new THREE.Color('#c2470c') },
      uMid: { value: new THREE.Color('#ffab3d') },
      uHot: { value: new THREE.Color('#fff0c4') },
      uFlare: { value: new THREE.Vector4(0, 1, 0, 0) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // A flare every half-minute or so: a fast rise and a slow fade, at a
  // random point in the sunspot belts. Purely illustrative timing.
  const flare = useRef({ next: 8, start: -100 })
  // About half of the flares launch a coronal mass ejection from the same spot.
  const cme = useRef({ active: false, start: -100, axis: new THREE.Vector3(0, 1, 0) })
  const effects = useEffects()

  useFrame((state, delta) => {
    if (materialRef.current) {
      const time = state.clock.elapsedTime
      materialRef.current.uniforms.uTime.value = time
      materialRef.current.uniforms.uMotion.value = motion
      const f = flare.current
      const uFlare = materialRef.current.uniforms.uFlare.value
      if (motion && time > f.next) {
        // A site in the sunspot belts, preferring the hemisphere facing the
        // viewer: a flare or eruption on the far side would never be seen.
        const toCamera = state.camera.position.clone().normalize()
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const lat = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.3)
          const lon = Math.random() * Math.PI * 2
          uFlare.set(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat), 0)
          const facing = new THREE.Vector3(uFlare.x, uFlare.y, uFlare.z)
          if (meshRef.current) facing.applyQuaternion(meshRef.current.quaternion)
          // Near the limb is best: eruptions show in profile there.
          if (facing.dot(toCamera) > 0.1 && facing.dot(toCamera) < 0.75) break
        }
        f.start = time
        f.next = time + 20 + Math.random() * 25
        if (effects.events && Math.random() < 0.55 && meshRef.current) {
          // The flare direction is in the Sun's rotating frame.
          cme.current.axis.set(uFlare.x, uFlare.y, uFlare.z).applyQuaternion(meshRef.current.quaternion)
          cme.current.start = time
          cme.current.active = true
        }
      }
      const age = time - f.start
      uFlare.w = motion ? Math.min(1, age / 0.6) * Math.exp(-Math.max(0, age - 0.6) / 3) : 0
    }
    if (meshRef.current && motion) {
      meshRef.current.rotation.y += delta * 0.012
    }
  })

  return (
    <group>
      {motion > 0 && <CoronalMassEjection radius={radius} event={cme} />}
      <mesh
        ref={meshRef}
        geometry={SPHERE}
        scale={radius}
        onClick={(event) => {
          event.stopPropagation()
          onSelect('sun')
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={surfaceVertex}
          fragmentShader={surfaceFragment}
          defines={quality().tier === 'low' ? { SUN_CHEAP: '' } : {}}
        />
      </mesh>

      <Billboard>
        <CoronaLayer
          radius={radius}
          scale={radius * 4.6}
          color="#ff9336"
          intensity={0.85}
          power={2.2}
          rayStrength={0.4}
          motion={motion}
          prominence={0.55}
        />
        <CoronaLayer
          radius={radius}
          scale={radius * 11.0}
          color="#ff6a1f"
          intensity={0.3}
          power={2.8}
          rayStrength={0.55}
          motion={motion}
        />
        {selected && (
          <CoronaLayer
            radius={radius}
            scale={radius * 6.0}
            color="#22d3ee"
            intensity={0.22}
            power={3.2}
            rayStrength={0.15}
            motion={motion}
          />
        )}
      </Billboard>
    </group>
  )
}
