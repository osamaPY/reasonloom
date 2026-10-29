"use client";

/**
 * Review page (fork, P05): what is due and why, what is coming, and the
 * attempt history behind it. Every queue item shows the evidence that put it
 * there. Attempts are derived from practice sessions; the only actions here
 * are postponing a concept and flagging an attempt's grading as wrong.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReviewOverview } from "@/src/core";

const OUTCOME_LABEL: Record<string, string> = {
	solved: "Solved",
	solvedWithHints: "Solved with hints",
	movedOn: "Moved on",
	surrendered: "Gave up",
	dismissed: "Dismissed",
};

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function ReviewView() {
	const [data, setData] = useState<ReviewOverview | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/reviews");
			setData((await res.json()) as ReviewOverview);
		} catch {
			setError("Could not load your review queue.");
		}
	}, []);
	useEffect(() => {
		void load();
	}, [load]);

	const post = async (url: string, body: unknown) => {
		setError(null);
		const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
		if (!res.ok) setError("That did not work — the item may no longer exist.");
		await load();
	};

	return (
		<div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-4 pb-16 pt-16">
			<h1 className="pb-1 font-ui text-lg">Review</h1>
			<p className="pb-4 font-ui text-xs text-muted-foreground">
				Concepts come back for review on a simple schedule based on your practice attempts: 1, 3, 7, 14, 30, then 60 days. Solving without hints moves a concept to a longer interval; hints, giving up or moving on do not. This is a scheduling rule, not a measure of what you know.
			</p>
			{error && (
				<p role="alert" className="mb-3 font-ui text-xs text-destructive">
					{error}
				</p>
			)}

			<h2 className="pb-2 font-ui text-sm">Due now{data ? ` (${data.due.length})` : ""}</h2>
			{data && data.due.length === 0 && (
				<p data-testid="review-empty" className="pb-4 font-ui text-xs text-muted-foreground">
					{data.attempts.length === 0 ? "Nothing to review yet. Finish a practice problem and it will appear here once it is due." : "Nothing is due. Upcoming reviews are listed below."}
				</p>
			)}
			<ul className="flex flex-col gap-2">
				{data?.due.map((r) => (
					<li key={r.concept} data-testid="review-due" className="rounded-xl border bg-card/85 p-3">
						<p className="font-ui text-sm">{r.label}</p>
						<p className="pb-2 font-ui text-xs text-muted-foreground">{r.reason}</p>
						<div className="flex flex-wrap items-center gap-2 font-ui text-xs">
							<Link href={`/chat/${r.lastChatId}`} className="rounded-md border px-2 py-1 hover:bg-accent">
								Open practice session
							</Link>
							<span className="text-muted-foreground">Postpone</span>
							{data.postponeChoices.map((d) => (
								<button key={d} type="button" onClick={() => void post("/api/reviews/postpone", { concept: r.concept, days: d })} className="rounded-md border px-2 py-1 hover:bg-accent">
									{d} {d === 1 ? "day" : "days"}
								</button>
							))}
						</div>
					</li>
				))}
			</ul>

			{data && data.upcoming.length > 0 && (
				<>
					<h2 className="pb-2 pt-6 font-ui text-sm">Coming up ({data.upcoming.length})</h2>
					<ul className="flex flex-col gap-1">
						{data.upcoming.map((r) => (
							<li key={r.concept} data-testid="review-upcoming" className="font-ui text-xs">
								<span className="text-foreground">{r.label}</span> <span className="text-muted-foreground">— {r.postponed ? "postponed to" : "due"} {day(r.due)}</span>
							</li>
						))}
					</ul>
				</>
			)}

			<h2 className="pb-2 pt-6 font-ui text-sm">Attempt history{data ? ` (${data.attempts.length})` : ""}</h2>
			{data && data.attempts.length === 0 && <p className="font-ui text-xs text-muted-foreground">No practice attempts recorded yet.</p>}
			<ul className="divide-y">
				{data?.attempts.map((a) => (
					<li key={a.id} data-testid="attempt-row" className={`py-2 ${a.disputed ? "opacity-60" : ""}`}>
						<div className="flex items-start gap-2">
							<div className="min-w-0 flex-1">
								<p className="font-ui text-xs">
									<span className="text-foreground">{OUTCOME_LABEL[a.outcome] ?? a.outcome}</span>
									<span className="text-muted-foreground">
										{" "}
										· {day(a.at)}
										{a.rung ? ` · hint ${a.rung}` : ""}
										{a.missClass ? ` · ${a.missClass}` : ""}
									</span>
									{a.disputed && <span className="text-destructive"> · grading disputed, not counted</span>}
									{a.outcome === "dismissed" && <span className="text-muted-foreground"> · not counted</span>}
								</p>
								{a.statement && <p className="line-clamp-2 font-sans text-sm">{a.statement}</p>}
								{a.verdict && <p className="font-ui text-xs text-muted-foreground">{a.verdict}</p>}
								<p className="font-ui text-xs text-muted-foreground">
									<Link href={`/chat/${a.chatId}`} className="hover:underline">
										{a.chatTitle}
									</Link>
									{" · "}
									{a.concepts.map((c) => c.label).join(", ")}
								</p>
							</div>
							{a.outcome !== "dismissed" && (
								<button type="button" onClick={() => void post("/api/reviews/dispute", { attemptId: a.id, disputed: !a.disputed })} className="shrink-0 rounded-md px-2 py-1 font-ui text-xs text-muted-foreground hover:bg-accent">
									{a.disputed ? "Count it again" : "Grading is wrong"}
								</button>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
