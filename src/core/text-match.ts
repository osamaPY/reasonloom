/**
 * Small lexical helpers shared by passage ranking (which passages fit the
 * context budget) and citation checking (does a cited passage plausibly
 * support the sentence citing it). Deliberately crude and deterministic: word
 * overlap, no embeddings, no model. Pure.
 */

const STOPWORDS = new Set(
	(
		"the a an and or but if then else of to in on at by for with from as is are was were be been being it its this that these those " +
		"there here which who whom whose what when where why how not no nor so than too very can could should would may might must will shall " +
		"do does did done have has had having you your yours we our they them their he she his her him i me my mine also into over under about " +
		"each every any all some such only own same other another more most less least both either neither between within without per via " +
		"given let say says said note see call called mean means thus hence therefore because since while whereas however"
	).split(/\s+/),
);

/** Prose only: formulas, image syntax and link targets carry no comparable
 * words (a formula is symbols; a URL is noise), so they are dropped before
 * words are compared. */
export function plainForMatching(text: string): string {
	return text
		.replace(/\$\$[\s\S]*?\$\$/g, " ")
		.replace(/\$[^$\n]+\$/g, " ")
		.replace(/\\\([\s\S]*?\\\)/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\]\([^)]*\)/g, "] ");
}

/** Lowercase content words (letters only, 3+ chars), stopwords removed, TeX
 * command backslashes dropped so `\lambda` counts as "lambda". */
export function contentWords(text: string): string[] {
	const out: string[] = [];
	for (const raw of plainForMatching(text).toLowerCase().replace(/\\/g, " ").split(/[^a-zÀ-ɏ]+/)) {
		if (raw.length < 3 || STOPWORDS.has(raw)) continue;
		out.push(stem(raw));
	}
	return out;
}

/** Cheap suffix stripping so "eigenvalues"/"eigenvalue" and "solving"/"solve" meet. */
function stem(w: string): string {
	for (const suffix of ["ing", "ed", "es", "s"]) {
		if (w.length > suffix.length + 3 && w.endsWith(suffix)) return w.slice(0, -suffix.length);
	}
	return w;
}

/** Inverse document frequency over a set of documents (smoothed). */
export function idfWeights(docs: readonly (readonly string[])[]): Map<string, number> {
	const df = new Map<string, number>();
	for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
	const n = docs.length;
	const idf = new Map<string, number>();
	for (const [w, c] of df) idf.set(w, Math.log(1 + (n - c + 0.5) / (c + 0.5)));
	return idf;
}

/** Weighted fraction of the QUERY's words that appear in the document (0..1).
 * Asymmetric on purpose: "how much of what was asked is covered here". */
export function coverage(queryWords: readonly string[], docWords: readonly string[], idf?: ReadonlyMap<string, number>): number {
	if (queryWords.length === 0 || docWords.length === 0) return 0;
	const doc = new Set(docWords);
	const q = [...new Set(queryWords)];
	let hit = 0;
	let total = 0;
	for (const w of q) {
		const weight = idf?.get(w) ?? 1;
		total += weight;
		if (doc.has(w)) hit += weight;
	}
	return total === 0 ? 0 : hit / total;
}
