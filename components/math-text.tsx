import katex from "katex";
import { splitMath } from "@/src/core";

/**
 * Inline math for short plain strings (titles, labels, previews) that are
 * not rendered through the Markdown pipeline. `$x^2$` and `\(x^2\)` become
 * real KaTeX; everything else stays text. Output is KaTeX's own sanitised
 * HTML (trust off) — the same engine the Markdown renderer uses. A span KaTeX
 * cannot parse is shown as the original source text, never dropped.
 */
const cache = new Map<string, string | null>();

function render(tex: string): string | null {
	if (cache.has(tex)) return cache.get(tex) ?? null;
	let html: string | null = null;
	try {
		html = katex.renderToString(tex, { throwOnError: true, output: "htmlAndMathml", trust: false, strict: "ignore" });
	} catch {
		html = null;
	}
	if (cache.size > 500) cache.clear();
	cache.set(tex, html);
	return html;
}

export function MathText({ text }: { text: string }) {
	const parts = splitMath(text);
	if (parts.every((p) => p.kind === "text")) return <>{text}</>;
	return (
		<>
			{parts.map((p, i) => {
				if (p.kind === "text") return <span key={i}>{p.value}</span>;
				const html = render(p.value);
				return html ? <span key={i} dangerouslySetInnerHTML={{ __html: html }} /> : <span key={i}>{`$${p.value}$`}</span>;
			})}
		</>
	);
}
