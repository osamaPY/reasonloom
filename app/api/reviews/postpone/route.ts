import { postponeConcept } from "@/src/server";

function offset(raw: unknown): number {
	const n = typeof raw === "number" ? raw : NaN;
	return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? Math.round(n) : 0;
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { concept?: unknown; days?: unknown; tz?: unknown } | null;
	if (typeof body?.concept !== "string" || typeof body.days !== "number") return Response.json({ error: "invalid_body" }, { status: 400 });
	const result = postponeConcept(body.concept, body.days, Date.now(), offset(body.tz));
	if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });
	return Response.json({ ok: true });
}
