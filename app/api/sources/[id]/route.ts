import { assignSourceToSubject, readSourceIndex, readSourceText, removeSource } from "@/src/server";
import { resolvePassage, splitPassages } from "@/src/core";

export const dynamic = "force-dynamic";

/** One source with its passages. `?ref=<index>.<hash>` also returns how that
 * reference resolves against the current text (exact / moved / stale). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const source = readSourceIndex().find((s) => s.id === id);
	const text = source ? readSourceText(id) : null;
	if (!source || text === null) return Response.json({ error: "not_found" }, { status: 404 });
	const passages = splitPassages(text);
	const ref = new URL(request.url).searchParams.get("ref");
	return Response.json({ source, passages, ...(ref ? { resolution: resolvePassage(passages, ref) } : {}) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const body = (await req.json().catch(() => null)) as { subjectId?: unknown } | null;
	if (!body || !("subjectId" in body) || (body.subjectId !== null && typeof body.subjectId !== "string")) {
		return Response.json({ error: "invalid_body" }, { status: 400 });
	}
	const result = assignSourceToSubject(id, body.subjectId);
	if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "subject_archived" ? 409 : 404 });
	return Response.json({ source: result.source });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!removeSource(id)) return Response.json({ error: "not_found" }, { status: 404 });
	return Response.json({ ok: true });
}
