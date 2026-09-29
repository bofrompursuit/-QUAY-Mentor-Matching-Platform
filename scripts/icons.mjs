// Renders public/ app icons from one SVG source. Run: node scripts/icons.mjs
import fs from "node:fs";
import sharp from "sharp";

// Motif: a "Q" ring whose tail runs out to a node — a founder docking with a mentor.
const mark = `
  <circle cx="236" cy="232" r="116" fill="none" stroke="#fff" stroke-width="44"/>
  <path d="M310 306 L378 374" stroke="#3d74ff" stroke-width="44" stroke-linecap="round"/>
  <circle cx="392" cy="388" r="38" fill="#3d74ff"/>
  <circle cx="392" cy="388" r="15" fill="#0d1224"/>`;
const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#1a2446"/><stop offset="1" stop-color="#0b0f1d"/></linearGradient></defs>`;

const svg = ({ rounded, scale = 1 }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${mark}</g></svg>`;

const out = (f) => `public/${f}`;
fs.writeFileSync(out("icon.svg"), svg({ rounded: true }));

const png = (s, size, file) => sharp(Buffer.from(s)).resize(size, size).png().toFile(out(file));
await Promise.all([
  png(svg({ rounded: true }), 512, "icon.png"),
  png(svg({ rounded: true }), 192, "icon-192.png"),
  png(svg({ rounded: true }), 512, "icon-512.png"),
  // Maskable/Apple: full-bleed background, mark kept inside the 80% safe zone; the OS applies its own mask.
  png(svg({ rounded: false, scale: 0.74 }), 512, "icon-maskable-512.png"),
  png(svg({ rounded: false, scale: 0.84 }), 180, "apple-touch-icon.png"),
  png(svg({ rounded: true }), 256, "favicon-src.png"),
]);
