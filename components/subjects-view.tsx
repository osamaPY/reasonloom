"use client";

/**
 * Subjects page (fork, P03): create, rename, archive subjects and move
 * sessions between them. Server state only — every action PUTs/POSTs and
 * re-reads, so what you see is what is on disk. Sessions never disappear
 * when a subject is archived; they stay listed under it.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import type { ChatSummary, SourceMeta, Subject } from "@/src/core";

interface SubjectsPayload {
	subjects: Subject[];
	sessions: Record<string, string[]>;
	ungrouped: string[];
}

const ERROR_TEXT: Record<string, string> = {
	name_required: "Give the subject a name.",
	name_too_long: "That name is too long.",
	goal_too_long: "That goal is too long.",
	duplicate_name: "A subject with that name already exists (archived ones count).",
	not_found: "That subject no longer exists.",
	subject_archived: "Restore the subject before adding sessions to it.",
};

export function SubjectsView() {
	const [data, setData] = useState<SubjectsPayload | null>(null);
	const [chats, setChats] = useState<Record<string, ChatSummary>>({});
	const [sources, setSources] = useState<SourceMeta[]>([]);
	const [name, setName] = useState("");
	const [goal, setGoal] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [showArchived, setShowArchived] = useState(false);

	const load = useCallback(async () => {
		try {
			const [s, c, src] = await Promise.all([fetch("/api/subjects"), fetch("/api/chats"), fetch("/api/sources")]);
			setSources(((await src.json()) as { sources: SourceMeta[] }).sources);
			setData((await s.json()) as SubjectsPayload);
			const list = ((await c.json()) as { chats: ChatSummary[] }).chats;
			setChats(Object.fromEntries(list.map((chat) => [chat.id, chat])));
		} catch {
			setError("Could not load subjects.");
		}
	}, []);
	useEffect(() => {
		void load();
	}, [load]);

	const send = async (url: string, method: string, body: unknown): Promise<boolean> => {
		setError(null);
		const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
		if (!res.ok) {
			const { error: code } = (await res.json().catch(() => ({}))) as { error?: string };
			setError(ERROR_TEXT[code ?? ""] ?? "Something went wrong.");
			await load(); // reset any edited field back to what is on disk
			return false;
		}
		await load();
		return true;
	};

	const title = (id: string) => chats[id]?.title || "Untitled session";
	const active = data?.subjects.filter((s) => !s.archived) ?? [];
	const archived = data?.subjects.filter((s) => s.archived) ?? [];

	const sessionRow = (id: string, subject: Subject | null) => (
		<li key={id} className="flex items-center gap-2 py-1">
			<Link href={`/chat/${id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
				{title(id)}
			</Link>
			<select
				aria-label={`Subject for ${title(id)}`}
				value={subject?.id ?? ""}
				onChange={(e) => void send("/api/subjects/assign", "PUT", { chatId: id, subjectId: e.target.value || null })}
				className="max-w-40 rounded-md border bg-background px-1.5 py-1 font-ui text-xs"
			>
				<option value="">No subject</option>
				{active.map((s) => (
					<option key={s.id} value={s.id}>
						{s.name}
					</option>
				))}
				{subject?.archived && <option value={subject.id}>{subject.name} (archived)</option>}
			</select>
		</li>
	);

	const card = (s: Subject) => (
		<li key={`${s.id}:${s.updatedAt}`} data-testid="subject-card" className="rounded-xl border bg-card/85 p-4">
			<div className="flex items-start gap-2">
				<div className="min-w-0 flex-1">
					<input
						aria-label={`Name of ${s.name}`}
						defaultValue={s.name}
						onBlur={(e) => {
							if (e.target.value.trim() !== s.name) void send(`/api/subjects/${s.id}`, "PUT", { name: e.target.value });
						}}
						className="w-full bg-transparent font-ui text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
					<textarea
						aria-label={`Goal of ${s.name}`}
						defaultValue={s.goal}
						placeholder="Goal: what do you want to be able to do?"
						rows={2}
						onBlur={(e) => {
							if (e.target.value !== s.goal) void send(`/api/subjects/${s.id}`, "PUT", { goal: e.target.value });
						}}
						className="mt-1 w-full resize-none bg-transparent font-ui text-xs text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				</div>
				<button
					type="button"
					onClick={() => void send(`/api/subjects/${s.id}`, "PUT", { archived: !s.archived })}
					className="flex items-center gap-1 rounded-md px-2 py-1 font-ui text-xs text-muted-foreground hover:bg-accent"
				>
					{s.archived ? <ArchiveRestoreIcon className="size-3" /> : <ArchiveIcon className="size-3" />}
					{s.archived ? "Restore" : "Archive"}
				</button>
			</div>
			{sources.some((src) => src.subjectId === s.id) && (
				<p data-testid="subject-sources" className="mt-2 font-ui text-xs text-muted-foreground">
					Sources:{" "}
					{sources.filter((src) => src.subjectId === s.id).map((src, i) => (
						<span key={src.id}>
							{i > 0 && ", "}
							<Link href={`/sources?source=${src.id}`} className="underline">
								{src.name}
							</Link>
						</span>
					))}
				</p>
			)}
			<ul className="mt-2 divide-y">
				{(data?.sessions[s.id] ?? []).map((id) => sessionRow(id, s))}
				{(data?.sessions[s.id] ?? []).length === 0 && <li className="py-1 font-ui text-xs text-muted-foreground/70">No sessions yet.</li>}
			</ul>
		</li>
	);

	return (
		<div className="mx-auto h-full w-full max-w-2xl overflow-y-auto px-4 pb-16 pt-16">
			<h1 className="pb-1 font-ui text-lg">Subjects</h1>
			<p className="pb-4 font-ui text-xs text-muted-foreground">Group sessions by what you are learning. Archiving a subject keeps its sessions.</p>

			<form
				className="mb-6 flex flex-col gap-2 rounded-xl border bg-card/85 p-4"
				onSubmit={(e) => {
					e.preventDefault();
					void send("/api/subjects", "POST", { name, goal }).then((ok) => {
						if (ok) {
							setName("");
							setGoal("");
						}
					});
				}}
			>
				<input aria-label="New subject name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New subject, e.g. Linear algebra" className="rounded-md border bg-background px-2 py-1.5 font-ui text-sm" />
				<input aria-label="New subject goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal (optional)" className="rounded-md border bg-background px-2 py-1.5 font-ui text-xs" />
				<button type="submit" data-testid="create-subject" className="self-start rounded-md border px-3 py-1.5 font-ui text-xs hover:bg-accent">
					Create subject
				</button>
			</form>

			{error && (
				<p role="alert" className="mb-4 font-ui text-xs text-destructive">
					{error}
				</p>
			)}

			{data && active.length === 0 && (
				<div className="mb-4 font-ui text-xs text-muted-foreground">
					<p>No subjects yet. Create one above, then move sessions into it.</p>
					<p className="pt-2">
						Want to look around first?{" "}
						<button type="button" data-testid="load-sample" onClick={() => void send("/api/sample", "POST", {})} className="underline">
							Load the sample workspace
						</button>
						. It is synthetic demonstration data (no model was involved) and can be archived or deleted like anything else.
					</p>
				</div>
			)}
			<ul className="flex flex-col gap-3">{active.map(card)}</ul>

			{archived.length > 0 && (
				<div className="mt-6">
					<button type="button" onClick={() => setShowArchived((v) => !v)} className="font-ui text-xs text-muted-foreground hover:underline">
						{showArchived ? "Hide" : "Show"} archived ({archived.length})
					</button>
					{showArchived && <ul className="mt-2 flex flex-col gap-3">{archived.map(card)}</ul>}
				</div>
			)}

			<h2 className="pb-1 pt-8 font-ui text-sm">No subject</h2>
			<ul className="divide-y">
				{(data?.ungrouped ?? []).map((id) => sessionRow(id, null))}
				{data && data.ungrouped.length === 0 && <li className="py-1 font-ui text-xs text-muted-foreground/70">Every session belongs to a subject.</li>}
			</ul>
		</div>
	);
}
