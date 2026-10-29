/**
 * Turn the positioned text items of one PDF page into paragraphs. Pure: the
 * pdfjs call lives in server/pdf-import.ts; this only decides where lines and
 * paragraphs break, so it is testable with synthetic items.
 *
 * Heuristic, and said so: a new line starts when the baseline moves by more
 * than a fraction of the text height; a new paragraph starts when the gap is
 * clearly bigger than normal leading. Two-column layouts, tables and
 * equations come out in reading order only as well as the file's own text
 * order allows.
 */

export interface PdfTextItem {
	str: string;
	/** Baseline y (PDF space: larger = higher on the page). */
	y: number;
	/** Text height (font size) of the item. */
	h: number;
	/** pdfjs's own end-of-line flag. */
	eol?: boolean;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Join items into lines, then lines into paragraphs. */
export function layoutPageParagraphs(items: readonly PdfTextItem[]): string[] {
	const lines: { text: string; y: number; h: number }[] = [];
	for (const it of items) {
		if (it.str === "" && !it.eol) continue;
		const last = lines[lines.length - 1];
		const sameLine = last && Math.abs(it.y - last.y) <= Math.max(1, 0.5 * Math.max(it.h, last.h));
		if (sameLine) {
			// pdfjs splits words/runs into items; add a space only if neither side has one.
			const glue = last.text.endsWith(" ") || it.str.startsWith(" ") || last.text === "" ? "" : " ";
			last.text += glue + it.str;
		} else if (it.str.trim() !== "") {
			lines.push({ text: it.str, y: it.y, h: it.h });
		}
	}
	const paragraphs: string[] = [];
	let cur: string[] = [];
	let prev: { y: number; h: number } | null = null;
	const flush = () => {
		const t = norm(cur.join(" "));
		if (t) paragraphs.push(t);
		cur = [];
	};
	for (const line of lines) {
		const text = norm(line.text);
		if (!text) continue;
		if (prev) {
			const gap = Math.abs(prev.y - line.y);
			const lead = Math.max(prev.h, line.h) || 10;
			if (gap > 1.7 * lead) flush();
		}
		// rejoin words hyphenated across a line break ("eigen-" + "value")
		if (cur.length > 0 && cur[cur.length - 1]!.endsWith("-") && /^[a-z]/.test(text)) cur[cur.length - 1] = cur[cur.length - 1]!.slice(0, -1) + text;
		else cur.push(text);
		prev = { y: line.y, h: line.h };
	}
	flush();
	return paragraphs;
}

export interface PdfTextResult {
	pages: number;
	/** Pages that had no extractable text. */
	emptyPages: number;
	text: string;
}

/** Assemble pages into one text. Each page's first paragraph is prefixed
 * `(p. N)` so a passage — and a model citing it — carries its page. */
export function assemblePdfText(pageParagraphs: readonly (readonly string[])[], maxChars: number): PdfTextResult & { truncated: boolean } {
	const out: string[] = [];
	let used = 0;
	let empty = 0;
	let truncated = false;
	for (let i = 0; i < pageParagraphs.length; i++) {
		const paras = pageParagraphs[i]!;
		if (paras.length === 0) {
			empty++;
			continue;
		}
		const withPage = [`(p. ${i + 1}) ${paras[0]}`, ...paras.slice(1)];
		for (const p of withPage) {
			if (used + p.length + 2 > maxChars) {
				truncated = true;
				break;
			}
			out.push(p);
			used += p.length + 2;
		}
		if (truncated) break;
	}
	return { pages: pageParagraphs.length, emptyPages: empty, text: out.join("\n\n"), truncated };
}
