import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assignSession,
	createSubject,
	emptySubjects,
	groupSessions,
	sanitizeSubjects,
	updateSubject,
	SUBJECT_GOAL_MAX,
	SUBJECT_NAME_MAX,
	type SubjectsRecord,
} from "../src/core/subjects.ts";

const T0 = "2026-10-29T10:00:00.000Z";
const T1 = "2026-10-29T11:00:00.000Z";

function withSubject(name = "Linear algebra"): SubjectsRecord {
	const r = createSubject(emptySubjects(), { id: "s1", name, goal: "Understand eigenvectors" }, T0);
	assert.ok(r.ok);
	return r.value;
}

describe("subjects core", () => {
	it("creates a trimmed subject and refuses empty, long and duplicate names", () => {
		const rec = withSubject("  Linear algebra ");
		assert.equal(rec.subjects[0]?.name, "Linear algebra");
		assert.equal(rec.subjects[0]?.createdAt, T0);
		const empty = createSubject(rec, { id: "x", name: "   " }, T0);
		assert.deepEqual(empty, { ok: false, error: "name_required" });
		const long = createSubject(rec, { id: "x", name: "a".repeat(SUBJECT_NAME_MAX + 1) }, T0);
		assert.deepEqual(long, { ok: false, error: "name_too_long" });
		const dup = createSubject(rec, { id: "x", name: "LINEAR ALGEBRA" }, T0);
		assert.deepEqual(dup, { ok: false, error: "duplicate_name" });
		const goal = createSubject(rec, { id: "x", name: "Other", goal: "g".repeat(SUBJECT_GOAL_MAX + 1) }, T0);
		assert.deepEqual(goal, { ok: false, error: "goal_too_long" });
	});

	it("does not mutate its input", () => {
		const rec = withSubject();
		const snapshot = JSON.stringify(rec);
		updateSubject(rec, "s1", { name: "Renamed" }, T1);
		assignSession(rec, "chat1", "s1");
		assert.equal(JSON.stringify(rec), snapshot);
	});

	it("renames, edits the goal and archives; a rename to its own name is allowed", () => {
		let rec = withSubject();
		const same = updateSubject(rec, "s1", { name: "linear algebra" }, T1);
		assert.ok(same.ok);
		const r = updateSubject(rec, "s1", { name: "Matrices", goal: "", archived: true }, T1);
		assert.ok(r.ok);
		rec = r.value;
		assert.equal(rec.subjects[0]?.name, "Matrices");
		assert.equal(rec.subjects[0]?.goal, "");
		assert.equal(rec.subjects[0]?.archived, true);
		assert.equal(rec.subjects[0]?.updatedAt, T1);
		assert.equal(rec.subjects[0]?.createdAt, T0);
		assert.deepEqual(updateSubject(rec, "nope", { name: "x" }, T1), { ok: false, error: "not_found" });
	});

	it("blocks renaming onto another subject, archived ones included", () => {
		let rec = withSubject();
		const second = createSubject(rec, { id: "s2", name: "Calculus" }, T0);
		assert.ok(second.ok);
		rec = second.value;
		const arch = updateSubject(rec, "s2", { archived: true }, T1);
		assert.ok(arch.ok);
		assert.deepEqual(updateSubject(arch.value, "s1", { name: "calculus" }, T1), { ok: false, error: "duplicate_name" });
	});

	it("assigns one subject per session, moves it, and ungroups with null", () => {
		let rec = withSubject();
		const second = createSubject(rec, { id: "s2", name: "Calculus" }, T0);
		assert.ok(second.ok);
		rec = second.value;
		const a = assignSession(rec, "c1", "s1");
		assert.ok(a.ok);
		const moved = assignSession(a.value, "c1", "s2");
		assert.ok(moved.ok);
		assert.deepEqual(moved.value.assignments, { c1: "s2" });
		const un = assignSession(moved.value, "c1", null);
		assert.ok(un.ok);
		assert.deepEqual(un.value.assignments, {});
		assert.deepEqual(assignSession(rec, "c1", "ghost"), { ok: false, error: "not_found" });
	});

	it("refuses to assign to an archived subject but keeps existing assignments", () => {
		const a = assignSession(withSubject(), "c1", "s1");
		assert.ok(a.ok);
		const arch = updateSubject(a.value, "s1", { archived: true }, T1);
		assert.ok(arch.ok);
		assert.deepEqual(arch.value.assignments, { c1: "s1" });
		assert.deepEqual(assignSession(arch.value, "c2", "s1"), { ok: false, error: "subject_archived" });
	});

	it("groups sessions, ignores deleted chats, and lists the rest as ungrouped in order", () => {
		let rec = withSubject();
		for (const c of ["c1", "gone"]) {
			const a = assignSession(rec, c, "s1");
			assert.ok(a.ok);
			rec = a.value;
		}
		const g = groupSessions(rec, ["c0", "c1", "c2"]);
		assert.deepEqual(g.bySubject, { s1: ["c1"] });
		assert.deepEqual(g.ungrouped, ["c0", "c2"]);
	});

	it("sanitizes junk off disk: bad rows dropped, orphan assignments dropped, never throws", () => {
		for (const junk of [null, 5, "x", [], {}]) assert.deepEqual(sanitizeSubjects(junk), emptySubjects());
		const rec = sanitizeSubjects({
			version: 1,
			subjects: [
				{ id: "a", name: " Good ", goal: 3, archived: "yes" },
				{ id: "a", name: "Dup id" },
				{ id: "", name: "No id" },
				{ id: "b", name: "  " },
				"str",
			],
			assignments: { c1: "a", c2: "missing", c3: 7 },
		});
		assert.equal(rec.subjects.length, 1);
		assert.equal(rec.subjects[0]?.name, "Good");
		assert.equal(rec.subjects[0]?.goal, "");
		assert.equal(rec.subjects[0]?.archived, false);
		assert.deepEqual(rec.assignments, { c1: "a" });
	});
});
