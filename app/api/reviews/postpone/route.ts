import { postponeConcept } from "@/src/server";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { concept?: unknown; days?: unknown } | null;
	if (typeof body?.concept !== "string" || typeof body.days !== "number") return Response.json({ error: "invalid_body" }, { status: 400 });
	const result = postponeConcept(body.concept, body.days);
	if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });
	return Response.json({ ok: true });
}
