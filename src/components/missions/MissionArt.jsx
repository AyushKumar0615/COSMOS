import { memo, useId, useMemo } from 'react'
import { createRandom } from '../../lib/random.js'

/**
 * Original mission illustrations, drawn in SVG so the explorer never depends
 * on external image URLs. Each `art.kind` is a small composed scene — a
 * stylised spacecraft at its destination — tinted with the mission accent.
 * They are illustrations, not photographs, and the UI labels them so.
 */

const W = 400
const H = 240

function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function Stars({ seed, count = 70 }) {
  const stars = useMemo(() => {
    const random = createRandom(hash(seed))
    return Array.from({ length: count }, () => ({
      x: random.range(0, W),
      y: random.range(0, H),
      r: random.next() < 0.08 ? random.range(0.9, 1.4) : random.range(0.3, 0.8),
      o: random.range(0.25, 0.9),
    }))
  }, [seed, count])
  return (
    <g>
      {stars.map((star, i) => (
        <circle key={i} cx={star.x.toFixed(1)} cy={star.y.toFixed(1)} r={star.r.toFixed(2)} fill="#fff" opacity={star.o.toFixed(2)} />
      ))}
    </g>
  )
}

/** Solar panel with a cell grid. */
function Panel({ x, y, w, h, cols = 4, rows = 2, tint = '#2b4a8a', rotate = 0, cx = x + w / 2, cy = y + h / 2 }) {
  const lines = []
  for (let c = 1; c < cols; c += 1) lines.push(<line key={`c${c}`} x1={x + (w * c) / cols} y1={y} x2={x + (w * c) / cols} y2={y + h} />)
  for (let r = 1; r < rows; r += 1) lines.push(<line key={`r${r}`} x1={x} y1={y + (h * r) / rows} x2={x + w} y2={y + (h * r) / rows} />)
  return (
    <g transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}>
      <rect x={x} y={y} width={w} height={h} rx="1" fill={tint} stroke="#8fb0ff" strokeOpacity="0.5" strokeWidth="0.6" />
      <g stroke="#a8c2ff" strokeOpacity="0.28" strokeWidth="0.5">{lines}</g>
    </g>
  )
}

// --- Scenes ------------------------------------------------------------------

function LunarModule({ id, accent }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-earth`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#9fd0ff" />
          <stop offset="55%" stopColor="#2f6bd8" />
          <stop offset="100%" stopColor="#0c1e4a" />
        </radialGradient>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8d909a" />
          <stop offset="100%" stopColor="#2a2c33" />
        </linearGradient>
        <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d37a" />
          <stop offset="60%" stopColor="#b8862e" />
          <stop offset="100%" stopColor="#5b3f14" />
        </linearGradient>
      </defs>
      <circle cx="318" cy="58" r="20" fill={`url(#${id}-earth)`} />
      <path d="M318 38a20 20 0 0 1 0 40a26 26 0 0 0 0-40Z" fill="#03040b" opacity="0.78" />
      <path d="M0 176 Q120 160 220 168 T400 162 V240 H0Z" fill={`url(#${id}-ground)`} />
      <ellipse cx="88" cy="205" rx="26" ry="5" fill="#000" opacity="0.25" />
      <ellipse cx="300" cy="214" rx="38" ry="6" fill="#000" opacity="0.22" />
      {/* Lunar module */}
      <g transform="translate(168 96)">
        <path d="M-6 82 L6 56 M70 82 L58 56 M14 86 L20 58 M50 86 L44 58" stroke="#c9ccd6" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M-12 84h12M64 84h12M8 88h12M44 88h12" stroke="#c9ccd6" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M4 34 H60 L66 46 V58 H-2 V46 Z" fill={`url(#${id}-foil)`} />
        <path d="M12 6 L44 2 L58 14 L56 34 H8 L4 18 Z" fill="#c6c9d2" />
        <path d="M12 6 L44 2 L58 14 L56 34 H32 V8 Z" fill="#8e929e" opacity="0.6" />
        <rect x="18" y="14" width="10" height="8" rx="1" fill="#0b0f1c" />
        <path d="M44 2 l2 -10 m-2 10 l10 -6" stroke="#c9ccd6" strokeWidth="1.2" />
      </g>
      {/* Flag */}
      <path d="M262 176 V132" stroke="#d5d8e0" strokeWidth="1.4" />
      <rect x="262" y="132" width="22" height="13" fill={accent} opacity="0.85" />
    </>
  )
}

