/**
 * Subjects (fork, P03): a named learning area with an optional goal that
 * groups sessions. Pure domain logic — no IO, no clock, no randomness
 * (callers pass `now` and ids), so every rule is unit-testable.
 *
 * Rules (BUILD_DECISIONS.md, P03):
 *  - A session belongs to at most ONE subject; ungrouped sessions stay valid.
 *  - Subjects are archived, never deleted — archiving is reversible and
 *    leaves the session assignments intact.
 *  - Assignments live in the subjects file, NOT in chat records, so the
 *    inherited chat schema is untouched and sessions stay readable by
 *    upstream-compatible code.
 */

export const SUBJECTS_VERSION = 1;
export const SUBJECT_NAME_MAX = 80;
export const SUBJECT_GOAL_MAX = 500;

export interface Subject {
	id: string;
	name: string;
	/** Free text: what the learner wants to be able to do. May be empty. */
	goal: string;
	archived: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface SubjectsRecord {
	version: number;
	subjects: Subject[];
	/** chatId → subjectId. Absent = ungrouped. */
	assignments: Record<string, string>;
}

export function emptySubjects(): SubjectsRecord {
	return { version: SUBJECTS_VERSION, subjects: [], assignments: {} };
}

export type SubjectError = "name_required" | "name_too_long" | "goal_too_long" | "duplicate_name" | "not_found" | "subject_archived";

export type SubjectResult<T> = { ok: true; value: T } | { ok: false; error: SubjectError };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Everything off disk passes through here: malformed rows are dropped,
 * never repaired into something the learner did not write. Unknown
 * (newer) versions keep their shape and extra fields are discarded only
 * on the next write by this code — the store refuses to overwrite a file
 * whose version is newer than this one. */
export function sanitizeSubjects(raw: unknown): SubjectsRecord {
	if (!isRecord(raw)) return emptySubjects();
	const subjects: Subject[] = [];
	const seen = new Set<string>();
	if (Array.isArray(raw.subjects)) {
		for (const s of raw.subjects) {
			if (!isRecord(s)) continue;
			if (typeof s.id !== "string" || s.id === "" || seen.has(s.id)) continue;
			if (typeof s.name !== "string" || s.name.trim() === "") continue;
			const createdAt = typeof s.createdAt === "string" ? s.createdAt : "";
			seen.add(s.id);
			subjects.push({
				id: s.id,
				name: s.name.trim().slice(0, SUBJECT_NAME_MAX),
				goal: typeof s.goal === "string" ? s.goal.slice(0, SUBJECT_GOAL_MAX) : "",
				archived: s.archived === true,
				createdAt,
				updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : createdAt,
			});
		}
	}
	const assignments: Record<string, string> = {};
	if (isRecord(raw.assignments)) {
		for (const [chatId, subjectId] of Object.entries(raw.assignments)) {
			if (typeof subjectId === "string" && seen.has(subjectId)) assignments[chatId] = subjectId;
		}
	}
	return {
		version: typeof raw.version === "number" ? raw.version : SUBJECTS_VERSION,
		subjects,
		assignments,
	};
}

const nameKey = (name: string) => name.trim().toLowerCase();

function checkFields(
	record: SubjectsRecord,
	fields: { name?: string; goal?: string },
	selfId?: string,
): SubjectError | null {
	if (fields.name !== undefined) {
		const name = fields.name.trim();
		if (name === "") return "name_required";
		if (name.length > SUBJECT_NAME_MAX) return "name_too_long";
		// Duplicate names are refused among active AND archived subjects, so
		// un-archiving can never create a hidden collision.
		if (record.subjects.some((s) => s.id !== selfId && nameKey(s.name) === nameKey(name))) return "duplicate_name";
	}
	if (fields.goal !== undefined && fields.goal.length > SUBJECT_GOAL_MAX) return "goal_too_long";
	return null;
}

export function createSubject(
	record: SubjectsRecord,
	input: { id: string; name: string; goal?: string },
	now: string,
): SubjectResult<SubjectsRecord> {
	const error = checkFields(record, { name: input.name, goal: input.goal ?? "" });
	if (error) return { ok: false, error };
	const subject: Subject = {
		id: input.id,
		name: input.name.trim(),
		goal: input.goal ?? "",
		archived: false,
		createdAt: now,
		updatedAt: now,
	};
	return { ok: true, value: { ...record, subjects: [...record.subjects, subject] } };
}

export function updateSubject(
	record: SubjectsRecord,
	id: string,
	patch: { name?: string; goal?: string; archived?: boolean },
	now: string,
): SubjectResult<SubjectsRecord> {
	const existing = record.subjects.find((s) => s.id === id);
	if (!existing) return { ok: false, error: "not_found" };
	const error = checkFields(record, { name: patch.name, goal: patch.goal }, id);
	if (error) return { ok: false, error };
	const next: Subject = {
		...existing,
		name: patch.name !== undefined ? patch.name.trim() : existing.name,
		goal: patch.goal ?? existing.goal,
		archived: patch.archived ?? existing.archived,
		updatedAt: now,
	};
	return { ok: true, value: { ...record, subjects: record.subjects.map((s) => (s.id === id ? next : s)) } };
}

/** Assign a session to a subject, or ungroup it with `subjectId = null`.
 * Assigning to an archived subject is refused (un-archive first). */
export function assignSession(record: SubjectsRecord, chatId: string, subjectId: string | null): SubjectResult<SubjectsRecord> {
	if (subjectId === null) {
		if (!(chatId in record.assignments)) return { ok: true, value: record };
		const assignments = { ...record.assignments };
		delete assignments[chatId];
		return { ok: true, value: { ...record, assignments } };
	}
	const subject = record.subjects.find((s) => s.id === subjectId);
	if (!subject) return { ok: false, error: "not_found" };
	if (subject.archived) return { ok: false, error: "subject_archived" };
	return { ok: true, value: { ...record, assignments: { ...record.assignments, [chatId]: subjectId } } };
}

/** Group chat ids by subject. `knownChatIds` filters out assignments whose
 * session no longer exists (deleted sessions never resurrect in a count);
 * ids not assigned anywhere come back as `ungrouped`, preserving order. */
export function groupSessions(
	record: SubjectsRecord,
	knownChatIds: readonly string[],
): { bySubject: Record<string, string[]>; ungrouped: string[] } {
	const bySubject: Record<string, string[]> = {};
	for (const s of record.subjects) bySubject[s.id] = [];
	const ungrouped: string[] = [];
	for (const chatId of knownChatIds) {
		const subjectId = record.assignments[chatId];
		if (subjectId && bySubject[subjectId]) bySubject[subjectId].push(chatId);
		else ungrouped.push(chatId);
	}
	return { bySubject, ungrouped };
}
