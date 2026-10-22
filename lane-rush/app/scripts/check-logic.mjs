/**
 * Guard the `logic.js` contract at build time: the six exports exist, `meta`
 * is sane, no imports, no timers, no Date.now()/Math.random().
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logicPath = resolve(app, "src/logic.js");
const REQUIRED = ["meta", "setup", "validateAction", "applyAction", "isGameOver", "viewFor"];
const RULES = [
  [/\brequire\s*\(/, "logic.js must not require() anything"],
  [/^\s*import\s+[^.\n]/m, "logic.js must not import packages"],
  [/\bset(Timeout|Interval)\s*\(/, "use the room's wakeIn/alarm instead of timers"],
  [/\bDate\s*\.\s*now\s*\(/, "logic must be deterministic — time arrives as action.t"],
  [/\bnew\s+Date\s*\(/, "logic must be deterministic — time arrives as action.t"],
  [/\bMath\s*\.\s*random\s*\(/, "logic must be deterministic — seed randomness"],
  [/\bfetch\s*\(/, "logic.js has no network access"],
];

const source = await readFile(logicPath, "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const problems = [];
for (const [pattern, why] of RULES) if (pattern.test(code)) problems.push(why);

const logic = await import(logicPath);
for (const name of REQUIRED) if (!(name in logic)) problems.push(`missing export: ${name}`);
const { meta } = logic;
if (!meta || !Number.isInteger(meta.minPlayers) || !Number.isInteger(meta.maxPlayers) || meta.minPlayers > meta.maxPlayers) {
  problems.push("meta needs integer minPlayers <= maxPlayers");
}

if (problems.length) {
  console.error("src/logic.js does not satisfy the game contract:\n");
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}
console.log(`logic.js OK — ${meta.game} (${meta.minPlayers}-${meta.maxPlayers} players)`);
