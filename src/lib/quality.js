/**
 * Device-aware rendering quality.
 *
 * The tier is decided once, from what the browser will actually tell us:
 * CPU threads, the memory hint where it exists, whether the pointer is
 * coarse (phones and tablets), and how many pixels the display asks for.
 * There is no reliable way to identify a GPU from JavaScript, so this is a
 * conservative starting point rather than a measurement — the renderer then
 * adapts at runtime (see PerformanceMonitor in SceneCanvas), which is what
 * actually protects integrated graphics.
 */

const TIERS = {
  low: { particles: 0.45, dprMax: 1, nebulaDetail: 0.55, rayScale: 0.5, raySteps: 44, skySize: 2048, stars: 45000 },
  medium: { particles: 0.7, dprMax: 1.5, nebulaDetail: 0.8, rayScale: 0.7, raySteps: 64, skySize: 2048, stars: 110000 },
  high: { particles: 1, dprMax: 1.75, nebulaDetail: 1, rayScale: 1, raySteps: 96, skySize: 4096, stars: 220000 },
}

function detectTier() {
  if (typeof window === 'undefined') return 'high'

  // ?quality=low|medium|high forces a tier — useful for checking how the site
  // behaves on weaker hardware than the machine you happen to be on.
  const forced = new URLSearchParams(window.location.search).get('quality')
  if (forced && TIERS[forced]) return forced

  const cores = navigator.hardwareConcurrency ?? 4
  // Chromium only; undefined elsewhere, so it can lower the tier but never
  // raise it on browsers that withhold it.
  const memory = navigator.deviceMemory
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const dpr = window.devicePixelRatio ?? 1
  // Pixels the GPU would have to fill at native density.
  const pixels = window.screen.width * window.screen.height * dpr * dpr

  if (memory != null && memory <= 2) return 'low'
  if (cores <= 2) return 'low'
  // A dense small screen with few cores is a mid-range phone.
  if (coarse && cores <= 4) return 'low'
  if (coarse) return 'medium'
  if (cores <= 4 || (memory != null && memory <= 4)) return 'medium'
  // A 4K+ desktop display with a modest CPU is usually an integrated GPU
  // being asked to fill a lot of pixels.
  if (pixels > 12e6 && cores <= 8) return 'medium'
  return 'high'
}

let cached = null

/** Quality settings for this device. Computed once per page load. */
export function quality() {
  if (!cached) {
    const tier = detectTier()
    cached = { tier, ...TIERS[tier] }
  }
  return cached
}

/** Scale a particle or sprite count for this device, never below `min`. */
export function scaleCount(count, min = 24) {
  return Math.max(min, Math.round(count * quality().particles))
}

/**
 * Thin a built list of sprites to this device's detail level, keeping the
 * shape the generator drew.
 *
 * Removing a contiguous slice would eat a whole arm or pillar, and a fixed
 * stride can line up with the structure underneath, so this walks the list
 * with the golden ratio — a low-discrepancy sequence that spreads the
 * removals evenly however the sprites happen to be ordered. What remains is
 * grown a little, so a thinner cloud still covers about as much sky.
 */
export function thin(list, detail = quality().nebulaDetail) {
  if (detail >= 1 || list.length < 64) return list
  const grow = 1 / Math.sqrt(detail)
  const kept = []
  let phase = 0
  for (const sprite of list) {
    phase += 0.6180339887498949
    if (phase >= 1) phase -= 1
    // `s` is the sprite's radius, as nebulaGenerator writes it.
    if (phase < detail) kept.push({ ...sprite, s: sprite.s * grow })
  }
  return kept.length ? kept : list
}
