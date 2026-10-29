/** Text extraction from a PDF for the source library (pdfjs, no model, no OCR). */
import { assemblePdfText, layoutPageParagraphs, type PdfTextItem } from "../core/pdf-text.ts";
import { SOURCE_MAX_BYTES } from "../core/sources.ts";
import { standardFontsDir } from "../agent/subagents/pdf-ops.ts";

export const PDF_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_MAX_PAGES = 400;

export type PdfExtraction =
	| { ok: true; pages: number; emptyPages: number; text: string; truncated: boolean }
	| { ok: false; reason: "bad_pdf" | "too_many_pages" | "no_text_layer" };

/** Pull the text layer out of a PDF, page by page, laid out as paragraphs
 * with `(p. N)` markers. A scanned PDF (no text layer) is reported as such:
 * OCR is not supported. */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtraction> {
	// The magic number is checked first so a renamed file fails fast and cheaply.
	if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return { ok: false, reason: "bad_pdf" };
	let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
	try {
		pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
	} catch {
		return { ok: false, reason: "bad_pdf" };
	}
	// pdfjs transfers the buffer; hand it a copy so the caller's bytes stay valid.
	const task = pdfjs.getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: standardFontsDir(), verbosity: 0 });
	try {
		const doc = await task.promise;
		if (doc.numPages > PDF_MAX_PAGES) return { ok: false, reason: "too_many_pages" };
		const pages: string[][] = [];
		for (let n = 1; n <= doc.numPages; n++) {
			const page = await doc.getPage(n);
			const content = await page.getTextContent();
			const items: PdfTextItem[] = [];
			for (const it of content.items) {
				if (!it || typeof it !== "object" || !("str" in it)) continue;
				const t = it as { str: string; transform?: number[]; height?: number; hasEOL?: boolean };
				const tr = t.transform ?? [0, 0, 0, 0, 0, 0];
				items.push({ str: t.str, y: tr[5] ?? 0, h: t.height || Math.abs(tr[3] ?? 0) || 10, eol: t.hasEOL });
			}
			pages.push(layoutPageParagraphs(items));
			page.cleanup();
		}
		const assembled = assemblePdfText(pages, SOURCE_MAX_BYTES);
		if (assembled.text.trim() === "") return { ok: false, reason: "no_text_layer" };
		return { ok: true, pages: assembled.pages, emptyPages: assembled.emptyPages, text: assembled.text, truncated: assembled.truncated };
	} catch {
		return { ok: false, reason: "bad_pdf" };
	} finally {
		await task.destroy().catch(() => {});
	}
}
