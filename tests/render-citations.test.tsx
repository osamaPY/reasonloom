/** Fork: cited source labels become links in every tool-content surface of a
 * grounded session (practice reveal, quiz explanation), and nowhere else. */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, it } from "node:test";
import { ToolContentResponse } from "../components/ai-elements/message.tsx";
import { CitationsProvider } from "../components/citations-context.tsx";

const citations = { "S1.P4": { sourceId: "src-1", ref: "3.abcdef" } };
const render = (text: string, withCitations: boolean) => {
	const body = React.createElement(ToolContentResponse, null, text);
	return renderToStaticMarkup(withCitations ? React.createElement(CitationsProvider, { value: citations }, body) : body);
};

describe("ToolContentResponse citations", () => {
	it("links a known label to its passage inside a grounded session", () => {
		const html = render("See the characteristic equation [S1.P4].", true);
		// Streamdown renders a link as a safety-gated button; the label is its text.
		assert.match(html, /data-streamdown="link"[^>]*>S1\.P4</);
	});

	it("leaves unknown labels as plain text", () => {
		const html = render("Made up [S9.P9].", true);
		assert.ok(!html.includes('data-streamdown="link"'));
		assert.ok(html.includes("S9.P9 — not in your sources"));
	});

	it("is a no-op outside a grounded session", () => {
		const html = render("See [S1.P4].", false);
		assert.ok(!html.includes('data-streamdown="link"'));
		assert.ok(html.includes("[S1.P4]"));
	});
});
