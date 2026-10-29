/**
 * Build the app's web files (`www/`) from the Lane Rush website.
 *
 * The game itself is never copied into this folder's sources: `www/` is made
 * fresh each time from `../app`, the same way the website's build
 * makes `dist/client/`:
 *
 *   www/**        ← ../app/public (client, styles, art, three.js)
 *   www/logic.js  ← ../app/src/logic.js (the rules, shared with the server)
 *   www/native.js ← native/native.js, loaded by index.html before the game
 *
 * The art and three.js are not in git; `npm run assets` downloads them first.
 */

import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const game = resolve(mobile, "../app");
const www = resolve(mobile, "www");

// Web-only files the app doesn't need.
const SKIP = new Set(["name-preview.html", "themes.d.ts"]);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Without these the app would install and then hang on its loading screen.
for (const need of ["public/assets/c0.glb", "public/vendor/three.module.js"]) {
  if (!(await exists(resolve(game, need)))) {
    console.error(`missing ../app/${need}: run \`npm run assets\` first`);
    process.exit(1);
  }
}

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });
await cp(resolve(game, "public"), www, {
  recursive: true,
  filter: (src) => !SKIP.has(basename(src)),
});
await cp(resolve(game, "src/logic.js"), resolve(www, "logic.js"));

// native.js must run before the game's modules, so it goes in as a classic
// script right above the import map. If the page changes so that the marker is
// gone, stop: an app without it would race on the wrong server.
await cp(resolve(mobile, "native/native.js"), resolve(www, "native.js"));
const page = resolve(www, "index.html");
const html = await readFile(page, "utf8");
const MARKER = '<script type="importmap">';
if (html.split(MARKER).length !== 2) {
  console.error(`index.html has no single ${MARKER}: can't add native.js`);
  process.exit(1);
}
await writeFile(page, html.replace(MARKER, `<script src="/native.js"></script>\n    ${MARKER}`));

console.log("built www/ from ../app");
