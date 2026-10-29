/** P06: the whole learning path, end to end at the server layer, under an
 * isolated LH_DATA_DIR and across separate processes (= restarts):
 * subject -> source -> practice record -> review queue -> postpone.
 * No model is involved; practice records are the scripted sample. */
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
	const out = execFileSync(process.execPath, ["--import", TSX, "--input-type=module", "--eval", code], {
		cwd: REPO_ROOT,
		encoding: "utf-8",
		env: { ...process.env, LH_DATA_DIR: dir },
	});
	return JSON.parse(out.trim().split("\n").pop()!) as T;
}

describe("end-to-end journey (server layer)", () => {
	it("sample workspace links subject, source, session and a due review; survives restarts; is idempotent", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-e2e-"));
		try {
			const first = run<{ created: boolean; subjectId: string }>(dir, `console.log(JSON.stringify(m.createSampleWorkspace()));`);
			assert.equal(first.created, true);

			// New process = restart: everything is read back from disk.
			const state = run<{
				subject: { name: string; goal: string };
				sources: { name: string; subjectId: string | null }[];
				sessions: string[];
				chats: { title: string; kind: string }[];
				overview: { due: { reason: string; label: string; lastChatId: string }[]; attempts: { outcome: string; concepts: unknown[] }[] };
			}>(
				dir,
				`const subj = m.readSubjects();
				const sub = subj.subjects[0];
				const chats = m.listChats();
				console.log(JSON.stringify({
					subject: sub,
					sources: m.readSourceIndex(),
					sessions: Object.keys(subj.assignments),
					chats,
					overview: m.reviewOverview(),
				}));`,
			);
			assert.equal(state.subject.name, "Sample: Eigenvalues");
			assert.match(state.subject.goal, /Demonstration data/);
			assert.equal(state.sources.length, 1);
			assert.equal(state.sources[0]?.subjectId, first.subjectId);
			assert.equal(state.chats.length, 1);
			assert.equal(state.chats[0]?.kind, "practice");
			assert.match(state.chats[0]?.title ?? "", /^\[Sample\]/);
			assert.equal(state.sessions.length, 1);
			assert.deepEqual(state.overview.attempts.map((a) => a.outcome).sort(), ["solved", "solvedWithHints"]);
			assert.equal(state.overview.due.length, 1, "the dated sample attempts leave one review due");
			assert.match(state.overview.due[0]?.reason ?? "", /Last attempt \(.*\): solved without hints; 2 usable attempts, box 1/);
			assert.match(state.overview.due[0]?.label ?? "", /Topic: \[Sample\] Eigenvalue drills/);

			// Passage references resolve against the stored sample source.
			const passages = run<{ n: number; ref: string; status: string }>(
				dir,
				`const s = m.readSourceIndex()[0];
				const core = await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src", "core", "sources.ts")).href)});
				const ps = core.splitPassages(m.readSourceText(s.id));
				console.log(JSON.stringify({ n: ps.length, ref: ps[2].ref, status: core.resolvePassage(ps, ps[2].ref).status }));`,
			);
			assert.ok(passages.n >= 5);
			assert.equal(passages.status, "exact");

			// Second creation is a no-op: still exactly one of each.
			const again = run<{ created: boolean; chats: number; sources: number; subjects: number }>(
				dir,
				`const r = m.createSampleWorkspace(); console.log(JSON.stringify({ created: r.created, chats: m.listChats().length, sources: m.readSourceIndex().length, subjects: m.readSubjects().subjects.length }));`,
			);
			assert.deepEqual(again, { created: false, chats: 1, sources: 1, subjects: 1 });

			// Review action survives another restart.
			const concept = state.overview.due[0] ? run<{ c: string }>(dir, `console.log(JSON.stringify({ c: m.reviewOverview().due[0].concept }));`).c : "";
			const postponed = run<{ ok: boolean; due: number; upcoming: number }>(
				dir,
				`const r = m.postponeConcept(${JSON.stringify(concept)}, 3); const o = m.reviewOverview(); console.log(JSON.stringify({ ok: r.ok, due: o.due.length, upcoming: o.upcoming.length }));`,
			);
			assert.deepEqual(postponed, { ok: true, due: 0, upcoming: 1 });
			const afterRestart = run<{ due: number; upcoming: number }>(dir, `const o = m.reviewOverview(); console.log(JSON.stringify({ due: o.due.length, upcoming: o.upcoming.length }));`);
			assert.deepEqual(afterRestart, { due: 0, upcoming: 1 });
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("a learner's own subject and source coexist with the sample and archive keeps sessions", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-e2e-"));
		try {
			const out = run<{ moved: boolean; archived: boolean; kept: number; refused: unknown }>(
				dir,
				`m.createSampleWorkspace();
				const mine = m.createSubjectRecord({ name: "Calculus" }).value.subjects.find(s => s.name === "Calculus");
				const src = m.ingestSource({ name: "limits.md", bytes: 10, text: "# Limits\\n\\nA limit describes behaviour near a point." });
				const moved = m.assignSourceToSubject(src.id, mine.id).ok;
				const chatId = m.listChats()[0].id;
				const sampleId = m.readSubjects().subjects[0].id;
				const archived = m.updateSubjectRecord(sampleId, { archived: true }).ok;
				const kept = Object.keys(m.readSubjects().assignments).filter(k => k === chatId).length;
				const refused = m.assignSessionToSubject(chatId, sampleId);
				console.log(JSON.stringify({ moved, archived, kept, refused }));`,
			);
			assert.equal(out.moved, true);
			assert.equal(out.archived, true);
			assert.equal(out.kept, 1, "archiving a subject keeps its session assignment");
			assert.deepEqual(out.refused, { ok: false, error: "subject_archived" });
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
