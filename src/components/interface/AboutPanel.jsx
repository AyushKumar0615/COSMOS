import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const BUILT = [
  'Interactive solar system with NASA-sourced figures for every body',
  'Guided tour of the Sun and all eight planets',
  'Free flight with keyboard, mouse, touch and joystick controls',
  'Black holes: four, ray-traced, with a guided descent and five missions',
  'Galaxies: Milky Way, Andromeda, Whirlpool, Sombrero and Triangulum',
  'Nebulae: Orion, Crab, Eagle, Carina, Pillars, Horsehead, Ring and Helix',
  'Phenomena: supernova, pulsar, wormhole, spacetime, scale and exoplanets',
  'Mission archive: fourteen missions from NASA, ISRO, ESA and JAXA',
]

const NEXT = [
  'Constellation overlays and a time control',
  'Moons, asteroids and comets beyond the eight planets',
]

export default function AboutPanel({ onClose, reducedMotion }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const transition = {
    duration: reducedMotion ? 0 : 0.5,
    ease: [0.22, 1, 0.36, 1],
  }

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-end justify-center p-4 sm:items-center sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition}
    >
      <button
        type="button"
        aria-label="Close about panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-void/70 backdrop-blur-[6px]"
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        // Opaque base under the glass: the hero headline sits directly
        // behind this panel and would otherwise read through it.
        // Capped to the viewport and scrolled internally: on a phone held
        // sideways the panel is taller than the screen, and without this the
        // heading and its close button end up above the top edge, out of
        // reach of anyone without a keyboard.
        className="glass relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-[#070a17]/92 sm:max-h-[calc(100dvh-4rem)]"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 26, scale: reducedMotion ? 1 : 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reducedMotion ? 0 : 26, scale: reducedMotion ? 1 : 0.99 }}
        transition={transition}
      >
        {/* Header stays put; everything below it scrolls. */}
        <div className="flex items-start justify-between gap-6 px-7 pt-7 sm:px-10 sm:pt-10">
          <div>
            <p className="eyebrow text-cyan/80">About the project</p>
            <h2
              id="about-title"
              className="mt-3 text-2xl font-light tracking-tight text-ink sm:text-3xl"
            >
              An interactive digital observatory
            </h2>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 transition-colors duration-300 hover:border-white/25"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                className="text-ink-dim"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 sm:px-10 sm:pb-10 [scrollbar-width:thin]">
        <p className="mt-6 text-sm font-light leading-relaxed text-ink-dim">
          Everything here is rendered live in your browser. Facts are cited to
          NASA, ESA, the Event Horizon Telescope and peer-reviewed papers, and
          the models are labelled for what they are: observed, inferred,
          modelled or theoretical.
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <section>
            <h3 className="readout mb-3.5 text-cyan/80">To explore</h3>
            <ul className="space-y-2.5">
              {BUILT.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-[0.8125rem] font-light leading-relaxed text-ink-dim"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan/80" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="readout mb-3.5 text-violet/80">Future ideas</h3>
            <ul className="space-y-2.5">
              {NEXT.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-[0.8125rem] font-light leading-relaxed text-muted"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet/70" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="hairline mt-8 h-px w-full opacity-60" />

        <p className="readout mt-5 opacity-60">
          Sizes, distances, speeds and surfaces are illustrative, not to scale
        </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