function Voyager({ id, planet }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-planet`} cx="30%" cy="30%" r="75%">
          {planet === 'neptune' ? (
            <>
              <stop offset="0%" stopColor="#8ec5ff" />
              <stop offset="60%" stopColor="#2a55c9" />
              <stop offset="100%" stopColor="#0a1640" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#f6e2b0" />
              <stop offset="60%" stopColor="#c99a52" />
              <stop offset="100%" stopColor="#4a3215" />
            </>
          )}
        </radialGradient>
        <radialGradient id={`${id}-dish`} cx="40%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#c8cdd8" />
          <stop offset="100%" stopColor="#7b8191" />
        </radialGradient>
      </defs>
      <g transform="translate(300 70)">
        {/* Ring drawn in two halves so the planet sits inside it. */}
        {planet === 'saturn' && (
          <path d="M-64 0 A64 13 0 0 1 64 0" transform="rotate(-16)" fill="none" stroke="#e8d2a0" strokeOpacity="0.45" strokeWidth="5" />
        )}
        <circle r="34" fill={`url(#${id}-planet)`} />
        <path d="M0 -34a34 34 0 0 1 0 68a44 44 0 0 0 0-68Z" fill="#03040b" opacity="0.7" />
        {planet === 'saturn' && (
          <path d="M-64 0 A64 13 0 0 0 64 0" transform="rotate(-16)" fill="none" stroke="#f1dfb4" strokeOpacity="0.75" strokeWidth="5" />
        )}
      </g>
      <g transform="translate(150 132) rotate(-12)">
        {/* Magnetometer boom */}
        <path d="M30 10 L170 -46" stroke="#cfd4df" strokeWidth="1.1" strokeOpacity="0.85" />
        {/* RTG boom */}
        <path d="M-6 18 L-74 52" stroke="#cfd4df" strokeWidth="2" />
        <rect x="-86" y="48" width="18" height="10" rx="2" fill="#8a8f9c" transform="rotate(-26 -77 53)" />
        {/* Bus */}
        <path d="M-14 6 h40 l6 10 l-6 10 h-40 l-6 -10 Z" fill="#9aa0ad" />
        {/* Dish */}
        <ellipse cx="6" cy="-8" rx="44" ry="18" fill={`url(#${id}-dish)`} />
        <ellipse cx="6" cy="-8" rx="44" ry="18" fill="none" stroke="#fff" strokeOpacity="0.5" />
        <path d="M6 -8 L6 -30 M-20 -2 L6 -30 M32 -2 L6 -30" stroke="#e8ecf4" strokeWidth="0.8" />
      </g>
    </>
  )
}

