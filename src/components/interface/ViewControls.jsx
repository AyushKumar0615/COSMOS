function ControlButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center text-ink-dim transition-colors duration-200 hover:bg-white/[0.06] hover:text-ink"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

/** Zoom in, zoom out and reset. Horizontal bottom-left on desktop, a
 *  vertical strip on the right edge on small screens. */
export default function ViewControls({ onZoomIn, onZoomOut, onReset }) {
  return (
    <div
      role="toolbar"
      aria-label="View controls"
      className="glass pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-full tall:bottom-10 tall:left-6 tall:right-auto tall:top-auto tall:translate-y-0 tall:flex-row lg:left-10"
    >
      <ControlButton label="Zoom in" onClick={onZoomIn}>
        <path d="M10 5v10M5 10h10" {...stroke} />
      </ControlButton>
      <ControlButton label="Zoom out" onClick={onZoomOut}>
        <path d="M5 10h10" {...stroke} />
      </ControlButton>
      <span className="mx-auto h-px w-5 bg-white/10 tall:my-auto tall:h-5 tall:w-px" aria-hidden="true" />
      <ControlButton label="Reset view to the whole solar system" onClick={onReset}>
        <circle cx="10" cy="10" r="2" {...stroke} />
        <path d="M10 2.5v2.5M10 15v2.5M2.5 10H5M15 10h2.5" {...stroke} />
        <circle cx="10" cy="10" r="5.5" {...stroke} strokeOpacity="0.5" />
      </ControlButton>
    </div>
  )
}
