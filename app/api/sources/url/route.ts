import { ingestUrl, readSourceIndex } from "@/src/server";

export const dynamic = "force-dynamic";

/** Import one public web page (or a PDF/text file at a URL) as a source. The
 * fetch is guarded server-side: public addresses only, http(s), bounded. */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
	if (typeof body?.url !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });
	const result = await ingestUrl(body.url);
	return Response.json({ results: [result], sources: readSourceIndex() });
}