function Webb({ id, accent }) {
  // Honeycomb of 18 hexes: two rings around an empty centre.
  const hexes = useMemo(() => {
    const out = []
    const size = 13
    const dx = size * Math.sqrt(3)
    const axial = []
    for (let q = -2; q <= 2; q += 1) {
      for (let r = -2; r <= 2; r += 1) {
        const s = -q - r
        const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(s))
        if (d >= 1 && d <= 2) axial.push([q, r])
      }
    }
    for (const [q, r] of axial) {
      const x = dx * (q + r / 2)
      const y = size * 1.5 * r
      out.push({ x, y })
    }
    return { size, list: out }
  }, [])
  const hexPath = (x, y, s) => {
    const pts = []
    for (let k = 0; k < 6; k += 1) {
      const a = (Math.PI / 3) * k + Math.PI / 6
      pts.push(`${(x + s * Math.cos(a)).toFixed(1)},${(y + s * Math.sin(a)).toFixed(1)}`)
    }
    return `M${pts.join('L')}Z`
  }
  return (
    <>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe6a0" />
          <stop offset="55%" stopColor={accent} />
          <stop offset="100%" stopColor="#7a5212" />
        </linearGradient>
        <linearGradient id={`${id}-shield`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6d5aa8" />
          <stop offset="50%" stopColor="#c9bff0" />
          <stop offset="100%" stopColor="#5b4b96" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="96" r="110" fill={`url(#${id}-glow)`} />
      {/* Sunshield layers */}
      {[0, 1, 2, 3, 4].map((layer) => (
        <path
          key={layer}
          d={`M${66 - layer * 2} ${190 - layer * 4} L200 ${170 - layer * 4} L${334 + layer * 2} ${190 - layer * 4} L200 ${214 - layer * 4} Z`}
          fill={`url(#${id}-shield)`}
          opacity={0.35 + layer * 0.12}
          stroke="#e9e4ff"
          strokeOpacity="0.25"
          strokeWidth="0.6"
        />
      ))}
      {/* Tower and mirror */}
      <path d="M196 176 V140 M204 176 V140" stroke="#b9bfcc" strokeWidth="2" />
      <g transform="translate(200 92)">
        {hexes.list.map((hex, i) => (
          <path key={i} d={hexPath(hex.x, hex.y, hexes.size - 1)} fill={`url(#${id}-gold)`} stroke="#3a2a08" strokeWidth="0.6" />
        ))}
        {/* Secondary mirror on its tripod */}
        <path d="M-40 26 L0 -60 M40 26 L0 -60 M0 40 L0 -60" stroke="#c9ccd6" strokeWidth="1.1" strokeOpacity="0.8" />
        <circle cx="0" cy="-60" r="4.5" fill="#d9a63a" />
      </g>
    </>
  )
}

function Hubble({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-earth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fc4ff" />
          <stop offset="35%" stopColor="#1f5fb0" />
          <stop offset="100%" stopColor="#061532" />
        </linearGradient>
        <linearGradient id={`${id}-hull`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f3f8" />
          <stop offset="50%" stopColor="#b9bec9" />
          <stop offset="100%" stopColor="#6c7282" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="420" rx="420" ry="220" fill={`url(#${id}-earth)`} />
      <ellipse cx="200" cy="420" rx="420" ry="220" fill="none" stroke="#9fd8ff" strokeOpacity="0.55" strokeWidth="3" />
      <g transform="translate(200 104) rotate(-14)">
        <Panel x={-70} y={-58} w={34} h={116} cols={2} rows={6} tint="#273e78" />
        <Panel x={36} y={-58} w={34} h={116} cols={2} rows={6} tint="#273e78" />
        <path d="M-36 0 H-24 M24 0 H36" stroke="#c9ccd6" strokeWidth="2" />
        <rect x="-24" y="-30" width="48" height="96" rx="8" fill={`url(#${id}-hull)`} />
        <rect x="-26" y="-50" width="52" height="26" rx="4" fill="#d9dde6" />
        <path d="M-26 -50 l-10 -18 h44 l18 18 Z" fill="#c5cad5" />
        <ellipse cx="0" cy="-50" rx="24" ry="6" fill="#0a0e1a" />
        <rect x="-24" y="44" width="48" height="22" rx="4" fill="#8c92a0" />
      </g>
    </>
  )
}

function Rover({ id, variant, accent }) {
  const curiosity = variant === 'curiosity'
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b0f12" stopOpacity="0" />
          <stop offset="100%" stopColor="#d68a5e" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8643a" />
          <stop offset="100%" stopColor="#3b1a0e" />
        </linearGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2f2f2" />
          <stop offset="100%" stopColor="#9ea3ad" />
        </linearGradient>
      </defs>
      <rect x="0" y="80" width={W} height="110" fill={`url(#${id}-sky)`} />
      {curiosity ? (
        <path d="M120 170 L220 92 L262 116 L300 104 L380 170 Z" fill="#8a4b2b" opacity="0.75" />
      ) : (
        <path d="M0 168 Q80 140 150 158 T300 148 T400 156 V190 H0Z" fill="#7d4328" opacity="0.8" />
      )}
      <path d="M0 176 Q110 160 210 172 T400 168 V240 H0Z" fill={`url(#${id}-ground)`} />
      {!curiosity && (
        // Ingenuity
        <g transform="translate(304 62)">
          <path d="M-22 -4 H22 M-18 2 H18" stroke="#d8dbe3" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M0 -4 V8" stroke="#d8dbe3" strokeWidth="1.2" />
          <rect x="-5" y="7" width="10" height="7" rx="1.5" fill="#c9ccd6" />
          <path d="M-4 14 L-9 22 M4 14 L9 22" stroke="#d8dbe3" strokeWidth="0.9" />
        </g>
      )}
      <g transform="translate(118 112)">
        {/* Mast */}
        <path d="M40 34 V-2" stroke="#d9dce4" strokeWidth="3" />
        <rect x="30" y="-12" width="24" height="12" rx="2" fill={`url(#${id}-body)`} />
        <circle cx="48" cy="-6" r="2.4" fill="#10131d" />
        {/* Arm */}
        <path d="M128 50 L156 40 L164 62" stroke="#c9ccd6" strokeWidth="3" fill="none" strokeLinejoin="round" />
        <rect x="158" y="60" width="12" height="9" rx="2" fill="#a7acb7" />
        {/* RTG */}
        <path d="M0 40 L-18 26" stroke="#9ea3ad" strokeWidth="9" strokeLinecap="round" />
        {/* Body */}
        <path d="M2 34 H132 L126 60 H8 Z" fill={`url(#${id}-body)`} />
        <path d="M8 60 H126" stroke={accent} strokeOpacity="0.6" />
        {/* Rocker-bogie and wheels */}
        <path d="M24 62 L48 78 L76 62 L104 78 L128 62" stroke="#7c818d" strokeWidth="3" fill="none" />
        {[18, 54, 92, 130].map((x) => (
          <g key={x}>
            <circle cx={x} cy={84} r="11" fill="#2b2e36" />
            <circle cx={x} cy={84} r="7" fill="#5d626d" />
          </g>
        ))}
      </g>
    </>
  )
}

