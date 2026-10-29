import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	SOURCE_MAX_BYTES,
	decideIngest,
	findPassages,
	normalizeText,
	resolvePassage,
	sourceName,
	splitPassages,
	textHash,
	type SourceMeta,
} from "../src/core/sources.ts";

function meta(over: Partial<SourceMeta> & { id: string }): SourceMeta {
	return {
		name: `${over.id}.md`,
		sha256: `hash-${over.id}`,
		bytes: 10,
		chars: 10,
		passages: 1,
		revision: 1,
		subjectId: null,
		addedAt: "2026-10-29T00:00:00.000Z",
		updatedAt: "2026-10-29T00:00:00.000Z",
		...over,
	};
}

const input = (over: Partial<{ name: string; bytes: number; text: string; sha256: string }> = {}) => ({
	name: "notes.md",
	bytes: 20,
	text: "# Hello\n\nworld",
	sha256: "new-hash",
	...over,
});

describe("decideIngest", () => {
	it("adds a new supported file", () => {
		assert.deepEqual(decideIngest([], input()), { kind: "add" });
	});

	it("rejects unsupported types, empty, oversized and binary content", () => {
		assert.deepEqual(decideIngest([], input({ name: "a.pdf" })), { kind: "reject", reason: "unsupported_type" });
		assert.deepEqual(decideIngest([], input({ name: "" })), { kind: "reject", reason: "unsupported_type" });
		assert.deepEqual(decideIngest([], input({ text: " \n " })), { kind: "reject", reason: "empty" });
		assert.deepEqual(decideIngest([], input({ bytes: SOURCE_MAX_BYTES + 1 })), { kind: "reject", reason: "too_large" });
		assert.deepEqual(decideIngest([], input({ text: "a\u0000b" })), { kind: "reject", reason: "not_text" });
	});

	it("accepts extensions case-insensitively", () => {
		assert.deepEqual(decideIngest([], input({ name: "NOTES.MD" })), { kind: "add" });
		assert.deepEqual(decideIngest([], input({ name: "a.txt" })), { kind: "add" });
	});

	it("flags identical content as duplicate even under a different name", () => {
		const lib = [meta({ id: "a", sha256: "new-hash" })];
		assert.deepEqual(decideIngest(lib, input({ name: "other.md" })), { kind: "duplicate", existingId: "a" });
	});

	it("treats same name with changed content as an update, case-insensitively", () => {
		const lib = [meta({ id: "a", name: "Notes.md" })];
		assert.deepEqual(decideIngest(lib, input()), { kind: "update", existingId: "a" });
	});

	it("checks validity before duplicates", () => {
		const lib = [meta({ id: "a", sha256: "new-hash" })];
		assert.deepEqual(decideIngest(lib, input({ name: "x.exe" })), { kind: "reject", reason: "unsupported_type" });
	});
});

describe("names and normalisation", () => {
	it("keeps only the base name, never a client path", () => {
		assert.equal(sourceName("C:\\Users\\me\\notes.md"), "notes.md");
		assert.equal(sourceName("../../etc/passwd.txt"), "passwd.txt");
	});

	it("normalises BOM and CRLF", () => {
		assert.equal(normalizeText("\uFEFFa\r\nb\rc"), "a\nb\nc");
	});
});

describe("passages", () => {
	const text = "# Title\n\nFirst para\nstill first.\n\n\n  \nSecond para.\n\nThird.";

	it("splits on blank lines, with offsets into the normalised text", () => {
		const ps = splitPassages(text);
		assert.deepEqual(ps.map((p) => p.text), ["# Title", "First para\nstill first.", "Second para.", "Third."]);
		for (const p of ps) assert.equal(normalizeText(text).slice(p.start, p.end), p.text);
	});

	it("gives identical refs for CRLF and LF versions of the same text", () => {
		const a = splitPassages(text).map((p) => p.ref);
		const b = splitPassages(text.replace(/\n/g, "\r\n")).map((p) => p.ref);
		assert.deepEqual(a, b);
	});

	it("returns no passages for blank text", () => {
		assert.deepEqual(splitPassages("  \n\n "), []);
	});

	it("hashes deterministically and distinguishes texts", () => {
		assert.equal(textHash("abc"), textHash("abc"));
		assert.notEqual(textHash("abc"), textHash("abd"));
		assert.match(textHash("x"), /^[0-9a-f]{14}$/);
	});
});

describe("resolvePassage", () => {
	const v1 = splitPassages("Alpha.\n\nBeta.\n\nGamma.");
	const beta = v1[1]!.ref;

	it("is exact when the text is unchanged", () => {
		const r = resolvePassage(v1, beta);
		assert.equal(r.status, "exact");
	});

	it("reports moved when text shifts position, pointing at the same text", () => {
		const v2 = splitPassages("Intro.\n\nAlpha.\n\nBeta.\n\nGamma.");
		const r = resolvePassage(v2, beta);
		assert.equal(r.status, "moved");
		assert.equal(r.status === "moved" && r.passage.text, "Beta.");
	});

	it("reports stale when the passage was edited or removed — never another passage", () => {
		const v2 = splitPassages("Alpha.\n\nBeta edited.\n\nGamma.");
		assert.deepEqual(resolvePassage(v2, beta), { status: "stale" });
	});

	it("prefers the occurrence nearest the old index when text repeats", () => {
		const dup = splitPassages("Same.\n\nOther.\n\nSame.");
		const ref2 = `2.${textHash("Same.")}`;
		const r = resolvePassage(dup, ref2);
		assert.equal(r.status, "exact");
	});

	it("rejects malformed references", () => {
		assert.deepEqual(resolvePassage(v1, "nope"), { status: "invalid" });
		assert.deepEqual(resolvePassage(v1, "1.XYZ"), { status: "invalid" });
	});
});

describe("findPassages", () => {
	it("matches case-insensitively and ignores blank queries", () => {
		const ps = splitPassages("Eigenvalues here.\n\nNothing.\n\nMore EIGEN stuff.");
		assert.deepEqual(findPassages(ps, "eigen"), [0, 2]);
		assert.deepEqual(findPassages(ps, "  "), []);
	});
});
