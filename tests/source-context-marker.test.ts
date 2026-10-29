/** Fork: the source-context marker end to end below the UI — built from a
 * real library (isolated LH_DATA_DIR, child process), projected by the view,
 * and read by the model as a user-role message. */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { newSourceContextMessage, toLlmMessages } from "../src/core/native-messages.ts";
import { projectView } from "../src/core/view.ts";
import { linkCitations, type SourceContextDetails } from "../src/core/source-context.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const TSX = pathToFileURL(path.join(REPO_ROOT, "node_modules", "tsx", "dist", "loader.mjs")).href;
const serverUrl = JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src", "server", "index.ts")).href);

function run<T>(dir: string, body: string): T {
	const code = `const m = await import(${serverUrl}); ${body}`;
	const out = execFileSync(process.execPath, ["--import", TSX, "--input-type=module", "--eval", code], { cwd: REPO_ROOT, encoding: "utf-8", env: { ...process.env, LH_DATA_DIR: dir } });
	return JSON.parse(out.trim().split("\n").pop()!) as T;
}

describe("source-context marker", () => {
	it("is built from the subject's own sources only, and the model reads it as a user message", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-sc-"));
		try {
			const r = run<{ none: unknown; emptySubject: unknown; marker: { customType: string; content: string; details: SourceContextDetails }; archived: unknown; ghost: unknown }>(
				dir,
				`const a = m.createSubjectRecord({ name: "Alpha" }).value.subjects[0];
				const b = m.createSubjectRecord({ name: "Beta" }).value.subjects[1];
				const empty = m.sourceContextMarkerFor(a.id);
				const s1 = m.ingestSource({ name: "alpha.md", bytes: 20, text: ["Alpha fact one.", "Alpha fact two."].join(String.fromCharCode(10, 10)) });
				const s2 = m.ingestSource({ name: "beta.md", bytes: 20, text: "Beta only fact." });
				m.assignSourceToSubject(s1.id, a.id);
				m.assignSourceToSubject(s2.id, b.id);
				const got = m.sourceContextMarkerFor(a.id);
				m.updateSubjectRecord(b.id, { archived: true });
				console.log(JSON.stringify({ none: null, emptySubject: empty, marker: got.marker, archived: m.sourceContextMarkerFor(b.id), ghost: m.sourceContextMarkerFor("nope") }));`,
			);
			assert.deepEqual(r.emptySubject, { ok: true, marker: null }, "a subject without sources yields no marker");
			assert.deepEqual(r.archived, { ok: false, error: "subject_archived" });
			assert.deepEqual(r.ghost, { ok: false, error: "subject_not_found" });
			assert.equal(r.marker.customType, "source-context");
			assert.match(r.marker.content, /\[S1\.P2\] Alpha fact two\./);
			assert.ok(!r.marker.content.includes("Beta only fact"), "another subject's source never leaks in");
			assert.equal(r.marker.details.sources.length, 1);

			const llm = toLlmMessages([r.marker as never]);
			assert.equal(llm.length, 1);
			assert.equal(llm[0]?.role, "user");
			assert.match(JSON.stringify(llm[0]?.content), /Alpha fact one/);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("projects as a card (not a bubble) and its citation map links a cited label", () => {
		const details: SourceContextDetails = {
			subjectId: "s",
			subjectName: "Alpha",
			sources: [{ label: "S1", id: "id1", name: "alpha.md", revision: 1, passages: [{ label: "S1.P1", ref: "0.abc", preview: "x", truncated: false }], omitted: 0 }],
			omittedSources: 0,
			citations: { "S1.P1": { sourceId: "id1", ref: "0.abc" } },
		};
		const view = projectView([newSourceContextMessage("ctx", details)]);
		assert.equal(view.length, 1);
		assert.equal(view[0]?.role, "user");
		assert.equal(view[0]?.parts[0]?.type, "data-source-context");
		assert.equal((view[0]?.parts[0]?.data as SourceContextDetails).citations["S1.P1"]?.ref, "0.abc");
		assert.equal(linkCitations("per [S1.P1]", details.citations), "per [S1.P1](/sources?source=id1&ref=0.abc)");
	});
});
