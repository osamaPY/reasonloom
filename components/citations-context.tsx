"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { CitationTarget } from "@/src/core";

/**
 * Fork: the session's label -> passage map (see core/source-context.ts),
 * provided by the chat view so every markdown surface in it — replies,
 * practice reveals, quiz explanations — can turn a cited [S1.P2] into a link
 * to the exact passage on the Sources page.
 */
const CitationsContext = createContext<Readonly<Record<string, CitationTarget>>>({});

export const CitationsProvider = CitationsContext.Provider;
export const useCitations = () => useContext(CitationsContext);

/** Streamdown renders links as safety-gated buttons (confirm modal / new
 * tab). A cited label is internal, so a capture-phase click handler routes it
 * to the Sources page instead. Mounts the router hook only when the session
 * actually has citations, so unit renders outside the app router are
 * unaffected. */
export function CitationBoundary({ children }: { children: ReactNode }) {
	const citations = useCitations();
	if (Object.keys(citations).length === 0) return <>{children}</>;
	return <RoutedBoundary citations={citations}>{children}</RoutedBoundary>;
}

function RoutedBoundary({ citations, children }: { citations: Readonly<Record<string, CitationTarget>>; children: ReactNode }) {
	// useRouter throws outside the app router (unit renders); fall back to a
	// plain navigation there rather than crashing.
	let router: ReturnType<typeof useRouter> | null = null;
	try {
		router = useRouter();
	} catch {
		router = null;
	}
	const onClickCapture = useCallback(
		(e: React.MouseEvent) => {
			const link = (e.target as HTMLElement).closest('[data-streamdown="link"]');
			const target = link ? citations[link.textContent?.trim() ?? ""] : undefined;
			if (!target) return;
			e.preventDefault();
			e.stopPropagation();
			const url = `/sources?source=${encodeURIComponent(target.sourceId)}&ref=${encodeURIComponent(target.ref)}`;
			if (router) router.push(url);
			else window.location.assign(url);
		},
		[citations, router],
	);
	return (
		<div style={{ display: "contents" }} onClickCapture={onClickCapture}>
			{children}
		</div>
	);
}
