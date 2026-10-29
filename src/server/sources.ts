/** Server-side source library operations: store + hashing, ids, clock. */
import { createHash, randomUUID } from "node:crypto";
import {
	SOURCE_MAX_FILES_PER_REQUEST,
	decideIngest,
	normalizeText,
	sourceName,
	splitPassages,
	type SourceKind,
	type SourceMeta,
	type SourceRejection,
} from "../core/sources.ts";
import { extractPdfText, PDF_MAX_BYTES } from "./pdf-import.ts";
import { importWebPage } from "./web-import.ts";
import { deleteSourceText, readSourceIndex, readSourceText, writeSourceIndex, writeSourceText } from "../store/sources.ts";
import { readSubjects } from "../store/subjects.ts";

export { readSourceIndex, readSourceText, SOURCE_MAX_FILES_PER_REQUEST };

export type IngestOutcome =
	| { name: string; status: "added" | "updated"; id: string }
	| { name: string; status: "duplicate"; id: string }
	| { name: string; status: "rejected"; reason: SourceRejection | ImportFailure | "write_failed" };

/** Reasons specific to PDFs and web pages. */
export type ImportFailure = "bad_pdf" | "no_text_layer" | "too_many_pages" | "bad_url" | "bad_scheme" | "credentials" | "blocked_host" | "fetch_failed" | "http_error" | "too_many_redirects" | "unsupported_content" | "not_readable";

interface FileInput {
	name: string;
	/** Byte size of the TEXT that will be stored. */
	bytes: number;
	text: string;
	kind?: SourceKind;
	origin?: string;
	pages?: number;
}

/** One file at a time: re-read the index per file so a later file's
 * duplicate check sees an earlier file from the same batch. A failure on one
 * file never aborts the rest. */
export function ingestSource(file: FileInput): IngestOutcome {
	const name = sourceName(file.name);
	const text = normalizeText(file.text);
	const sha256 = createHash("sha256").update(text).digest("hex");
	const index = readSourceIndex();
	const decision = decideIngest(index, { name, bytes: file.bytes, text, sha256 });
	if (decision.kind === "reject") return { name, status: "rejected", reason: decision.reason };
	if (decision.kind === "duplicate") return { name, status: "duplicate", id: decision.existingId };
	const now = new Date().toISOString();
	const stats = {
		sha256,
		bytes: file.bytes,
		chars: text.length,
		passages: splitPassages(text).length,
		...(file.kind && file.kind !== "text" ? { kind: file.kind } : {}),
		...(file.origin ? { origin: file.origin } : {}),
		...(file.pages ? { pages: file.pages } : {}),
	};
	try {
		if (decision.kind === "add") {
			const id = randomUUID();
			writeSourceText(id, text);
			writeSourceIndex([...index, { id, name, ...stats, revision: 1, subjectId: null, addedAt: now, updatedAt: now }]);
			return { name, status: "added", id };
		}
		const id = decision.existingId;
		const previousText = readSourceText(id);
		writeSourceText(id, text);
		try {
			writeSourceIndex(index.map((s) => (s.id === id ? { ...s, ...stats, name, revision: s.revision + 1, updatedAt: now } : s)));
		} catch (error) {
			// An index failure must not leave its old hash/revision pointing at
			// replacement text after the UI reports that the import failed.
			if (previousText === null) deleteSourceText(id);
			else writeSourceText(id, previousText);
			throw error;
		}
		return { name, status: "updated", id };
	} catch {
		return { name, status: "rejected", reason: "write_failed" };
	}
}

/** A PDF file: extract its text layer (no OCR), then store it like any source. */
export async function ingestPdfFile(file: { name: string; data: Uint8Array }): Promise<IngestOutcome> {
	const name = sourceName(file.name);
	if (file.data.length > PDF_MAX_BYTES) return { name, status: "rejected", reason: "too_large" };
	const pdf = await extractPdfText(file.data);
	if (!pdf.ok) return { name, status: "rejected", reason: pdf.reason };
	return ingestSource({ name, bytes: Buffer.byteLength(pdf.text), text: pdf.text, kind: "pdf", pages: pdf.pages });
}

/** A web page (or PDF/text file behind a URL): fetch under the network guard, convert, store. */
export async function ingestUrl(rawUrl: string): Promise<IngestOutcome> {
	const got = await importWebPage(rawUrl);
	if (!got.ok) return { name: rawUrl.slice(0, 200), status: "rejected", reason: got.reason };
	return ingestSource({ name: got.name, bytes: Buffer.byteLength(got.text), text: got.text, kind: got.kind === "text" ? "web" : got.kind, origin: got.origin, pages: got.pages });
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

/** Re-derive each source's passage count from its stored text. The passage
 * rules can change between versions (e.g. displayed formulas now stay with
 * their sentence); the counts shown must describe what the viewer and the
 * model will actually see. Writes the index only when something changed. */
export function refreshSourceStats(): SourceMeta[] {
	const index = readSourceIndex();
	let changed = false;
	const next = index.map((s) => {
		const text = readSourceText(s.id);
		if (text === null) return s;
		const passages = splitPassages(text).length;
		if (passages === s.passages) return s;
		changed = true;
		return { ...s, passages };
	});
	if (changed) {
		try {
			writeSourceIndex(next);
		} catch {
			/* a read-only data dir still gets the corrected numbers this once */
		}
	}
	return next;
}
