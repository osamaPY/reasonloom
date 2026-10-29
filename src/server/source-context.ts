/** Server side of the source context: read a subject's sources and build
 * the session marker (core/source-context.ts). */
import { buildSourceContext } from "../core/source-context.ts";
import { newSourceContextMessage, type LhMarkerMessage } from "../core/native-messages.ts";
import { readSourceIndex, readSourceText } from "../store/sources.ts";
import { readSubjects } from "../store/subjects.ts";

export type SourceMarkerResult =
	| { ok: true; marker: LhMarkerMessage | null }
	| { ok: false; error: "subject_not_found" | "subject_archived" };

/** `marker` is null when the subject exists but has no readable sources —
 * the session is still created and assigned, just without grounding. */
export function sourceContextMarkerFor(subjectId: string): SourceMarkerResult {
	const subject = readSubjects().subjects.find((s) => s.id === subjectId);
	if (!subject) return { ok: false, error: "subject_not_found" };
	if (subject.archived) return { ok: false, error: "subject_archived" };
	const sources = readSourceIndex()
		.filter((s) => s.subjectId === subjectId)
		.flatMap((meta) => {
			const text = readSourceText(meta.id);
			return text === null ? [] : [{ meta, text }];
		});
	const built = buildSourceContext({ id: subject.id, name: subject.name }, sources);
	return { ok: true, marker: built ? newSourceContextMessage(built.content, built.details) : null };
}
