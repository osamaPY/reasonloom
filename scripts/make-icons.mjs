// Regenerate the Windows/Linux icon set from the flat design source
// (build/icon-flat.svg — the owner's Affinity export, rounded squircle
// with baked transparency, owner ruling 2026-10-13).
//
//   build/icon.ico  — Windows (.ico with 16/24/32/48/64/128/256 PNG entries)
//   build/icon.png  — Linux (512×512; AppImage/deb/desktop entry)
//
// (The macOS fallback icns and the DMG background are also generated below.)
// macOS does NOT come from here: build/icon.icon (the Icon Composer
// document) is the mac source of truth, compiled by actool at package
// time into Assets.car (macOS 26 Liquid Glass) + a fallback icns; the
// hand-packed build/icon.icns replaces that fallback's 256px cap via
// scripts/after-pack.cjs (pre-Tahoe keeps full-res).
//
// Renders each size DIRECTLY from the SVG (resvg) — sharper squircle
// edges than downsampling a raster. Committed outputs; rerun only when
// the design changes: `node scripts/make-icons.mjs`.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svg = readFileSync(path.join(root, "build", "icon-flat.svg"), "utf8");

const render = (size) => new Resvg(svg, { fitTo: { mode: "width", value: size } }).render(size, size).asPng();

// ---- build/icon.ico: ICONDIR + PNG entries ------------------------------
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const pngs = ICO_SIZES.map(render);
// Header (6) + one 16-byte directory entry per image, then the PNGs.
const header = Buffer.alloc(6 + ICO_SIZES.length * 16);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(ICO_SIZES.length, 4);
let offset = header.length;
ICO_SIZES.forEach((size, i) => {
	const e = 6 + i * 16;
	header.writeUInt8(size === 256 ? 0 : size, e); // 0 encodes 256
	header.writeUInt8(size === 256 ? 0 : size, e + 1);
	header.writeUInt8(0, e + 2); // colors
	header.writeUInt8(0, e + 3); // reserved
	header.writeUInt16LE(1, e + 4); // planes
	header.writeUInt16LE(32, e + 6); // bpp
	header.writeUInt32LE(pngs[i].length, e + 8);
	header.writeUInt32LE(offset, e + 12);
	offset += pngs[i].length;
});
const ico = Buffer.concat([header, ...pngs]);
writeFileSync(path.join(root, "build", "icon.ico"), ico);
console.log(`build/icon.ico  ${ICO_SIZES.join("/")} — ${(ico.length / 1024).toFixed(1)} KB`);

// ---- build/icon.png: the Linux icon -------------------------------------
const png512 = render(512);
writeFileSync(path.join(root, "build", "icon.png"), png512);
console.log(`build/icon.png  512×512 — ${(png512.length / 1024).toFixed(1)} KB`);

// ---- build/icon.icns: the pre-Tahoe macOS fallback ------------------------
// (afterPack copies this over actool's 256px-capped fallback.) Packed by hand:
// an 'icns' container of PNG-compressed entries. The squircle is inset to the
// macOS icon grid (about 80% of the canvas) because macOS draws no mask for
// a plain icns.
{
	const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
	const padded = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><g transform="translate(100 100) scale(0.8047)">${inner}</g></svg>`;
	const renderPadded = (size) => new Resvg(padded, { fitTo: { mode: "width", value: size } }).render(size, size).asPng();
	// [OSType, pixel size] — the full set iconutil would produce.
	const ENTRIES = [
		["icp4", 16], ["icp5", 32], ["icp6", 64], ["ic07", 128], ["ic08", 256], ["ic09", 512], ["ic10", 1024],
		["ic11", 32], ["ic12", 64], ["ic13", 256], ["ic14", 512],
	];
	const chunks = ENTRIES.map(([type, size]) => {
		const png = renderPadded(size);
		const head = Buffer.alloc(8);
		head.write(type, 0, "ascii");
		head.writeUInt32BE(png.length + 8, 4);
		return Buffer.concat([head, png]);
	});
	const body = Buffer.concat(chunks);
	const header = Buffer.alloc(8);
	header.write("icns", 0, "ascii");
	header.writeUInt32BE(body.length + 8, 4);
	writeFileSync(path.join(root, "build", "icon.icns"), Buffer.concat([header, body]));
	console.log(`build/icon.icns ${ENTRIES.length} entries 16→1024 — ${((body.length + 8) / 1024).toFixed(1)} KB`);
}

// ---- build/background.png (+ @2x): the DMG window art ----------------------
{
	const dmg = readFileSync(path.join(root, "build", "dmg-background.svg"), "utf8");
	for (const [file, width] of [["background.png", 540], ["background@2x.png", 1080]]) {
		const png = new Resvg(dmg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: true } }).render().asPng();
		writeFileSync(path.join(root, "build", file), png);
		console.log(`build/${file}  ${width}px — ${(png.length / 1024).toFixed(1)} KB`);
	}
}
