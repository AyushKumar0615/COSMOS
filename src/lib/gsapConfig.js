import gsap from 'gsap'

/**
 * Disable GSAP's lag smoothing.
 *
 * By default GSAP shortens the time step it applies after any frame longer
 * than 500ms, so on a slow renderer a "2 second" tween can take many seconds
 * of real time. For camera moves that are coordinated with application state
 * that is the wrong trade: we would rather drop frames than stretch the
 * move, so a transition always takes the time it says it does.
 */
gsap.ticker.lagSmoothing(0)

export default gsap
