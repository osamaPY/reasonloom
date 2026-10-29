/**
 * Inline math in short plain-text strings (session titles, labels,
 * previews) — the places that are NOT rendered through the Markdown
 * pipeline. Pure: splits a string into text and TeX segments; the UI
 * renders the TeX with KaTeX. Full documents (replies, sources, problem
 * statements) go through the Markdown renderer instead.
 *
 * Recognised: `$...$` and `\(...\)`, single line only. Currency stays text:
 * a `$` span must have non-space just inside both dollars and must not be a
 * bare number ("$5 and $6"). `\$` is a literal dollar.
 */

export type MathSegment = { kind: "text"; value: string } | { kind: "math"; value: string };

const BACKSLASH = "\\";
const BARE_NUMBER = /^[\d.,\s]*$/;

export function splitMath(text: string): MathSegment[] {
	const out: MathSegment[] = [];
	let buf = "";
	const flush = () => {
		if (buf) out.push({ kind: "text", value: buf });
		buf = "";
	};
	let i = 0;
	while (i < text.length) {
		const ch = text[i]!;
		if (ch === BACKSLASH && text[i + 1] === "$") {
			buf += "$";
			i += 2;
			continue;
		}
		if (ch === BACKSLASH && text[i + 1] === "(") {
			const end = text.indexOf(BACKSLASH + ")", i + 2);
			const body = end === -1 ? "" : text.slice(i + 2, end);
			if (end !== -1 && body.trim() !== "" && !body.includes("\n")) {
				flush();
				out.push({ kind: "math", value: body });
				i = end + 2;
				continue;
			}
		}
		if (ch === "$" && text[i + 1] === "$") {
			// A one-line double-dollar span: shown inline in short strings.
			const end = text.indexOf("$$", i + 2);
			const body = end === -1 ? "" : text.slice(i + 2, end);
			if (end !== -1 && body.trim() !== "" && !body.includes("\n")) {
				flush();
				out.push({ kind: "math", value: body });
				i = end + 2;
				continue;
			}
		}
		if (ch === "$" && text[i + 1] !== "$") {
			let j = i + 1;
			let close = -1;
			while (j < text.length) {
				if (text[j] === "\n") break;
				if (text[j] === BACKSLASH) {
					j += 2;
					continue;
				}
				if (text[j] === "$") {
					close = j;
					break;
				}
				j++;
			}
			if (close > i + 1) {
				const body = text.slice(i + 1, close);
				if (!/^\s|\s$/.test(body) && !BARE_NUMBER.test(body)) {
					flush();
					out.push({ kind: "math", value: body });
					i = close + 1;
					continue;
				}
			}
		}
		buf += ch;
		i++;
	}
	flush();
	return out;
}

/** Cut a preview to `max` characters without leaving an unclosed `$` span:
 * if the cut lands inside one, back up to just before its opening dollar. */
export function mathSafePreview(text: string, max: number): { text: string; truncated: boolean } {
	if (text.length <= max) return { text, truncated: false };
	let cut = text.slice(0, max);
	const dollars: number[] = [];
	for (let i = 0; i < cut.length; i++) {
		if (cut[i] === BACKSLASH) i++;
		else if (cut[i] === "$") dollars.push(i);
	}
	if (dollars.length % 2 === 1) cut = cut.slice(0, dollars[dollars.length - 1]!);
	const open = BACKSLASH + "(";
	const close = BACKSLASH + ")";
	const opens = cut.split(open).length - 1;
	const closes = cut.split(close).length - 1;
	if (opens > closes) cut = cut.slice(0, cut.lastIndexOf(open));
	return { text: cut.trimEnd(), truncated: true };
}