function Solar({ id, variant }) {
  const parker = variant === 'parker'
  return (
    <>
      <defs>
        <radialGradient id={`${id}-sun`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="45%" stopColor="#ffc55a" />
          <stop offset="80%" stopColor="#ff7a1f" />
          <stop offset="100%" stopColor="#b33a0a" />
        </radialGradient>
        <radialGradient id={`${id}-corona`} cx="50%" cy="50%" r="50%">
          <stop offset="45%" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff7a1f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-earth`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#9fd0ff" />
          <stop offset="60%" stopColor="#2f6bd8" />
          <stop offset="100%" stopColor="#0c1e4a" />
        </radialGradient>
      </defs>
      {parker ? (
        <>
          <circle cx="-30" cy="120" r="230" fill={`url(#${id}-corona)`} />
          <circle cx="-30" cy="120" r="150" fill={`url(#${id}-sun)`} />
          {/* Coronal streamers */}
          <g stroke="#ffd28a" strokeOpacity="0.25" strokeWidth="1.2" fill="none">
            <path d="M118 60 Q190 40 260 20" />
            <path d="M120 120 Q210 118 300 112" />
            <path d="M116 180 Q190 206 270 232" />
          </g>
          <g transform="translate(262 116)">
            {/* Heat shield, edge-on toward the Sun */}
            <rect x="-28" y="-34" width="9" height="68" rx="4" fill="#f4f4f2" />
            <rect x="-19" y="-30" width="3" height="60" fill="#c9ccd6" />
            <path d="M-16 -12 H26 V12 H-16 Z" fill="#a9aeb9" />
            <path d="M26 -2 L60 -18 M26 2 L60 18" stroke="#c9ccd6" strokeWidth="1" />
            <Panel x={-6} y={-30} w={22} h={12} cols={3} rows={1} tint="#2a3f72" />
            <Panel x={-6} y={18} w={22} h={12} cols={3} rows={1} tint="#2a3f72" />
          </g>
        </>
      ) : (
        <>
          <circle cx="430" cy="110" r="210" fill={`url(#${id}-corona)`} />
          <circle cx="430" cy="110" r="120" fill={`url(#${id}-sun)`} />
          <circle cx="40" cy="150" r="12" fill={`url(#${id}-earth)`} />
          <path d="M52 150 H236" stroke="#ffffff" strokeOpacity="0.22" strokeDasharray="3 5" />
          <ellipse cx="200" cy="150" rx="32" ry="64" fill="none" stroke="#ffd27a" strokeOpacity="0.45" strokeDasharray="4 4" />
          <text x="200" y="232" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" letterSpacing="2" fill="#ffffff" opacity="0.45">
            L1
          </text>
          <g transform="translate(200 86)">
            <rect x="-12" y="-12" width="24" height="24" rx="2" fill="#d9a63a" />
            <rect x="-12" y="-12" width="24" height="24" rx="2" fill="none" stroke="#fff3c4" strokeOpacity="0.5" />
            <circle cx="12" cy="0" r="4" fill="#f4f4f2" />
            <Panel x={-56} y={-7} w={42} h={14} cols={4} rows={1} tint="#2a3f72" />
          </g>
        </>
      )}
    </>
  )
}

