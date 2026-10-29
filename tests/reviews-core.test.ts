import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LhMessage } from "../src/core/native-messages.ts";
import {
	DAY_MS,
	attemptsFromMessages,
	disputedIds,
	postponeEvent,
	sanitizeEvents,
	scheduleConcepts,
	splitQueue,
	startOfUtcDay,
	type Attempt,
	type ReviewEvent,
} from "../src/core/reviews.ts";

const D0 = Date.UTC(2026, 9, 1, 15, 30); // 1 Oct 2026 15:30 UTC

const call = (id: string, name: string, args: Record<string, unknown>) => ({ type: "toolCall", id, name, arguments: args });
const assistant = (timestamp: number, ...content: unknown[]) => ({ role: "assistant", content, timestamp }) as unknown as LhMessage;
const result = (toolCallId: string, isError = false) => ({ role: "toolResult", toolCallId, isError, content: [], timestamp: 0 }) as unknown as LhMessage;

function practiceRecord(): LhMessage[] {
	return [
		assistant(D0, call("p1", "problem", { statement: "Find the eigenvalues", mode: "recall", target: ["node-a", "node-a", "node-b"], modelSolution: "x" })),
		result("p1"),
		assistant(D0 + 1000, call("c1", "conclude", { outcome: "solvedWithHints", verdict: "Needed a nudge", rung: "R2", missClass: "execution", retest: true })),
		result("c1"),
		assistant(D0 + 2000, call("p2", "problem", { statement: "Untagged one", mode: "recall", modelSolution: "y" })),
		result("p2"),
		assistant(D0 + 3000, call("c2", "conclude", { outcome: "solved", verdict: "Good", rung: null, missClass: null, retest: false })),
		result("c2"),
	];
}

const attempt = (over: Partial<Attempt> & { id: string; outcome: Attempt["outcome"] }): Attempt => ({
	chatId: "chat",
	at: D0,
	rung: null,
	missClass: null,
	verdict: "",
	statement: "",
	targets: ["k"],
	...over,
});

describe("attemptsFromMessages", () => {
	it("folds clean problem+conclude pairs, deduping targets and keeping untagged ones empty", () => {
		const a = attemptsFromMessages("chat1", practiceRecord());
		assert.equal(a.length, 2);
		assert.deepEqual(a[0], {
			id: "c1",
			chatId: "chat1",
			at: D0 + 1000,
			outcome: "solvedWithHints",
			rung: "R2",
			missClass: "execution",
			verdict: "Needed a nudge",
			statement: "Find the eigenvalues",
			targets: ["node-a", "node-b"],
		});
		assert.deepEqual(a[1]?.targets, [], "untagged problem carries no stale targets from the previous pose");
	});

	it("is idempotent: reading the same record twice yields identical ids", () => {
		const ids = (x: Attempt[]) => x.map((v) => v.id);
		assert.deepEqual(ids(attemptsFromMessages("c", practiceRecord())), ids(attemptsFromMessages("c", practiceRecord())));
	});

	it("ignores conclude calls whose result errored or never arrived", () => {
		const msgs = [
			assistant(D0, call("p1", "problem", { statement: "s", mode: "recall", modelSolution: "m" })),
			result("p1"),
			assistant(D0 + 1, call("c1", "conclude", { outcome: "solved", verdict: "v", rung: null, missClass: null, retest: false })),
			result("c1", true),
			assistant(D0 + 2, call("c2", "conclude", { outcome: "solved", verdict: "v", rung: null, missClass: null, retest: false })),
		];
		assert.deepEqual(attemptsFromMessages("c", msgs), []);
	});

	it("skips unknown outcomes and tolerates junk content", () => {
		const msgs = [
			assistant(D0, call("p1", "problem", { statement: "s", mode: "recall", modelSolution: "m" })),
			result("p1"),
			assistant(D0 + 1, call("c1", "conclude", { outcome: "bogus" })),
			result("c1"),
			{ role: "user", content: "hi" } as unknown as LhMessage,
		];
		assert.deepEqual(attemptsFromMessages("c", msgs), []);
	});

	it("keeps dismissed attempts as records", () => {
		const msgs = [assistant(D0, call("c9", "conclude", { outcome: "dismissed" })), result("c9")];
		assert.equal(attemptsFromMessages("c", msgs)[0]?.outcome, "dismissed");
	});
});

