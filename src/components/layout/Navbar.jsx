import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { NAV_ITEMS } from '../../data/navigation.js'

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg
        viewBox="0 0 28 28"
        className="h-5 w-5 shrink-0"
        aria-hidden="true"
        fill="none"
      >
        <circle cx="14" cy="14" r="3.6" fill="#9BE9FF" />
        <circle cx="14" cy="14" r="3.6" fill="url(#navCore)" />
        <ellipse
          cx="14"
          cy="14"
          rx="11.5"
          ry="4.4"
          stroke="#22D3EE"
          strokeOpacity="0.65"
          strokeWidth="1.1"
          transform="rotate(-24 14 14)"
        />
        <ellipse
          cx="14"
          cy="14"
          rx="11.5"
          ry="4.4"
          stroke="#7C4DFF"
          strokeOpacity="0.45"
          strokeWidth="1.1"
          transform="rotate(38 14 14)"
        />
        <defs>
          <radialGradient id="navCore" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#2F6BFF" />
          </radialGradient>
        </defs>
      </svg>
      <span className="font-mono text-[0.7rem] font-medium tracking-[0.42em] text-ink pl-[0.1em]">
        COSMOS
      </span>
    </span>
  )
}

export default function Navbar({ onNavigate, reducedMotion, activeId }) {
  const [open, setOpen] = useState(false)

  const handle = (item) => {
    setOpen(false)
    onNavigate(item)
  }

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30">
      <div className="pointer-events-auto mx-auto flex max-w-[1500px] items-center justify-between px-6 py-6 sm:px-10 sm:py-7">
        <button
          type="button"
          onClick={() => handle(NAV_ITEMS[0])}
          className="transition-opacity duration-300 hover:opacity-70"
          aria-label="COSMOS — return to home"
        >
          <Wordmark />
        </button>

        {/* Desktop navigation */}
        <nav className="hidden items-center xl:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = item.id === activeId
            return (
            <button
              key={item.id}
              type="button"
              onClick={() => handle(item)}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className="group relative whitespace-nowrap px-2 py-2 2xl:px-3.5"
            >
              <span
                className={`eyebrow !tracking-[0.2em] transition-colors duration-300 group-hover:text-ink ${
                  active ? 'text-ink' : 'text-ink-dim'
                }`}
              >
                {item.short ?? item.label}
              </span>
              {item.status === 'upcoming' && (
                <span
                  className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-violet/70"
                  aria-hidden="true"
                />
              )}
              <span
                className={`absolute inset-x-2 bottom-1 h-px origin-left bg-cyan/70 transition-transform duration-300 group-hover:scale-x-100 2xl:inset-x-3.5 ${
                  active ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
              {item.status === 'upcoming' && (
                <span className="sr-only"> (upcoming, {item.phase})</span>
              )}
            </button>
            )
          })}
        </nav>

        {/* Mobile trigger */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="glass flex h-10 w-10 items-center justify-center rounded-full xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <span className="relative block h-3 w-4">
            <span
              className={`absolute left-0 h-px w-full bg-ink transition-all duration-300 ${
                open ? 'top-1.5 rotate-45' : 'top-0'
              }`}
            />
            <span
              className={`absolute left-0 top-1.5 h-px w-full bg-ink transition-opacity duration-200 ${
                open ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`absolute left-0 h-px w-full bg-ink transition-all duration-300 ${
                open ? 'top-1.5 -rotate-45' : 'top-3'
              }`}
            />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Primary"
            // The list opens over the landing headline, so unlike the other glass
            // surfaces it needs a near-opaque base to stay readable, and on a
            // phone held sideways it is taller than the screen, so it scrolls.
            className="pointer-events-auto glass mx-6 max-h-[calc(100dvh-6.5rem)] overflow-y-auto rounded-2xl bg-[#070a17]/[0.97] lg:ml-auto lg:mr-10 lg:w-80 xl:hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            <ul className="divide-y divide-white/[0.06]">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handle(item)}
                    // aria-current is what actually tells assistive software
                    // where you are; the badge beside it is the visual
                    // equivalent and would otherwise run into the label as
                    // "Solar SystemCurrent".
                    aria-current={item.id === activeId ? 'page' : undefined}
                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                  >
                    <span className="text-base font-light text-ink">{item.label}</span>
                    <span className="readout" aria-hidden="true">
                      {item.status === 'upcoming' ? item.phase : item.id === activeId ? 'Current' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
