/**
 * Static CSS stand-in for the 3D scene: used on devices without WebGL, while
 * the Three.js chunk is still downloading, and if the renderer throws.
 * Deliberately dependency-free so it is never part of the 3D bundle.
 */
export default function StaticSpaceFallback() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-void"
      style={{
        backgroundImage: [
          'radial-gradient(1100px 620px at 18% 24%, rgba(124,77,255,0.24), transparent 65%)',
          'radial-gradient(900px 560px at 82% 72%, rgba(47,107,255,0.2), transparent 62%)',
          'radial-gradient(620px 420px at 58% 14%, rgba(34,211,238,0.12), transparent 60%)',
          'radial-gradient(2px 2px at 12% 32%, rgba(255,255,255,0.75), transparent 100%)',
          'radial-gradient(1.6px 1.6px at 72% 18%, rgba(255,255,255,0.6), transparent 100%)',
          'radial-gradient(1.6px 1.6px at 36% 76%, rgba(255,255,255,0.55), transparent 100%)',
          'radial-gradient(1.4px 1.4px at 88% 52%, rgba(255,255,255,0.5), transparent 100%)',
          'radial-gradient(1.4px 1.4px at 54% 44%, rgba(255,255,255,0.45), transparent 100%)',
          'radial-gradient(1.2px 1.2px at 24% 62%, rgba(255,255,255,0.4), transparent 100%)',
          'radial-gradient(1.2px 1.2px at 66% 84%, rgba(255,255,255,0.38), transparent 100%)',
        ].join(','),
      }}
    />
  )
}
