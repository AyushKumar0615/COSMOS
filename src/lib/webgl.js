/**
 * Cheap one-off capability probe. Used to decide between the 3D scene and
 * the lightweight CSS fallback before any Three.js code is imported.
 */
export function detectWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const context =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    if (!context) return false
    // Release the probe context straight away so it does not count against
    // the browser's small per-page WebGL context budget.
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
