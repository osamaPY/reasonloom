/** PDF text extraction and guarded web import, against a local fixture server
 * (the address guard is bypassed ONLY through the test-only option; the
 * default path is asserted to refuse loopback). */
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { extractPdfText } from "../src/server/pdf-import.ts";
import { htmlToMarkdown, importWebPage, safeName } from "../src/server/web-import.ts";

/** A valid single-page PDF with the given text lines (Helvetica), xref computed. */
function makePdf(pages: string[][]): Uint8Array {
	const objs: string[] = [];
	const add = (body: string) => objs.push(body) && objs.length;
	add("<< /Type /Catalog /Pages 2 0 R >>");
	const kidIds = pages.map((_, i) => 4 + i * 2);
	add(`<< /Type /Pages /Kids [${kidIds.map((k) => `${k} 0 R`).join(" ")}] /Count ${pages.length} >>`);
	add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
	for (const lines of pages) {
		const stream = `BT /F1 12 Tf 14 TL 72 720 Td ${lines.map((l) => `(${l.replace(/[()\\]/g, "\\$&")}) Tj T*`).join(" ")} ET`;
		const pageNo = objs.length + 1;
		add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNo + 1} 0 R >>`);
		add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
	}
	let out = "%PDF-1.4\n";
	const offsets: number[] = [];
	objs.forEach((body, i) => {
		offsets.push(out.length);
		out += `${i + 1} 0 obj\n${body}\nendobj\n`;
	});
	const xref = out.length;
	out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
	out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return new TextEncoder().encode(out);
}

describe("extractPdfText", () => {
	it("extracts each page's text with page markers", async () => {
		const r = await extractPdfText(makePdf([["An eigenvector keeps its direction."], ["Second page about eigenvalues."]]));
		assert.equal(r.ok, true);
		if (!r.ok) return;
		assert.equal(r.pages, 2);
		assert.match(r.text, /\(p\. 1\) An eigenvector keeps its direction\./);
		assert.match(r.text, /\(p\. 2\) Second page about eigenvalues\./);
	});

	it("reports a PDF with no text layer instead of storing nothing", async () => {
		assert.deepEqual(await extractPdfText(makePdf([[""]])), { ok: false, reason: "no_text_layer" });
	});

	it("rejects things that are not PDFs, however they are named", async () => {
		assert.deepEqual(await extractPdfText(new TextEncoder().encode("just some text")), { ok: false, reason: "bad_pdf" });
		assert.deepEqual(await extractPdfText(new Uint8Array()), { ok: false, reason: "bad_pdf" });
		assert.deepEqual(await extractPdfText(new TextEncoder().encode("%PDF-1.4 garbage that is not a document")), { ok: false, reason: "bad_pdf" });
	});

	it("leaves the caller's bytes intact", async () => {
		const bytes = makePdf([["Keep me."]]);
		const copy = bytes.slice();
		await extractPdfText(bytes);
		assert.deepEqual(bytes, copy);
	});
});

describe("htmlToMarkdown / safeName", () => {
	const article = `<html><head><title>Eigen things</title></head><body><nav>menu menu menu</nav><article><h1>Eigen things</h1><p>${"An eigenvector keeps its direction under a linear map. ".repeat(8)}</p><h2>Why nonzero</h2><p>The zero vector satisfies the equation for every scalar, so it carries no information about the matrix at all.</p></article><footer>copyright</footer></body></html>`;

	it("keeps the readable article as Markdown with the title and drops page chrome", () => {
		const md = htmlToMarkdown(article, "https://example.com/a")!;
		assert.equal(md.title, "Eigen things");
		assert.match(md.markdown, /^# Eigen things/);
		assert.match(md.markdown, /Why nonzero/);
		assert.ok(!md.markdown.includes("menu menu"));
	});

	it("returns null for a page with nothing readable", () => {
		assert.equal(htmlToMarkdown("<html><body><p>hi</p></body></html>", "https://example.com/"), null);
	});

	it("builds a safe file name", () => {
		assert.equal(safeName("A/B: C*D?", "example.com", ".md"), "A B C D (example.com).md");
		assert.equal(safeName("", "example.com", ".md"), "example.com (example.com).md");
		assert.ok(safeName("x".repeat(500), "h", ".md").length < 100);
	});
});

describe("importWebPage", () => {
	let server: http.Server;
	let base = "";
	const longText = "An eigenvector keeps its direction under the map. ".repeat(10);
	before(async () => {
		server = http.createServer((req, res) => {
			const send = (status: number, type: string, body: string | Uint8Array, extra: Record<string, string> = {}) => {
				res.writeHead(status, { "content-type": type, ...extra });
				res.end(body);
			};
			switch (req.url) {
				case "/page":
					return send(200, "text/html; charset=utf-8", `<html><head><title>Fixture page</title></head><body><article><h1>Fixture page</h1><p>${longText}</p><p>${longText}</p></article></body></html>`);
				case "/plain.txt":
					return send(200, "text/plain", "Plain notes about eigenvalues.");
				case "/doc.pdf":
					return send(200, "application/pdf", makePdf([["PDF over the wire."]]));
				case "/image":
					return send(200, "image/png", new Uint8Array([137, 80, 78, 71]));
				case "/missing":
					return send(404, "text/html", "nope");
				case "/hop":
					return send(302, "text/plain", "", { location: "/page" });
				case "/loop":
					return send(302, "text/plain", "", { location: "/loop" });
				case "/big":
					return send(200, "text/plain", "x".repeat(6 * 1024 * 1024));
				default:
					return send(404, "text/plain", "?");
			}
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});
	after(() => new Promise<void>((r) => server.close(() => r())));

	const priv = { allowPrivate: true };

	it("REFUSES loopback by default — the guard is on unless a test turns it off", async () => {
		assert.deepEqual(await importWebPage(`${base}/page`), { ok: false, reason: "blocked_host" });
		assert.deepEqual(await importWebPage("http://localhost/x"), { ok: false, reason: "blocked_host" });
		assert.deepEqual(await importWebPage("http://169.254.169.254/latest/meta-data/"), { ok: false, reason: "blocked_host" });
	});

	it("imports an HTML page as Markdown with its origin", async () => {
		const r = await importWebPage(`${base}/page`, priv);
		assert.equal(r.ok, true);
		if (!r.ok) return;
		assert.equal(r.kind, "web");
		assert.match(r.name, /^Fixture page \(127\.0\.0\.1\)\.md$/);
		assert.match(r.text, /^# Fixture page/);
		assert.equal(r.origin, `${base}/page`);
	});

	it("follows a redirect and records the final URL", async () => {
		const r = await importWebPage(`${base}/hop`, priv);
		assert.equal(r.ok && r.origin, `${base}/page`);
	});

	it("gives up on a redirect loop", async () => {
		assert.deepEqual(await importWebPage(`${base}/loop`, priv), { ok: false, reason: "too_many_redirects" });
	});

	it("imports plain text and a PDF behind a URL", async () => {
		const t = await importWebPage(`${base}/plain.txt`, priv);
		assert.equal(t.ok && t.kind, "text");
		const p = await importWebPage(`${base}/doc.pdf`, priv);
		assert.equal(p.ok && p.kind, "pdf");
		assert.match(p.ok ? p.text : "", /\(p\. 1\) PDF over the wire\./);
	});

	it("rejects unsupported content, HTTP errors and oversized bodies with a reason", async () => {
		assert.deepEqual(await importWebPage(`${base}/image`, priv), { ok: false, reason: "unsupported_content" });
		assert.deepEqual(await importWebPage(`${base}/missing`, priv), { ok: false, reason: "http_error" });
		assert.deepEqual(await importWebPage(`${base}/big`, priv), { ok: false, reason: "too_large" });
	});

	it("rejects bad URLs before any network use", async () => {
		assert.deepEqual(await importWebPage("ftp://example.com/x"), { ok: false, reason: "bad_scheme" });
		assert.deepEqual(await importWebPage("not a url"), { ok: false, reason: "bad_url" });
		assert.deepEqual(await importWebPage("https://u:p@example.com/"), { ok: false, reason: "credentials" });
	});
});
