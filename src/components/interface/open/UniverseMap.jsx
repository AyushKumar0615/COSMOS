import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { getWorld, TYPE_LOOK } from '../../../lib/worldCatalogue.js'
import { KM_PER_AU, KM_PER_LY, KM_PER_MPC, formatKm } from '../../../lib/openWorld.js'
import { ship } from '../../../lib/openWorldStore.js'

const DECADES = 9
const SCALES = [
  { label: '1,000 km', km: 1e3 },
  { label: '1 AU', km: KM_PER_AU },
  { label: '1 ly', km: KM_PER_LY },
  { label: '1,000 ly', km: 1e3 * KM_PER_LY },
  { label: '1 Mpc', km: KM_PER_MPC },
]

/**
 * A top-down map of the galactic plane around the ship, on a logarithmic
 * scale so a planet and a quasar fit on one chart. Directions are true
 * (galactic longitude); distances are compressed. Click anything to target it.
 */
export default function UniverseMap({ targetId, onPick, onClose, reducedMotion }) {
  const world = getWorld()
  const [inner, setInner] = useState(() => {
    // Start zoomed so the nearest catalogued objects sit near the centre.
    const nearest = Math.min(...world.objects.map((o) => Math.hypot(o.pos[0] - ship.pos[0], o.pos[1] - ship.pos[1], o.pos[2] - ship.pos[2])))
    return Math.floor(Math.log10(Math.max(nearest, 10)))
  })
  const [filter, setFilter] = useState('all')
  const [hover, setHover] = useState(null)

  const points = useMemo(() => {
    const out = []
    for (const obj of world.objects) {
      if (filter !== 'all' && !filter.split(',').includes(obj.type)) continue
      const dx = obj.pos[0] - ship.pos[0]
      const dz = obj.pos[2] - ship.pos[2]
      const d = Math.hypot(dx, obj.pos[1] - ship.pos[1], dz)
      if (d <= 0) continue
      const r = Math.min(1, Math.max(0, (Math.log10(d) - inner) / DECADES))
      if (r <= 0 && d > 10 ** inner) continue
      const flat = Math.hypot(dx, dz) || 1
      // Seen from the north galactic pole: the centre (+X) up the chart and
      // longitude increasing anticlockwise, l = 90° to the left.
      out.push({ obj, d, x: (dz / flat) * r, y: (-dx / flat) * r, edge: r >= 1 })
    }
    return out
  }, [world, filter, inner])

  const rings = SCALES.filter((s) => Math.log10(s.km) > inner && Math.log10(s.km) < inner + DECADES).map((s) => ({ ...s, r: (Math.log10(s.km) - inner) / DECADES }))

  // Padded below the navigation bar, which sits above the HUD's layer.
  return (
    <motion.div
      role="dialog"
      aria-label="Universe map"
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#03040b]/80 p-3 pt-20 backdrop-blur-sm sm:pt-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
    >
      <div className="glass flex max-h-full w-full max-w-[880px] flex-col gap-3 rounded-3xl bg-[#070a17]/90 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="readout text-cyan">Universe map</p>
            <p className="mt-1 text-[0.8125rem] font-light text-ink-dim">Galactic plane around you · true directions, logarithmic distances</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setInner((v) => v - 1)} aria-label="Zoom map in" className="h-9 w-9 rounded-full border border-white/12 text-ink-dim hover:text-ink">+</button>
            <button type="button" onClick={() => setInner((v) => v + 1)} aria-label="Zoom map out" className="h-9 w-9 rounded-full border border-white/12 text-ink-dim hover:text-ink">−</button>
            <button type="button" onClick={onClose} aria-label="Close map" className="ml-2 h-9 rounded-full border border-white/12 px-4 text-[0.8125rem] text-ink-dim hover:text-ink">Close</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            ['all', 'Everything'],
            ['star', 'Stars'],
            ['planet,dwarf,moon,small,spacecraft', 'Solar system'],
            ['exoplanet', 'Exoplanets'],
            ['nebula,cluster', 'Nebulae and clusters'],
            ['galaxy,blackhole', 'Galaxies and black holes'],
          ].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-full border px-3 py-1 text-[0.75rem] font-light ${filter === value ? 'border-cyan/50 text-ink' : 'border-white/10 text-ink-dim'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[min(60vh,620px)]">
          <svg viewBox="-1.08 -1.08 2.16 2.16" className="h-full w-full" role="img" aria-label="Map of catalogued objects around the ship">
            <circle r="1" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.004" />
            {rings.map((ring) => (
              <g key={ring.label}>
                <circle r={ring.r} fill="none" stroke="rgba(143,212,255,0.16)" strokeWidth="0.003" strokeDasharray="0.01 0.012" />
                <text x="0.01" y={-ring.r - 0.008} fontSize="0.03" fill="rgba(200,215,255,0.5)" fontFamily="monospace">{ring.label}</text>
              </g>
            ))}
            <text x="0" y="-1.03" fontSize="0.032" textAnchor="middle" fill="rgba(200,215,255,0.55)" fontFamily="monospace">↑ Galactic Centre (l 0°)</text>
            {points.map(({ obj, x, y, edge }) => (
              <circle
                key={obj.id}
                cx={x}
                cy={y}
                r={obj.id === targetId ? 0.018 : edge ? 0.006 : 0.009}
                fill={TYPE_LOOK[obj.type]?.color ?? '#fff'}
                opacity={edge ? 0.35 : 0.9}
                stroke={obj.id === targetId ? '#22d3ee' : 'none'}
                strokeWidth="0.006"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(obj.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onPick(obj.id)}
              >
                <title>{obj.name}</title>
              </circle>
            ))}
            <circle r="0.014" fill="#22d3ee" />
            <text y="0.05" fontSize="0.03" textAnchor="middle" fill="#9feaff" fontFamily="monospace">You</text>
          </svg>
          {hover && (
            <p className="readout pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-3 py-1 text-ink">
              {world.byId[hover].name} · {formatKm(points.find((p) => p.obj.id === hover)?.d)}
            </p>
          )}
        </div>
        <ul className="grid max-h-36 grid-cols-1 gap-x-4 overflow-y-auto sm:grid-cols-2 [scrollbar-width:thin]" aria-label="Objects on the map">
          {[...points].sort((p, r) => p.d - r.d).slice(0, 40).map(({ obj, d }) => (
            <li key={obj.id}>
              <button type="button" onClick={() => onPick(obj.id)} className="flex w-full items-baseline justify-between gap-3 py-0.5 text-left">
                <span className="truncate text-[0.75rem] font-light text-ink-dim hover:text-ink">{obj.name}</span>
                <span className="readout shrink-0 opacity-60">{formatKm(d)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
