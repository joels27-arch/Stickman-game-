#!/usr/bin/env node
// Baut index.html aus src/ zusammen (ohne Abhängigkeiten).
//   node build.cjs          → index.html neu schreiben
//   node build.cjs --check  → nur prüfen, ob index.html aktuell ist (Exit 1, wenn nicht)
// In src/shell.html wird jede Zeile "@@include <datei>@@" durch den Inhalt der Datei ersetzt.
// "@@include game@@" fügt alle Spielcode-Dateien aus GAME in dieser Reihenfolge ein
// (sie laufen im Browser als EIN Skript – gemeinsame globale Variablen, Funktionen überall sichtbar).
const fs = require("fs"), path = require("path");
const SRC = path.join(__dirname, "src"), OUT = path.join(__dirname, "index.html");

const GAME = [
  "world.js",          // Weltlayout (Straßen, Gebäude, Zonen), Helfer, Bodenzeichnung
  "graphics.js",       // Sprites, Gebäudetexturen, Figuren-Rig, Gebäude zeichnen, Freischaltungen, FX, Sound
  "vehicles.js",       // Fahrzeuge, Verkehr, Helis, Ein-/Aussteigen, Autoklau
  "npcs.js",           // Passanten, Meeresleben
  "combat.js",         // Waffen, Leben/Wasted, Fahrzeuge zeichnen
  "ui.js",             // HUD, Handy, Eingabe
  "loop.js",           // Hauptschleife, GPS/Route, Radio, Skills
  "story.js",          // Akt-1-Grundlagen: Dialoge, Karten, Missions-Helfer
  "activities.js",     // Flugzeuge, Lake Hollywood, Santa Luna, Achterbahn, Golf, Controller
  "police-ai.js",      // Taktik, Polizei/Fahndung, Crew, Gegner-KI, Verfolger, Wegfindung, Mitfahrer
  "missions-act1.js",  // Ankunft, Intro, Safe-Minispiel, Tutorial, Missionen m1–m6
  "rooms.js",          // Akt-2-Infrastruktur: Innenräume, Schleichen, Bank/Tresor/Häuser/Museum
  "missions-act2.js",  // Akt 2: mh, mf, m7–m14
  "shops.js",          // LA ARMS, Schlossknacken & Autoklau-Minigames, Rico's, Strip, Gefängnis, Innenräume, große Karte, Start
].map(f => "game/" + f);

const read = f => fs.readFileSync(path.join(SRC, f), "utf8");
const html = read("shell.html").replace(/^@@include (\S+)@@\n/gm, (_, f) => f === "game" ? GAME.map(read).join("") : read(f));

if (process.argv.includes("--check")) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (cur !== html) { console.error("index.html ist nicht aktuell – bitte `node build.cjs` ausführen."); process.exit(1); }
  console.log("index.html ist aktuell.");
} else {
  fs.writeFileSync(OUT, html);
  console.log("index.html gebaut (" + html.length + " Zeichen).");
}
