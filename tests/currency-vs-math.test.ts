/** Fork: a price pair ("$5 and then $6") must not be typeset as one math span,
 * while real inline math (padded, digit-leading, or ordinary) still is. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { transformMathDelimiters } from "../src/core/math-delims.ts";

describe("currency dollars are not math", () => {
	it("keeps a price pair as literal dollars", () => {
		assert.equal(transformMathDelimiters("it costs $5 and then $6 more"), "it costs \\$5 and then \\$6 more");
		assert.equal(transformMathDelimiters("$5, $10, and $15"), "\\$5, \\$10, and $15");
	});

	it("still treats real inline math as math", () => {
		for (const md of ["then $x$ here", "then $ x $ here", "then $2x+1$ here", "then $2 \\times 2$ here", "a $x$ b and $y$ c", "set $n = 5$ and $m = 6$ now"]) {
			assert.equal(transformMathDelimiters(md), md, md);
		}
	});

	it("leaves display math and code alone", () => {
		for (const md of ["$$a + b$$", "use `$5 and $6` literally", "```\n$5 and $6\n```"]) assert.equal(transformMathDelimiters(md), md, md);
	});
});