describe("scheduleConcepts — the Leitner policy", () => {
	const one = (attempts: Attempt[], events: ReviewEvent[] = [], now = D0 + 100 * DAY_MS) => scheduleConcepts(attempts, events, now)[0];

	it("walks the boxes: solved advances, hints hold, moved on drops, surrendered resets", () => {
		const seq = (...o: Attempt["outcome"][]) => one(o.map((outcome, i) => attempt({ id: `a${i}`, outcome, at: D0 + i * 1000 })));
		assert.equal(seq("solved")?.box, 1);
		assert.equal(seq("solved", "solved", "solved")?.box, 3);
		assert.equal(seq("solved", "solvedWithHints")?.box, 1);
		assert.equal(seq("solved", "solved", "movedOn")?.box, 1);
		assert.equal(seq("movedOn")?.box, 0);
		assert.equal(seq("solved", "solved", "surrendered")?.box, 0);
	});

	it("sets due by box interval from the latest usable attempt", () => {
		assert.equal(one([attempt({ id: "a", outcome: "surrendered" })])?.due, D0 + 1 * DAY_MS);
		assert.equal(one([attempt({ id: "a", outcome: "solved" })])?.due, D0 + 3 * DAY_MS);
		const six = Array.from({ length: 8 }, (_, i) => attempt({ id: `s${i}`, outcome: "solved", at: D0 + i }));
		assert.equal(one(six)?.box, 8);
		assert.equal(one(six)?.due, D0 + 7 + 60 * DAY_MS, "interval caps at 60 days");
	});

	it("never queues a concept without usable attempts (unassessed)", () => {
		assert.deepEqual(scheduleConcepts([attempt({ id: "a", outcome: "dismissed" })], [], D0), []);
		assert.deepEqual(scheduleConcepts([], [], D0), []);
	});

	it("orders attempts by time regardless of input order", () => {
		const a = attempt({ id: "a", outcome: "solved", at: D0 });
		const b = attempt({ id: "b", outcome: "surrendered", at: D0 + 5 });
		assert.equal(one([b, a])?.box, 0);
		assert.equal(one([a, b])?.box, 0);
	});

	it("excludes disputed attempts and restores them on undispute", () => {
		const a = attempt({ id: "a", outcome: "solved", at: D0 });
		const b = attempt({ id: "b", outcome: "surrendered", at: D0 + 5 });
		const dispute: ReviewEvent = { kind: "dispute", attemptId: "b", at: D0 + 10 };
		assert.equal(one([a, b], [dispute])?.box, 1);
		assert.equal(one([a, b], [dispute, { kind: "undispute", attemptId: "b", at: D0 + 20 }])?.box, 0);
		assert.deepEqual([...disputedIds([dispute])], ["b"]);
		assert.equal(scheduleConcepts([b], [dispute], D0).length, 0, "all attempts disputed = unassessed");
	});

	it("groups multi-target attempts under each concept and untagged ones by session", () => {
		const r = scheduleConcepts(
			[attempt({ id: "a", outcome: "solved", targets: ["x", "y"] }), attempt({ id: "b", outcome: "solved", targets: [], chatId: "c7" })],
			[],
			D0,
		);
		assert.deepEqual(r.map((c) => c.concept).sort(), ["topic:c7", "x", "y"]);
	});

	it("splits due from upcoming exactly at the boundary", () => {
		const r = scheduleConcepts([attempt({ id: "a", outcome: "surrendered" })], [], D0);
		const dueAt = D0 + DAY_MS;
		assert.equal(splitQueue(r, dueAt - 1).due.length, 0);
		assert.equal(splitQueue(r, dueAt).due.length, 1);
		assert.equal(splitQueue(r, dueAt + 1).due.length, 1);
	});
});

