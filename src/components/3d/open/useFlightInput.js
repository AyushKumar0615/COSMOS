import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { getOpenSettings, input, setOpenSettings } from '../../../lib/openWorldStore.js'
import { SPEED_LOG } from '../../../lib/openWorld.js'

// Movement keys: [axis, sign]. Ctrl can't be held with W in every browser
// (Ctrl+W closes the tab), so C descends as well.
const KEYS = {
  KeyW: ['forward', 1],
  KeyS: ['forward', -1],
  KeyD: ['right', 1],
  KeyA: ['right', -1],
  Space: ['up', 1],
  ControlLeft: ['up', -1],
  ControlRight: ['up', -1],
  KeyC: ['up', -1],
  KeyE: ['roll', -1],
  KeyQ: ['roll', 1],
  ArrowLeft: ['yaw', 1],
  ArrowRight: ['yaw', -1],
  ArrowUp: ['pitch', 1],
  ArrowDown: ['pitch', -1],
}

const isTyping = (target) => target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

/**
 * Keyboard, mouse and touch for open-universe flight. Writes axes into a
 * ref the frame loop reads; pointer drags and pointer-lock moves add to
 * `input.look`. Every key is released on blur, so nothing sticks.
 */
export function useFlightInput() {
  const gl = useThree((state) => state.gl)
  const axes = useRef({ forward: 0, right: 0, up: 0, roll: 0, yaw: 0, pitch: 0, pressed: new Set() })

  useEffect(() => {
    const a = axes.current
    const recompute = () => {
      a.forward = a.right = a.up = a.roll = a.yaw = a.pitch = 0
      for (const code of a.pressed) {
        const [axis, sign] = KEYS[code]
        a[axis] += sign
      }
    }
    const clear = () => {
      a.pressed.clear()
      input.boost = false
      recompute()
    }
    const onDown = (event) => {
      if (isTyping(event.target)) return
      if (event.key === 'Shift') input.boost = true
      if (!KEYS[event.code] || event.metaKey || event.altKey) return
      event.preventDefault()
      a.pressed.add(event.code)
      recompute()
    }
    const onUp = (event) => {
      if (event.key === 'Shift') input.boost = false
      if (!KEYS[event.code]) return
      a.pressed.delete(event.code)
      recompute()
    }
    const onVisibility = () => document.visibilityState !== 'visible' && clear()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    window.addEventListener('contextmenu', clear)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clear()
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
      window.removeEventListener('contextmenu', clear)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Pointer: drag to look (grab the sky, as elsewhere in the app), or, with
  // the pointer locked, steer like a mouse-look game. Wheel sets the speed.
  useEffect(() => {
    const element = gl.domElement
    let active = null
    let lastX = 0
    let lastY = 0
    const onDown = (event) => {
      if (document.pointerLockElement === element) return
      if (active !== null || (event.pointerType === 'mouse' && event.button !== 0)) return
      active = event.pointerId
      lastX = event.clientX
      lastY = event.clientY
      element.setPointerCapture?.(event.pointerId)
      element.style.cursor = 'grabbing'
    }
    const onMove = (event) => {
      if (document.pointerLockElement === element) {
        input.look.x -= event.movementX * 0.0022
        input.look.y -= event.movementY * 0.0022
        return
      }
      if (event.pointerId !== active) return
      const sensitivity = event.pointerType === 'touch' ? 0.005 : 0.0032
      input.look.x += (event.clientX - lastX) * sensitivity
      input.look.y += (event.clientY - lastY) * sensitivity
      lastX = event.clientX
      lastY = event.clientY
    }
    const onUp = (event) => {
      if (event.pointerId !== active) return
      active = null
      element.releasePointerCapture?.(event.pointerId)
      element.style.cursor = 'grab'
    }
    const onWheel = (event) => {
      event.preventDefault()
      const { speedLog } = getOpenSettings()
      const next = Math.min(SPEED_LOG.max, Math.max(SPEED_LOG.min, speedLog - event.deltaY * 0.004))
      setOpenSettings({ speedLog: Math.round(next * 20) / 20 })
    }
    const onLockChange = () => setOpenSettings({ mouseSteer: document.pointerLockElement === element })
    element.style.cursor = 'grab'
    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
    element.addEventListener('lostpointercapture', onUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      element.style.cursor = ''
      if (document.pointerLockElement === element) document.exitPointerLock?.()
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.removeEventListener('lostpointercapture', onUp)
      element.removeEventListener('wheel', onWheel)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [gl])

  return axes
}
