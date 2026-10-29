/**
 * Sample workspace (fork, P06): a clearly labelled demonstration so the
 * Subjects -> Sources -> Practice -> Review path can be explored without
 * configuring a provider. EVERYTHING here is synthetic: the source text is
 * written for this purpose, and the practice record is a scripted stand-in
 * (titled "[Sample]") — no model produced or graded it. It is created only
 * on request, never overwrites anything, and is idempotent.
 *
 * Removal: archive the subject, delete the source on /sources, delete the
 * session in the sidebar. Nothing is hidden or auto-deleted.
 */
import { DAY_MS } from "../core/reviews.ts";
import { createHash, randomUUID } from "node:crypto";
import { normalizeText, splitPassages } from "../core/sources.ts";
import { readSourceIndex, writeSourceIndex, writeSourceText } from "../store/sources.ts";
import type { LhMessage } from "../core/native-messages.ts";
import { createChat } from "./chats.ts";
import { stores } from "./stores.ts";
import { assignSessionToSubject, createSubjectRecord, readSubjects } from "./subjects.ts";

export const SAMPLE_SUBJECT = "Sample: Eigenvalues";
export const SAMPLE_SOURCE_NAME = "sample-eigenvalues.md";
export const SAMPLE_CHAT_TITLE = "[Sample] Eigenvalue drills";

export const SAMPLE_SOURCE_TEXT = `# Eigenvalues (sample source)

This file is sample data written for the demo workspace. It is not a textbook and may be simplified.

An eigenvector of a square matrix A is a nonzero vector v such that Av = λv for some number λ. The number λ is the eigenvalue belonging to v.

To find eigenvalues, solve det(A − λI) = 0. This is the characteristic equation. For a 2×2 matrix it is a quadratic in λ.

For a diagonal matrix the eigenvalues are the entries on the diagonal. For example, the matrix with 2 and 3 on the diagonal has eigenvalues 2 and 3.

Common mistake: forgetting that an eigenvector must be nonzero. The zero vector satisfies Av = λv for every λ, so it carries no information.
`;

const STAMPS = {
	api: "faux",
	provider: "synthetic",
	model: "sample-data",
	usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
	stopReason: "toolUse",
} as const;

type Call = { id: string; name: string; args: Record<string, unknown> };

function pair(at: number, call: Call): LhMessage[] {
	return [
		{
			id: `sample_a_${call.id}`,
			role: "assistant",
			content: [{ type: "toolCall", id: call.id, name: call.name, arguments: call.args }],
			timestamp: at,
			...STAMPS,
		} as unknown as LhMessage,
		{
			id: `sample_r_${call.id}`,
			role: "toolResult",
			toolCallId: call.id,
			toolName: call.name,
			content: [{ type: "text", text: "ok" }],
			isError: false,
			timestamp: at,
		} as unknown as LhMessage,
	];
}

/** The scripted practice record: one problem solved with a hint, one solved
 * cleanly, both dated in the past so the review queue has something due. */
export function sampleMessages(now: number): LhMessage[] {
	const t = now - 8 * DAY_MS;
	return [
		...pair(t, {
			id: "sample_p1",
			name: "problem",
			args: { statement: "(Sample data) Find the eigenvalues of the matrix with 2 and 3 on its diagonal and zeros elsewhere.", mode: "recall", modelSolution: "The eigenvalues are 2 and 3." },
		}),
		...pair(t + 60_000, {
			id: "sample_c1",
			name: "conclude",
			args: { outcome: "solvedWithHints", verdict: "(Sample data) Needed a nudge that diagonal entries are the eigenvalues.", rung: "R2", missClass: "cue", retest: true },
		}),
		...pair(t + 120_000, {
			id: "sample_p2",
			name: "problem",
			args: { statement: "(Sample data) Why must an eigenvector be nonzero?", mode: "discrimination", modelSolution: "The zero vector satisfies Av = λv for every λ." },
		}),
		...pair(t + 180_000, {
			id: "sample_c2",
			name: "conclude",
			args: { outcome: "solved", verdict: "(Sample data) Correct: the zero vector fits every λ, so it says nothing.", rung: null, missClass: null, retest: false },
		}),
	];
}

export interface SampleResult {
	created: boolean;
	subjectId: string;
}

export function createSampleWorkspace(now: number = Date.now()): SampleResult {
	const existing = readSubjects().subjects.find((s) => s.name.toLowerCase() === SAMPLE_SUBJECT.toLowerCase());
	if (existing) return { created: false, subjectId: existing.id };

	const made = createSubjectRecord({
		name: SAMPLE_SUBJECT,
		goal: "Demonstration data so you can explore the app without a provider. Replace it with your own subject when you are ready.",
	});
	if (!made.ok) throw new Error(`sample subject: ${made.error}`);
	const subject = made.value.subjects[made.value.subjects.length - 1]!;

	// Demo data owns a separate copy: normal ingestion updates matching names
	// and deduplicates content, either of which can mutate a learner's source.
	const index = readSourceIndex();
	let name = SAMPLE_SOURCE_NAME;
	for (let n = 2; index.some((s) => s.name.toLowerCase() === name.toLowerCase()); n++) {
		name = `sample-eigenvalues-${n}.md`;
	}
	const id = randomUUID();
	const text = normalizeText(SAMPLE_SOURCE_TEXT);
	const at = new Date(now).toISOString();
	writeSourceText(id, text);
	writeSourceIndex([...index, {
		id, name, sha256: createHash("sha256").update(text).digest("hex"),
		bytes: Buffer.byteLength(text), chars: text.length, passages: splitPassages(text).length,
		revision: 1, subjectId: subject.id, addedAt: at, updatedAt: at,
	}]);

	const chat = createChat(SAMPLE_CHAT_TITLE, "practice");
	stores.chatStore.saveMessages(chat.id, sampleMessages(now));
	assignSessionToSubject(chat.id, subject.id);
	return { created: true, subjectId: subject.id };
}
