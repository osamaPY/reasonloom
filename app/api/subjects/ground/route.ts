import { groundSessionInSubject } from "@/src/server";

/** Ground an existing session in a subject's sources (assign + marker). Idempotent: refreshes. */
export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { chatId?: unknown; subjectId?: unknown } | null;
	if (typeof body?.chatId !== "string" || typeof body.subjectId !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });
	const result = groundSessionInSubject(body.chatId, body.subjectId);
	if (!result.ok) {
		const status = result.error === "turn_running" || result.error === "subject_archived" ? 409 : result.error === "no_sources" ? 422 : 404;
		return Response.json({ error: result.error }, { status });
	}
	return Response.json({ ok: true, replaced: result.replaced });
}
