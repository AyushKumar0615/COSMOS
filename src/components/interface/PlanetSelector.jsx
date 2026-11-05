import { BODIES_BY_ID, BODY_ORDER } from '../../data/planets.js'

/**
 * Body picker. A quiet vertical rail on desktop, a horizontally scrolling
 * chip row on small screens. Both drive the same selection.
 */
export default function PlanetSelector({ selectedId, onSelect, hidden }) {
  return (
    <>
      <nav
        aria-label="Solar system bodies"
        className="pointer-events-auto absolute left-6 top-1/2 hidden -translate-y-1/2 tall:block lg:left-10"
      >
        <p className="readout mb-4 pl-5 opacity-50">Bodies</p>
        <ul className="relative space-y-0.5">
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-white/0 via-white/12 to-white/0"
          />
          {BODY_ORDER.map((id) => {
            const body = BODIES_BY_ID[id]
            const active = id === selectedId
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-current={active ? 'true' : undefined}
                  className="group relative flex items-center gap-3.5 py-1.5 pr-3"
                >
                  <span
                    className={`relative z-10 h-[11px] w-[11px] rounded-full ring-1 transition-all duration-300 ${
                      active ? 'ring-cyan/90 ring-offset-2 ring-offset-void' : 'ring-white/15'
                    }`}
                    style={{ backgroundColor: body.color }}
                  />
                  <span
                    className={`eyebrow transition-colors duration-300 ${
                      active ? 'text-ink' : 'text-muted group-hover:text-ink-dim'
                    }`}
                  >
                    {body.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <nav
        aria-label="Solar system bodies"
        className={`pointer-events-auto absolute inset-x-0 bottom-5 transition-opacity duration-300 tall:hidden ${
          hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {BODY_ORDER.map((id) => {
            const body = BODIES_BY_ID[id]
            const active = id === selectedId
            return (
              <li key={id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-current={active ? 'true' : undefined}
                  className={`glass flex items-center gap-2 rounded-full py-2 pl-2.5 pr-3.5 transition-colors ${
                    active ? 'border-cyan/50' : ''
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: body.color }}
                  />
                  <span className={`text-[0.8125rem] font-light ${active ? 'text-ink' : 'text-ink-dim'}`}>
                    {body.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
