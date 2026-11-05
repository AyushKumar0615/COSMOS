import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import gsap from '../../lib/gsapConfig.js'
import { useViewShift } from '../../hooks/useViewShift.js'

const fromPosition = new THREE.Vector3()
const fromTarget = new THREE.Vector3()
const toPosition = new THREE.Vector3()
const toTarget = new THREE.Vector3()

/**
 * Camera for the galaxy and nebula explorers: OrbitControls for free
 * inspection, plus a smooth flight to each object's curated vantage point
 * whenever `poseKey` changes. The first pose is applied instantly, since
 * the scene appears from behind the travel overlay.
 */
export default function ExplorerRig({
  pose,
  poseKey,
  reducedMotion,
  minDistance = 10,
  maxDistance = 600,
  autoRotate = true,
  viewShift = null,
  suspended = false,
}) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  useViewShift(suspended ? null : viewShift, reducedMotion)

  const first = useRef(true)
  const flownKey = useRef(null)
  // Read by cleanups, which run after the new props are applied.
  const suspendedRef = useRef(suspended)
  useLayoutEffect(() => {
    suspendedRef.current = suspended
  }, [suspended])
  const progress = useRef({ value: 1 })
  const tween = useRef(null)
  const flying = useRef(false)

  // Before the first frame: never render a frame from the previous scene's
  // camera position.
  useLayoutEffect(() => {
    camera.position.fromArray(pose.position)
    camera.lookAt(new THREE.Vector3().fromArray(pose.target))
    // Mount-only: later poses are flown to by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera])

  useEffect(() => {
    // Free flight owns the camera; its exit hands the view back in place,
    // so only a new pose (another object selected) moves the camera.
    if (!controls || suspended) return
    if (!first.current && flownKey.current === poseKey) return
    flownKey.current = poseKey
    toPosition.fromArray(pose.position)
    toTarget.fromArray(pose.target)

    if (first.current || reducedMotion) {
      first.current = false
      camera.position.copy(toPosition)
      controls.target.copy(toTarget)
      controls.update()
      return
    }

    fromPosition.copy(camera.position)
    fromTarget.copy(controls.target)
    controls.enabled = false
    flying.current = true
    progress.current.value = 0
    tween.current?.kill()
    tween.current = gsap.to(progress.current, {
      value: 1,
      duration: 1.9,
      ease: 'power3.inOut',
      onComplete: () => {
        flying.current = false
        controls.enabled = !suspendedRef.current
        controls.update()
      },
    })

    return () => {
      tween.current?.kill()
      flying.current = false
      controls.enabled = !suspendedRef.current
    }
    // The pose object is looked up from static data by key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseKey, controls, suspended])

  useFrame(() => {
    if (!flying.current || !controls) return
    const t = progress.current.value
    camera.position.lerpVectors(fromPosition, toPosition, t)
    controls.target.lerpVectors(fromTarget, toTarget, t)
    camera.lookAt(controls.target)
  })

  return (
    <OrbitControls
      makeDefault
      enabled={!suspended}
      enableDamping
      dampingFactor={0.07}
      rotateSpeed={0.5}
      zoomSpeed={0.75}
      enablePan
      panSpeed={0.6}
      screenSpacePanning
      minDistance={minDistance}
      maxDistance={maxDistance}
      autoRotate={autoRotate && !reducedMotion && !suspended}
      autoRotateSpeed={0.22}
    />
  )
}
