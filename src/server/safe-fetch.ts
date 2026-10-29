/**
 * Fetch a public web resource for the source library, with the network guard
 * enforced at CONNECT time: the address the socket actually uses is the one
 * validated, so a hostname that resolves to (or is rebound to) a private
 * address is refused. Redirects are followed by hand, each hop re-checked.
 * No cookies, no credentials, no proxies, bounded size and time.
 */
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { checkImportUrl, isPublicAddress } from "../core/net-guard.ts";

export const FETCH_MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Reasonloom/0.4 (source import; +https://github.com/osamaPY/learnharness-fork)";

export type FetchFailure = "bad_url" | "bad_scheme" | "credentials" | "blocked_host" | "fetch_failed" | "too_large" | "too_many_redirects" | "http_error";
export type FetchResult = { ok: true; bytes: Uint8Array; contentType: string; finalUrl: string } | { ok: false; reason: FetchFailure };

/** A `lookup` that resolves normally but only ever hands the socket a public address. */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
	dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
		if (err) return callback(err, "", 4);
		const list = (addresses as dns.LookupAddress[]).filter((a) => isPublicAddress(a.address));
		if (list.length === 0) return callback(Object.assign(new Error("blocked_host"), { code: "EBLOCKED" }), "", 4);
		// `options.all` may be set by the caller (happy eyeballs); honour either shape.
		if ((options as { all?: boolean }).all) (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
		else callback(null, list[0]!.address, list[0]!.family);
	});
};

interface Opts {
	maxBytes?: number;
	timeoutMs?: number;
	/** TEST ONLY: skip the address guard (a local fixture server is loopback). Never set from an API. */
	allowPrivate?: boolean;
}

function once(url: URL, opts: Required<Pick<Opts, "maxBytes" | "timeoutMs">> & { allowPrivate: boolean }): Promise<{ status: number; location?: string; contentType: string; bytes: Uint8Array } | FetchFailure> {
	return new Promise((resolve) => {
		const lib = url.protocol === "https:" ? https : http;
		const req = lib.request(
			url,
			{
				method: "GET",
				timeout: opts.timeoutMs,
				headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/pdf,text/plain,text/markdown;q=0.9,*/*;q=0.1", "accept-encoding": "identity" },
				agent: false,
				...(opts.allowPrivate ? {} : { lookup: publicOnlyLookup }),
			},
			(res) => {
				const status = res.statusCode ?? 0;
				const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
				if (status >= 300 && status < 400 && res.headers.location) {
					res.resume();
					return resolve({ status, location: String(res.headers.location), contentType, bytes: new Uint8Array() });
				}
				const declared = Number(res.headers["content-length"] ?? 0);
				if (declared > opts.maxBytes) {
					res.destroy();
					return resolve("too_large");
				}
				const chunks: Buffer[] = [];
				let size = 0;
				res.on("data", (c: Buffer) => {
					size += c.length;
					if (size > opts.maxBytes) {
						res.destroy();
						resolve("too_large");
						return;
					}
					chunks.push(c);
				});
				res.on("end", () => resolve({ status, contentType, bytes: new Uint8Array(Buffer.concat(chunks)) }));
				res.on("error", () => resolve("fetch_failed"));
			},
		);
		req.on("timeout", () => {
			req.destroy();
			resolve("fetch_failed");
		});
		req.on("error", (e) => resolve((e as { code?: string }).code === "EBLOCKED" ? "blocked_host" : "fetch_failed"));
		req.end();
	});
}

export async function fetchPublic(raw: string, o: Opts = {}): Promise<FetchResult> {
	const opts = { maxBytes: o.maxBytes ?? FETCH_MAX_BYTES, timeoutMs: o.timeoutMs ?? FETCH_TIMEOUT_MS, allowPrivate: o.allowPrivate === true };
	let current = raw;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const check = checkImportUrl(current);
		if (!check.ok && !(opts.allowPrivate && check.reason === "blocked_host")) return { ok: false, reason: check.reason };
		const url = check.ok ? check.url : new URL(current);
		const r = await once(url, opts);
		if (typeof r === "string") return { ok: false, reason: r };
		if (r.location) {
			try {
				current = new URL(r.location, url).toString();
			} catch {
				return { ok: false, reason: "bad_url" };
			}
			continue;
		}
		if (r.status < 200 || r.status >= 300) return { ok: false, reason: "http_error" };
		return { ok: true, bytes: r.bytes, contentType: r.contentType, finalUrl: url.toString() };
	}
	return { ok: false, reason: "too_many_redirects" };
}
