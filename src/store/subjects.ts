/**
 * Subjects persistence (fork, P03): data/subjects.json under the
 * LH_DATA_DIR seam. Read-modify-write of one small record; the write is
 * atomic (temp file + rename) so a crash never leaves a half-written file.
 *
 * A corrupt file reads as empty WITHOUT being overwritten until the next
 * successful mutation; a file written by a NEWER schema version is never
 * overwritten (the write throws) so an old build cannot destroy it.
 */

import fs from "node:fs";
import path from "node:path";
import { SUBJECTS_FILE } from "../../config.ts";
import { SUBJECTS_VERSION, emptySubjects, sanitizeSubjects, type SubjectsRecord } from "../core/subjects.ts";

export function readSubjects(): SubjectsRecord {
	let raw: string;
	try {
		raw = fs.readFileSync(SUBJECTS_FILE, "utf-8");
	} catch {
		return emptySubjects();
	}
	try {
		return sanitizeSubjects(JSON.parse(raw));
	} catch {
		return emptySubjects();
	}
}

export class SubjectsVersionError extends Error {
	constructor(found: number) {
		super(`subjects.json was written by a newer version (${found}); refusing to overwrite`);
	}
}

export function writeSubjects(record: SubjectsRecord): void {
	const existing = readSubjects();
	if (existing.version > SUBJECTS_VERSION) throw new SubjectsVersionError(existing.version);
	fs.mkdirSync(path.dirname(SUBJECTS_FILE), { recursive: true });
	const tmp = `${SUBJECTS_FILE}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify({ ...record, version: SUBJECTS_VERSION }, null, "\t"), "utf-8");
	fs.renameSync(tmp, SUBJECTS_FILE);
}
