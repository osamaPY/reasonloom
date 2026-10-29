import { createSubjectRecord, listChats, readSubjects } from "@/src/server";
import { groupSessions } from "@/src/core";

export const dynamic = "force-dynamic";

/** Subjects plus, per subject, the ids of its (still existing) sessions. */
export async function GET() {
	const record = readSubjects();
	const { bySubject, ungrouped } = groupSessions(record, listChats().map((c) => c.id));
	return Response.json({ subjects: record.subjects, sessions: bySubject, ungrouped });
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { name?: unknown; goal?: unknown } | null;
	if (typeof body?.name !== "string") return Response.json({ error: "name_required" }, { status: 400 });
	if (body.goal !== undefined && typeof body.goal !== "string") return Response.json({ error: "goal_too_long" }, { status: 400 });
	const result = createSubjectRecord({ name: body.name, goal: body.goal });
	if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "duplicate_name" ? 409 : 400 });
	return Response.json({ subjects: result.value.subjects }, { status: 201 });
}
