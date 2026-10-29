import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assemblePdfText, layoutPageParagraphs, type PdfTextItem } from "../src/core/pdf-text.ts";

const it_ = (str: string, y: number, h = 10, eol = false): PdfTextItem => ({ str, y, h, eol });

describe("layoutPageParagraphs", () => {
	it("joins items on one baseline into a line and wraps lines into a paragraph", () => {
		const p = layoutPageParagraphs([it_("An eigenvector", 700), it_("is a vector", 700), it_("that keeps its", 688), it_("direction.", 676)]);
		assert.deepEqual(p, ["An eigenvector is a vector that keeps its direction."]);
	});

	it("starts a new paragraph on a clearly larger gap", () => {
		const p = layoutPageParagraphs([it_("First paragraph line one", 700), it_("line two.", 688), it_("Second paragraph.", 640)]);
		assert.deepEqual(p, ["First paragraph line one line two.", "Second paragraph."]);
	});

	it("rejoins a word hyphenated across lines", () => {
		assert.deepEqual(layoutPageParagraphs([it_("the eigen-", 700), it_("value is", 688)]), ["the eigenvalue is"]);
	});

	it("ignores empty items and returns nothing for a page with no text", () => {
		assert.deepEqual(layoutPageParagraphs([it_("", 700), it_("  ", 690)]), []);
		assert.deepEqual(layoutPageParagraphs([]), []);
	});

	it("does not glue a run onto the previous one without a space", () => {
		assert.deepEqual(layoutPageParagraphs([it_("Hello", 700), it_("world", 700)]), ["Hello world"]);
		assert.deepEqual(layoutPageParagraphs([it_("Hello ", 700), it_("world", 700)]), ["Hello world"]);
	});
});

describe("assemblePdfText", () => {
	it("prefixes each non-empty page with its page number and counts empty pages", () => {
		const r = assemblePdfText([["Intro paragraph.", "More."], [], ["Page three text."]], 10_000);
		assert.equal(r.text, "(p. 1) Intro paragraph.\n\nMore.\n\n(p. 3) Page three text.");
		assert.deepEqual([r.pages, r.emptyPages, r.truncated], [3, 1, false]);
	});

	it("truncates at the character budget and says so, never mid-paragraph", () => {
		const r = assemblePdfText([["a".repeat(50)], ["b".repeat(50)], ["c".repeat(50)]], 130);
		assert.equal(r.truncated, true);
		assert.ok(r.text.length <= 130);
		assert.ok(!r.text.includes("c"));
	});

	it("yields empty text when no page has any", () => {
		const r = assemblePdfText([[], []], 1000);
		assert.deepEqual([r.text, r.pages, r.emptyPages], ["", 2, 2]);
	});
});
