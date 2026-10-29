"use client";

import { useEffect, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";

/**
 * Markdown + math clamped to a few lines with a Show more / Show less toggle,
 * so a long multi-part problem does not push the rest of a list off screen.
 * The toggle only appears when the content is actually taller than the clamp.
 */
export function ClampedMarkdown({ children, maxRem = 7, className }: { children: string; maxRem?: number; className?: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [overflows, setOverflows] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => setOverflows(el.scrollHeight > maxRem * parseFloat(getComputedStyle(document.documentElement).fontSize) + 2);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [children, maxRem]);
	return (
		<div>
			<div ref={ref} data-testid="clamped-markdown" style={!open ? { maxHeight: `${maxRem}rem`, overflow: "hidden" } : undefined} className={open || !overflows ? undefined : "[mask-image:linear-gradient(to_bottom,black_70%,transparent)]"}>
				<MessageResponse className={className}>{children}</MessageResponse>
			</div>
			{overflows && (
				<button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 font-ui text-xs text-muted-foreground hover:text-foreground">
					{open ? "Show less" : "Show more"}
				</button>
			)}
		</div>
	);
}
