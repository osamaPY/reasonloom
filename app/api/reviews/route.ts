import { reviewOverview } from "@/src/server";

export const dynamic = "force-dynamic";

/** A sane UTC offset in minutes (east positive); anything else falls back to UTC. */
function parseOffset(raw: unknown): number {
	const n = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
	return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? Math.round(n) : 0;
}

/** The review queue (due + upcoming, each with its reason) and the full attempt history.
 * `?tz=<minutes east of UTC>` makes day boundaries the learner's own. */
export async function GET(req: Request) {
	return Response.json(reviewOverview(Date.now(), parseOffset(new URL(req.url).searchParams.get("tz"))));
}
