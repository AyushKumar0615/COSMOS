/**
 * Primary call to action. The sweep and the arrow are pure CSS transitions on
 * hover/focus so there is no animation cost while the button sits idle.
 */
export default function EnterButton({ onClick, label = 'Enter Universe' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-4 overflow-hidden rounded-full border border-white/15 bg-white/[0.04] px-8 py-4 backdrop-blur-xl transition-colors duration-500 hover:border-cyan/50 focus-visible:border-cyan/60"
    >
      {/* Light sweep */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/14 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-full group-focus-visible:translate-x-full"
      />
      {/* Inner edge light */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
      />

      <span className="eyebrow relative text-ink">{label}</span>

      <span
        aria-hidden="true"
        className="relative flex h-5 w-5 items-center justify-center"
      >
        <svg viewBox="0 0 20 20" className="h-full w-full" fill="none">
          <path
            d="M3 10h13M11.5 5.5 16 10l-4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-cyan transition-transform duration-500 group-hover:translate-x-[3px] group-focus-visible:translate-x-[3px]"
          />
        </svg>
      </span>
    </button>
  )
}
