"use client";

import { useEffect, useState } from "react";
import type { SourceMeta, Subject } from "@/src/core";

/**
 * Fork: shown on the new-session draft when it was opened from a subject.
 * Says plainly what the session will be grounded in — or that it won't be.
 */
export function SubjectChip({ subjectId }: { subjectId: string }) {
	const [state, setState] = useState<{ subject: Subject | null; sources: number } | "loading">("loading");
	useEffect(() => {
		let live = true;
		void Promise.all([fetch("/api/subjects").then((r) => r.json()), fetch("/api/sources").then((r) => r.json())])
			.then(([s, src]: [{ subjects: Subject[] }, { sources: SourceMeta[] }]) => {
				if (!live) return;
				setState({ subject: s.subjects.find((x) => x.id === subjectId) ?? null, sources: src.sources.filter((x) => x.subjectId === subjectId).length });
			})
			.catch(() => live && setState({ subject: null, sources: 0 }));
		return () => {
			live = false;
		};
	}, [subjectId]);
	if (state === "loading") return null;
	const { subject, sources } = state;
	const text = !subject
		? "That subject no longer exists — this session will start without one."
		: subject.archived
			? `"${subject.name}" is archived — restore it on the Subjects page to start from it.`
			: sources > 0
				? `Subject: ${subject.name} · grounded in ${sources} ${sources === 1 ? "source" : "sources"} from your library`
				: `Subject: ${subject.name} · no sources yet, so nothing to ground this session in`;
	return (
		<p data-testid="subject-chip" className="pointer-events-auto mb-2 font-ui text-xs text-muted-foreground">
			{text}
		</p>
	);
}
