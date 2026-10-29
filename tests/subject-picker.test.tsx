/** Fork: the home / draft subject picker (pure parts + hidden-by-default). */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, it } from "node:test";
import { ComposerActions } from "../components/composer-actions.tsx";
import { SubjectPicker, optionLabel, subjectOptions } from "../components/subject-picker.tsx";
import type { SourceMeta, Subject } from "../src/core/index.ts";

const subject = (id: string, name: string, archived = false): Subject => ({ id, name, goal: "", archived, createdAt: "", updatedAt: "" });
const source = (id: string, subjectId: string | null): SourceMeta => ({ id, name: `${id}.md`, sha256: id, bytes: 1, chars: 1, passages: 1, revision: 1, subjectId, addedAt: "", updatedAt: "" });

describe("subjectOptions / optionLabel", () => {
	it("lists only active subjects, each with its own source count", () => {
		const opts = subjectOptions([subject("a", "Algebra"), subject("b", "Old", true), subject("c", "Calculus")], [source("1", "a"), source("2", "a"), source("3", "b"), source("4", null)]);
		assert.deepEqual(opts, [
			{ id: "a", name: "Algebra", sources: 2 },
			{ id: "c", name: "Calculus", sources: 0 },
		]);
	});

	it("says what picking it will mean, including no sources", () => {
		assert.equal(optionLabel({ id: "a", name: "Algebra", sources: 1 }), "Algebra · 1 source");
		assert.equal(optionLabel({ id: "a", name: "Algebra", sources: 3 }), "Algebra · 3 sources");
		assert.equal(optionLabel({ id: "a", name: "Algebra", sources: 0 }), "Algebra · no sources");
	});
});

describe("SubjectPicker + ComposerActions", () => {
	it("renders nothing before the subjects load, so people not using subjects see no new control", () => {
		assert.equal(renderToStaticMarkup(React.createElement(SubjectPicker, { value: null, onChange: () => {} })), "");
	});

	it("an empty picker leaves the actions row empty (hidden by CSS) rather than adding a margin", () => {
		const html = renderToStaticMarkup(React.createElement(ComposerActions, { subject: React.createElement(SubjectPicker, { value: null, onChange: () => {} }) }));
		assert.match(html, /composer-actions[^>]*empty:hidden[^>]*><\/div>|empty:hidden[^>]*data-testid="composer-actions"[^>]*><\/div>/);
	});

	it("without any action the row still renders nothing at all (unchanged behaviour)", () => {
		assert.equal(renderToStaticMarkup(React.createElement(ComposerActions, {})), "");
	});

	it("shows the subject slot alongside the picker and setup actions", () => {
		const html = renderToStaticMarkup(React.createElement(ComposerActions, { picker: React.createElement("i", null, "P"), subject: React.createElement("b", null, "S"), setup: React.createElement("u", null, "U") }));
		assert.ok(html.indexOf("<i>P") < html.indexOf("<b>S") && html.indexOf("<b>S") < html.indexOf("<u>U"));
	});
});
