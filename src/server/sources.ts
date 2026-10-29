/** Server-side source library operations: store + hashing, ids, clock. */
import { createHash, randomUUID } from "node:crypto";
import {
	SOURCE_MAX_FILES_PER_REQUEST,
	decideIngest,
	normalizeText,
	sourceName,
	splitPassages,
	type SourceMeta,
	type SourceRejection,
} from "../core/sources.ts";
import { deleteSourceText, readSourceIndex, readSourceText, writeSourceIndex, writeSourceText } from "../store/sources.ts";
import { readSubjects } from "../store/subjects.ts";

export { readSourceIndex, readSourceText, SOURCE_MAX_FILES_PER_REQUEST };

export type IngestOutcome =
	| { name: string; status: "added" | "updated"; id: string }
	| { name: string; status: "duplicate"; id: string }
	| { name: string; status: "rejected"; reason: SourceRejection | "write_failed" };

/** One file at a time: re-read the index per file so a later file's
 * duplicate check sees an earlier file from the same batch. A failure on one
 * file never aborts the rest. */
export function ingestSource(file: { name: string; bytes: number; text: string }): IngestOutcome {
	const name = sourceName(file.name);
	const text = normalizeText(file.text);
	const sha256 = createHash("sha256").update(text).digest("hex");
	const index = readSourceIndex();
	const decision = decideIngest(index, { name, bytes: file.bytes, text, sha256 });
	if (decision.kind === "reject") return { name, status: "rejected", reason: decision.reason };
	if (decision.kind === "duplicate") return { name, status: "duplicate", id: decision.existingId };
	const now = new Date().toISOString();
	const stats = { sha256, bytes: file.bytes, chars: text.length, passages: splitPassages(text).length };
	try {
		if (decision.kind === "add") {
			const id = randomUUID();
			writeSourceText(id, text);
			writeSourceIndex([...index, { id, name, ...stats, revision: 1, subjectId: null, addedAt: now, updatedAt: now }]);
			return { name, status: "added", id };
		}
		const id = decision.existingId;
		writeSourceText(id, text);
		writeSourceIndex(index.map((s) => (s.id === id ? { ...s, ...stats, name, revision: s.revision + 1, updatedAt: now } : s)));
		return { name, status: "updated", id };
	} catch {
		return { name, status: "rejected", reason: "write_failed" };
	}
}

export type SourceUpdateResult = { ok: true; source: SourceMeta } | { ok: false; error: "not_found" | "subject_not_found" | "subject_archived" };

/** Move a source into a subject, or out with null. */
export function assignSourceToSubject(id: string, subjectId: string | null): SourceUpdateResult {
	const index = readSourceIndex();
	const source = index.find((s) => s.id === id);
	if (!source) return { ok: false, error: "not_found" };
	if (subjectId !== null) {
		const subject = readSubjects().subjects.find((s) => s.id === subjectId);
		if (!subject) return { ok: false, error: "subject_not_found" };
		if (subject.archived) return { ok: false, error: "subject_archived" };
	}
	const next = { ...source, subjectId };
	writeSourceIndex(index.map((s) => (s.id === id ? next : s)));
	return { ok: true, source: next };
}

/** Removes the library's copy only; the learner's original file is never touched. */
export function removeSource(id: string): boolean {
	const index = readSourceIndex();
	if (!index.some((s) => s.id === id)) return false;
	writeSourceIndex(index.filter((s) => s.id !== id));
	deleteSourceText(id);
	return true;
}
