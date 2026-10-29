/** Relevance ranking under the budget, the citation plausibility check, and
 * the "nothing cited" rule. All heuristic and deterministic. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SourceMeta } from "../src/core/sources.ts";
import { buildSourceContext, checkCitations, citationLabelOf, lacksCitation, linkCitations, type CitationTarget } from "../src/core/source-context.ts";
import { contentWords, coverage } from "../src/core/text-match.ts";

const meta = (id: string, name: string): SourceMeta => ({ id, name, sha256: id, bytes: 1, chars: 1, passages: 1, revision: 1, subjectId: "s", addedAt: "", updatedAt: "" });
const subject = { id: "s", name: "Maths" };

describe("text-match", () => {
	it("drops stopwords and short words, stems simple suffixes", () => {
		assert.deepEqual(contentWords("The eigenvalues are solved"), ["eigenvalu", "solv"]);
		assert.deepEqual(contentWords("it is a to of"), []);
	});

	it("coverage is the weighted share of the QUERY found in the document", () => {
		assert.equal(coverage(["cat", "dog"], ["cat", "bird"]), 0.5);
		assert.equal(coverage([], ["cat"]), 0);
		assert.equal(coverage(["cat"], []), 0);
	});
});

describe("ranking under the budget", () => {
	const filler = (n: number, topic: string) => Array.from({ length: n }, (_, i) => `${topic} paragraph ${i} ${"lorem ipsum ".repeat(30)}`).join("\n\n");

	it("keeps passages relevant to the opening message when the library does not fit", () => {
		const text = [filler(10, "Gardening"), "Photosynthesis converts light into chemical energy inside chloroplasts.", filler(10, "Cooking")].join("\n\n");
		const r = buildSourceContext(subject, [{ meta: meta("a", "a.md"), text }], 1500, "How does photosynthesis work in chloroplasts?")!;
		assert.equal(r.details.ranked, true);
		assert.ok(r.content.includes("Photosynthesis converts light"), "the relevant passage made the cut");
		assert.match(r.content, /most relevant to the learner's opening message/);
		// labels stay tied to the ORIGINAL passage index
		const label = Object.entries(r.details.citations).find(([, c]) => c.text?.startsWith("Photosynthesis"))?.[0];
		assert.equal(label, "S1.P11");
	});

	it("falls back to document order without a query, and is not 'ranked'", () => {
		const text = filler(30, "Topic");
		const r = buildSourceContext(subject, [{ meta: meta("a", "a.md"), text }], 1500)!;
		assert.equal(r.details.ranked, false);
		assert.ok(r.details.citations["S1.P1"]);
		assert.ok(!r.details.citations["S1.P30"]);
	});

	it("includes everything, unranked, when the library fits", () => {
		const r = buildSourceContext(subject, [{ meta: meta("a", "a.md"), text: "One.\n\nTwo." }], 24000, "anything")!;
		assert.equal(r.details.ranked, false);
		assert.equal(Object.keys(r.details.citations).length, 2);
	});

	it("never exceeds the budget while ranking", () => {
		const text = filler(40, "Topic");
		const r = buildSourceContext(subject, [{ meta: meta("a", "a.md"), text }], 2000, "topic paragraph")!;
		const body = Object.values(r.details.citations).reduce((n, c) => n + (c.text?.length ?? 0), 0);
		assert.ok(body <= 2000, `body ${body}`);
	});
});

describe("checkCitations", () => {
	const citations: Record<string, CitationTarget> = {
		"S1.P1": { sourceId: "a", ref: "0.x", text: "An eigenvector is a nonzero vector whose direction the matrix does not change." },
	};

	it("marks a supported citation ok", () => {
		const m = checkCitations("An eigenvector is a nonzero vector that keeps its direction [S1.P1].", citations);
		assert.equal(m.get("S1.P1"), "ok");
	});

	it("flags a citation whose sentence shares almost nothing with the passage as weak", () => {
		const m = checkCitations("Mitochondria produce adenosine triphosphate through oxidative phosphorylation [S1.P1].", citations);
		assert.equal(m.get("S1.P1"), "weak");
	});

	it("does not judge a sentence too short to judge", () => {
		assert.equal(checkCitations("See this [S1.P1].", citations).get("S1.P1"), "ok");
	});

	it("flags an unknown label and the worst status per label wins", () => {
		const m = checkCitations("Hmm [S9.P9]. Mitochondria produce adenosine triphosphate through phosphorylation [S1.P1]. An eigenvector is a nonzero vector [S1.P1].", citations);
		assert.equal(m.get("S9.P9"), "unknown");
		assert.equal(m.get("S1.P1"), "weak");
	});

	it("returns nothing when the session has no citations", () => {
		assert.equal(checkCitations("x [S1.P1]", {}).size, 0);
	});
});

describe("linkCitations marks", () => {
	const citations: Record<string, CitationTarget> = { "S1.P1": { sourceId: "a", ref: "0.x", text: "An eigenvector is a nonzero vector whose direction the matrix does not change." } };

	it("adds a ? to a weak link and none to a good one; the label is recoverable", () => {
		const weak = linkCitations("Mitochondria produce adenosine triphosphate through oxidative phosphorylation [S1.P1].", citations);
		assert.match(weak, /\[S1\.P1\?\]\(\/sources/);
		const good = linkCitations("An eigenvector is a nonzero vector that keeps its direction [S1.P1].", citations);
		assert.match(good, /\[S1\.P1\]\(\/sources/);
		assert.equal(citationLabelOf("S1.P1?"), "S1.P1");
		assert.equal(citationLabelOf(" S1.P1 "), "S1.P1");
	});
});

describe("lacksCitation", () => {
	const citations: Record<string, CitationTarget> = { "S1.P1": { sourceId: "a", ref: "0.x" } };
	const long = "word ".repeat(80);

	it("is true for a long reply that cites nothing in a grounded session", () => {
		assert.equal(lacksCitation(long, citations), true);
	});

	it("is false when something is cited, when the reply is short, or outside a grounded session", () => {
		assert.equal(lacksCitation(long + "[S1.P1]", citations), false);
		assert.equal(lacksCitation("short", citations), false);
		assert.equal(lacksCitation(long, {}), false);
	});
});
