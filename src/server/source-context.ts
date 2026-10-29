/** Server side of the source context: read a subject's sources and build
 * the session marker (core/source-context.ts). */
import { buildSourceContext } from "../core/source-context.ts";
import { newSourceContextMessage, type LhMarkerMessage } from "../core/native-messages.ts";
import { readSourceIndex, readSourceText } from "../store/sources.ts";
import { readSubjects } from "../store/subjects.ts";
import type { LhMessage } from "../core/native-messages.ts";
import { stores } from "./stores.ts";
import { isTurnRunning } from "./turn-liveness.ts";
import { assignSessionToSubject } from "./subjects.ts";

export type SourceMarkerResult =
	| { ok: true; marker: LhMarkerMessage | null }
	| { ok: false; error: "subject_not_found" | "subject_archived" };

/** `marker` is null when the subject exists but has no readable sources —
 * the session is still created and assigned, just without grounding. */
export function sourceContextMarkerFor(subjectId: string, query?: string): SourceMarkerResult {
	const subject = readSubjects().subjects.find((s) => s.id === subjectId);
	if (!subject) return { ok: false, error: "subject_not_found" };
	if (subject.archived) return { ok: false, error: "subject_archived" };
	const sources = readSourceIndex()
		.filter((s) => s.subjectId === subjectId)
		.flatMap((meta) => {
			const text = readSourceText(meta.id);
			return text === null ? [] : [{ meta, text }];
		});
	const built = buildSourceContext({ id: subject.id, name: subject.name }, sources, undefined, query);
	return { ok: true, marker: built ? newSourceContextMessage(built.content, built.details) : null };
}

// ─── grounding an EXISTING session ───────────────────────────────────────────


export type GroundResult =
	| { ok: true; grounded: boolean; replaced: boolean }
	| { ok: false; error: "not_found" | "subject_not_found" | "subject_archived" | "turn_running" | "no_sources" };

const isSourceMarker = (m: LhMessage) => (m as { role?: string }).role === "custom" && (m as { customType?: string }).customType === "source-context";

/** The text of the learner's first message, used to rank passages. */
function firstUserText(messages: readonly LhMessage[], fallback: string): string {
	for (const m of messages) {
		if ((m as { role?: string }).role !== "user") continue;
		const c = (m as { content?: unknown }).content;
		if (typeof c === "string") return c;
		if (Array.isArray(c)) return c.map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : "")).join(" ");
	}
	return fallback;
}

/** Ground an existing session in a subject: assign it, and insert (or replace)
 * the source-context marker at the head of its record. Refused while a turn is
 * running (the record is being written) and when the subject has no sources.
 * Idempotent: running it again refreshes the marker from the current library. */
export function groundSessionInSubject(chatId: string, subjectId: string): GroundResult {
	const chat = stores.chatStore.getChat(chatId);
	if (!chat) return { ok: false, error: "not_found" };
	if (isTurnRunning(chatId)) return { ok: false, error: "turn_running" };
	const built = sourceContextMarkerFor(subjectId, firstUserText(chat.messages, chat.title));
	if (!built.ok) return built;
	if (!built.marker) return { ok: false, error: "no_sources" };
	const had = chat.messages.some(isSourceMarker);
	const rest = chat.messages.filter((m) => !isSourceMarker(m));
	stores.chatStore.saveMessages(chatId, [built.marker, ...rest]);
	assignSessionToSubject(chatId, subjectId);
	return { ok: true, grounded: true, replaced: had };
}

/** Ids of sessions whose record carries a source-context marker. */
export function groundedChatIds(): string[] {
	const out: string[] = [];
	for (const s of stores.chatStore.listChats()) {
		const rec = stores.chatStore.getChat(s.id);
		if (rec?.messages.slice(0, 4).some(isSourceMarker)) out.push(s.id);
	}
	return out;
}
