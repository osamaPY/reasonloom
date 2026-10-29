/** Server-side subject operations: the store plus ids and the clock. */
import { randomUUID } from "node:crypto";
import {
	assignSession as assignCore,
	createSubject as createCore,
	updateSubject as updateCore,
	type SubjectResult,
	type SubjectsRecord,
} from "../core/subjects.ts";
import { readSubjects, writeSubjects } from "../store/subjects.ts";

export { readSubjects };

function commit(result: SubjectResult<SubjectsRecord>): SubjectResult<SubjectsRecord> {
	if (result.ok) writeSubjects(result.value);
	return result;
}

export function createSubjectRecord(input: { name: string; goal?: string }) {
	return commit(createCore(readSubjects(), { id: randomUUID(), ...input }, new Date().toISOString()));
}

export function updateSubjectRecord(id: string, patch: { name?: string; goal?: string; archived?: boolean }) {
	return commit(updateCore(readSubjects(), id, patch, new Date().toISOString()));
}

export function assignSessionToSubject(chatId: string, subjectId: string | null) {
	return commit(assignCore(readSubjects(), chatId, subjectId));
}
