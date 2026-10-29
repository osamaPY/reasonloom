/** P03: subjects persistence under an isolated LH_DATA_DIR. config.ts reads
 * the env at module load, so each case runs in a fresh child process. */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const TSX = pathToFileURL(path.join(REPO_ROOT, "node_modules", "tsx", "dist", "loader.mjs")).href;

function run(dir: string, body: string): string {
	const store = pathToFileURL(path.join(REPO_ROOT, "src", "server", "subjects.ts")).href;
	const code = `const m = await import(${JSON.stringify(store)}); ${body}`;
	return execFileSync(process.execPath, ["--import", TSX, "--input-type=module", "--eval", code], {
		cwd: REPO_ROOT,
		encoding: "utf-8",
		env: { ...process.env, LH_DATA_DIR: dir },
	});
}

function tmp(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "lh-subjects-"));
}

describe("subjects store", () => {
	it("persists subjects and assignments across processes, leaving no temp file", () => {
		const dir = tmp();
		try {
			run(dir, `const r = m.createSubjectRecord({ name: "Linear algebra", goal: "eigenvectors" }); const id = r.value.subjects[0].id; m.assignSessionToSubject("chat-1", id);`);
			const out = run(dir, `console.log(JSON.stringify(m.readSubjects()));`);
			const rec = JSON.parse(out) as { subjects: { name: string }[]; assignments: Record<string, string> };
			assert.equal(rec.subjects[0]?.name, "Linear algebra");
			assert.deepEqual(Object.keys(rec.assignments), ["chat-1"]);
			assert.deepEqual(fs.readdirSync(dir), ["subjects.json"]);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("reads a corrupt file as empty and recovers on the next write", () => {
		const dir = tmp();
		try {
			fs.writeFileSync(path.join(dir, "subjects.json"), "{ not json", "utf-8");
			assert.equal(run(dir, `console.log(m.readSubjects().subjects.length);`).trim(), "0");
			run(dir, `m.createSubjectRecord({ name: "Fresh" });`);
			assert.equal(run(dir, `console.log(m.readSubjects().subjects.length);`).trim(), "1");
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("refuses to overwrite a file written by a newer schema version", () => {
		const dir = tmp();
		const file = path.join(dir, "subjects.json");
		const future = JSON.stringify({ version: 99, subjects: [], assignments: {}, extra: "keep" });
		try {
			fs.writeFileSync(file, future, "utf-8");
			assert.throws(() => run(dir, `m.createSubjectRecord({ name: "X" });`), /newer version/);
			assert.equal(fs.readFileSync(file, "utf-8"), future);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
