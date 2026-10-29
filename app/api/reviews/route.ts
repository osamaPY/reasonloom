import { reviewOverview } from "@/src/server";

export const dynamic = "force-dynamic";

/** The review queue (due + upcoming, each with its reason) and the full attempt history. */
export async function GET() {
	return Response.json(reviewOverview());
}
