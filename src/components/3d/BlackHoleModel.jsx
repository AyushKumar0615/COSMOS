import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  COMPOSITE_FRAGMENT,
  COMPOSITE_VERTEX,
  TRACE_FRAGMENT,
  TRACE_VERTEX,
} from '../../lib/blackHoleShader.js'
import { getSkyTexture } from '../../lib/skyTexture.js'
import { fallSpeed } from '../../lib/relativity.js'
import { quality } from '../../lib/quality.js'

const QUAD = new THREE.PlaneGeometry(2, 2)
const MIN_SCALE = 0.32
const color = (hex) => new THREE.Color(hex).convertSRGBToLinear()

/** Disc and jet settings as shader uniform values. */
function applyHole(uniforms, render) {
  uniforms.uCool.value = color(render.cool)
  uniforms.uHot.value = color(render.hot)
  uniforms.uDiskInner.value = render.diskInner
  uniforms.uDiskOuter.value = render.diskOuter
  uniforms.uDiskGain.value = render.diskGain
  uniforms.uDiskOpacity.value = render.diskOpacity
  uniforms.uTurbulence.value = render.turbulence
  uniforms.uCorona.value = render.corona
  uniforms.uJet.value = render.jet
  uniforms.uJetColor.value = color(render.jetColor ?? '#ffffff')
  uniforms.uFlare.value = render.flare ?? 0
  const companion = render.companion
  // w is the star's radius, so this must be an explicit zero: Vector4 defaults to 1.
  uniforms.uStar.value = companion ? new THREE.Vector4(...companion.position, companion.radius) : new THREE.Vector4(0, 0, 0, 0)
  uniforms.uStarColor.value = color(companion?.color ?? '#ffffff')
}

/**
 * The black hole itself: a ray-traced image rendered into its own target,
 * then composited over the scene with bloom from the target's mip chain.
 *
 * The trace is the expensive part, so it runs at its own resolution. That
 * resolution starts from the device's quality tier and then follows the
 * frame rate, on top of the renderer-wide pixel ratio control.
 */
export default function BlackHoleModel({ hole, opacityRef, overlay, reducedMotion, telemetry, dive }) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)

  const pass = useMemo(() => {
    const { raySteps, rayScale } = quality()
    const halfFloat = gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float')
    const target = new THREE.WebGLRenderTarget(4, 4, {
      type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: false,
      stencilBuffer: false,
    })
    const trace = new THREE.ShaderMaterial({
      vertexShader: TRACE_VERTEX,
      fragmentShader: TRACE_FRAGMENT,
      defines: { RAY_STEPS: raySteps },
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uInvProjection: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uSky: { value: getSkyTexture(gl) },
        uCamera: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uStepScale: { value: 96 / raySteps },
        uFall: { value: 0 },
        uDepth: { value: 0 },
        uOverlay: { value: 0 },
        uPixel: { value: 0.01 },
        uCool: { value: new THREE.Color() },
        uHot: { value: new THREE.Color() },
        uDiskInner: { value: 3 },
        uDiskOuter: { value: 12 },
        uDiskGain: { value: 1 },
        uDiskOpacity: { value: 0.7 },
        uTurbulence: { value: 1 },
        uCorona: { value: 0 },
        uJet: { value: 0 },
        uJetColor: { value: new THREE.Color() },
        uFlare: { value: 0 },
        uStar: { value: new THREE.Vector4(0, 0, 0, 0) },
        uStarColor: { value: new THREE.Color() },
      },
    })
    const composite = new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uImage: { value: target.texture },
        uOpacity: { value: 0 },
        uStrain: { value: 0 },
        uBloom: { value: 0.42 },
      },
    })
    const scene = new THREE.Scene()
    const quad = new THREE.Mesh(QUAD, trace)
    quad.frustumCulled = false
    scene.add(quad)
    return { target, trace, composite, scene, ortho: new THREE.Camera(), baseScale: rayScale }
  }, [gl])

  useEffect(
    () => () => {
      pass.target.dispose()
      pass.trace.dispose()
      pass.composite.dispose()
    },
    [pass],
  )

  useEffect(() => {
    applyHole(pass.trace.uniforms, hole.render)
  }, [pass, hole])

  const clock = useRef(0)
  const overlayLevel = useRef(0)
  const lastY = useRef(0)
  const budget = useRef({ scale: 1, average: 1 / 60, frames: 0, width: 0, height: 0 })

  useFrame((state, delta) => {
    const uniforms = pass.trace.uniforms
    const b = budget.current

    // Follow the frame rate. Long gaps are a hidden tab, not a slow GPU.
    if (delta < 0.25) {
      b.average += (delta - b.average) * 0.06
      b.frames += 1
      if (b.frames > 40) {
        b.frames = 0
        if (b.average > 1 / 38) b.scale = Math.max(MIN_SCALE / pass.baseScale, b.scale * 0.86)
        else if (b.average < 1 / 55) b.scale = Math.min(1, b.scale * 1.05)
      }
    }
    const ratio = gl.getPixelRatio() * pass.baseScale * b.scale
    const width = Math.max(2, Math.round(state.size.width * ratio))
    const height = Math.max(2, Math.round(state.size.height * ratio))
    if (width !== b.width || height !== b.height) {
      b.width = width
      b.height = height
      pass.target.setSize(width, height)
    }

    if (!reducedMotion) clock.current += Math.min(delta, 0.1)
    overlayLevel.current += ((overlay ? 1 : 0) - overlayLevel.current) * Math.min(1, delta * 6)

    camera.updateMatrixWorld()
    const r = camera.position.length()
    uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse)
    uniforms.uCameraWorld.value.copy(camera.matrixWorld)
    uniforms.uCamera.value.copy(camera.position)
    uniforms.uTime.value = clock.current
    uniforms.uOverlay.value = overlayLevel.current
    uniforms.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * r) / height

    const falling = dive.current.active
    uniforms.uFall.value = falling && r > 1 ? Math.min(fallSpeed(r), 0.97) : 0
    uniforms.uDepth.value = falling && r < 1 ? Math.min(0.999, Math.max(1 - r, 0.0001)) : 0

    const strain = THREE.MathUtils.clamp(1.3 / Math.max(r, 0.2) - 0.3, 0, falling ? 1 : 0.6)
    pass.composite.uniforms.uStrain.value = reducedMotion ? 0 : strain
    pass.composite.uniforms.uOpacity.value = opacityRef.current.value

    const previousTarget = gl.getRenderTarget()
    gl.setRenderTarget(pass.target)
    gl.render(pass.scene, pass.ortho)
    gl.setRenderTarget(previousTarget)

    // Live readings for the interface, which polls them on its own schedule.
    const y = camera.position.y
    const t = telemetry.current
    t.r = r
    t.inclination = THREE.MathUtils.radToDeg(Math.asin(Math.min(1, Math.abs(y) / Math.max(r, 1e-3))))
    t.resolution = pass.baseScale * b.scale
    const planar = Math.hypot(camera.position.x, camera.position.z)
    if (lastY.current * y < 0 && planar >= 3 && planar <= 10 && !falling) t.diskCrossed = true
    lastY.current = y
  })

  return <mesh geometry={QUAD} material={pass.composite} frustumCulled={false} renderOrder={-20} raycast={() => null} />
}