describe("explanations", () => {
	it("states the evidence: last outcome, hint level, attempts, box and lateness", () => {
		const a = attempt({ id: "a", outcome: "solvedWithHints", rung: "R2", at: D0 });
		const r = scheduleConcepts([a], [], D0 + 6 * DAY_MS)[0]!;
		assert.match(r.reason, /Last attempt \(2026-10-01\): solved with hints \(hint level R2\)/);
		assert.match(r.reason, /1 usable attempt, box 0/);
		assert.match(r.reason, /due 2026-10-02, 5 days overdue/);
	});

	it("says due today and upcoming dates", () => {
		const a = attempt({ id: "a", outcome: "surrendered", at: D0 });
		assert.match(scheduleConcepts([a], [], D0 + DAY_MS + 1000)[0]!.reason, /due today/);
		assert.match(scheduleConcepts([a], [], D0)[0]!.reason, /due 2026-10-02\.$/);
	});
});

describe("postponement", () => {
	const a = attempt({ id: "a", outcome: "surrendered", at: D0 });
	const now = D0 + 3 * DAY_MS + 5000; // overdue

	it("holds an overdue concept later and the reason says so", () => {
		const base = scheduleConcepts([a], [], now)[0]!;
		const ev = postponeEvent(base, 3, now)!;
		const after = scheduleConcepts([a], [ev], now)[0]!;
		assert.equal(after.postponed, true);
		assert.equal(after.due, startOfUtcDay(now) + 3 * DAY_MS);
		assert.ok(splitQueue([after], now).due.length === 0);
		assert.match(after.reason, /postponed to/);
	});

	it("is idempotent within a day: pressing it twice does not drift", () => {
		const base = scheduleConcepts([a], [], now)[0]!;
		const e1 = postponeEvent(base, 3, now)!;
		const afterFirst = scheduleConcepts([a], [e1], now + 1000)[0]!;
		const e2 = postponeEvent(afterFirst, 3, now + 60_000)!;
		assert.equal(e2.until, e1.until);
	});

	it("never pulls a due date earlier than policy", () => {
		const base = scheduleConcepts([a], [], D0)[0]!; // due in 1 day
		const ev = postponeEvent(base, 1, D0)!;
		assert.ok(scheduleConcepts([a], [ev], D0)[0]!.due >= base.scheduledDue);
	});

	it("is cleared by a newer attempt", () => {
		const base = scheduleConcepts([a], [], now)[0]!;
		const ev = postponeEvent(base, 7, now)!;
		const newer = attempt({ id: "b", outcome: "solved", at: now + 1000 });
		const after = scheduleConcepts([a, newer], [ev], now + 2000)[0]!;
		assert.equal(after.postponed, false);
		assert.equal(after.due, now + 1000 + 3 * DAY_MS);
	});

	it("only accepts the offered choices", () => {
		const base = scheduleConcepts([a], [], now)[0]!;
		assert.equal(postponeEvent(base, 2, now), null);
		assert.equal(postponeEvent(base, -1, now), null);
	});
});

describe("sanitizeEvents", () => {
	it("keeps valid events and drops junk", () => {
		const ok = { kind: "postpone", concept: "c", until: 5, at: 1 };
		const out = sanitizeEvents([ok, { kind: "postpone", concept: "", until: 5, at: 1 }, { kind: "dispute", attemptId: "a", at: 2 }, { kind: "x" }, null, { kind: "dispute", attemptId: "a", at: "no" }]);
		assert.deepEqual(out, [ok, { kind: "dispute", attemptId: "a", at: 2 }]);
		assert.deepEqual(sanitizeEvents("nope"), []);
	});
});
