/** Reasonloom's mark: a small loom — warp threads (currentColor) woven with a weft (the brand accent).
 *  Keep the export name stable for existing callers. */
export function LhMark({ className = "" }: { className?: string }) {
	const weft = "var(--brand-accent, currentColor)";
	return (
		<svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
			<path d="M9 5.5V26.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
			<path d="M16 5.5V26.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
			<path d="M23 5.5V26.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
			<path d="M5.5 9H26.5" stroke={weft} strokeWidth="2.4" strokeLinecap="round" />
			<path d="M5.5 16H26.5" stroke={weft} strokeWidth="2.4" strokeLinecap="round" />
			<path d="M5.5 23H26.5" stroke={weft} strokeWidth="2.4" strokeLinecap="round" />
			<path d="M16 6.9V11.1" stroke="currentColor" strokeWidth="2.4" />
			<path d="M9 13.9V18.1" stroke="currentColor" strokeWidth="2.4" />
			<path d="M23 13.9V18.1" stroke="currentColor" strokeWidth="2.4" />
			<path d="M16 20.9V25.1" stroke="currentColor" strokeWidth="2.4" />
		</svg>
	);
}
