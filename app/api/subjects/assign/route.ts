import { assignSessionToSubject, getChat } from "@/src/server";

/** Move a session into a subject, or ungroup it with `subjectId: null`. */
export async function PUT(req: Request) {
	const body = (await req.json().catch(() => null)) as { chatId?: unknown; subjectId?: unknown } | null;
	if (typeof body?.chatId !== "string" || (body.subjectId !== null && typeof body.subjectId !== "string")) {
		return Response.json({ error: "invalid_body" }, { status: 400 });
	}
	if (!getChat(body.chatId)) return Response.json({ error: "not_found" }, { status: 404 });
	const result = assignSessionToSubject(body.chatId, body.subjectId);
	if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409 });
	return Response.json({ assignments: result.value.assignments });
}
