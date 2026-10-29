/**
 * Practice evidence and review (fork, P05). Pure: no IO, clock or ids —
 * `now` is always passed in so every rule is testable.
 *
 * DESIGN (BUILD_DECISIONS.md, P05)
 *  - Attempts are a DERIVED read model, folded from practice-session
 *    records (a clean `problem` call followed by a clean `conclude` call).
 *    Nothing new is written when a learner practises, so a restart or a
 *    repeated read can never double-count: an attempt's id is its conclude
 *    tool-call id. Attempts live apart from the knowledge graph.
 *  - The only stored learner data is a small event list: postpones and
 *    grading disputes (see ReviewEvent).
 *  - Scheduling is a per-concept Leitner box. One policy, written below,
 *    and every queue item carries a plain-language reason.
 *
 * THE POLICY (counted over a concept's usable attempts, oldest first)
 *    box starts at 0, then per attempt:
 *      solved            -> box + 1
 *      solvedWithHints   -> box unchanged
 *      movedOn           -> box - 1 (not below 0)
 *      surrendered       -> box = 0
 *      dismissed         -> ignored (no evidence either way)
 *    Disputed attempts are ignored as well.
 *    Interval after the latest usable attempt, by box:
 *      0: 1 day, 1: 3, 2: 7, 3: 14, 4: 30, 5+: 60
 *    due = latest usable attempt time + interval. A concept with no usable
 *    attempt is unassessed and never queued. A postponement holds the due
 *    date later until the learner attempts the concept again.
 *    This is a scheduling convention, NOT evidence that it improves
 *    retention.
 *
 * Days are UTC days (a documented limit: no per-learner time zone yet).
 */

import type { AssistantMessage, ToolResultMessage } from "@earendil-works/pi-ai";
import { PRACTICE_CONCLUDE_TOOL, PRACTICE_PROBLEM_TOOL, type LhMessage } from "./native-messages.ts";

export const DAY_MS = 86_400_000;
export const BOX_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;
export const POSTPONE_CHOICES = [1, 3, 7] as const;

export type AttemptOutcome = "solved" | "solvedWithHints" | "movedOn" | "surrendered" | "dismissed";
const OUTCOMES: readonly AttemptOutcome[] = ["solved", "solvedWithHints", "movedOn", "surrendered", "dismissed"];

