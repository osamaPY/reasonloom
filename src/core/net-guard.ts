/**
 * Network guard for importing a web page into the source library. Pure.
 *
 * The app runs on the learner's own machine, so a fetch the user types is
 * still a fetch from INSIDE their network: it must not be usable to read a
 * router admin page, a cloud metadata endpoint or another local service. The
 * rule is simple — only public addresses over http(s), checked at connect
 * time (see server/safe-fetch.ts), never credentials in the URL.
 */

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: "bad_url" | "bad_scheme" | "credentials" | "blocked_host" };

export const MAX_URL_LENGTH = 2048;

export function checkImportUrl(raw: string): UrlCheck {
	const text = raw.trim();
	if (text === "" || text.length > MAX_URL_LENGTH) return { ok: false, reason: "bad_url" };
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		return { ok: false, reason: "bad_url" };
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "bad_scheme" };
	if (url.username !== "" || url.password !== "") return { ok: false, reason: "credentials" };
	const host = url.hostname.toLowerCase();
	if (host === "" || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return { ok: false, reason: "blocked_host" };
	// A literal IP is judged here; a name is judged after resolution.
	const literal = host.startsWith("[") ? host.slice(1, -1) : host;
	if ((/^[\d.]+$/.test(literal) || literal.includes(":")) && !isPublicAddress(literal)) return { ok: false, reason: "blocked_host" };
	return { ok: true, url };
}

function ipv4Parts(ip: string): number[] | null {
	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
	if (!m) return null;
	const p = m.slice(1).map(Number);
	return p.every((n) => n <= 255) ? p : null;
}

/** True only for an address that is routable on the public internet. Unknown
 * or malformed input is NOT public. */
export function isPublicAddress(ip: string): boolean {
	const v4 = ipv4Parts(ip);
	if (v4) {
		const [a, b] = v4 as [number, number, number, number];
		if (a === 0 || a === 10 || a === 127) return false; // this-network, private, loopback
		if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
		if (a === 169 && b === 254) return false; // link-local (incl. cloud metadata)
		if (a === 172 && b >= 16 && b <= 31) return false; // private
		if (a === 192 && b === 168) return false; // private
		if (a === 192 && b === 0) return false; // IETF protocol assignments / TEST-NET-1
		if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
		if (a === 198 && b === 51) return false; // TEST-NET-2 (198.51.100/24)
		if (a === 203 && b === 0) return false; // TEST-NET-3 (203.0.113/24)
		if (a >= 224) return false; // multicast, reserved, broadcast
		return true;
	}
	const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
	if (!v6.includes(":") || !/^[0-9a-f:.]+$/.test(v6)) return false;
	// Structure: at most one "::", at most 8 groups, each 1-4 hex digits (a trailing dotted v4 is judged below).
	if ((v6.match(/::/g) ?? []).length > 1) return false;
	const body = v6.replace(/(\d{1,3}\.){3}\d{1,3}$/, "0:0");
	const groups = body.split(":").filter((g) => g !== "");
	if (groups.length > (v6.includes("::") ? 7 : 8) || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return false;
	if (!v6.includes("::") && groups.length !== 8) return false;
	// IPv4-mapped / compatible (::ffff:a.b.c.d) -> judge the embedded v4 address.
	const mapped = /^(?:0{0,4}:){0,5}(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v6);
	if (mapped) return isPublicAddress(mapped[1]!);
	if (v6 === "::" || v6 === "::1") return false;
	const first = v6.split(":")[0] ?? "";
	const head = first === "" ? 0 : parseInt(first, 16);
	if (Number.isNaN(head)) return false;
	if ((head & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
	if ((head & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
	if ((head & 0xff00) === 0xff00) return false; // multicast
	if (head === 0x2001 && v6.startsWith("2001:db8")) return false; // documentation
	if (head === 0 || head === 0x0100) return false; // unspecified / discard
	return true;
}
