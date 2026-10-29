/**
 * Review events persistence (fork, P05): <data>/reviews.json, a flat list of
 * learner events (postpone / dispute / undispute). Attempts are NOT stored
 * here — they are folded from practice-session records on every read.
 * Atomic write (temp + rename); a corrupt file reads as empty.
 */

import fs from "node:fs";
import path from "node:path";
import { REVIEWS_FILE } from "../../config.ts";
import { sanitizeEvents, type ReviewEvent } from "../core/reviews.ts";

export function readReviewEvents(): ReviewEvent[] {
	try {
		return sanitizeEvents(JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf-8")));
	} catch {
		return [];
	}
}

export function appendReviewEvent(event: ReviewEvent): void {
	const events = [...readReviewEvents(), event];
	fs.mkdirSync(path.dirname(REVIEWS_FILE), { recursive: true });
	const tmp = `${REVIEWS_FILE}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(events, null, "\t"), "utf-8");
	fs.renameSync(tmp, REVIEWS_FILE);
}