function MoonLander({ id, accent }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7d808a" />
          <stop offset="100%" stopColor="#1d1f25" />
        </linearGradient>
        <radialGradient id={`${id}-earth`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#9fd0ff" />
          <stop offset="60%" stopColor="#2f6bd8" />
          <stop offset="100%" stopColor="#0c1e4a" />
        </radialGradient>
        <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd98a" />
          <stop offset="60%" stopColor={accent} />
          <stop offset="100%" stopColor="#6a3f0c" />
        </linearGradient>
      </defs>
      {/* Near the south pole, Earth sits low over the horizon. */}
      <circle cx="84" cy="150" r="22" fill={`url(#${id}-earth)`} />
      <path d="M84 128a22 22 0 0 1 0 44a30 30 0 0 0 0-44Z" fill="#03040b" opacity="0.72" />
      <path d="M0 168 Q90 150 200 162 T400 156 V240 H0Z" fill={`url(#${id}-ground)`} />
      <ellipse cx="320" cy="200" rx="34" ry="6" fill="#000" opacity="0.3" />
      <ellipse cx="60" cy="214" rx="22" ry="4" fill="#000" opacity="0.28" />
      {/* Vikram */}
      <g transform="translate(176 104)">
        <path d="M2 50 L-14 76 M70 50 L86 76 M18 54 L12 80 M54 54 L60 80" stroke="#c9ccd6" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M-20 78h12M80 78h12M6 82h12M54 82h12" stroke="#c9ccd6" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="0" y="12" width="72" height="42" rx="3" fill={`url(#${id}-foil)`} />
        <Panel x={6} y={-6} w={60} h={18} cols={6} rows={2} tint="#263c70" />
        <path d="M36 -6 V-18" stroke="#c9ccd6" strokeWidth="1.2" />
        <circle cx="36" cy="-20" r="3" fill="#e8ecf4" />
      </g>
      {/* Ramp and Pragyan */}
      <path d="M248 150 L282 176" stroke="#b8bcc6" strokeWidth="3" />
      <g transform="translate(292 166)">
        <rect x="0" y="0" width="26" height="9" rx="1.5" fill="#d6d9e0" />
        <Panel x={2} y={-6} w={22} h={6} cols={3} rows={1} tint="#2a3f72" />
        {[3, 13, 23].map((x) => (
          <circle key={x} cx={x} cy={12} r="3" fill="#3a3d46" />
        ))}
      </g>
    </>
  )
}

