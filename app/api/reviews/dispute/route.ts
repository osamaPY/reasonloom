import { setAttemptDisputed } from "@/src/server";

/** Flag an attempt's grading as incorrect (disputed: true) or restore it (false). */
export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { attemptId?: unknown; disputed?: unknown } | null;
	if (typeof body?.attemptId !== "string" || typeof body.disputed !== "boolean") return Response.json({ error: "invalid_body" }, { status: 400 });
	const result = setAttemptDisputed(body.attemptId, body.disputed);
	if (!result.ok) return Response.json({ error: result.error }, { status: 404 });
	return Response.json({ ok: true });
}
