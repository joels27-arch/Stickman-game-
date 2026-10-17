# JJ in Los Angeles – Projektnotizen für Claude Code

Top-down-Open-World-Spiel (GTA-2-Stil) in **einer HTML-Datei**: `index.html`. Hauptzielgerät: **iPhone im Querformat** (Touch). Controller-Steuerung ist absichtlich deaktiviert (`PAD_ENABLED=false`).

## Arbeitsweise (vom Besitzer Joel)
- Antworten auf Deutsch, knapp.
- Selbstständig entscheiden, keine Rückfragen zu Details.
- **Nur ändern, worum gebeten wurde** – Layout/Platzierung anderer Teile nicht anfassen.
- Nach Änderungen: `sw.js` Cache-Version hochzählen (`jjla-vNN`), sonst sehen Handys die alte Version.
- ZIP nur liefern, wenn Joel danach fragt.

## Aufbau von index.html
- Der Spielcode steht in `<script type="text/plain" id="mainjs">`. Ein kleiner Loader lädt vorher `chars.webp`, `veh.webp`, `tex.webp` in `window.ASSETS` und injiziert dann den Code.
- Syntax-Check: Inhalt von `#mainjs` extrahieren und `node --check` laufen lassen.
- Welt: `WW=10900`, `LANDW=9400` (Festland-Bodencanvas `ground`), `WH0=3700`, `WH=6500`; Insel Santa Luna auf `ground2` (`G2`); Nordost-Insel Bel Air Key (JJs Villa `NEVILLA`, Garage `NEGARAGE`, Brücke `NEBR`) auf `ground3` (`G3`). Bodenzeichnung läuft einmal beim Start über den Proxy-Kontext `g`.
- Figuren: Cutout-Rig aus `chars.webp` (`RIGM`, `drawRig`, `rigFor`). Lokal: vorwärts = +y, `ang=atan2(-dx,dy)`. Köpfe sind zentriert (echte Draufsicht).
- Fahrzeuge/Palmen gemalt aus `veh.webp` (`paintedCar`). Bodentexturen aus `tex.webp` (`TEXP`).
- Übersetzung: DOM-Übersetzer über `I18N`-Map. Neue Texte mit `L2("deutsch","english")` registrieren, Dialoge mit `TL([[wer,de,en],…])`.
- Missionen: `MDEF` (Akt 1: m1–m6; Akt 2 via `act2Def`: mh, mf, m7–m14). Helfer: `talk`, `obj`, `fig`, `figSay`, `walkTo`, `spawnFoe`, `spawnChaser`, `holdRing`, `completeMission`, `failMission`, `LEADS`, `crewMsg`.
- Missions-Türen/Prompts: `def.door(m,d)` → wird in `doorTarget()` abgefragt. `MI.talk={ok,fn,lbl}` für E-Aktionen.
- Innenräume (Bank, Tresor, Brooks' Haus, Whitmore-Villa, Museum): `defRoom`, `enterRoom`, `exitRoom`, `CURROOM`, `CURSOL`. Räume liegen im Meer außerhalb der Insel, außen wird schwarz maskiert.
- Schleichen: `SG` (`sgStart`, `sgGuard`, `sgCam`, `sgLaser`, `knockOut`).
- Shops: LA ARMS (`armsOpen()`), DRIP STORE Klamotten (`clothesOpen()`, `CLO`), Rico's Autos (`ricoOpen()`, Autokauf ab m12). Beide über `openRico("o"|"c")`.
- Test-Sprung zu Mission i: `jumpToMission(i)` in der Konsole.

## Tests (Playwright, headless Chromium)
```
cd tests && npm i playwright && npx playwright install chromium
node err.js       # Fehler beim Laden/Spielen (DE)
node err_en.js    # dasselbe auf Englisch
node mis.js       # Akt 1 komplett durchspielen
node a2full.js    # alle Akt-2-Missionen durchschalten
```
Alle müssen `[]` (keine Fehler) bzw. alle Missionen `true` melden.

## Deploy
Ordner per Drag & Drop auf Netlify, oder `netlify deploy --prod --dir .`

## Offene Punkte
- Radio-MP3s einbauen, sobald Joel welche schickt.
- Sprecher-Stimmen für Dialoge: noch keine Entscheidung (erste KI-Probe wurde verworfen).
