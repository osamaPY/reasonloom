/** P05: review overview over real practice-session records, under an
 * isolated LH_DATA_DIR (fresh child process; config.ts reads env at load). */
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

function run(dir: string, body: string): unknown {
	const code = `const m = await import(${serverUrl}); ${body}`;
	const out = execFileSync(process.execPath, ["--import", TSX, "--input-type=module", "--eval", code], {
		cwd: REPO_ROOT,
		encoding: "utf-8",
		env: { ...process.env, LH_DATA_DIR: dir },
	});
	return JSON.parse(out.trim().split("\n").pop()!);
}

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 12, 0);

/** Seeds one practice session: a tagged problem solved with hints, then an untagged one surrendered. */
const SEED = `
const T0 = ${T0};
const call = (id, name, args) => ({ type: "toolCall", id, name, arguments: args });
const asst = (timestamp, ...content) => ({ id: "m" + timestamp, role: "assistant", content, timestamp });
const res = (toolCallId) => ({ role: "toolResult", toolCallId, toolName: "x", isError: false, content: [{ type: "text", text: "ok" }], timestamp: 0 });
const chat = m.createChat("Eigen drills", "practice");
m.stores.chatStore.saveMessages(chat.id, [
  asst(T0, call("p1", "problem", { statement: "S1", mode: "recall", target: ["ghost-node"], modelSolution: "x" })), res("p1"),
  asst(T0 + 1, call("c1", "conclude", { outcome: "solvedWithHints", verdict: "ok", rung: "R1", missClass: null, retest: false })), res("c1"),
  asst(T0 + 2, call("p2", "problem", { statement: "S2", mode: "recall", modelSolution: "y" })), res("p2"),
  asst(T0 + 3, call("c2", "conclude", { outcome: "surrendered", verdict: "gave up", rung: "R4", missClass: "structural", retest: true })), res("c2"),
]);
`;

function withDir(fn: (dir: string) => void) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-reviews-"));
	try {
		fn(dir);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

type Overview = {
	due: { concept: string; label: string; reason: string; postponed: boolean; box: number }[];
	upcoming: { concept: string }[];
	attempts: { id: string; disputed: boolean; outcome: string }[];
};

describe("review overview (derived from practice records)", () => {
	it("derives attempts, queues due concepts with reasons, and is stable across processes", () => {
		withDir((dir) => {
			const first = run(dir, `${SEED} console.log(JSON.stringify(m.reviewOverview(${T0 + 5 * DAY})));`) as Overview;
			assert.deepEqual(first.attempts.map((a) => a.id).sort(), ["c1", "c2"]);
			assert.equal(first.due.length, 2);
			const ghost = first.due.find((d) => d.concept === "ghost-node");
			assert.match(ghost?.label ?? "", /Unknown concept/, "a target missing from the graph is labelled, not dropped");
			assert.match(ghost?.reason ?? "", /solved with hints \(hint level R1\)/);
			const topic = first.due.find((d) => d.concept.startsWith("topic:"));
			assert.match(topic?.label ?? "", /Topic: Eigen drills/);
			// A second process reads the same records: same attempts, no duplicates.
			const second = run(dir, `console.log(JSON.stringify(m.reviewOverview(${T0 + 5 * DAY})));`) as Overview;
			assert.deepEqual(second.attempts.map((a) => a.id).sort(), ["c1", "c2"]);
			assert.equal(second.due.length, 2);
		});
	});

	it("moves a concept to upcoming before its due date", () => {
		withDir((dir) => {
			const ov = run(dir, `${SEED} console.log(JSON.stringify(m.reviewOverview(${T0 + 60_000})));`) as Overview;
			assert.equal(ov.due.length, 0);
			assert.equal(ov.upcoming.length, 2);
		});
	});

	it("postpones idempotently, persists it, and a dispute removes the concept's evidence", () => {
		withDir((dir) => {
			const now = T0 + 5 * DAY;
			const out = run(
				dir,
				`${SEED}
				const a = m.postponeConcept("ghost-node", 3, ${now});
				const b = m.postponeConcept("ghost-node", 3, ${now + 60_000});
				const bad = m.postponeConcept("ghost-node", 2, ${now});
				const none = m.postponeConcept("nope", 3, ${now});
				console.log(JSON.stringify({ a, b, bad, none, ov: m.reviewOverview(${now + 1000}) }));`,
			) as { a: unknown; b: unknown; bad: unknown; none: unknown; ov: Overview };
			assert.deepEqual(out.a, { ok: true });
			assert.deepEqual(out.b, { ok: true });
			assert.deepEqual(out.bad, { ok: false, error: "invalid_days" });
			assert.deepEqual(out.none, { ok: false, error: "not_found" });
			assert.equal(out.ov.due.some((d) => d.concept === "ghost-node"), false, "postponed concept leaves the due list");
			const held = out.ov.upcoming.find((u) => u.concept === "ghost-node");
			assert.ok(held, "and appears as upcoming");
			// restart: the postponement is still in force and only one distinct date was stored
			const events = JSON.parse(fs.readFileSync(path.join(dir, "reviews.json"), "utf-8")) as { until: number }[];
			assert.equal(new Set(events.map((e) => e.until)).size, 1);
			const after = run(dir, `console.log(JSON.stringify(m.reviewOverview(${now + 1000})));`) as Overview;
			assert.equal(after.due.some((d) => d.concept === "ghost-node"), false);

			const disputed = run(
				dir,
				`console.log(JSON.stringify({ r: m.setAttemptDisputed("c1", true, ${now + 2000}), missing: m.setAttemptDisputed("zzz", true), ov: m.reviewOverview(${now + 3000}) }));`,
			) as { r: unknown; missing: unknown; ov: Overview };
			assert.deepEqual(disputed.r, { ok: true });
			assert.deepEqual(disputed.missing, { ok: false, error: "not_found" });
			assert.equal(disputed.ov.attempts.find((a) => a.id === "c1")?.disputed, true);
			assert.equal([...disputed.ov.due, ...disputed.ov.upcoming].some((d) => d.concept === "ghost-node"), false, "the only attempt on that concept was disputed");
		});
	});

	it("ignores teaching sessions entirely", () => {
		withDir((dir) => {
			const ov = run(dir, `m.createChat("Just teaching"); console.log(JSON.stringify(m.reviewOverview(${T0})));`) as Overview;
			assert.deepEqual([ov.due, ov.upcoming, ov.attempts], [[], [], []]);
		});
	});
});
