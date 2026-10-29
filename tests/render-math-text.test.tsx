/** MathText renders inline TeX in short strings with real KaTeX and falls back safely. */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, it } from "node:test";
import { MathText } from "../components/math-text.tsx";

const html = (text: string) => renderToStaticMarkup(React.createElement(MathText, { text }));

describe("MathText", () => {
	it("renders $...$ as KaTeX and keeps the surrounding words", () => {
		const out = html("Find $\\lambda$ for A");
		assert.match(out, /class="katex"/);
		assert.match(out, /Find /);
		assert.match(out, / for A/);
		assert.ok(!out.includes("$\\lambda$"), "the raw source is not shown");
	});

	it("renders \\( \\) too", () => {
		assert.match(html("see \\(x^2\\)"), /class="katex"/);
	});

	it("leaves plain text and currency exactly as written", () => {
		assert.equal(html("Plain title"), "Plain title");
		assert.equal(html("costs $5 and $6"), "costs $5 and $6");
	});

	it("shows unparseable TeX as its source instead of dropping it or throwing", () => {
		const out = html("bad $\\frac{1$ here");
		assert.ok(out.includes("\\frac{1"), "the source text stays visible");
		assert.doesNotMatch(out, /class="katex-error"/);
	});

	it("never injects markup from the string", () => {
		const out = html("x $<img src=x onerror=alert(1)>$ y");
		assert.ok(!/<img/i.test(out), "no live element from user text");
	});
});
