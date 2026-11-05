import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import EnterButton from './EnterButton.jsx'

/**
 * Cinematic landing content. Everything sits above the shared 3D canvas, so
 * the root is pointer-events-none and only the controls opt back in.
 */
export default function Landing({ onEnter, onBlackHole, reducedMotion }) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const targets = root.querySelectorAll('[data-reveal]')

    if (reducedMotion) {
      gsap.set(targets, { clearProps: 'all' })
      gsap.set(root.querySelectorAll('[data-reveal-line]'), { y: '0%' })
      return
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
        delay: 0.15,
      })

      timeline
        .from('[data-reveal="eyebrow"]', {
          opacity: 0,
          y: 14,
          duration: 0.9,
        })
        .from(
          '[data-reveal-line]',
          {
            yPercent: 112,
            duration: 1.25,
            stagger: 0.09,
            ease: 'expo.out',
          },
          '-=0.6',
        )
        .from(
          '[data-reveal="body"]',
          { opacity: 0, y: 18, duration: 0.95 },
          '-=0.85',
        )
        .from(
          '[data-reveal="cta"]',
          { opacity: 0, y: 18, duration: 0.9 },
          '-=0.75',
        )
    }, root)

    return () => context.revert()
  }, [reducedMotion])

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 pb-32 pt-32 sm:px-10 sm:pb-36 sm:pt-36 short:pb-5 short:pt-16"
    >
      <div className="flex w-full max-w-[1120px] flex-col items-center text-center">
        <div
          data-reveal="eyebrow"
          className="mb-8 flex items-center gap-4 sm:mb-10 short:hidden"
        >
          <span className="h-px w-8 bg-cyan/50 sm:w-12" aria-hidden="true" />
          <span className="eyebrow text-cyan/90">Interactive 3D Universe</span>
          <span className="h-px w-8 bg-cyan/50 sm:w-12" aria-hidden="true" />
        </div>

        <h1 className="text-hero font-light leading-[0.9] tracking-[-0.035em] short:text-[2.75rem]">
          <span className="block overflow-hidden pb-[0.05em]">
            <span data-reveal-line className="block text-ink/95">
              EXPLORE
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.05em]">
            <span data-reveal-line className="block text-cosmic">
              THE UNIVERSE
            </span>
          </span>
        </h1>

        <p
          data-reveal="body"
          className="mt-8 max-w-lg text-pretty text-[0.9375rem] font-light leading-relaxed text-ink-dim sm:mt-9 sm:text-base short:mt-3 short:text-sm"
        >
          A real-time journey through space, rendered in your browser. Tour
          the solar system, fly freely between the planets, then travel out to
          glowing nebulae and whole galaxies, or ride a ray-traced fall to the
          edge of a black hole.
        </p>

        <div
          data-reveal="cta"
          className="pointer-events-auto mt-11 flex flex-col items-center gap-5 sm:mt-12 short:mt-4"
        >
          <EnterButton onClick={onEnter} />
          {onBlackHole && (
            <button
              type="button"
              onClick={onBlackHole}
              className="group flex items-center gap-2.5 text-[0.8125rem] font-light text-ink-dim transition-colors duration-300 hover:text-ink short:hidden"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffb37a]" aria-hidden="true" />
              Or fall straight into a black hole
            </button>
          )}
          <p className="readout opacity-55 short:hidden">
            Solar system · Nebulae · Galaxies
            <span className="hidden sm:inline">
              {' '}
              · Illustrative scale
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
