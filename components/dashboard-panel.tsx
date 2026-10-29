/**
 * P02 (fork): the home dashboard body — a Continue card and, on an empty
 * workspace, a three-step start guide. Pure (props in, markup out) so the
 * render suite pins it statically. It reports only what the chat list
 * already records; review queues and subjects arrive with P03/P05 and are
 * deliberately not faked here.
 */
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import type { ChatSummary } from "@/src/core";

/** The session to resume: sessions waiting on the learner first (an
 * unanswered question or a posed problem), then the most recently updated.
 * Ties and unparseable dates fall back to list order. */
export function pickResumeSession(chats: readonly ChatSummary[]): ChatSummary | null {
	const time = (c: ChatSummary) => {
		const t = Date.parse(c.updatedAt);
		return Number.isNaN(t) ? 0 : t;
	};
	const waiting = (c: ChatSummary) => c.pendingQuestion || c.pendingProblem;
	let best: ChatSummary | null = null;
	for (const c of chats) {
		if (!best) {
			best = c;
			continue;
		}
		if (waiting(c) !== waiting(best)) {
			if (waiting(c)) best = c;
			continue;
		}
		if (time(c) > time(best)) best = c;
	}
	return best;
}

function waitingLabel(chat: ChatSummary): string {
	if (chat.pendingProblem) return "Problem waiting";
	if (chat.pendingQuestion) return "Question waiting";
	return chat.kind === "practice" ? "Practice session" : "Teaching session";
}

const START_STEPS = [
	"Import notes or describe what you want to learn below.",
	"Learn it in a teaching session; the knowledge graph builds as you go.",
	"Switch to practice mode to test what you have learned.",
] as const;

export function DashboardPanel({ chats }: { chats: readonly ChatSummary[] }) {
	const resume = pickResumeSession(chats);
	return (
		<section data-testid="dashboard-panel" aria-label="Dashboard" className="flex w-full max-w-md flex-col gap-3 px-4">
			{resume ? (
				<Link
					href={`/chat/${resume.id}`}
					data-testid="dashboard-resume"
					className="group flex items-center gap-3 rounded-xl border bg-card/85 px-4 py-3 shadow-lg backdrop-blur transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					<span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
						<span className="font-ui text-xs text-muted-foreground">Continue where you left off</span>
						<span className="truncate font-ui text-sm text-foreground">{resume.title || "Untitled session"}</span>
						<span className="font-ui text-xs text-muted-foreground">{waitingLabel(resume)}</span>
					</span>
					<ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
				</Link>
			) : (
				<div data-testid="dashboard-start-guide" className="rounded-xl border bg-card/85 px-4 py-3 text-left shadow-lg backdrop-blur">
					<p className="pb-2 font-ui text-sm text-foreground">Start here</p>
					<ol className="flex list-decimal flex-col gap-1.5 pl-5 font-ui text-xs text-muted-foreground">
						{START_STEPS.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
				</div>
			)}
		</section>
	);
}
