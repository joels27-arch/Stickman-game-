/**
 * Produce the two things the deploy consumes:
 *
 *   dist/worker/index.js  — the bundled Worker (entry + room + logic)
 *   dist/client/**        — the static files, served before the Worker runs
 */

import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(app, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve(app, "src/worker.ts")],
  outdir: resolve(dist, "worker"),
  naming: "index.js",
  target: "browser",
  format: "esm",
  // Keep the runtime module unresolved; bundling it would break the DO class.
  external: ["cloudflare:workers"],
  minify: false,
  sourcemap: "none",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("worker bundle failed");
}

await cp(resolve(app, "public"), resolve(dist, "client"), { recursive: true });
// The client builds the same seeded course and uses the same tuning as the
// rules, so the rules file is served too (it has no secrets: pure functions).
await cp(resolve(app, "src/logic.js"), resolve(dist, "client/logic.js"));

console.log("built dist/worker/index.js + dist/client/");