export interface Attempt {
	/** The conclude tool-call id: stable across reads and restarts. */
	id: string;
	chatId: string;
	/** Epoch ms of the concluding assistant message. */
	at: number;
	outcome: AttemptOutcome;
	rung: string | null;
	missClass: string | null;
	verdict: string;
	statement: string;
	/** Proposition ids the problem exercised; empty = an untagged topic problem. */
	targets: string[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Fold one practice session's messages into its attempts. A call counts
 * only through its clean result (the same "honest activation" law the
 * practice gates use): errored or dangling calls never happened. */
export function attemptsFromMessages(chatId: string, messages: readonly LhMessage[]): Attempt[] {
	const clean = new Set<string>();
	for (const m of messages) {
		if ((m as { role?: string }).role !== "toolResult") continue;
		const r = m as ToolResultMessage;
		if (!r.isError) clean.add(r.toolCallId);
	}
	const attempts: Attempt[] = [];
	let lastProblem: Record<string, unknown> | null = null;
	for (const m of messages) {
		if ((m as { role?: string }).role !== "assistant") continue;
		const a = m as AssistantMessage;
		for (const block of a.content) {
			if (block.type !== "toolCall" || !clean.has(block.id)) continue;
			const args = (block.arguments ?? {}) as Record<string, unknown>;
			if (block.name === PRACTICE_PROBLEM_TOOL) {
				lastProblem = args;
				continue;
			}
			if (block.name !== PRACTICE_CONCLUDE_TOOL) continue;
			const outcome = OUTCOMES.find((o) => o === args.outcome);
			if (!outcome) continue;
			const target = Array.isArray(lastProblem?.target) ? (lastProblem.target as unknown[]).filter((t): t is string => typeof t === "string" && t !== "") : [];
			attempts.push({
				id: block.id,
				chatId,
				at: typeof a.timestamp === "number" ? a.timestamp : 0,
				outcome,
				rung: typeof args.rung === "string" ? args.rung : null,
				missClass: typeof args.missClass === "string" ? args.missClass : null,
				verdict: str(args.verdict),
				statement: str(lastProblem?.statement),
				targets: [...new Set(target)],
			});
			lastProblem = null;
		}
	}
	return attempts;
}

/** A concept is a proposition id, or — for untagged problems — the session. */
export const conceptKeysOf = (a: Attempt): string[] => (a.targets.length > 0 ? a.targets : [`topic:${a.chatId}`]);

// ─── learner events (the only stored data) ───────────────────────────────────

export type ReviewEvent =
	| { kind: "postpone"; concept: string; until: number; at: number }
	| { kind: "dispute"; attemptId: string; at: number }
	| { kind: "undispute"; attemptId: string; at: number };

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function sanitizeEvents(raw: unknown): ReviewEvent[] {
	if (!Array.isArray(raw)) return [];
	const out: ReviewEvent[] = [];
	for (const e of raw as Record<string, unknown>[]) {
		if (!e || typeof e !== "object" || !isFiniteNumber(e.at)) continue;
		if (e.kind === "postpone" && typeof e.concept === "string" && e.concept !== "" && isFiniteNumber(e.until)) {
			out.push({ kind: "postpone", concept: e.concept, until: e.until, at: e.at });
		} else if ((e.kind === "dispute" || e.kind === "undispute") && typeof e.attemptId === "string" && e.attemptId !== "") {
			out.push({ kind: e.kind, attemptId: e.attemptId, at: e.at });
		}
	}
	return out;
}

/** Attempt ids currently disputed: the newest dispute/undispute event wins. */
export function disputedIds(events: readonly ReviewEvent[]): Set<string> {
	const state = new Map<string, boolean>();
	for (const e of [...events].sort((x, y) => x.at - y.at)) {
		if (e.kind === "dispute") state.set(e.attemptId, true);
		else if (e.kind === "undispute") state.set(e.attemptId, false);
	}
	return new Set([...state].filter(([, v]) => v).map(([k]) => k));
}

// ─── the review overview served to the UI ──────────────────────────────────

export interface ReviewItem {
	concept: string;
	label: string;
	reason: string;
	due: number;
	postponed: boolean;
	box: number;
	/** Chat the most recent usable attempt came from — where to practise again. */
	lastChatId: string;
}

export interface AttemptRow extends Attempt {
	chatTitle: string;
	concepts: { concept: string; label: string }[];
	disputed: boolean;
}

export interface ReviewOverview {
	now: number;
	due: ReviewItem[];
	upcoming: ReviewItem[];
	attempts: AttemptRow[];
	postponeChoices: readonly number[];
}

// ─── scheduling ──────────────────────────────────────────────────────────────

export interface ConceptReview {
	concept: string;
	/** Usable attempts, oldest first (dismissed and disputed excluded). */
	usable: Attempt[];
	box: number;
	lastAt: number;
	/** Policy due date, before any postponement. */
	scheduledDue: number;
	/** What the queue sorts and compares on (scheduledDue or a later postponement). */
	due: number;
	postponed: boolean;
	reason: string;
}

export const startOfUtcDay = (ms: number): number => Math.floor(ms / DAY_MS) * DAY_MS;

export function intervalDays(box: number): number {
	return BOX_INTERVAL_DAYS[Math.min(box, BOX_INTERVAL_DAYS.length - 1)]!;
}

function advance(box: number, outcome: AttemptOutcome): number {
	switch (outcome) {
		case "solved":
			return box + 1;
		case "solvedWithHints":
			return box;
		case "movedOn":
			return Math.max(0, box - 1);
		case "surrendered":
			return 0;
		default:
			return box;
	}
}

const OUTCOME_TEXT: Record<AttemptOutcome, string> = {
	solved: "solved without hints",
	solvedWithHints: "solved with hints",
	movedOn: "moved on without finishing",
	surrendered: "given up",
	dismissed: "dismissed",
};

const fmtDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function explain(r: Omit<ConceptReview, "reason">, now: number): string {
	const last = r.usable[r.usable.length - 1]!;
	const parts = [`Last attempt (${fmtDay(last.at)}): ${OUTCOME_TEXT[last.outcome]}`];
	if (last.outcome === "solvedWithHints" && last.rung) parts[0] += ` (hint level ${last.rung})`;
	parts.push(`${r.usable.length} usable ${r.usable.length === 1 ? "attempt" : "attempts"}, box ${r.box}`);
	if (r.postponed) parts.push(`postponed to ${fmtDay(r.due)}`);
	else if (r.due <= now) {
		const late = Math.floor((startOfUtcDay(now) - startOfUtcDay(r.due)) / DAY_MS);
		parts.push(late > 0 ? `due ${fmtDay(r.due)}, ${late} ${late === 1 ? "day" : "days"} overdue` : "due today");
	} else parts.push(`due ${fmtDay(r.due)}`);
	return parts.join("; ") + ".";
}

/** Per-concept review state from the attempts and the learner's events.
 * Concepts with no usable attempt are omitted (unassessed). */
export function scheduleConcepts(attempts: readonly Attempt[], events: readonly ReviewEvent[], now: number): ConceptReview[] {
	const disputed = disputedIds(events);
	const byConcept = new Map<string, Attempt[]>();
	for (const a of [...attempts].sort((x, y) => x.at - y.at || x.id.localeCompare(y.id))) {
		if (a.outcome === "dismissed" || disputed.has(a.id)) continue;
		for (const key of conceptKeysOf(a)) byConcept.set(key, [...(byConcept.get(key) ?? []), a]);
	}
	const out: ConceptReview[] = [];
	for (const [concept, usable] of byConcept) {
		let box = 0;
		for (const a of usable) box = advance(box, a.outcome);
		const lastAt = usable[usable.length - 1]!.at;
		const scheduledDue = lastAt + intervalDays(box) * DAY_MS;
		// A postponement only counts while no attempt came after it.
		const hold = events
			.filter((e): e is Extract<ReviewEvent, { kind: "postpone" }> => e.kind === "postpone" && e.concept === concept && e.at >= lastAt)
			.reduce((m, e) => Math.max(m, e.until), 0);
		const due = Math.max(scheduledDue, hold);
		const base = { concept, usable, box, lastAt, scheduledDue, due, postponed: hold > scheduledDue };
		out.push({ ...base, reason: explain(base, now) });
	}
	return out.sort((a, b) => a.due - b.due || a.concept.localeCompare(b.concept));
}

export function splitQueue(reviews: readonly ConceptReview[], now: number): { due: ConceptReview[]; upcoming: ConceptReview[] } {
	return { due: reviews.filter((r) => r.due <= now), upcoming: reviews.filter((r) => r.due > now) };
}

/** Postpone by 1, 3 or 7 days. The new date is anchored on the later of the
 * concept's current due date and today, snapped to a UTC day, so pressing it
 * twice the same day yields the same date instead of drifting further. */
export function postponeEvent(review: ConceptReview, days: number, now: number): Extract<ReviewEvent, { kind: "postpone" }> | null {
	if (!(POSTPONE_CHOICES as readonly number[]).includes(days)) return null;
	const anchor = startOfUtcDay(Math.max(review.scheduledDue, now));
	return { kind: "postpone", concept: review.concept, until: anchor + days * DAY_MS, at: now };
}
