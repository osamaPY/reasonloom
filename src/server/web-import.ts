/** Import a public web page (or a PDF/text file behind a URL) as a source: fetch
 * under the network guard, extract the readable article, convert to Markdown. */
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { SOURCE_MAX_BYTES } from "../core/sources.ts";
import { extractPdfText, PDF_MAX_BYTES } from "./pdf-import.ts";
import { fetchPublic, FETCH_MAX_BYTES, type FetchFailure } from "./safe-fetch.ts";

export type WebImport = {
	name: string;
	text: string;
	kind: "web" | "pdf" | "text";
	origin: string;
	pages?: number;
	truncated?: boolean;
};
export type WebImportResult = ({ ok: true } & WebImport) | { ok: false; reason: FetchFailure | "unsupported_content" | "not_readable" | "bad_pdf" | "no_text_layer" | "too_many_pages" };

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
const MIN_USEFUL_CHARS = 200;

// Math travels as TeX, verbatim. Turndown escapes `_`, `\` and `*` in ordinary
// text, which would corrupt a formula, so formulas are carried in a marker
// element that this rule emits unescaped.
turndown.addRule("math", {
	filter: (node) => node.nodeName === "SPAN" && (node as Element).hasAttribute("data-lh-math"),
	replacement: (_content, node) => {
		const el = node as Element;
		const tex = el.getAttribute("data-lh-math") ?? "";
		return el.getAttribute("data-lh-display") === "1" ? `\n\n$$${tex}$$\n\n` : `$${tex}$`;
	},
});
// Turndown escapes literal square brackets as \[ and \]. The reader of this app
// takes those for legacy display-math delimiters, so a plain "[edit]" would be
// typeset as an equation. Square brackets in prose are left as they are.
const baseEscape = turndown.escape.bind(turndown);
turndown.escape = (text: string) => baseEscape(text).replace(/\\([[\]])/g, "$1");

// Remote images are not text; the library keeps words and formulas only.
turndown.addRule("drop-images", { filter: (node) => ["IMG", "PICTURE", "SVG"].includes(node.nodeName.toUpperCase()), replacement: () => "" });

/** MediaWiki wraps TeX as "{\displaystyle x^2}"; return the bare "x^2". */
export function unwrapDisplaystyle(tex: string): string {
	const t = tex.trim().replace(/\s+/g, " ");
	const m = /^\{\s*\\displaystyle\s+([\s\S]*)\}$/.exec(t);
	return (m ? m[1]! : t).trim();
}

/** Reference marks, edit links and "needs citation" tags are page chrome, not content. */
const CHROME = "sup.reference, .mw-editsection, .noprint, .mw-cite-backlink, .reference, style, script, noscript";

/** Replace MediaWiki-style math (MathML with a TeX annotation, or a fallback
 * image whose alt text is the TeX) with a marker element carrying the TeX. */
function markMath(document: Document): void {
	for (const el of Array.from(document.querySelectorAll(CHROME))) el.remove();
	const mark = (target: Element, tex: string, display: boolean) => {
		if (!tex) return;
		const span = document.createElement("span");
		span.setAttribute("data-lh-math", tex);
		// Turndown skips elements with no text at all; the text is ignored by the rule.
		span.textContent = tex;
		if (display) span.setAttribute("data-lh-display", "1");
		target.replaceWith(span);
	};
	for (const math of Array.from(document.querySelectorAll("math"))) {
		const ann = math.querySelector('annotation[encoding="application/x-tex"]');
		const wrapper = math.closest(".mwe-math-element") ?? math;
		const display = math.getAttribute("display") === "block" || /display/.test(String(wrapper.className ?? ""));
		if (ann?.textContent) mark(wrapper, unwrapDisplaystyle(ann.textContent), display);
		else math.remove();
	}
	for (const img of Array.from(document.querySelectorAll("img"))) {
		const alt = img.getAttribute("alt") ?? "";
		if (/^\s*\{\s*\\displaystyle/.test(alt)) mark(img, unwrapDisplaystyle(alt), /display/.test(String(img.className ?? "")));
	}
}

/** A safe file name from a title: no path characters, bounded, never empty. */
export function safeName(title: string, host: string, ext: string): string {
	const cleaned = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
	return `${cleaned || host} (${host})${ext}`;
}

/** Readable article -> Markdown with the title as H1 and math kept as TeX. Null when there is nothing worth keeping. */
export function htmlToMarkdown(html: string, url: string): { title: string; markdown: string } | null {
	const { document } = parseHTML(html);
	// Readability needs a base URI to resolve links; linkedom lacks one by default.
	try {
		const base = document.createElement("base");
		base.setAttribute("href", url);
		document.head?.prepend(base);
	} catch {
		/* a page without a head is still readable */
	}
	markMath(document as unknown as Document);
	const article = new Readability(document as unknown as Document).parse();
	if (!article?.content) return null;
	const body = turndown.turndown(article.content).trim();
	if (body.length < MIN_USEFUL_CHARS) return null;
	const title = (article.title ?? "").trim();
	return { title, markdown: title ? `# ${title}\n\n${body}` : body };
}

export async function importWebPage(rawUrl: string, opts: { allowPrivate?: boolean } = {}): Promise<WebImportResult> {
	const got = await fetchPublic(rawUrl, { maxBytes: Math.max(FETCH_MAX_BYTES, PDF_MAX_BYTES), allowPrivate: opts.allowPrivate });
	if (!got.ok) return got;
	const url = new URL(got.finalUrl);
	const host = url.hostname.replace(/^www\./, "");
	const type = got.contentType.split(";")[0]!.trim();
	const looksPdf = type === "application/pdf" || (type === "application/octet-stream" && url.pathname.toLowerCase().endsWith(".pdf"));

	if (looksPdf) {
		if (got.bytes.length > PDF_MAX_BYTES) return { ok: false, reason: "too_large" };
		const pdf = await extractPdfText(got.bytes);
		if (!pdf.ok) return pdf;
		const base = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "").replace(/\.pdf$/i, "");
		return { ok: true, name: safeName(base, host, ".pdf"), text: pdf.text, kind: "pdf", origin: got.finalUrl, pages: pdf.pages, truncated: pdf.truncated };
	}
	if (got.bytes.length > FETCH_MAX_BYTES) return { ok: false, reason: "too_large" };
	const text = new TextDecoder("utf-8", { fatal: false }).decode(got.bytes);
	if (type === "text/html" || type === "application/xhtml+xml") {
		const md = htmlToMarkdown(text, got.finalUrl);
		if (!md) return { ok: false, reason: "not_readable" };
		const truncated = md.markdown.length > SOURCE_MAX_BYTES;
		return { ok: true, name: safeName(md.title, host, ".md"), text: truncated ? md.markdown.slice(0, SOURCE_MAX_BYTES) : md.markdown, kind: "web", origin: got.finalUrl, truncated };
	}
	if (type === "text/plain" || type === "text/markdown") {
		const base = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "").replace(/\.(txt|md|markdown)$/i, "");
		return { ok: true, name: safeName(base, host, type === "text/markdown" ? ".md" : ".txt"), text, kind: "text", origin: got.finalUrl };
	}
	return { ok: false, reason: "unsupported_content" };
}
