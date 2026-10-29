/** Grounding an EXISTING session: assign + insert/replace the source marker
 * at the head of its record, without losing or reordering anything else. */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const TSX = pathToFileURL(path.join(REPO_ROOT, "node_modules", "tsx", "dist", "loader.mjs")).href;
const serverUrl = JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src", "server", "index.ts")).href);

function run<T>(dir: string, body: string): T {
	const code = `const m = await import(${serverUrl}); ${body}`;
	const out = execFileSync(process.execPath, ["--import", TSX, "--input-type=module", "--eval", code], { cwd: REPO_ROOT, encoding: "utf-8", env: { ...process.env, LH_DATA_DIR: dir } });
	return JSON.parse(out.trim().split("\n").pop()!) as T;
}

describe("groundSessionInSubject", () => {
	it("inserts the marker first, keeps the transcript intact, assigns the subject, and refresh replaces rather than duplicates", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-ground-"));
		try {
			const r = run<{
				first: unknown;
				kinds: string[];
				texts: string[];
				assigned: boolean;
				grounded: string[];
				again: unknown;
				kindsAfter: string[];
				noSources: unknown;
				archived: unknown;
				missing: unknown;
			}>(
				dir,
				`const sub = m.createSubjectRecord({ name: "Maths" }).value.subjects[0];
				const src = m.ingestSource({ name: "n.md", bytes: 40, text: "An eigenvector keeps its direction." });
				m.assignSourceToSubject(src.id, sub.id);
				const empty = m.createSubjectRecord({ name: "Empty" }).value.subjects[1];
				const chat = m.createChat("Eigenvectors please");
				m.stores.chatStore.saveMessages(chat.id, [
					{ id: "u1", role: "user", content: [{ type: "text", text: "What is an eigenvector?" }], timestamp: 1 },
					{ id: "a1", role: "assistant", content: [{ type: "text", text: "A vector that keeps its direction." }], timestamp: 2, api: "faux", provider: "x", model: "x", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "stop" },
				]);
				const first = m.groundSessionInSubject(chat.id, sub.id);
				const rec = m.getChat(chat.id);
				const kinds = rec.messages.map((x) => x.role === "custom" ? x.customType : x.role);
				const texts = rec.messages.filter((x) => x.role !== "custom").map((x) => JSON.stringify(x.content));
				const assigned = m.readSubjects().assignments[chat.id] === sub.id;
				const grounded = m.groundedChatIds();
				const again = m.groundSessionInSubject(chat.id, sub.id);
				const kindsAfter = m.getChat(chat.id).messages.map((x) => x.role === "custom" ? x.customType : x.role);
				const noSources = m.groundSessionInSubject(chat.id, empty.id);
				m.updateSubjectRecord(sub.id, { archived: true });
				const archived = m.groundSessionInSubject(chat.id, sub.id);
				const missing = m.groundSessionInSubject("nope", sub.id);
				console.log(JSON.stringify({ first, kinds, texts, assigned, grounded, again, kindsAfter, noSources, archived, missing }));`,
			);
			assert.deepEqual(r.first, { ok: true, grounded: true, replaced: false });
			assert.deepEqual(r.kinds, ["source-context", "user", "assistant"]);
			assert.equal(r.texts.length, 2, "the learner's message and the reply are untouched");
			assert.match(r.texts[0] ?? "", /What is an eigenvector/);
			assert.equal(r.assigned, true);
			assert.equal(r.grounded.length, 1);
			assert.deepEqual(r.again, { ok: true, grounded: true, replaced: true });
			assert.deepEqual(r.kindsAfter, ["source-context", "user", "assistant"], "a refresh replaces the marker, never stacks a second");
			assert.deepEqual(r.noSources, { ok: false, error: "no_sources" });
			assert.deepEqual(r.archived, { ok: false, error: "subject_archived" });
			assert.deepEqual(r.missing, { ok: false, error: "not_found" });
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
