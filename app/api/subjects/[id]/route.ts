import { updateSubjectRecord } from "@/src/server";

/** Rename, edit the goal, or archive/un-archive. Subjects are never deleted. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const body = (await req.json().catch(() => null)) as { name?: unknown; goal?: unknown; archived?: unknown } | null;
	if (!body || typeof body !== "object") return Response.json({ error: "invalid_body" }, { status: 400 });
	const patch: { name?: string; goal?: string; archived?: boolean } = {};
	if (body.name !== undefined) {
		if (typeof body.name !== "string") return Response.json({ error: "name_required" }, { status: 400 });
		patch.name = body.name;
	}
	if (body.goal !== undefined) {
		if (typeof body.goal !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });
		patch.goal = body.goal;
	}
	if (body.archived !== undefined) {
		if (typeof body.archived !== "boolean") return Response.json({ error: "invalid_body" }, { status: 400 });
		patch.archived = body.archived;
	}
	const result = updateSubjectRecord(id, patch);
	if (!result.ok) {
		const status = result.error === "not_found" ? 404 : result.error === "duplicate_name" ? 409 : 400;
		return Response.json({ error: result.error }, { status });
	}
	return Response.json({ subjects: result.value.subjects });
}
