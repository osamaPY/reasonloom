/** P04: source library persistence under an isolated LH_DATA_DIR (fresh
 * child process per case; config.ts reads the env at module load). */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const TSX = pathToFileURL(path.join(REPO_ROOT, "node_modules", "tsx", "dist", "loader.mjs")).href;
const url = (rel: string) => JSON.stringify(pathToFileURL(path.join(REPO_ROOT, rel)).href);

function run(dir: string, body: string): string {
	const code = `const m = await import(${url("src/server/sources.ts")}); const subj = await import(${url("src/server/subjects.ts")}); ${body}`;
	return execFileSync(process.execPath, ["--import", TSX, "--input-type=module", "--eval", code], {
		cwd: REPO_ROOT,
		encoding: "utf-8",
		env: { ...process.env, LH_DATA_DIR: dir },
	});
}

function withDir(fn: (dir: string) => void) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-sources-"));
	try {
		fn(dir);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

describe("source library store", () => {
	it("adds, reports duplicates and updates, and persists across processes", () => {
		withDir((dir) => {
			const files = {
				first: { name: "C:\\x\\notes.md", text: "# One\r\n\r\nalpha" },
				copy: { name: "copy.md", text: "# One\n\nalpha" },
				changed: { name: "NOTES.md", text: "# One\n\nalpha changed" },
				bad: { name: "a.pdf", text: "x" },
			};
			const out = run(
				dir,
				`const files = ${JSON.stringify(files)};
				const f = (x) => ({ name: x.name, bytes: Buffer.byteLength(x.text), text: x.text });
				const a = m.ingestSource(f(files.first));
				const dup = m.ingestSource(f(files.copy));
				const upd = m.ingestSource(f(files.changed));
				const bad = m.ingestSource(f(files.bad));
				console.log(JSON.stringify({ a, dup, upd, bad }));`,
			);
			const r = JSON.parse(out);
			assert.equal(r.a.status, "added");
			assert.equal(r.a.name, "notes.md");
			assert.deepEqual([r.dup.status, r.dup.id], ["duplicate", r.a.id], "CRLF/LF variant of the same text is a duplicate");
			assert.deepEqual([r.upd.status, r.upd.id], ["updated", r.a.id]);
			assert.deepEqual(r.bad, { name: "a.pdf", status: "rejected", reason: "unsupported_type" });

			const after = JSON.parse(run(dir, `const i = m.readSourceIndex(); console.log(JSON.stringify({ i, t: m.readSourceText(i[0].id) }));`));
			assert.equal(after.i.length, 1);
			assert.equal(after.i[0].revision, 2);
			assert.equal(after.i[0].passages, 2);
			assert.equal(after.t, "# One\n\nalpha changed", "stored text is normalised");
			assert.deepEqual(fs.readdirSync(path.join(dir, "sources")).sort(), ["index.json", `${r.a.id}.txt`].sort(), "no temp files left");
		});
	});

	it("assigns to a live subject, refuses archived or unknown ones, and removes cleanly", () => {
		withDir((dir) => {
			const out = run(
				dir,
				`const s = m.ingestSource({ name: "n.txt", bytes: 3, text: "abc" });
				const sub = subj.createSubjectRecord({ name: "Math" }).value.subjects[0].id;
				const ok = m.assignSourceToSubject(s.id, sub);
				subj.updateSubjectRecord(sub, { archived: true });
				const arch = m.assignSourceToSubject(s.id, sub);
				const none = m.assignSourceToSubject(s.id, "ghost");
				const missing = m.assignSourceToSubject("00000000-0000-0000-0000-000000000000", null);
				const kept = m.readSourceIndex()[0].subjectId === sub;
				const removed = m.removeSource(s.id);
				const again = m.removeSource(s.id);
				console.log(JSON.stringify({ ok: ok.ok, arch, none, missing, kept, removed, again, left: m.readSourceIndex().length, text: m.readSourceText(s.id) }));`,
			);
			const r = JSON.parse(out);
			assert.equal(r.ok, true);
			assert.deepEqual(r.arch, { ok: false, error: "subject_archived" });
			assert.deepEqual(r.none, { ok: false, error: "subject_not_found" });
			assert.deepEqual(r.missing, { ok: false, error: "not_found" });
			assert.equal(r.kept, true, "a failed assignment leaves the previous one intact");
			assert.equal(r.removed, true);
			assert.equal(r.again, false);
			assert.equal(r.left, 0);
			assert.equal(r.text, null);
		});
	});

	it("treats a corrupt index as empty and never reads outside the sources dir", () => {
		withDir((dir) => {
			fs.mkdirSync(path.join(dir, "sources"));
			fs.writeFileSync(path.join(dir, "sources", "index.json"), "{ nope", "utf-8");
			const out = run(dir, `let threw = false; try { m.readSourceText("../../etc/passwd"); } catch { threw = true; } console.log(JSON.stringify({ n: m.readSourceIndex().length, threw: threw || m.readSourceText("../../x") === null }));`);
			const r = JSON.parse(out);
			assert.equal(r.n, 0);
			assert.equal(r.threw, true);
		});
	});
});
