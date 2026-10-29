"use client";

/**
 * Source library page (fork, P04): add .md/.txt files, see per-file
 * outcomes (added / updated / duplicate / rejected with a reason), group
 * sources under subjects, read one, and copy a stable link to a passage.
 * A shared link `/sources?source=<id>&ref=<ref>` resolves the reference
 * against the CURRENT text and says so when it moved or no longer exists.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { LinkIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { findPassages, SOURCE_EXTENSIONS, type Passage, type PassageResolution, type SourceMeta, type Subject } from "@/src/core";

interface UploadResult {
	name: string;
	status: "added" | "updated" | "duplicate" | "rejected";
	reason?: string;
}

interface Detail {
	source: SourceMeta;
	passages: Passage[];
	resolution?: PassageResolution;
}

const STATUS_TEXT: Record<UploadResult["status"], string> = {
	added: "added",
	updated: "updated (changed content)",
	duplicate: "already in the library",
	rejected: "not added",
};

const REASON_TEXT: Record<string, string> = {
	unsupported_type: `only ${SOURCE_EXTENSIONS.join(", ")} files are supported`,
	empty: "the file is empty",
	too_large: "it is too large (notes: 1 MiB, PDFs: 20 MiB, web pages: 5 MiB)",
	not_text: "the file is not plain text",
	write_failed: "it could not be saved — try again",
	bad_pdf: "that does not look like a readable PDF",
	no_text_layer: "the PDF has no text layer (it looks scanned); OCR is not supported",
	too_many_pages: "the PDF has more than 400 pages",
	bad_url: "that is not a valid web address",
	bad_scheme: "only http and https addresses are supported",
	credentials: "addresses with a username or password are not supported",
	blocked_host: "that address is private or local, so it was not fetched",
	fetch_failed: "the page could not be fetched (offline, slow or refused)",
	http_error: "the server answered with an error",
	too_many_redirects: "the address redirects too many times",
	unsupported_content: "that address is not a web page, PDF or text file",
	not_readable: "no readable article text was found on that page",
};

export function SourcesView() {
	const [sources, setSources] = useState<SourceMeta[] | null>(null);
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [results, setResults] = useState<UploadResult[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [url, setUrl] = useState("");
	const [detail, setDetail] = useState<Detail | null>(null);
	const [query, setQuery] = useState("");
	const [copied, setCopied] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	const loadList = useCallback(async () => {
		try {
			const [s, sub] = await Promise.all([fetch("/api/sources"), fetch("/api/subjects")]);
			setSources(((await s.json()) as { sources: SourceMeta[] }).sources);
			setSubjects(((await sub.json()) as { subjects: Subject[] }).subjects);
		} catch {
			setError("Could not load the library.");
		}
	}, []);

	const open = useCallback(async (id: string, ref?: string) => {
		const res = await fetch(`/api/sources/${id}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);
		if (!res.ok) {
			setDetail(null);
			setError("That source no longer exists.");
			return;
		}
		setError(null);
		setQuery("");
		setDetail((await res.json()) as Detail);
		const url = new URL(window.location.href);
		url.searchParams.set("source", id);
		if (ref) url.searchParams.set("ref", ref);
		else url.searchParams.delete("ref");
		window.history.replaceState(null, "", url);
	}, []);

	useEffect(() => {
		void loadList();
		const p = new URLSearchParams(window.location.search);
		const id = p.get("source");
		if (id) void open(id, p.get("ref") ?? undefined);
	}, [loadList, open]);

	// Bring a resolved passage into view once the detail renders.
	useEffect(() => {
		const r = detail?.resolution;
		if (r && (r.status === "exact" || r.status === "moved")) {
			document.getElementById(`passage-${r.passage.index}`)?.scrollIntoView({ block: "center" });
		}
	}, [detail]);

	const addUrl = async () => {
		const value = url.trim();
		if (!value || busy) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/sources/url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: value }) });
			const body = (await res.json()) as { results?: UploadResult[]; error?: string };
			if (!res.ok) setError("The request failed. Please retry.");
			else {
				setResults(body.results ?? []);
				if (body.results?.every((r) => r.status !== "rejected")) setUrl("");
			}
			await loadList();
		} catch {
			setError("The request failed. Please retry.");
		} finally {
			setBusy(false);
		}
	};

	const upload = async (files: FileList | null) => {
		if (!files || files.length === 0 || busy) return;
		setBusy(true);
		setError(null);
		try {
			const form = new FormData();
			for (const f of Array.from(files)) form.append("files", f);
			const res = await fetch("/api/sources", { method: "POST", body: form });
			const body = (await res.json()) as { results?: UploadResult[]; error?: string; max?: number };
			if (!res.ok) setError(body.error === "too_many_files" ? `Add at most ${body.max} files at a time.` : "The upload failed. Please retry.");
			else setResults(body.results ?? []);
			await loadList();
			if (detail) await open(detail.source.id);
		} catch {
			setError("The upload failed. Please retry.");
		} finally {
			setBusy(false);
			if (fileInput.current) fileInput.current.value = "";
		}
	};

	const assign = async (id: string, subjectId: string) => {
		const res = await fetch(`/api/sources/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ subjectId: subjectId || null }) });
		if (!res.ok) setError("Could not move the source — the subject may be archived.");
		await loadList();
	};

	const remove = async (s: SourceMeta) => {
		if (!window.confirm(`Remove "${s.name}" from the library? Your original file is not touched.`)) return;
		await fetch(`/api/sources/${s.id}`, { method: "DELETE" });
		if (detail?.source.id === s.id) {
			setDetail(null);
			const url = new URL(window.location.href);
			url.searchParams.delete("source");
			url.searchParams.delete("ref");
			window.history.replaceState(null, "", url);
		}
		await loadList();
	};

	const copyRef = async (p: Passage) => {
		if (!detail) return;
		const url = new URL(window.location.origin + "/sources");
		url.searchParams.set("source", detail.source.id);
		url.searchParams.set("ref", p.ref);
		try {
			await navigator.clipboard.writeText(url.toString());
			setCopied(p.ref);
		} catch {
			setError("Could not copy; the reference is " + p.ref);
		}
	};

	const hits = detail ? new Set(findPassages(detail.passages, query)) : new Set<number>();
	const resolution = detail?.resolution;
	const target = resolution && (resolution.status === "exact" || resolution.status === "moved") ? resolution.passage.index : null;
	const subjectName = (id: string | null) => subjects.find((s) => s.id === id)?.name;

	return (
		<div className="reasonloom-workspace mx-auto h-full w-full max-w-3xl overflow-y-auto px-4 pb-16 pt-16">
			<p className="reasonloom-eyebrow">A library for your thinking</p>
			<h1 className="reasonloom-title">Sources</h1>
			<p className="pb-6 font-prose text-base leading-relaxed text-muted-foreground">
				Keep your material here: notes and text files ({SOURCE_EXTENSIONS.filter((e) => e !== ".pdf").join(", ")}), PDFs with a text layer, or a public web page. Adding something stores a local copy of its text; nothing is sent to a model until you start a session with that subject.
			</p>

			<input ref={fileInput} type="file" multiple accept={SOURCE_EXTENSIONS.join(",")} className="hidden" onChange={(e) => void upload(e.target.files)} />
			<button type="button" data-testid="add-sources" disabled={busy} onClick={() => fileInput.current?.click()} className="mb-4 flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-ui text-xs hover:bg-accent disabled:opacity-50">
				<UploadIcon className="size-3" />
				{busy ? "Adding…" : "Add files…"}
			</button>
			<form
				className="mb-4 flex items-center gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					void addUrl();
				}}
			>
				<input aria-label="Web page address" data-testid="source-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste a web page address (https://…)" className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 font-ui text-xs" />
				<button type="submit" data-testid="add-url" disabled={busy || url.trim() === ""} className="shrink-0 rounded-md border px-3 py-1.5 font-ui text-xs hover:bg-accent disabled:opacity-50">
					Add page
				</button>
			</form>

			{error && (
				<p role="alert" className="mb-3 font-ui text-xs text-destructive">
					{error}
				</p>
			)}
			{results.length > 0 && (
				<ul data-testid="upload-results" className="mb-4 flex flex-col gap-1 rounded-xl border bg-card/85 p-3 font-ui text-xs">
					{results.map((r, i) => (
						<li key={i} className={r.status === "rejected" ? "text-destructive" : "text-muted-foreground"}>
							{r.name}: {STATUS_TEXT[r.status]}
							{r.reason ? ` — ${REASON_TEXT[r.reason] ?? r.reason}` : ""}
						</li>
					))}
				</ul>
			)}

			{sources && sources.length === 0 && <p className="font-ui text-xs text-muted-foreground">No sources yet. Add a Markdown or text file to begin.</p>}
			<ul className="flex flex-col gap-2">
				{(sources ?? []).map((s) => (
					<li key={s.id} data-testid="source-row" className={`flex items-center gap-2 rounded-xl border bg-card/85 px-3 py-2 ${detail?.source.id === s.id ? "ring-1 ring-ring" : ""}`}>
						<button type="button" onClick={() => void open(s.id)} className="min-w-0 flex-1 text-left">
							<span className="block truncate font-ui text-sm">{s.name}</span>
							<span className="block font-ui text-xs text-muted-foreground">
								{s.kind === "pdf" ? `PDF${s.pages ? `, ${s.pages} pages` : ""} · ` : s.kind === "web" ? "web page · " : ""}
								{s.passages} {s.passages === 1 ? "passage" : "passages"} · {s.chars.toLocaleString()} chars · revision {s.revision}
								{subjectName(s.subjectId) ? ` · ${subjectName(s.subjectId)}` : ""}
							</span>
						</button>
						<select aria-label={`Subject for ${s.name}`} value={s.subjectId ?? ""} onChange={(e) => void assign(s.id, e.target.value)} className="max-w-36 rounded-md border bg-background px-1.5 py-1 font-ui text-xs">
							<option value="">No subject</option>
							{subjects
								.filter((sub) => !sub.archived || sub.id === s.subjectId)
								.map((sub) => (
									<option key={sub.id} value={sub.id}>
										{sub.name}
										{sub.archived ? " (archived)" : ""}
									</option>
								))}
						</select>
						<button type="button" aria-label={`Remove ${s.name}`} onClick={() => void remove(s)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
							<Trash2Icon className="size-3.5" />
						</button>
					</li>
				))}
			</ul>

			{detail && (
				<section aria-label={`Reading ${detail.source.name}`} className="mt-8">
					<div className="flex items-center gap-2 pb-2">
						<h2 className="min-w-0 flex-1 truncate font-ui text-sm">{detail.source.name}</h2>
						<input aria-label="Search in this source" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-40 rounded-md border bg-background px-2 py-1 font-ui text-xs" />
					</div>
					{detail.source.origin && (
						<p className="pb-2 font-ui text-xs text-muted-foreground">
							Fetched from{" "}
							<a href={detail.source.origin} target="_blank" rel="noopener noreferrer" className="underline">
								{detail.source.origin}
							</a>
						</p>
					)}
					{resolution?.status === "moved" && <p className="pb-2 font-ui text-xs text-muted-foreground">This passage has moved since the link was made; showing its current position.</p>}
					{resolution?.status === "stale" && (
						<p role="alert" className="pb-2 font-ui text-xs text-destructive">
							The passage this link pointed to was edited or removed, so it cannot be shown. The source was updated after the link was made.
						</p>
					)}
					{resolution?.status === "invalid" && (
						<p role="alert" className="pb-2 font-ui text-xs text-destructive">
							This passage link is not valid.
						</p>
					)}
					{query.trim() !== "" && (
						<p className="pb-2 font-ui text-xs text-muted-foreground">
							{hits.size} {hits.size === 1 ? "passage matches" : "passages match"}
						</p>
					)}
					<ol className="flex flex-col gap-2">
						{detail.passages.map((p) => (
							<li
								key={p.ref}
								id={`passage-${p.index}`}
								data-testid="passage"
								data-target={target === p.index ? "true" : undefined}
								className={`group relative rounded-md border px-3 py-2 ${target === p.index ? "border-ring bg-accent" : hits.has(p.index) ? "border-ring/50" : "border-transparent"}`}
							>
								<MessageResponse className="break-words text-sm">{p.text}</MessageResponse>
								<button
									type="button"
									aria-label={`Copy link to passage ${p.index + 1}`}
									onClick={() => void copyRef(p)}
									className="absolute right-2 top-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 font-ui text-xs text-muted-foreground opacity-0 hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"
								>
									<LinkIcon className="size-3" />
									{copied === p.ref ? "Copied" : "Link"}
								</button>
							</li>
						))}
					</ol>
				</section>
			)}
		</div>
	);
}
