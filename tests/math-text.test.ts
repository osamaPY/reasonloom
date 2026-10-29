import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mathSafePreview, splitMath } from "../src/core/math-text.ts";

const m = (value: string) => ({ kind: "math", value });
const t = (value: string) => ({ kind: "text", value });

describe("splitMath", () => {
	it("splits inline dollars and \\( \\) spans from text", () => {
		assert.deepEqual(splitMath("Find $\\nabla f$ and \\(x^2\\) now"), [t("Find "), m("\\nabla f"), t(" and "), m("x^2"), t(" now")]);
	});

	it("leaves plain text, a lone dollar and currency alone", () => {
		assert.deepEqual(splitMath("plain"), [t("plain")]);
		assert.deepEqual(splitMath("costs $5 and $6 total"), [t("costs $5 and $6 total")]);
		assert.deepEqual(splitMath("a $ b"), [t("a $ b")]);
	});

	it("reads a one-line $$...$$ as math (shown inline in short strings)", () => {
		assert.deepEqual(splitMath("solve $$\\det(A)=0$$ now"), [t("solve "), m("\\det(A)=0"), t(" now")]);
		assert.deepEqual(splitMath("$$ never closed"), [t("$$ never closed")]);
		assert.deepEqual(splitMath("$$a$b$$"), [m("a$b")], "a single dollar inside does not close it");
	});

	it("requires non-space just inside the dollars", () => {
		assert.deepEqual(splitMath("$ x $"), [t("$ x $")]);
		assert.deepEqual(splitMath("$x$"), [m("x")]);
	});

	it("treats \\$ as a literal dollar and does not open math with it", () => {
		assert.deepEqual(splitMath("pay \\$x\\$ now"), [t("pay $x$ now")]);
	});

	it("does not span lines or unclosed spans", () => {
		assert.deepEqual(splitMath("a $x\ny$ b"), [t("a $x\ny$ b")]);
		assert.deepEqual(splitMath("open $x never closed"), [t("open $x never closed")]);
	});

	it("keeps escaped characters inside math (\\{ and \\$)", () => {
		assert.deepEqual(splitMath("$\\{a\\}$"), [m("\\{a\\}")]);
		assert.deepEqual(splitMath("$a\\$b$"), [m("a\\$b")]);
	});

	it("never throws and reassembles to the same text for non-math input", () => {
		for (const s of ["", "$", "$$", "\\(", "\\(\\)", "a\\", "$$x$$"]) assert.doesNotThrow(() => splitMath(s));
		assert.equal(splitMath("no math here").map((x) => x.value).join(""), "no math here");
	});
});

describe("mathSafePreview", () => {
	it("returns short text untouched", () => {
		assert.deepEqual(mathSafePreview("short $x$", 50), { text: "short $x$", truncated: false });
	});

	it("cuts plain text at the limit", () => {
		assert.deepEqual(mathSafePreview("abcdefghij", 5), { text: "abcde", truncated: true });
	});

	it("never leaves an unclosed $ span", () => {
		const r = mathSafePreview("see $\\frac{a}{b}$ and more", 10);
		assert.equal(r.text, "see");
		assert.ok(r.truncated);
		assert.equal(mathSafePreview("see $a$ and more", 8).text, "see $a$");
	});

	it("never leaves an unclosed \\( span", () => {
		assert.equal(mathSafePreview("go \\(x^2 + y^2\\) now", 8).text, "go");
	});
});
