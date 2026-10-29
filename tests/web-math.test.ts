/** Web pages keep their formulas as TeX (MediaWiki-style markup), drop remote
 * images, and the citation check ignores formulas and link noise. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkCitations } from "../src/core/source-context.ts";
import { contentWords, plainForMatching } from "../src/core/text-match.ts";
import { htmlToMarkdown, unwrapDisplaystyle } from "../src/server/web-import.ts";

const inlineMath = (tex: string) =>
	`<span class="mwe-math-element"><span class="mwe-math-mathml-inline"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">{\\displaystyle ${tex}}</annotation></semantics></math></span><img src="https://wikimedia.org/x.svg" class="mwe-math-fallback-image-inline" alt="{\\displaystyle ${tex}}"></span>`;
const displayMath = (tex: string) =>
	`<dl><dd><span class="mwe-math-element mwe-math-element-block"><span class="mwe-math-mathml-display"><math display="block"><semantics><mrow/><annotation encoding="application/x-tex">{\\displaystyle ${tex}}</annotation></semantics></math></span><img src="https://wikimedia.org/y.svg" class="mwe-math-fallback-image-display" alt="{\\displaystyle ${tex}}"></span></dd></dl>`;
const filler = "An eigenvector keeps its direction under the linear map and the scalar is called the eigenvalue. ".repeat(4);

describe("web pages keep formulas as TeX", () => {
	const page = `<html><head><title>Eigen</title></head><body><article><h1>Eigen</h1><p>${filler} For a ${inlineMath("2\\times 2")} matrix ${inlineMath("A_{ij}")} the polynomial is</p>${displayMath("p_A(t)=t^2-\\operatorname{tr}(A)\\,t+\\det(A)")}<p>${filler}</p><p><img src="https://example.com/photo.png" alt="a photo of a matrix"> ${filler}</p></article></body></html>`;

	it("turns MathML/fallback-image math into $...$ and $$...$$ without escaping the TeX", () => {
		const md = htmlToMarkdown(page, "https://example.com/p")!.markdown;
		assert.ok(md.includes("$2\\times 2$"), md);
		assert.ok(md.includes("$A_{ij}$"), "underscores in a formula are not escaped");
		assert.ok(md.includes("$$p_A(t)=t^2-\\operatorname{tr}(A)\\,t+\\det(A)$$"), md);
	});

	it("counts each formula once (the fallback image is not a second copy)", () => {
		const md = htmlToMarkdown(page, "https://example.com/p")!.markdown;
		assert.equal((md.match(/2\\times 2/g) ?? []).length, 1);
	});

	it("drops remote images and leaves no URLs from them", () => {
		const md = htmlToMarkdown(page, "https://example.com/p")!.markdown;
		assert.ok(!md.includes("wikimedia.org"));
		assert.ok(!md.includes("photo.png"));
		assert.ok(!md.includes("!["));
	});

	it("never emits \\[ or \\] (the app reads those as display-math delimiters) and drops reference/edit chrome", () => {
		const html = `<html><head><title>T</title></head><body><article><h1>T</h1><h2>Section <span class="mw-editsection">[<a href="/edit">edit</a>]</span></h2><p>${filler} A claim<sup class="reference"><a href="#n">[5]</a></sup> and a literal [bracketed aside] here, with <i>[clarification needed]</i>.</p><p>${filler}</p></article></body></html>`;
		const md = htmlToMarkdown(html, "https://example.com/p")!.markdown;
		assert.ok(!md.includes("\\["), md);
		assert.ok(!md.includes("\\]"), md);
		assert.ok(!md.includes("edit"), "the edit link is page chrome");
		assert.ok(!md.includes("[5]"), "the reference mark is page chrome");
		assert.ok(md.includes("[bracketed aside]"), "square brackets in prose survive as plain text");
	});

	it("unwraps MediaWiki's displaystyle envelope only", () => {
		assert.equal(unwrapDisplaystyle("{\\displaystyle x^2}"), "x^2");
		assert.equal(unwrapDisplaystyle("  {\\displaystyle   a  +  b }  "), "a + b");
		assert.equal(unwrapDisplaystyle("x^2"), "x^2");
	});
});

describe("matching ignores formulas and link noise", () => {
	it("strips math, images and link targets before comparing words", () => {
		const t = "See $x^2$ and $$y = z$$ and \\(w\\) then ![alt](https://u.example/a.png) and [roots](https://en.wikipedia.org/wiki/Zero_of_a_function \"t\") here";
		assert.deepEqual(contentWords(t), ["see", "root", "here"].filter((w) => contentWords(t).includes(w)));
		const plain = plainForMatching(t);
		assert.ok(!plain.includes("wikipedia") && !plain.includes("u.example") && !plain.includes("x^2"));
		assert.ok(plain.includes("[roots]"));
	});

	it("does not flag a citation whose sentence is mostly formula (too little prose to judge)", () => {
		const citations = { "S1.P1": { sourceId: "a", ref: "0.x", text: "For a 2x2 matrix the characteristic polynomial is thus" } };
		const m = checkCitations("So $p_A(t)=t^2-\\operatorname{tr}(A)t+\\det(A)$, exactly the shape [S1.P1].", citations);
		assert.equal(m.get("S1.P1"), "ok");
	});

	it("still flags an unrelated claim even when the passage is full of links and formulas", () => {
		const citations = { "S1.P1": { sourceId: "a", ref: "0.x", text: "The eigenvalues of A are the [roots](https://en.wikipedia.org/wiki/Zero) of ![d](https://w.org/a.svg) a monic polynomial." } };
		const m = checkCitations("Mitochondria generate adenosine triphosphate during oxidative phosphorylation in cells [S1.P1].", citations);
		assert.equal(m.get("S1.P1"), "weak");
	});
});
