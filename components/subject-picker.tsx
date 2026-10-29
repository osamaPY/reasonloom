"use client";

import { useEffect, useState } from "react";
import { LayersIcon } from "lucide-react";
import type { SourceMeta, Subject } from "@/src/core";

export interface SubjectOption {
	id: string;
	name: string;
	sources: number;
}

/** Active subjects with the number of sources each would ground a session in. */
export function subjectOptions(subjects: readonly Subject[], sources: readonly SourceMeta[]): SubjectOption[] {
	return subjects.filter((s) => !s.archived).map((s) => ({ id: s.id, name: s.name, sources: sources.filter((src) => src.subjectId === s.id).length }));
}

/** Pure label for one option — what picking it will mean. */
export function optionLabel(o: SubjectOption): string {
	return o.sources > 0 ? `${o.name} · ${o.sources} ${o.sources === 1 ? "source" : "sources"}` : `${o.name} · no sources`;
}

/**
 * Fork: choose the subject a new session starts from. Hidden until at least
 * one active subject exists (people not using subjects see no new control).
 * A value that is no longer a live subject (archived or deleted since the
 * link was made) is cleared with a visible note instead of failing the send.
 */
export function SubjectPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
	const [options, setOptions] = useState<SubjectOption[] | null>(null);
	const [stale, setStale] = useState(false);
	useEffect(() => {
		let live = true;
		void Promise.all([fetch("/api/subjects").then((r) => r.json()), fetch("/api/sources").then((r) => r.json())])
			.then(([s, src]: [{ subjects: Subject[] }, { sources: SourceMeta[] }]) => {
				if (!live) return;
				const opts = subjectOptions(s.subjects, src.sources);
				setOptions(opts);
				if (value && !opts.some((o) => o.id === value)) {
					setStale(true);
					onChange(null);
				}
			})
			.catch(() => live && setOptions([]));
		return () => {
			live = false;
		};
		// Load once; `value`/`onChange` are only read to validate the initial link.
	}, []);
	if (!options) return null;
	if (options.length === 0 && !stale) return null;
	return (
		<div className="flex items-center gap-2">
			<label className="flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 font-ui text-xs text-muted-foreground">
				<LayersIcon aria-hidden="true" className="size-3.5" />
				<span className="sr-only">Subject for this session</span>
				<select
					data-testid="subject-picker"
					value={value ?? ""}
					onChange={(e) => {
						setStale(false);
						onChange(e.target.value || null);
					}}
					className="max-w-52 cursor-pointer truncate bg-transparent text-foreground outline-none"
				>
					<option value="">No subject</option>
					{options.map((o) => (
						<option key={o.id} value={o.id}>
							{optionLabel(o)}
						</option>
					))}
				</select>
			</label>
			{stale && (
				<span role="status" data-testid="subject-stale" className="font-ui text-xs text-muted-foreground">
					That subject is archived or gone, so this session will start without one.
				</span>
			)}
		</div>
	);
}
