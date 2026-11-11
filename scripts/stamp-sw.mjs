// Writes public/sw.js from sw/sw.template.js with a unique build id.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const id = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const src = readFileSync(new URL("../sw/sw.template.js", import.meta.url), "utf8");
writeFileSync(new URL("../public/sw.js", import.meta.url), src.replace("__BUILD_ID__", id));
console.log(`sw.js stamped: ${id}`);
