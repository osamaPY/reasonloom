/**
 * Source context (fork): how a subject's source library reaches a session.
 * Pure — no IO or clock.
 *
 * A session grounded in a subject gets ONE marker message (like the graph
 * context) listing the subject's passages under short labels, S1.P1,
 * S1.P2, S2.P1 ... The model is asked to cite those labels; the app turns a
 * cited label into a link to the exact passage on the Sources page and runs a
 * cheap plausibility check on each citation.
 *
 * HONEST LIMITS
 *  - The material is an INSTRUCTION to the model, not a fence: nothing here
 *    can prove that an answer or a practice problem stayed inside it.
 *  - The context is bounded (CONTEXT_CHAR_BUDGET). When a library is larger
 *    than the budget, passages are chosen by lexical relevance to the
 *    learner's opening message (document order when there is none) and the
 *    omission is stated in both the model text and the UI card.
 *  - A citation is a label the model chose. The link proves the passage
 *    exists; the check (word overlap between the citing sentence and the
 *    passage) can flag a citation as weak, but it cannot prove support.
 */

import { mathSafePreview } from "./math-text.ts";
import { splitPassages, type SourceMeta } from "./sources.ts";
import { coverage, contentWords, idfWeights } from "./text-match.ts";

export const CONTEXT_CHAR_BUDGET = 24_000;
export const MAX_CONTEXT_SOURCES = 10;
export const MAX_PASSAGE_CHARS = 1_200;
/** Below this share of a sentence's content words found in the cited passage, a citation is flagged weak. */
export const WEAK_COVERAGE = 0.2;
/** Sentences with fewer content words than this are never flagged (too little to judge). */
export const MIN_WORDS_TO_JUDGE = 4;

export interface CitationTarget {
	sourceId: string;
	/** `<index>.<hash>` — resolves against the CURRENT source text. */
	ref: string;
	/** The passage text the model was given (bounded), used by the citation check. */
	text?: string;
}

export interface SourceContextDetails {
	subjectId: string;
	subjectName: string;
	sources: {
		label: string;
		id: string;
		name: string;
		revision: number;
		passages: { label: string; ref: string; preview: string; truncated: boolean }[];
		/** Passages of this source left out of the model's context. */
		omitted: number;
	}[];
	/** Sources of the subject left out entirely (over MAX_CONTEXT_SOURCES or budget). */
	omittedSources: number;
	/** True when passages were chosen by relevance to the opening message because the library exceeded the budget. */
	ranked?: boolean;
	citations: Record<string, CitationTarget>;
}

const preview = (text: string) => {
	const p = mathSafePreview(text.replace(/\s*\n\s*/g, " "), 140);
	return p.truncated ? `${p.text}…` : p.text;
};

interface Cand {
	si: number;
	index: number;
	label: string;
	ref: string;
	text: string;
	body: string;
	line: string;
	score: number;
}

export function buildSourceContext(
	subject: { id: string; name: string },
	sources: readonly { meta: SourceMeta; text: string }[],
	budget: number = CONTEXT_CHAR_BUDGET,
	query?: string,
): { content: string; details: SourceContextDetails } | null {
	if (sources.length === 0) return null;
	const ordered = [...sources].sort((a, b) => a.meta.name.localeCompare(b.meta.name) || a.meta.id.localeCompare(b.meta.id));
	const chosen = ordered.slice(0, MAX_CONTEXT_SOURCES);
	let omittedSources = ordered.length - chosen.length;

	// Every passage of every chosen source, with its stable label.
	const perSource = chosen.map((s, si) => {
		const label = `S${si + 1}`;
		const cands: Cand[] = splitPassages(s.text).map((p) => {
			const body = p.text.length > MAX_PASSAGE_CHARS ? `${p.text.slice(0, MAX_PASSAGE_CHARS)} […]` : p.text;
			const plabel = `${label}.P${p.index + 1}`;
			return { si, index: p.index, label: plabel, ref: p.ref, text: p.text, body, line: `[${plabel}] ${body}`, score: 0 };
		});
		return { s, label, cands };
	});
	const all = perSource.flatMap((x) => x.cands);
	const total = all.reduce((n, c) => n + c.line.length, 0);

	// Over budget: rank by relevance to the opening message. Greedy by score,
	// ties broken by document order; a passage that does not fit is skipped
	// (a smaller, later one may still fit). Under budget: everything goes in.
	const keep = new Set<Cand>();
	let ranked = false;
	if (total <= budget) {
		for (const c of all) keep.add(c);
	} else {
		const qWords = query ? contentWords(query) : [];
		if (qWords.length > 0) {
			ranked = true;
			const docs = all.map((c) => contentWords(c.text));
			const idf = idfWeights(docs);
			all.forEach((c, i) => {
				c.score = coverage(qWords, docs[i]!, idf);
			});
		}
		const order = [...all].sort((a, b) => b.score - a.score || a.si - b.si || a.index - b.index);
		let used = 0;
		for (const c of order) {
			if (used + c.line.length > budget) continue;
			used += c.line.length;
			keep.add(c);
		}
	}

	const details: SourceContextDetails = { subjectId: subject.id, subjectName: subject.name, sources: [], omittedSources: 0, ranked, citations: {} };
	const lines: string[] = [];
	for (const { s, label, cands } of perSource) {
		const kept = cands.filter((c) => keep.has(c));
		if (kept.length === 0 && cands.length > 0) {
			omittedSources++;
			continue;
		}
		const entry: SourceContextDetails["sources"][number] = { label, id: s.meta.id, name: s.meta.name, revision: s.meta.revision, passages: [], omitted: cands.length - kept.length };
		const block: string[] = [`${label} — ${s.meta.name}`];
		for (const c of kept) {
			block.push(c.line);
			entry.passages.push({ label: c.label, ref: c.ref, preview: preview(c.text), truncated: c.text.length > MAX_PASSAGE_CHARS });
			details.citations[c.label] = { sourceId: s.meta.id, ref: c.ref, text: c.body };
		}
		details.sources.push(entry);
		lines.push(...block, "");
	}
	details.omittedSources = omittedSources;
	if (details.sources.length === 0) return null;

	const omissions = details.sources.reduce((n, s) => n + s.omitted, 0);
	const header = [
		`[Session context] — the learner started this session from the subject "${subject.name}" and chose to ground it in these study materials from their own library.`,
		"",
		"How to use them:",
		"- Prefer these passages when explaining and when posing questions, quizzes or problems: build them from what the passages actually say, and where you can, test the learner on that material rather than on topics it does not cover. Do not present anything outside them as coming from the learner's material.",
		"- In every explanation, worked solution or answer reveal you write, cite the labels you used.",
		"- If the material does not cover what the learner asks, say so plainly, then answer from general knowledge and mark it as such.",
		"- When you rely on a passage, cite its label in square brackets, e.g. [S1.P2]. Cite only labels that appear below; never invent one.",
		"",
		"Material (label, then the passage):",
		"",
	];
	const footer: string[] = [];
	if (omissions > 0 || details.omittedSources > 0) {
		footer.push(
			`Note: the material above is incomplete (${omissions} passage(s) and ${details.omittedSources} source(s) did not fit${ranked ? "; the passages shown were chosen as the most relevant to the learner's opening message" : ""}). Do not assume the learner's material says nothing about a topic merely because it is absent here.`,
		);
	}
	return { content: [...header, ...lines, ...footer].join("\n").trimEnd(), details };
}

