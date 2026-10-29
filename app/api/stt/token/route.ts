/**
 * POST-less BYOK mint: the renderer never holds the real Deepgram key.
 *
 * The key lives server-side only (auth.json → process.env in the desktop
 * app; .env.local in dev — same seam as OPENROUTER_API_KEY). A dictation
 * run starts here: mint a short-lived access token (TTL 300s — a run can
 * outlast the 30s default), the renderer opens its WebSocket to Deepgram
 * with it, and audio flows renderer → Deepgram directly, never through
 * this server. The token is only checked at the WebSocket handshake, so
 * long dictation sessions survive the TTL fine (Deepgram docs).
 *
 * NOTE: if token minting (/auth/grant) returns 403 (for keys without Member
 * role), we fall back to providing the key directly to authenticate via
 * the WebSocket ["token", key] subprotocol.
 */
import { keyValue } from "@/src/server";

export async function GET() {
	const key = keyValue("DEEPGRAM_API_KEY");
	if (!key) {
		return Response.json(
			{ message: "No DEEPGRAM_API_KEY — add it to auth.json (desktop) or .env.local (dev)." },
			{ status: 503 },
		);
	}

	try {
		const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
			method: "POST",
			headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({ ttl_seconds: 300 }),
		});
		if (res.ok) {
			const data = (await res.json()) as { access_token?: string };
			if (data.access_token) {
				return Response.json({ token: data.access_token });
			}
		}
		// Fallback to raw key for WebSocket ["token", key] subprotocol
		return Response.json({ token: key });
	} catch {
		return Response.json({ token: key });
	}
}
