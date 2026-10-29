// Kopiert das fertige Spiel aus dem Spielordner (..) nach www/ (das, was in die App kommt).
// Vorher im Spielordner "node build.cjs" laufen lassen.
const fs = require("fs"), path = require("path");
const SRC = path.join(__dirname, ".."), OUT = path.join(__dirname, "www");
const FILES = ["index.html", "chars.webp", "veh.webp", "tex.webp", "photo_donny.jpg", "title_bg4k.jpg",
  "radio_hai.mp3", "radio_hai_en.mp3", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"];
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
for (const f of FILES) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
// In der App braucht es keinen Service-Worker (alles liegt schon lokal)
const p = path.join(OUT, "index.html");
fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/<script>if\("serviceWorker" in navigator\)[^<]*<\/script>/, ""));
console.log("www/ aktualisiert (" + FILES.length + " Dateien)");