function Orion({ id }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-moon`} cx="30%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#e3e5ea" />
          <stop offset="55%" stopColor="#9a9ea8" />
          <stop offset="100%" stopColor="#2b2d33" />
        </radialGradient>
        <radialGradient id={`${id}-earth`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#9fd0ff" />
          <stop offset="60%" stopColor="#2f6bd8" />
          <stop offset="100%" stopColor="#0c1e4a" />
        </radialGradient>
      </defs>
      <circle cx="330" cy="236" r="150" fill={`url(#${id}-moon)`} />
      {[
        [270, 130, 10],
        [340, 118, 7],
        [300, 170, 14],
        [380, 160, 9],
        [250, 190, 6],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#000" opacity="0.14" />
      ))}
      <circle cx="58" cy="54" r="10" fill={`url(#${id}-earth)`} />
      <path d="M58 44a10 10 0 0 1 0 20a13 13 0 0 0 0-20Z" fill="#03040b" opacity="0.75" />
      <g transform="translate(150 98) rotate(-18)">
        {/* Four solar array wings */}
        <Panel x={-74} y={-6} w={46} h={12} cols={4} rows={1} tint="#263c70" rotate={-24} cx={-28} cy={0} />
        <Panel x={-74} y={-6} w={46} h={12} cols={4} rows={1} tint="#263c70" rotate={24} cx={-28} cy={0} />
        <Panel x={30} y={-6} w={46} h={12} cols={4} rows={1} tint="#263c70" rotate={24} cx={30} cy={0} />
        <Panel x={30} y={-6} w={46} h={12} cols={4} rows={1} tint="#263c70" rotate={-24} cx={30} cy={0} />
        {/* Service module */}
        <rect x="-30" y="-14" width="60" height="28" rx="3" fill="#c8ccd6" />
        <rect x="-30" y="-14" width="60" height="6" fill="#e6e9ef" />
        {/* Crew module */}
        <path d="M30 -16 L62 -8 V8 L30 16 Z" fill="#dfe2e9" />
        <path d="M62 -8 V8" stroke="#8e929e" strokeWidth="2" />
        <path d="M-30 -8 L-40 -4 V4 L-30 8 Z" fill="#7d828e" />
      </g>
    </>
  )
}

function MarsOrbiter({ id, accent }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-mars`} cx="32%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffb48a" />
          <stop offset="50%" stopColor="#c2532a" />
          <stop offset="100%" stopColor="#3a1208" />
        </radialGradient>
        <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd98a" />
          <stop offset="60%" stopColor="#d89a3a" />
          <stop offset="100%" stopColor="#6a3f0c" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="132" rx="150" ry="44" fill="none" stroke={accent} strokeOpacity="0.4" strokeDasharray="3 5" transform="rotate(-12 160 132)" />
      <circle cx="150" cy="132" r="66" fill={`url(#${id}-mars)`} />
      <path d="M110 108 q20 8 40 0 t40 6" stroke="#7a2a12" strokeOpacity="0.5" strokeWidth="6" fill="none" />
      <path d="M100 150 q30 10 60 2" stroke="#7a2a12" strokeOpacity="0.4" strokeWidth="4" fill="none" />
      <ellipse cx="150" cy="70" rx="16" ry="4" fill="#fff" opacity="0.6" />
      <path d="M150 66a66 66 0 0 1 0 132a86 86 0 0 0 0-132Z" fill="#03040b" opacity="0.55" />
      <g transform="translate(300 86)">
        <Panel x={-74} y={-10} w={52} h={20} cols={5} rows={2} tint="#263c70" />
        <path d="M-22 0 H-12" stroke="#c9ccd6" strokeWidth="2" />
        <rect x="-12" y="-14" width="28" height="28" rx="2" fill={`url(#${id}-foil)`} />
        <ellipse cx="26" cy="0" rx="8" ry="20" fill="#eef0f4" />
        <path d="M16 0 H26" stroke="#c9ccd6" strokeWidth="1.4" />
      </g>
    </>
  )
}

