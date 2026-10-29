/** P02 (fork): the dashboard's resume choice and start guide. */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, it } from "node:test";
import { DashboardPanel, pickResumeSession } from "../components/dashboard-panel.tsx";
import type { ChatSummary } from "../src/core/index.ts";

function chat(over: Partial<ChatSummary> & { id: string }): ChatSummary {
	return {
		title: `Session ${over.id}`,
		createdAt: "2026-10-01T00:00:00.000Z",
		updatedAt: "2026-10-01T00:00:00.000Z",
		kind: "teach",
		messageCount: 2,
		phase: "probing",
		pendingQuestion: false,
		pendingProblem: false,
		...over,
	} as ChatSummary;
}

describe("pickResumeSession", () => {
	it("returns null for an empty list", () => {
		assert.equal(pickResumeSession([]), null);
	});

	it("picks the most recently updated session", () => {
		const a = chat({ id: "a", updatedAt: "2026-10-02T00:00:00.000Z" });
		const b = chat({ id: "b", updatedAt: "2026-10-05T00:00:00.000Z" });
		assert.equal(pickResumeSession([a, b])?.id, "b");
		assert.equal(pickResumeSession([b, a])?.id, "b");
	});

	it("prefers a session waiting on the learner over a newer idle one", () => {
		const waiting = chat({ id: "w", updatedAt: "2026-10-02T00:00:00.000Z", pendingQuestion: true });
		const newer = chat({ id: "n", updatedAt: "2026-10-09T00:00:00.000Z" });
		assert.equal(pickResumeSession([newer, waiting])?.id, "w");
	});

	it("tolerates unparseable dates by falling back to list order", () => {
		const a = chat({ id: "a", updatedAt: "not-a-date" });
		const b = chat({ id: "b", updatedAt: "also-bad" });
		assert.equal(pickResumeSession([a, b])?.id, "a");
	});
});

describe("DashboardPanel", () => {
	it("shows the start guide and no resume link on an empty workspace", () => {
		const html = renderToStaticMarkup(React.createElement(DashboardPanel, { chats: [] }));
		assert.ok(html.includes("dashboard-start-guide"));
		assert.ok(!html.includes("dashboard-resume"));
	});

	it("links the resume card to the chosen session with its status", () => {
		const html = renderToStaticMarkup(
			React.createElement(DashboardPanel, {
				chats: [chat({ id: "x1", title: "Linear algebra", kind: "practice", pendingProblem: true })],
			}),
		);
		assert.ok(html.includes('href="/chat/x1"'));
		assert.ok(html.includes("Linear algebra"));
		assert.ok(html.includes("Problem waiting"));
		assert.ok(!html.includes("dashboard-start-guide"));
	});

	it("labels an untitled session instead of rendering an empty row", () => {
		const html = renderToStaticMarkup(React.createElement(DashboardPanel, { chats: [chat({ id: "u", title: "" })] }));
		assert.ok(html.includes("Untitled session"));
	});
});
