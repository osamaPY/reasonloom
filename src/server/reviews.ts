/** Server-side review operations: derive attempts from practice sessions,
 * schedule, and record the learner's postpone / dispute events. */
import {
	POSTPONE_CHOICES,
	attemptsFromMessages,
	conceptKeysOf,
	disputedIds,
	postponeEvent,
	scheduleConcepts,
	splitQueue,
	type Attempt,
	type AttemptRow,
	type ReviewItem,
	type ReviewOverview,
	type ConceptReview,
} from "../core/reviews.ts";
import { stores } from "./stores.ts";
import { appendReviewEvent, readReviewEvents } from "../store/reviews.ts";
import { graphView } from "./graph.ts";

function collect(): { attempts: Attempt[]; titles: Map<string, string> } {
	const attempts: Attempt[] = [];
	const titles = new Map<string, string>();
	for (const summary of stores.chatStore.listChats()) {
		if (summary.kind !== "practice") continue;
		const record = stores.chatStore.getChat(summary.id);
		if (!record) continue;
		titles.set(summary.id, summary.title);
		attempts.push(...attemptsFromMessages(summary.id, record.messages));
	}
	return { attempts, titles };
}

export function reviewOverview(now: number = Date.now()): ReviewOverview {
	const { attempts, titles } = collect();
	const events = readReviewEvents();
	const names = new Map(graphView().propositions.map((n) => [n.id, n.name]));
	const label = (concept: string) =>
		concept.startsWith("topic:") ? `Topic: ${titles.get(concept.slice(6)) ?? "practice session"}` : (names.get(concept) ?? "Unknown concept (removed from the graph)");
	const item = (r: ConceptReview): ReviewItem => ({
		concept: r.concept,
		label: label(r.concept),
		reason: r.reason,
		due: r.due,
		postponed: r.postponed,
		box: r.box,
		lastChatId: r.usable[r.usable.length - 1]!.chatId,
	});
	const { due, upcoming } = splitQueue(scheduleConcepts(attempts, events, now), now);
	const disputed = disputedIds(events);
	const rows: AttemptRow[] = [...attempts]
		.sort((a, b) => b.at - a.at)
		.map((a) => ({
			...a,
			chatTitle: titles.get(a.chatId) ?? "Practice session",
			concepts: conceptKeysOf(a).map((c) => ({ concept: c, label: label(c) })),
			disputed: disputed.has(a.id),
		}));
	return { now, due: due.map(item), upcoming: upcoming.map(item), attempts: rows, postponeChoices: POSTPONE_CHOICES };
}

export type ReviewActionResult = { ok: true } | { ok: false; error: "not_found" | "invalid_days" };

/** Postpone a queued concept. Only concepts that have a schedule can be postponed. */
export function postponeConcept(concept: string, days: number, now: number = Date.now()): ReviewActionResult {
	const { attempts } = collect();
	const review = scheduleConcepts(attempts, readReviewEvents(), now).find((r) => r.concept === concept);
	if (!review) return { ok: false, error: "not_found" };
	const event = postponeEvent(review, days, now);
	if (!event) return { ok: false, error: "invalid_days" };
	appendReviewEvent(event);
	return { ok: true };
}

/** Flag (or unflag) an attempt's grading as wrong; flagged attempts stop counting. */
export function setAttemptDisputed(attemptId: string, disputed: boolean, now: number = Date.now()): ReviewActionResult {
	if (!collect().attempts.some((a) => a.id === attemptId)) return { ok: false, error: "not_found" };
	appendReviewEvent({ kind: disputed ? "dispute" : "undispute", attemptId, at: now });
	return { ok: true };
}
