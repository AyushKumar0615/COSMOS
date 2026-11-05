/**
 * The instrument furniture that frames the viewport: corner brackets and a
 * bottom readout strip. Decorative, so it is hidden from assistive tech, and
 * entirely non-interactive.
 */

function Corner({ className }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-10 w-10 border-white/15 ${className}`}
    />
  )
}

export default function HudFrame({ readouts = [], note }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      <div className="absolute inset-4 sm:inset-6">
        <Corner className="left-0 top-0 border-l border-t" />
        <Corner className="right-0 top-0 border-r border-t" />
        <Corner className="bottom-0 left-0 border-b border-l" />
        <Corner className="bottom-0 right-0 border-b border-r" />
      </div>

      {(readouts.length > 0 || note) && (
        <div className="absolute inset-x-0 bottom-0 px-6 pb-7 sm:px-12 sm:pb-9 short:hidden">
          <div className="hairline mb-4 h-px w-full opacity-60" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3">
            <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3 sm:gap-x-12">
              {readouts.map((item, index) => (
                <div
                  key={item.label}
                  // Keep the mobile strip to a single line.
                  className={`items-baseline gap-2.5 ${
                    index > 1 ? 'hidden sm:flex' : 'flex'
                  }`}
                >
                  <dt className="readout opacity-60">{item.label}</dt>
                  <dd className="font-mono text-[0.6875rem] tracking-[0.1em] text-ink-dim tabular-nums">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            {note && (
              <div className="hidden items-center gap-2.5 sm:flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
                </span>
                <span className="readout text-ink-dim/80">{note}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
