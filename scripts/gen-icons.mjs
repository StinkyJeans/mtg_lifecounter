// One-off: rasterize public/icons/mark.svg to the PNG sizes the manifest needs.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/icons/mark.svg", import.meta.url));
const out = (n) => new URL(`../public/icons/${n}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

await sharp(svg).resize(192, 192).png().toFile(out("icon-192.png"));
await sharp(svg).resize(512, 512).png().toFile(out("icon-512.png"));
await sharp(svg).resize(180, 180).png().toFile(out("apple-touch-icon.png"));
// Maskable: artwork scaled to the inner ~66% safe zone on a full-bleed base.
const inner = await sharp(svg).resize(340, 340).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#14110d" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("maskable-512.png"));
console.log("icons written");
