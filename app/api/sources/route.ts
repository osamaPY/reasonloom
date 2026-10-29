import { SOURCE_MAX_FILES_PER_REQUEST, ingestPdfFile, ingestSource, readSourceIndex, refreshSourceStats, type IngestOutcome } from "@/src/server";
import { SOURCE_MAX_BYTES } from "@/src/core";

export const dynamic = "force-dynamic";

/** PDFs may be larger than a text note (their text layer is what is stored, capped separately). */
const PDF_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export async function GET() {
	return Response.json({ sources: refreshSourceStats() });
}

/** Multipart "files": each is stored (or reported duplicate / rejected)
 * independently, so one bad file never blocks the rest. Text and Markdown are
 * stored as written; a PDF contributes its text layer (no OCR). */
export async function POST(request: Request) {
	const form = await request.formData().catch(() => null);
	const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
	if (files.length === 0) return Response.json({ error: "no_files" }, { status: 400 });
	if (files.length > SOURCE_MAX_FILES_PER_REQUEST) return Response.json({ error: "too_many_files", max: SOURCE_MAX_FILES_PER_REQUEST }, { status: 413 });
	const results: IngestOutcome[] = [];
	for (const file of files) {
		const isPdf = file.name.toLowerCase().endsWith(".pdf");
		// Refuse to read an oversized file into memory at all.
		if (file.size > (isPdf ? PDF_UPLOAD_MAX_BYTES : SOURCE_MAX_BYTES)) {
			results.push({ name: file.name, status: "rejected", reason: "too_large" });
			continue;
		}
		if (isPdf) {
			results.push(await ingestPdfFile({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) }));
			continue;
		}
		results.push(ingestSource({ name: file.name, bytes: file.size, text: await file.text() }));
	}
	return Response.json({ results, sources: readSourceIndex() });
}
