/**
 * Source library (fork, P04): study material stored as plain text, kept
 * apart from the knowledge-graph import (which runs a model and keeps only
 * a path + derived nodes). Pure domain logic: ingest decisions, passages,
 * and passage references. No IO, clock, or randomness — callers pass them.
 *
 * Rules (BUILD_DECISIONS.md, P04):
 *  - Formats: .md / .markdown / .txt, UTF-8 text, at most 1 MiB, no NUL.
 *  - Identical content (same sha256) is a DUPLICATE: nothing is stored.
 *  - Same name, changed content REPLACES the text under the same id and
 *    bumps `revision`; older text is not kept (version history is P08).
 *  - A passage is one blank-line-separated block. Its reference is
 *    `<index>.<hash>`: the hash identifies the text, the index is only a
 *    hint, so a reference survives edits elsewhere and reports `moved`,
 *    or `stale` when its text is gone — never silently points elsewhere.
 */

export const SOURCE_MAX_BYTES = 1024 * 1024;
export const SOURCE_MAX_FILES_PER_REQUEST = 25;
export const SOURCE_EXTENSIONS = [".md", ".markdown", ".txt", ".pdf"] as const;

/** How a source came in: a plain file, a PDF's text layer, or a fetched web page. */
export type SourceKind = "text" | "pdf" | "web";

export interface SourceMeta {
	id: string;
	name: string;
	sha256: string;
	bytes: number;
	chars: number;
	passages: number;
	revision: number;
	subjectId: string | null;
	/** Absent on sources added before this existed = "text". */
	kind?: SourceKind;
	/** The URL a web/PDF-by-URL source was fetched from. */
	origin?: string;
	/** Page count of a PDF source. */
	pages?: number;
	addedAt: string;
	updatedAt: string;
}

export type SourceRejection = "unsupported_type" | "empty" | "too_large" | "not_text";

export type IngestDecision =
	| { kind: "add" }
	| { kind: "duplicate"; existingId: string }
	| { kind: "update"; existingId: string }
	| { kind: "reject"; reason: SourceRejection };

/** Normalise line endings so the same note hashes and anchors identically
 * whether it was saved on Windows or elsewhere. */
export function normalizeText(text: string): string {
	return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

/** Display-name rule: the file's base name only — never a client path. */
export function sourceName(fileName: string): string {
	const base = fileName.split(/[\\/]/).pop() ?? "";
	return base.trim().slice(0, 200);
}

export function validateSource(name: string, bytes: number, text: string): SourceRejection | null {
	const lower = name.toLowerCase();
	if (!SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext)) || name === "") return "unsupported_type";
	if (bytes > SOURCE_MAX_BYTES) return "too_large";
	if (text.includes("\u0000")) return "not_text";
	if (text.trim() === "") return "empty";
	return null;
}

/** Decide what a file means for the library. `sha256` is of the normalised
 * text. Names compare case-insensitively (Windows file systems do). */
export function decideIngest(
	library: readonly SourceMeta[],
	input: { name: string; bytes: number; text: string; sha256: string },
): IngestDecision {
	const reason = validateSource(input.name, input.bytes, input.text);
	if (reason) return { kind: "reject", reason };
	const sameContent = library.find((s) => s.sha256 === input.sha256);
	if (sameContent) return { kind: "duplicate", existingId: sameContent.id };
	const sameName = library.find((s) => s.name.toLowerCase() === input.name.toLowerCase());
	if (sameName) return { kind: "update", existingId: sameName.id };
	return { kind: "add" };
}

export interface Passage {
	index: number;
	ref: string;
	text: string;
	/** Offsets into the normalised text, end exclusive. */
	start: number;
	end: number;
}

/** 53-bit string hash (cyrb53) as 14 hex chars: deterministic, sync, no deps.
 * Used for passage identity only — duplicate detection uses sha256. */
export function textHash(text: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i++) {
		const ch = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** A passage that is only a displayed formula ($$...$$ or \[...\]), optionally with trailing punctuation. */
const DISPLAY_ONLY = /^(\$\$[\s\S]*\$\$|\\\[[\s\S]*\\\])\s*[.,;:]?$/;

/** Split into blank-line-separated blocks. A fenced code block that itself
 * contains a blank line splits into two passages (documented limit).
 *
 * A displayed formula on its own is not a passage: it belongs to the sentence
 * that introduces it, and a sentence that carries on after it (it starts in
 * lower case) belongs there too. Without this a web page's "…the roots of / $$f(x)$$ / which is a polynomial"
 * would become three fragments, none of which a citation could stand on. */
export function splitPassages(rawText: string): Passage[] {
	const text = normalizeText(rawText);
	const blocks: { start: number; end: number; body: string }[] = [];
	const re = /\S[\s\S]*?(?=\n[ \t]*\n|$)/g;
	for (let m = re.exec(text); m; m = re.exec(text)) {
		const body = m[0].replace(/\s+$/, "");
		blocks.push({ start: m.index, end: m.index + body.length, body });
		if (m[0].length === 0) re.lastIndex++;
	}
	const merged: { start: number; end: number; math: boolean }[] = [];
	for (const b of blocks) {
		const last = merged[merged.length - 1];
		const isMath = DISPLAY_ONLY.test(b.body);
		const continues = last?.math === true && /^[a-z]/.test(b.body);
		if (last && (isMath || continues)) {
			last.end = b.end;
			last.math = isMath;
		} else {
			merged.push({ start: b.start, end: b.end, math: false });
		}
	}
	return merged.map((p, index) => {
		const body = text.slice(p.start, p.end);
		return { index, ref: `${index}.${textHash(body)}`, text: body, start: p.start, end: p.end };
	});
}

export type PassageResolution =
	| { status: "exact"; passage: Passage }
	| { status: "moved"; passage: Passage }
	| { status: "stale" }
	| { status: "invalid" };

/** Resolve a reference against the CURRENT passages. Hash decides identity:
 * the same text at the same index is `exact`, elsewhere `moved` (the nearest
 * occurrence wins if the text repeats), absent `stale`. */
export function resolvePassage(passages: readonly Passage[], ref: string): PassageResolution {
	const m = /^(\d+)\.([0-9a-f]{14})$/.exec(ref);
	if (!m) return { status: "invalid" };
	const index = Number(m[1]);
	const hash = m[2];
	let best: Passage | null = null;
	for (const p of passages) {
		if (!p.ref.endsWith(`.${hash}`)) continue;
		if (!best || Math.abs(p.index - index) < Math.abs(best.index - index)) best = p;
	}
	if (!best) return { status: "stale" };
	return { status: best.index === index ? "exact" : "moved", passage: best };
}

/** Plain-text search across passages for the viewer: case-insensitive
 * substring, returning passage indexes in order. */
export function findPassages(passages: readonly Passage[], query: string): number[] {
	const q = query.trim().toLowerCase();
	if (q === "") return [];
	return passages.filter((p) => p.text.toLowerCase().includes(q)).map((p) => p.index);
}
