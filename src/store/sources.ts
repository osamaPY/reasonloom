/**
 * Source library persistence (fork, P04): <data>/sources/index.json holds
 * the metadata, <data>/sources/<id>.txt the normalised text. Each file is
 * written atomically (temp + rename). The text is written BEFORE the index
 * entry, so a crash can leave an unreferenced text file (swept by nothing,
 * harmless) but never an index entry without text; a missing text file for
 * an indexed id reads as absent rather than throwing.
 */

import fs from "node:fs";
import path from "node:path";
import { SOURCES_DIR } from "../../config.ts";
import type { SourceMeta } from "../core/sources.ts";

const INDEX_FILE = () => path.join(SOURCES_DIR, "index.json");
const TEXT_FILE = (id: string) => {
	// ids are minted by randomUUID; refuse anything else so an id can never
	// escape the sources directory.
	if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("invalid source id");
	return path.join(SOURCES_DIR, `${id}.txt`);
};

function atomicWrite(file: string, data: string): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, data, "utf-8");
	fs.renameSync(tmp, file);
}

const isString = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function readSourceIndex(): SourceMeta[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(fs.readFileSync(INDEX_FILE(), "utf-8"));
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	const out: SourceMeta[] = [];
	const seen = new Set<string>();
	for (const r of parsed as Record<string, unknown>[]) {
		if (!r || typeof r !== "object") continue;
		if (!isString(r.id) || !/^[0-9a-f-]{36}$/.test(r.id) || seen.has(r.id) || !isString(r.name) || !isString(r.sha256)) continue;
		seen.add(r.id);
		out.push({
			id: r.id,
			name: r.name,
			sha256: r.sha256,
			bytes: isNum(r.bytes) ? r.bytes : 0,
			chars: isNum(r.chars) ? r.chars : 0,
			passages: isNum(r.passages) ? r.passages : 0,
			revision: isNum(r.revision) ? r.revision : 1,
			subjectId: isString(r.subjectId) ? r.subjectId : null,
			addedAt: isString(r.addedAt) ? r.addedAt : "",
			updatedAt: isString(r.updatedAt) ? r.updatedAt : "",
		});
	}
	return out;
}

export function writeSourceIndex(index: readonly SourceMeta[]): void {
	atomicWrite(INDEX_FILE(), JSON.stringify(index, null, "\t"));
}

export function readSourceText(id: string): string | null {
	try {
		return fs.readFileSync(TEXT_FILE(id), "utf-8");
	} catch {
		return null;
	}
}

export function writeSourceText(id: string, text: string): void {
	atomicWrite(TEXT_FILE(id), text);
}

export function deleteSourceText(id: string): void {
	fs.rmSync(TEXT_FILE(id), { force: true });
}
