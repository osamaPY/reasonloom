import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkImportUrl, isPublicAddress } from "../src/core/net-guard.ts";

describe("isPublicAddress", () => {
	it("accepts ordinary public IPv4 and IPv6", () => {
		for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
			assert.equal(isPublicAddress(ip), true, ip);
		}
	});

	it("rejects loopback, private, link-local, CGNAT, metadata and reserved IPv4", () => {
		for (const ip of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "127.255.255.254", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "100.127.255.255", "224.0.0.1", "255.255.255.255", "192.0.2.1", "198.18.0.1", "198.51.100.5", "203.0.113.9"]) {
			assert.equal(isPublicAddress(ip), false, ip);
		}
	});

	it("rejects loopback, unique-local, link-local, multicast and mapped-private IPv6", () => {
		for (const ip of ["::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "[::1]"]) {
			assert.equal(isPublicAddress(ip), false, ip);
		}
		assert.equal(isPublicAddress("::ffff:8.8.8.8"), true, "a mapped PUBLIC address is judged by its v4 part");
	});

	it("treats malformed input as not public", () => {
		for (const ip of ["", "abc", "999.1.1.1", "1.2.3", "1.2.3.4.5", "12345::", "gg::1"]) assert.equal(isPublicAddress(ip), false, ip);
	});
});

describe("checkImportUrl", () => {
	it("accepts http(s) URLs to public hosts", () => {
		const ok = checkImportUrl("https://example.com/notes/page?x=1");
		assert.equal(ok.ok, true);
		assert.equal(checkImportUrl(" http://8.8.8.8/x ").ok, true);
	});

	it("rejects other schemes, credentials and unparseable text", () => {
		assert.deepEqual(checkImportUrl("ftp://example.com/x"), { ok: false, reason: "bad_scheme" });
		assert.deepEqual(checkImportUrl("file:///etc/passwd"), { ok: false, reason: "bad_scheme" });
		assert.deepEqual(checkImportUrl("javascript:alert(1)"), { ok: false, reason: "bad_scheme" });
		assert.deepEqual(checkImportUrl("https://user:pw@example.com/"), { ok: false, reason: "credentials" });
		assert.deepEqual(checkImportUrl("not a url"), { ok: false, reason: "bad_url" });
		assert.deepEqual(checkImportUrl(""), { ok: false, reason: "bad_url" });
		assert.deepEqual(checkImportUrl("https://example.com/" + "a".repeat(3000)), { ok: false, reason: "bad_url" });
	});

	it("rejects local names and literal private addresses, including bracketed IPv6", () => {
		for (const u of ["http://localhost/", "http://foo.localhost/", "http://printer.local/", "http://db.internal/", "http://127.0.0.1:3000/", "http://10.0.0.5/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://[fd00::1]/", "http://192.168.0.1/"]) {
			assert.deepEqual(checkImportUrl(u), { ok: false, reason: "blocked_host" }, u);
		}
	});

	it("normalises odd IPv4 spellings before judging them", () => {
		// URL parsing turns these into 127.0.0.1 / 10.0.0.1 — they must not slip through.
		for (const u of ["http://2130706433/", "http://0x7f.0.0.1/", "http://017700000001/", "http://0/"]) {
			assert.deepEqual(checkImportUrl(u), { ok: false, reason: "blocked_host" }, u);
		}
	});
});
