/** Source stats are re-derived from the stored text when the passage rules change. */
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

describe("refreshSourceStats", () => {
	it("corrects a stale passage count, persists it, and leaves correct sources alone", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-refresh-"));
		try {
			const text = ["Lead in:", "$$a+b$$", "and so on.", "Next paragraph."].join(String.fromCharCode(10, 10));
			const r = run<{ added: number; fixed: number; again: number; stored: number }>(
				dir,
				`const text = ${JSON.stringify(text)};
				const s = m.ingestSource({ name: "n.md", bytes: text.length, text });
				const fs = await import("node:fs");
				const file = ${JSON.stringify(path.join(dir, "sources", "index.json"))};
				const idx = JSON.parse(fs.readFileSync(file, "utf-8"));
				const added = idx[0].passages;
				idx[0].passages = 99; // as if written by an older version with different rules
				fs.writeFileSync(file, JSON.stringify(idx));
				const fixed = m.refreshSourceStats()[0].passages;
				const stored = JSON.parse(fs.readFileSync(file, "utf-8"))[0].passages;
				const again = m.refreshSourceStats()[0].passages;
				console.log(JSON.stringify({ added, fixed, again, stored }));`,
			);
			assert.equal(r.added, 2, "the display formula stays with its sentence: two passages, not four");
			assert.equal(r.fixed, 2);
			assert.equal(r.stored, 2, "the correction is written back");
			assert.equal(r.again, 2);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
