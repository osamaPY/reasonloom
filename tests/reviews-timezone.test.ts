/** Review days are the learner's local days (a fixed UTC offset passed in). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DAY_MS, postponeEvent, scheduleConcepts, startOfDay, type Attempt } from "../src/core/reviews.ts";

const HOUR = 3_600_000;
// 2026-10-02 03:00 UTC = 2026-10-01 20:00 in UTC-7, 2026-10-02 08:30 in UTC+5:30.
const T = Date.UTC(2026, 9, 2, 3, 0);

const attempt = (over: Partial<Attempt> = {}): Attempt => ({ id: "a", chatId: "c", at: T, outcome: "surrendered", rung: null, missClass: null, verdict: "", statement: "", targets: ["k"], ...over });

describe("startOfDay", () => {
	it("is UTC midnight at offset 0 and local midnight otherwise", () => {
		assert.equal(startOfDay(T), Date.UTC(2026, 9, 2));
		assert.equal(startOfDay(T, -7 * 60), Date.UTC(2026, 9, 1, 7)); // 00:00 on 1 Oct in UTC-7
		assert.equal(startOfDay(T, 5.5 * 60), Date.UTC(2026, 9, 1, 18, 30)); // 00:00 on 2 Oct in UTC+5:30
	});

	it("is idempotent and monotonic within a local day", () => {
		const a = startOfDay(T, -7 * 60);
		assert.equal(startOfDay(a, -7 * 60), a);
		assert.equal(startOfDay(a + 23 * HOUR, -7 * 60), a);
		assert.equal(startOfDay(a + 24 * HOUR, -7 * 60), a + DAY_MS);
	});
});

describe("explanations use the learner's calendar", () => {
	it("dates the last attempt in local time", () => {
		const utc = scheduleConcepts([attempt()], [], T + HOUR)[0]!.reason;
		const west = scheduleConcepts([attempt()], [], T + HOUR, -7 * 60)[0]!.reason;
		assert.match(utc, /Last attempt \(2026-10-02\)/);
		assert.match(west, /Last attempt \(2026-10-01\)/);
	});

	it("counts overdue days by local day boundaries", () => {
		// Due = T + 1 day = 3 Oct 03:00 UTC = 2 Oct 20:00 in UTC-7. Now = 4 Oct 02:00 UTC = 3 Oct 19:00 in UTC-7.
		const now = Date.UTC(2026, 9, 4, 2, 0);
		assert.match(scheduleConcepts([attempt()], [], now, 0)[0]!.reason, /1 day overdue/);
		assert.match(scheduleConcepts([attempt()], [], now, -7 * 60)[0]!.reason, /1 day overdue/);
		// Same instants, but UTC+10: due is 3 Oct 13:00 local, now 4 Oct 12:00 local -> still 1 day by calendar.
		assert.match(scheduleConcepts([attempt()], [], now, 10 * 60)[0]!.reason, /1 day overdue/);
		// And "due today" when the calendar day matches even though it is hours late.
		assert.match(scheduleConcepts([attempt()], [], Date.UTC(2026, 9, 3, 10, 0), 0)[0]!.reason, /due today/);
	});
});

describe("postponing in local time", () => {
	it("anchors on the local day, so pressing twice the same local day is idempotent", () => {
		const off = -7 * 60;
		const now = T + 3 * DAY_MS;
		const base = scheduleConcepts([attempt()], [], now, off)[0]!;
		const e1 = postponeEvent(base, 3, now, off)!;
		const e2 = postponeEvent(base, 3, now + 2 * HOUR, off)!;
		assert.equal(e1.until, e2.until);
		assert.equal(e1.until, startOfDay(now, off) + 3 * DAY_MS);
	});

	it("moves the date shown to the learner by the chosen number of local days", () => {
		const off = 10 * 60;
		const now = T + 3 * DAY_MS;
		const base = scheduleConcepts([attempt()], [], now, off)[0]!;
		const ev = postponeEvent(base, 7, now, off)!;
		const after = scheduleConcepts([attempt()], [ev], now, off)[0]!;
		assert.match(after.reason, /postponed to 2026-10-12/);
	});
});
