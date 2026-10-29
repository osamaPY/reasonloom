import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitPassages, type SourceMeta } from "../src/core/sources.ts";
import { MAX_CONTEXT_SOURCES, MAX_PASSAGE_CHARS, buildSourceContext, linkCitations } from "../src/core/source-context.ts";

const meta = (id: string, name: string): SourceMeta => ({
	id,
	name,
	sha256: id,
	bytes: 1,
	chars: 1,
	passages: 1,
	revision: 2,
	subjectId: "sub",
	addedAt: "",
	updatedAt: "",
});

const subject = { id: "sub", name: "Linear algebra" };

describe("buildSourceContext", () => {
	it("returns null when the subject has no sources", () => {
		assert.equal(buildSourceContext(subject, []), null);
	});

	it("labels sources S1.. and passages P1.., in name order, with refs that match the passage text", () => {
		const a = { meta: meta("b-id", "b.md"), text: "Second file one.\n\nSecond file two." };
		const c = { meta: meta("a-id", "a.md"), text: "First file." };
		const r = buildSourceContext(subject, [a, c])!;
		assert.deepEqual(r.details.sources.map((s) => [s.label, s.name]), [["S1", "a.md"], ["S2", "b.md"]]);
		assert.match(r.content, /\[S1\.P1\] First file\./);
		assert.match(r.content, /\[S2\.P2\] Second file two\./);
		const target = r.details.citations["S2.P2"]!;
		assert.equal(target.sourceId, "b-id");
		assert.equal(target.ref, splitPassages(a.text)[1]!.ref);
		assert.equal(r.details.sources[1]?.revision, 2);
	});

	it("tells the model to cite only listed labels and to say when material is missing", () => {
		const r = buildSourceContext(subject, [{ meta: meta("x", "x.md"), text: "Hi." }])!;
		assert.match(r.content, /never invent one/);
		assert.match(r.content, /say so plainly/);
		assert.match(r.content, /^\[Session context\]/, "reads as injected context, not learner speech");
	});

	it("truncates one huge passage and flags it", () => {
		const r = buildSourceContext(subject, [{ meta: meta("x", "x.md"), text: "a".repeat(MAX_PASSAGE_CHARS + 500) }])!;
		assert.equal(r.details.sources[0]?.passages[0]?.truncated, true);
		assert.match(r.content, /\[…\]/);
	});

	it("stays within budget, says what was omitted, and keeps earliest passages", () => {
		const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i + 1} ${"w".repeat(200)}`).join("\n\n");
		const r = buildSourceContext(subject, [{ meta: meta("x", "x.md"), text }], 1000)!;
		const included = r.details.sources[0]!.passages.length;
		assert.ok(included > 0 && included < 30);
		assert.equal(r.details.sources[0]?.omitted, 30 - included);
		assert.ok(r.content.includes("[S1.P1]"));
		assert.ok(!r.content.includes(`[S1.P${included + 1}]`));
		assert.match(r.content, /incomplete/);
		assert.equal(Object.keys(r.details.citations).length, included, "only passages the model can see are citable");
	});

	it("caps the number of sources and counts the rest as omitted", () => {
		const many = Array.from({ length: MAX_CONTEXT_SOURCES + 3 }, (_, i) => ({ meta: meta(`id${i}`, `f${String(i).padStart(2, "0")}.md`), text: `Text ${i}.` }));
		const r = buildSourceContext(subject, many)!;
		assert.equal(r.details.sources.length, MAX_CONTEXT_SOURCES);
		assert.equal(r.details.omittedSources, 3);
		assert.match(r.content, /3 source\(s\)/);
	});

	it("counts a source that cannot fit even one passage as omitted, not as empty", () => {
		const big = { meta: meta("a", "a.md"), text: "x".repeat(900) };
		const next = { meta: meta("b", "b.md"), text: "y".repeat(900) };
		const r = buildSourceContext(subject, [big, next], 1000)!;
		assert.equal(r.details.sources.length, 1);
		assert.equal(r.details.omittedSources, 1);
	});
});

describe("linkCitations", () => {
	const citations = { "S1.P2": { sourceId: "src 1", ref: "1.abc" }, "S1.P1": { sourceId: "src 1", ref: "0.def" } };

	it("links known labels with an encoded, resolvable URL", () => {
		assert.equal(linkCitations("See [S1.P2] now.", citations), "See [S1.P2](/sources?source=src%201&ref=1.abc) now.");
	});

	it("links several labels, including adjacent ones", () => {
		const out = linkCitations("[S1.P1][S1.P2]", citations);
		assert.equal((out.match(/\]\(\/sources/g) ?? []).length, 2);
	});

	it("leaves unknown labels exactly as written", () => {
		assert.equal(linkCitations("Made up [S9.P9] and [S1.P7].", citations), "Made up [S9.P9] and [S1.P7].");
	});

	it("does not touch already-linked labels, inline code or fenced code", () => {
		const src = "ok [S1.P1](https://x) and `[S1.P1]` and\n```\n[S1.P2]\n```\nend";
		assert.equal(linkCitations(src, citations), src);
	});

	it("is a no-op without citations and on non-matching brackets", () => {
		assert.equal(linkCitations("[S1.P1]", {}), "[S1.P1]");
		assert.equal(linkCitations("[S1 P1] [P1] [S1.P]", citations), "[S1 P1] [P1] [S1.P]");
	});
});
