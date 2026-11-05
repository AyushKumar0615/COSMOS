import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createRandom } from '../../lib/random.js'
import { scaleCount } from '../../lib/quality.js'

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform float uPixelRatio;
  uniform vec3 uCameraPosition;
  attribute vec3 aOrbit;   // start angle, phase, tilt
  varying float vFade;
  varying float vHeat;

  void main() {
    // Each mote spirals inward along a fixed track, then starts over.
    float life = fract(uTime / (26.0 + aOrbit.y * 18.0) + aOrbit.y);
    float r = mix(uRadius, 3.2, pow(life, 0.62));
    float angle = aOrbit.x + 26.0 * pow(r, -0.5) + uTime * 0.25 / (r * sqrt(r)) * 8.0;
    vec3 world = vec3(cos(angle) * r, aOrbit.z * r * 0.09, sin(angle) * r);

    // Hide anything the shadow would block: not lensed, so kept outside it.
    vec3 toPoint = world - uCameraPosition;
    float distanceTo = length(toPoint);
    vec3 ray = toPoint / distanceTo;
    float along = dot(-uCameraPosition, ray);
    float passBy = length(uCameraPosition + ray * along);
    float blocked = step(0.0, along) * step(along, distanceTo) * (1.0 - smoothstep(2.5, 3.3, passBy));

    vFade = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.82, 1.0, life)) * (1.0 - blocked);
    vHeat = 1.0 - r / uRadius;

    vec4 view = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(uPixelRatio * 42.0 / max(-view.z, 0.5), 1.0, 7.0 * uPixelRatio);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uCool;
  uniform vec3 uHot;
  uniform float uOpacity;
  varying float vFade;
  varying float vHeat;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = pow(max(1.0 - d * 2.0, 0.0), 2.4);
    if (glow * vFade < 0.01) discard;
    gl_FragColor = vec4(mix(uCool, uHot, vHeat) * glow * vFade * uOpacity * 0.85, 1.0);
  }
`

/**
 * Motes of gas spiralling in from beyond the disc's edge. They are ordinary
 * points, not traced light, so they are kept outside the region where lensing
 * would visibly displace them.
 */
export default function InfallParticles({ hole, opacityRef, reducedMotion }) {
  const camera = useThree((state) => state.camera)
  const pixelRatio = useThree((state) => state.viewport.dpr)

  const { geometry, material } = useMemo(() => {
    const count = scaleCount(2600, 300)
    const rng = createRandom(7)
    const orbit = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      orbit[i * 3] = rng.next() * Math.PI * 2
      orbit[i * 3 + 1] = rng.next()
      orbit[i * 3 + 2] = rng.gauss()
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    buffer.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 3))
    buffer.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200)
    return {
      geometry: buffer,
      material: new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uRadius: { value: 30 },
          uPixelRatio: { value: 1 },
          uCameraPosition: { value: new THREE.Vector3() },
          uOpacity: { value: 0 },
          uCool: { value: new THREE.Color() },
          uHot: { value: new THREE.Color() },
        },
      }),
    }
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useEffect(() => {
    material.uniforms.uCool.value.set(hole.render.cool)
    material.uniforms.uHot.value.set(hole.render.hot)
    material.uniforms.uRadius.value = hole.render.diskOuter * 2.4
  }, [material, hole])

  useFrame((_, delta) => {
    const u = material.uniforms
    if (!reducedMotion) u.uTime.value += Math.min(delta, 0.1)
    u.uPixelRatio.value = pixelRatio
    u.uCameraPosition.value.copy(camera.position)
    // Fades with the view inside the disc, where it would only be clutter.
    const near = THREE.MathUtils.smoothstep(camera.position.length(), 3, 7)
    u.uOpacity.value = opacityRef.current.value * near
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} raycast={() => null} />
}
