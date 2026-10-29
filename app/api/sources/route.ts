import { SOURCE_MAX_FILES_PER_REQUEST, ingestSource, readSourceIndex } from "@/src/server";
import { SOURCE_MAX_BYTES } from "@/src/core";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ sources: readSourceIndex() });
}

/** Multipart "files": each is stored (or reported duplicate / rejected)
 * independently, so one bad file never blocks the rest. */
export async function POST(request: Request) {
	const form = await request.formData().catch(() => null);
	const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
	if (files.length === 0) return Response.json({ error: "no_files" }, { status: 400 });
	if (files.length > SOURCE_MAX_FILES_PER_REQUEST) return Response.json({ error: "too_many_files", max: SOURCE_MAX_FILES_PER_REQUEST }, { status: 413 });
	const results = [];
	for (const file of files) {
		// Refuse to read an oversized file into memory at all.
		if (file.size > SOURCE_MAX_BYTES) {
			results.push({ name: file.name, status: "rejected" as const, reason: "too_large" as const });
			continue;
		}
		results.push(ingestSource({ name: file.name, bytes: file.size, text: await file.text() }));
	}
	return Response.json({ results, sources: readSourceIndex() });
}
