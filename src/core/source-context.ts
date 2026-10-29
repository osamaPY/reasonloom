/**
 * Source context (fork, P06+): how a subject's source library reaches a
 * session. Pure — no IO or clock.
 *
 * A session started from a subject gets ONE marker message (like the graph
 * context) listing the subject's passages under short labels, S1.P1,
 * S1.P2, S2.P1 ... The model is asked to cite those labels; the app turns a
 * cited label into a link to the exact passage on the Sources page.
 *
 * HONEST LIMITS
 *  - The material is an INSTRUCTION to the model, not a fence: nothing here
 *    can verify that an answer or a practice problem stayed inside it.
 *  - The context is bounded (CONTEXT_CHAR_BUDGET). When a library is larger
 *    the earliest passages are included and the omission is stated in both
 *    the model text and the UI card; nothing is silently dropped.
 *  - A citation is a label the model chose. The link proves the passage
 *    exists in the learner's library, not that it supports the claim.
 */

import { splitPassages, type SourceMeta } from "./sources.ts";

export const CONTEXT_CHAR_BUDGET = 24_000;
export const MAX_CONTEXT_SOURCES = 10;
export const MAX_PASSAGE_CHARS = 1_200;

export interface CitationTarget {
	sourceId: string;
	/** `<index>.<hash>` — resolves against the CURRENT source text. */
	ref: string;
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
	citations: Record<string, CitationTarget>;
}

const preview = (text: string) => (text.length > 140 ? `${text.slice(0, 140).trimEnd()}…` : text);

export function buildSourceContext(
	subject: { id: string; name: string },
	sources: readonly { meta: SourceMeta; text: string }[],
	budget: number = CONTEXT_CHAR_BUDGET,
): { content: string; details: SourceContextDetails } | null {
	if (sources.length === 0) return null;
	const ordered = [...sources].sort((a, b) => a.meta.name.localeCompare(b.meta.name) || a.meta.id.localeCompare(b.meta.id));
	const chosen = ordered.slice(0, MAX_CONTEXT_SOURCES);
	let used = 0;
	let omittedSources = ordered.length - chosen.length;
	const lines: string[] = [];
	const details: SourceContextDetails = { subjectId: subject.id, subjectName: subject.name, sources: [], omittedSources: 0, citations: {} };

	chosen.forEach((s, si) => {
		const label = `S${si + 1}`;
		const passages = splitPassages(s.text);
		const entry: SourceContextDetails["sources"][number] = { label, id: s.meta.id, name: s.meta.name, revision: s.meta.revision, passages: [], omitted: 0 };
		const block: string[] = [`${label} — ${s.meta.name}`];
		for (const p of passages) {
			const body = p.text.length > MAX_PASSAGE_CHARS ? `${p.text.slice(0, MAX_PASSAGE_CHARS)} […]` : p.text;
			const plabel = `${label}.P${p.index + 1}`;
			const line = `[${plabel}] ${body}`;
			if (used + line.length > budget) {
				entry.omitted = passages.length - entry.passages.length;
				break;
			}
			used += line.length;
			block.push(line);
			entry.passages.push({ label: plabel, ref: p.ref, preview: preview(p.text), truncated: p.text.length > MAX_PASSAGE_CHARS });
			details.citations[plabel] = { sourceId: s.meta.id, ref: p.ref };
		}
		if (entry.passages.length === 0 && passages.length > 0) {
			// Not even one passage fit: the whole source is out.
			omittedSources++;
			return;
		}
		details.sources.push(entry);
		lines.push(...block, "");
	});
	details.omittedSources = omittedSources;
	if (details.sources.length === 0) return null;

	const omissions = details.sources.reduce((n, s) => n + s.omitted, 0);
	const header = [
		`[Session context] — the learner started this session from the subject "${subject.name}" and chose to ground it in these study materials from their own library.`,
		"",
		"How to use them:",
		"- Prefer these passages when explaining and when posing problems; do not present anything outside them as coming from the learner's material.",
		"- If the material does not cover what the learner asks, say so plainly, then answer from general knowledge and mark it as such.",
		"- When you rely on a passage, cite its label in square brackets, e.g. [S1.P2]. Cite only labels that appear below; never invent one.",
		"",
		"Material (label, then the passage):",
		"",
	];
	const footer: string[] = [];
	if (omissions > 0 || details.omittedSources > 0) {
		footer.push(
			`Note: the material above is incomplete (${omissions} passage(s) and ${details.omittedSources} source(s) did not fit). Do not assume the learner's material says nothing about a topic merely because it is absent here.`,
		);
	}
	return { content: [...header, ...lines, ...footer].join("\n").trimEnd(), details };
}

/** Turn cited labels into links to the passage. Labels not in the map are
 * left exactly as written (a made-up citation must not become a live link);
 * already-linked labels and fenced code are untouched. */
export function linkCitations(text: string, citations: Readonly<Record<string, CitationTarget>>): string {
	if (Object.keys(citations).length === 0) return text;
	const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g); // odd indexes are code
	return parts
		.map((part, i) => {
			if (i % 2 === 1) return part;
			return part.replace(/\[(S\d{1,2}\.P\d{1,4})\](?!\()/g, (whole, label: string) => {
				const target = citations[label];
				if (!target) return whole;
				return `[${label}](/sources?source=${encodeURIComponent(target.sourceId)}&ref=${encodeURIComponent(target.ref)})`;
			});
		})
		.join("");
}
