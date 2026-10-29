"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceContextDetails } from "@/src/core";

/**
 * Fork: the session's source context — scaffolding card, collapsed by
 * default, like the graph-context card. Shows which sources (and how many
 * passages) the model was given, what did not fit, and links every passage
 * to the Sources page. The model reads the marker's own text; this is the
 * learner's face of it.
 */
export function SourceContextCard({ data }: { data: SourceContextDetails }) {
	const [open, setOpen] = useState(false);
	const sources = data?.sources ?? [];
	const given = sources.reduce((n, s) => n + s.passages.length, 0);
	const omitted = sources.reduce((n, s) => n + s.omitted, 0) + (data?.omittedSources ?? 0);
	return (
		<div data-testid="source-context-card" className="my-1">
			<button
				type="button"
				data-testid="source-context-toggle"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<ChevronRightIcon aria-hidden="true" className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
				<span className="font-medium">Sources</span>
				<span className="min-w-0 flex-1 truncate">
					{data?.subjectName} · {sources.length} {sources.length === 1 ? "source" : "sources"}, {given} {given === 1 ? "passage" : "passages"}
					{omitted > 0 ? ` · some material did not fit (${omitted} left out)` : ""}
				</span>
			</button>
			{open && (
				<div data-testid="source-context-body" className="mt-1 space-y-3 rounded-lg border border-dashed border-border/70 px-4 py-3 text-xs">
					{sources.map((s) => (
						<div key={s.id}>
							<p className="font-medium text-foreground/80">
								{s.label} · {s.name}
							</p>
							<ul className="space-y-0.5 pt-1">
								{s.passages.map((p) => (
									<li key={p.label} className="leading-relaxed text-muted-foreground">
										<Link href={`/sources?source=${encodeURIComponent(s.id)}&ref=${encodeURIComponent(p.ref)}`} className="font-mono text-[11px] underline">
											{p.label}
										</Link>{" "}
										{p.preview}
									</li>
								))}
							</ul>
							{s.omitted > 0 && <p className="pt-1 text-muted-foreground/80">{s.omitted} later passage(s) were not given to the model.</p>}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
