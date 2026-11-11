// Service worker build steps.
//   node scripts/stamp-sw.mjs          before next build: sw.js from template, unique build id
//   node scripts/stamp-sw.mjs --post   after next build: embed every emitted /_next/static file
//                                      so lazily loaded chunks (3D dice) work offline too
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const swPath = new URL("../public/sw.js", import.meta.url);

if (process.argv.includes("--post")) {
  const root = fileURLToPath(new URL("../.next/static", import.meta.url));
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (!name.endsWith(".map")) files.push(p);
    }
  };
  if (existsSync(root)) walk(root);
  const urls = files.map(
    (f) => "/_next/static/" + relative(root, f).split(sep).map(encodeURIComponent).join("/"),
  );
  const src = readFileSync(swPath, "utf8").replace("const PRECACHE = [];", "const PRECACHE = " + JSON.stringify(urls) + ";");
  writeFileSync(swPath, src);
  console.log("sw.js precache list: " + urls.length + " files");
} else {
  const id = Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
  const src = readFileSync(new URL("../sw/sw.template.js", import.meta.url), "utf8");
  writeFileSync(swPath, src.replace("__BUILD_ID__", id));
  console.log("sw.js stamped: " + id);
}
