import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeText, resolvePassage, splitPassages } from "../src/core/sources.ts";

describe("displayed formulas stay with their sentence", () => {
	it("merges a $$..$$ block into the sentence that introduces it and the clause that continues it", () => {
		const text = "Intro paragraph.\n\nIn other words, the eigenvalues of A are the roots of\n\n$$\\det(xI-A),$$\n\nwhich is a monic polynomial.\n\nA new paragraph.";
		const ps = splitPassages(text);
		assert.deepEqual(ps.map((p) => p.text.split("\n\n").length), [1, 3, 1]);
		assert.equal(ps[1]?.text, "In other words, the eigenvalues of A are the roots of\n\n$$\\det(xI-A),$$\n\nwhich is a monic polynomial.");
		assert.equal(ps[2]?.text, "A new paragraph.");
	});

	it("keeps offsets pointing at the merged text in the normalised source", () => {
		const text = "Lead in:\n\n$$a+b$$\n\nthen more.\n\nNext.";
		for (const p of splitPassages(text)) assert.equal(normalizeText(text).slice(p.start, p.end), p.text);
	});

	it("does not merge an ordinary paragraph, a capitalised follow-on, or an inline formula", () => {
		assert.equal(splitPassages("One $x$ here.\n\nTwo.\n\nThree.").length, 3);
		assert.equal(splitPassages("Lead:\n\n$$a$$\n\nThen a New sentence.").length, 2, "the lead-in and the display merge; a capitalised follow-on stays its own passage");
	});

	it("handles two displays in a row and a display at the very start", () => {
		assert.equal(splitPassages("Lead:\n\n$$a$$\n\n$$b$$\n\nEnd.").length, 2);
		assert.equal(splitPassages("$$a$$\n\nAfter.").length, 2);
	});

	it("supports \\[...\\] displays and trailing punctuation after $$", () => {
		assert.equal(splitPassages("Lead:\n\n\\[a+b\\]\n\nand so on.").length, 1);
		assert.equal(splitPassages("Lead:\n\n$$a+b$$.\n\nMore text here.").length, 2);
	});

	it("refs of untouched passages are unchanged by the merge rule", () => {
		const plain = "Alpha.\n\nBeta.\n\nGamma.";
		const ps = splitPassages(plain);
		assert.equal(resolvePassage(ps, ps[1]!.ref).status, "exact");
	});
});