export type CitationStatus = "ok" | "weak" | "unknown";

const LABEL = /\[(S\d{1,2}\.P\d{1,4})\](?!\()/g;

/** The sentence (or line) a citation sits in, without the citation labels. */
function sentenceAround(text: string, at: number): string {
	const before = Math.max(text.lastIndexOf(". ", at), text.lastIndexOf("\n", at), text.lastIndexOf("? ", at), text.lastIndexOf("! ", at));
	const afterCands = [text.indexOf(". ", at), text.indexOf("\n", at), text.indexOf("? ", at), text.indexOf("! ", at)].filter((i) => i >= 0);
	const after = afterCands.length ? Math.min(...afterCands) : text.length;
	return text.slice(before + 1, after).replace(/\[S\d{1,2}\.P\d{1,4}\]/g, " ");
}

/** Judge each cited label in `text`: unknown (not in this session's list),
 * weak (the citing sentence shares few content words with the passage), or ok.
 * The worst status across a label's occurrences wins. Heuristic only. */
export function checkCitations(text: string, citations: Readonly<Record<string, CitationTarget>>): Map<string, CitationStatus> {
	const out = new Map<string, CitationStatus>();
	if (Object.keys(citations).length === 0) return out;
	const rank: Record<CitationStatus, number> = { ok: 0, weak: 1, unknown: 2 };
	for (const m of text.matchAll(LABEL)) {
		const label = m[1]!;
		const target = citations[label];
		let status: CitationStatus = "ok";
		if (!target) status = "unknown";
		else if (target.text) {
			const words = contentWords(sentenceAround(text, m.index!));
			if (words.length >= MIN_WORDS_TO_JUDGE && coverage(words, contentWords(target.text)) < WEAK_COVERAGE) status = "weak";
		}
		const prev = out.get(label);
		if (!prev || rank[status] > rank[prev]) out.set(label, status);
	}
	return out;
}

/** Turn cited labels into links to the passage. Unknown labels become plain
 * text saying so (a made-up citation must never be a live link); weak ones
 * link but carry a trailing "?" the UI explains; already-linked labels and
 * code are untouched. */
export function linkCitations(text: string, citations: Readonly<Record<string, CitationTarget>>): string {
	if (Object.keys(citations).length === 0) return text;
	const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g); // odd indexes are code
	return parts
		.map((part, i) => {
			if (i % 2 === 1) return part;
			const status = checkCitations(part, citations);
			return part.replace(LABEL, (whole, label: string) => {
				const target = citations[label];
				if (!target) return `[${label} — not in your sources]`;
				const mark = status.get(label) === "weak" ? "?" : "";
				return `[${label}${mark}](/sources?source=${encodeURIComponent(target.sourceId)}&ref=${encodeURIComponent(target.ref)})`;
			});
		})
		.join("");
}

/** True when a reply in a grounded session cites nothing from the learner's notes. */
export function lacksCitation(text: string, citations: Readonly<Record<string, CitationTarget>>, minChars = 240): boolean {
	if (Object.keys(citations).length === 0 || text.length < minChars) return false;
	return !new RegExp(LABEL.source).test(text);
}

/** The label a rendered citation button shows ("S1.P3" or "S1.P3?"), without the weak mark. */
export const citationLabelOf = (shown: string): string => shown.trim().replace(/\?$/, "");
