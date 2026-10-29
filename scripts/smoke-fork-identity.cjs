// Check real Electron profile resolution without booting the app/server or
// opening a window. All filesystem state is restricted to a fresh temp root.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const product = require("../package.json");

if (process.versions.electron && process.env.LH_IDENTITY_SMOKE_ROOT) {
	const { app } = require("electron");
	try {
		const root = process.env.LH_IDENTITY_SMOKE_ROOT;
		app.setPath("appData", root);
		app.setName(product.productName);
		if (process.argv.includes("--dev")) app.setPath("userData", `${app.getPath("userData")}-dev`);
		const expected = path.join(root, `LearnHarness Fork${process.argv.includes("--dev") ? "-dev" : ""}`);
		assert.equal(app.getName(), "LearnHarness Fork");
		assert.equal(app.getPath("userData"), expected);
		console.log(`PASS real Electron ${process.argv.includes("--dev") ? "dev" : "default"} profile isolation`);
		app.exit(0);
	} catch (error) {
		console.error(error.message);
		app.exit(1);
	}
} else {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "learnharness-fork-identity-"));
	try {
		const env = { ...process.env, LH_IDENTITY_SMOKE_ROOT: root };
		delete env.ELECTRON_RUN_AS_NODE;
		for (const args of [[], ["--dev"]]) {
			const result = spawnSync(require("electron"), [__filename, ...args], { env, encoding: "utf8", windowsHide: true, timeout: 30000 });
			if (result.stdout) process.stdout.write(result.stdout);
			if (result.status !== 0) throw new Error(result.error?.message || result.stderr || `Electron exit ${result.status}`);
		}
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	} finally {
		// Only the exact mkdtemp directory created by this process is removed.
		fs.rmSync(root, { recursive: true, force: true });
	}
}