function Comet({ id }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-coma`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#cfe0ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#cfe0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-rock`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#8f939c" />
          <stop offset="60%" stopColor="#3d4048" />
          <stop offset="100%" stopColor="#14151a" />
        </radialGradient>
        <linearGradient id={`${id}-jet`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#dbe7ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#dbe7ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="140" cy="140" r="130" fill={`url(#${id}-coma)`} />
      {/* Jets */}
      <path d="M118 96 L96 20 L132 22 Z" fill={`url(#${id}-jet)`} />
      <path d="M170 104 L206 30 L230 44 Z" fill={`url(#${id}-jet)`} opacity="0.7" />
      {/* Two-lobed nucleus */}
      <ellipse cx="112" cy="148" rx="56" ry="44" fill={`url(#${id}-rock)`} transform="rotate(-18 112 148)" />
      <ellipse cx="176" cy="118" rx="38" ry="32" fill={`url(#${id}-rock)`} transform="rotate(12 176 118)" />
      <path d="M140 132 q8 -6 14 -4" stroke="#0b0c10" strokeOpacity="0.6" strokeWidth="5" fill="none" />
      <g transform="translate(308 84) rotate(8)">
        <Panel x={-92} y={-7} w={74} h={14} cols={6} rows={1} tint="#263c70" />
        <Panel x={18} y={-7} w={74} h={14} cols={6} rows={1} tint="#263c70" />
        <rect x="-18" y="-16" width="36" height="32" rx="2" fill="#c9a24a" />
        <ellipse cx="0" cy="-22" rx="16" ry="6" fill="#eef0f4" />
      </g>
    </>
  )
}

function Asteroid({ id }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-rock`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#7a7d86" />
          <stop offset="60%" stopColor="#33353c" />
          <stop offset="100%" stopColor="#101114" />
        </radialGradient>
      </defs>
      {/* Ryugu's spinning-top shape */}
      <path d="M40 150 Q120 64 160 70 Q210 70 290 150 Q210 230 160 228 Q110 228 40 150 Z" fill={`url(#${id}-rock)`} />
      <path d="M44 150 Q160 166 286 150" stroke="#9a9ea8" strokeOpacity="0.35" strokeWidth="2" fill="none" />
      {[
        [110, 120, 6],
        [196, 112, 4],
        [150, 190, 7],
        [230, 176, 5],
        [90, 170, 3],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#d6d9e0" opacity="0.18" />
      ))}
      <path d="M260 72 L214 128" stroke="#ffffff" strokeOpacity="0.2" strokeDasharray="2 4" />
      <g transform="translate(296 58) rotate(-12)">
        <Panel x={-62} y={-8} w={44} h={16} cols={4} rows={1} tint="#263c70" />
        <Panel x={18} y={-8} w={44} h={16} cols={4} rows={1} tint="#263c70" />
        <rect x="-18" y="-15" width="36" height="30" rx="2" fill="#c9ccd6" />
        <rect x="-18" y="-15" width="36" height="30" rx="2" fill="none" stroke="#fff" strokeOpacity="0.4" />
        <circle cx="0" cy="-20" r="8" fill="#eef0f4" />
        <path d="M-4 15 L-30 64" stroke="#d9dce4" strokeWidth="1.6" />
      </g>
    </>
  )
}

const SCENES = {
  'lunar-module': LunarModule,
  voyager: Voyager,
  webb: Webb,
  hubble: Hubble,
  rover: Rover,
  solar: Solar,
  'moon-lander': MoonLander,
  orion: Orion,
  'mars-orbiter': MarsOrbiter,
  comet: Comet,
  asteroid: Asteroid,
}

function MissionArt({ mission, className = '', decorative = true }) {
  const rawId = useId()
  const id = `m${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const Scene = SCENES[mission.art.kind]
  const label = `Illustration of ${mission.name}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-bg`} cx="70%" cy="20%" r="95%">
          <stop offset="0%" stopColor={mission.accent} stopOpacity="0.16" />
          <stop offset="55%" stopColor="#070a17" stopOpacity="1" />
          <stop offset="100%" stopColor="#03040b" stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-bg)`} />
      <Stars seed={mission.id} />
      {Scene && <Scene id={id} accent={mission.accent} {...mission.art} />}
    </svg>
  )
}

export default memo(MissionArt)
