# JJ in Los Angeles – Projektnotizen für Claude Code

Top-down-Open-World-Spiel (GTA-2-Stil). Ausgeliefert wird **eine HTML-Datei** `index.html`, bearbeitet wird aber in `src/` (siehe unten). Hauptzielgerät: **iPhone im Querformat** (Touch). Controller-Steuerung ist absichtlich deaktiviert (`PAD_ENABLED=false`).

## Arbeitsweise (vom Besitzer Joel)
- Antworten auf Deutsch, knapp.
- Selbstständig entscheiden, keine Rückfragen zu Details.
- **Nur ändern, worum gebeten wurde** – Layout/Platzierung anderer Teile nicht anfassen.
- Nach Änderungen: `sw.js` Cache-Version hochzählen (`jjla-vNN`), sonst sehen Handys die alte Version.
- ZIP nur liefern, wenn Joel danach fragt.

## Quellcode & Build
- **Nie `index.html` direkt bearbeiten** – sie wird aus `src/` gebaut: `node build.cjs` (ohne Abhängigkeiten). `node build.cjs --check` prüft, ob `index.html` aktuell ist. Nach jeder Änderung in `src/` bauen und `index.html` mit committen (Netlify liefert sie direkt aus, kein Build auf Netlify).
- `src/shell.html`: HTML-Gerüst (DOM, Loader, Service-Worker). Zeilen `@@include …@@` werden beim Bauen ersetzt.
- `src/style.css`: komplettes CSS. `src/i18n.js`: Sprache/Übersetzer (`LANG`, `I18N`, `L2`, `TL`, `tr`).
- `src/game/*.js`: Spielcode. Die Dateien werden in der Reihenfolge der Liste `GAME` in `build.cjs` zu **einem** Skript zusammengefügt (gemeinsamer globaler Gültigkeitsbereich, Funktionen sind überall sichtbar – keine Imports/Exports). Neue Datei → in `GAME` eintragen.
  - `world.js` Weltlayout, Helfer, Boden · `graphics.js` Sprites, Gebäude, Figuren-Rig, FX, Sound · `vehicles.js` Fahrzeuge, Verkehr, Helis, Autoklau · `npcs.js` Passanten, Meeresleben · `combat.js` Waffen, Leben, Fahrzeuge zeichnen
  - `ui.js` HUD, Handy, Eingabe · `loop.js` Hauptschleife, GPS, Radio, Skills · `story.js` Dialoge, Karten, Missions-Helfer · `activities.js` Flugzeuge, Lake, Santa Luna, Golf, Controller · `police-ai.js` Taktik, Polizei, Crew, Gegner-KI, Wegfindung
  - `missions-act1.js` Ankunft, Intro, Safe, Tutorial, m1–m6 · `rooms.js` Innenräume, Schleichen · `missions-act2.js` mh, mf, m7–m14 · `missions-act3.js` m15–m19 (Story-Ende) · `shops.js` LA ARMS, Schlossknacken/Autoklau-Minigames, Rico's, Strip, Gefängnis, große Karte, Spielstart
- Syntax-Check: `node --check src/game/<datei>.js` (jede Datei ist einzeln gültig).

## Aufbau des Spiels
- Der Spielcode steht in `index.html` in `<script type="text/plain" id="mainjs">`. Ein kleiner Loader lädt vorher `chars.webp`, `veh.webp`, `tex.webp` in `window.ASSETS` und injiziert dann den Code.
- Welt: `WW=10900`, `LANDW=9400` (Festland-Bodencanvas `ground`), `WH0=3700`, `WH=6500`; Insel Santa Luna auf `ground2` (`G2`); Nordost-Insel Bel Air Key (JJs Villa `NEVILLA`, Garage `NEGARAGE`, Brücke `NEBR`) auf `ground3` (`G3`). Bodenzeichnung läuft einmal beim Start über den Proxy-Kontext `g`.
- Figuren: Cutout-Rig aus `chars.webp` (`RIGM`, `drawRig`, `rigFor`). Lokal: vorwärts = +y, `ang=atan2(-dx,dy)`. Köpfe sind zentriert (echte Draufsicht).
- Fahrzeuge/Palmen gemalt aus `veh.webp` (`paintedCar`). Bodentexturen aus `tex.webp` (`TEXP`).
- Übersetzung: DOM-Übersetzer über `I18N`-Map. Neue Texte mit `L2("deutsch","english")` registrieren, Dialoge mit `TL([[wer,de,en],…])`.
- Missionen: `MDEF` (Akt 1: m1–m6; Akt 2 via `act2Def`: mh, mf, m7–m14; Akt 3 via `act3Def`: m15 Gefängnishof, m16 Lukas Verrat + 2-Min-Zeitlimit, m17 Lukas Flucht, m18 Leuchtturm/Donny, m19 Finale Santoro → ENDE). Akt-3-Defs haben auch `act2:true` (Raum-Aufräumen), Unterscheidung über `act3`.
- Zeitlimit: `mTimer(m,sek)`, `mTimerTick(m,dt)` (true = abgelaufen), `mTimerStop(m)`; Anzeige `#mTimer`. `def.noHeli` sperrt Heli-Rufen. Endgegner: `n.boss`/`n.bossMax` (Treffer, `killNpc` ist umhüllt).
- Waffen-Freischaltung (LA ARMS sperrt wirklich über `UNLOCK`): Akt 1 Schläger m2, Schrotflinte m3, SCAR m4 · Akt 2 Raketenwerfer m9 · Akt 3 Granatwerfer m15, Alien-Blaster m17.
- Pflichtkäufe Akt 2: m10 erst im DRIP STORE umziehen (`MI.d.dressed`), m12 am Ende Auto bei Rico kaufen (`MI.d.carBought`, Rico gibt $3.000). Helfer: `talk`, `obj`, `fig`, `figSay`, `walkTo`, `spawnFoe`, `spawnChaser`, `holdRing`, `completeMission`, `failMission`, `LEADS`, `crewMsg`.
- Missions-Türen/Prompts: `def.door(m,d)` → wird in `doorTarget()` abgefragt. `MI.talk={ok,fn,lbl}` für E-Aktionen.
- Innenräume (Bank, Tresor, Brooks' Haus, Whitmore-Villa, Museum): `defRoom`, `enterRoom`, `exitRoom`, `CURROOM`, `CURSOL`. Räume liegen im Meer außerhalb der Insel, außen wird schwarz maskiert.
- Schleichen: `SG` (`sgStart`, `sgGuard`, `sgCam`, `sgLaser`, `knockOut`).
- Shops: LA ARMS (`armsOpen()`), DRIP STORE Klamotten (`clothesOpen()`, `CLO`), Rico's Autos (`ricoOpen()`, Autokauf ab m12). Beide über `openRico("o"|"c")`.
- Fahrten mit Chauffeur: `RIDE` (Onkel Bobby → Luka nach m1, `setupRide`; Luka → Yunus nach m2, `setupLukaRide`, Route per `roadRoute`). Tutorial 1 (`TUT_STEPS`, `jjla-tut3`) läuft bei Bobby, Tutorial 2 (`TUT2_STEPS`: Handy/Bank, Waffen- & Outfit-Rad, `jjla-tut4`) bei Luka.
- Fahndungs-Balance (v103): `WANT_CARS=[0,1,2,2,3,3,4]`, Panzer erst ab 5 Sternen (`WANT_TANKS=[0,0,0,0,0,1,2]`, Schuss alle 5,5 s), Nachschub alle 4–5 s, erster Wagen frühestens 3 s nach Sternaufstieg; Explosionen mit Polizei-/Jet-Quelle machen JJ nur 45 % Schaden (`soft` in `explosion`). Bankcoup: Fluchtwagen `getaway()` vor der Bank, danach 4 Sterne.
- Fahndung durch Passanten: Überfahren zählt nicht; zu Fuß getötet ab dem 3. Opfer innerhalb 90 s (`CIVK`, `wantOnKill`).
- LA ARMS: Kaufpunkt `SISPOT` vor der Theke, Knopf/E öffnet den Laden (`onShopSpot`). Handy (Touch): `#radioChip` sitzt im `#hud` links neben dem Geld.
- Gefängnis: Türsteher (`JAIL.b`, `bouncerAI`) greifen nur an, wenn JJ sie angreift. Sind beide erledigt, führt die Tür (`JDOOR`) in den Gefängnishof (`enterJailYard`, raus über `JYIN`). Der alte Zellenblock-Raum (`enterJailIn`) ist nicht mehr erreichbar.
- Achtung: Alle Dateien teilen sich einen globalen Namensraum – gleichnamige Funktionen überschreiben sich still (so war `freeSpot` doppelt → Heli flog ins Nichts; jetzt `heliSpot`).
- Test-Sprung zu Mission i: `jumpToMission(i)` in der Konsole.
- Spawnpunkt (Spielstart, Tod, Verhaftung): `homeSpot()` = Onkel Bobbys Haus, nach `mh` die Villa (`SALEDOOR`).
- Missions-Startpunkte (`def.loc`), die in einem Hindernis liegen, werden am Ende von `missions-act3.js` automatisch auf freien Boden verschoben (sonst steckt JJ nach dem Sprung fest).
- Bank (m14): Personal-Tor öffnet beim Stürmen, Tresortür öffnet nach dem Bohren wirklich (`setGate(VAULT,"door",true)`), Taschen vor den Goldpaletten; `cleanup` schließt alles wieder.
- Dialog-Ton & Figuren (Akt 2/3, ikonisch statt nur Gags):
  - JJ: trocken, nummerierte „Regeln“ aus 8 Jahren Exil (Regel 1: Familie ist nicht verhandelbar – von Donny; Regel 14: Wer „vertrau mir“ sagt, dem vertraust du nicht → Payoff bei Lukas Verrat), bewertet Dinge „x von zehn“.
  - Santoro: höflicher Tarantino-Bösewicht, bietet Espresso an, nennt JJ „Mister Niemand“, „Wie unhöflich.“
  - Luka: Wolf-of-Wall-Street-Hype („kein Bankraub, ein BÖRSENGANG“), alles ist ein Verkauf, sagt „Vertrau mir“, will einen Tiger.
  - Yunus: Tauben sind Regierungsdrohnen aus Ohio. Mo: Pilot mit Höhenangst, hat ein Flugzeug an einen Elvis verloren. Bobby: Couch „Gerald“. Rico: Boot „Valentina“. Enzo: Diamant „Gisela“. Dario: Hotdog-oder-Sandwich-Debatte.

## Tests (Playwright, headless Chromium)
```
cd tests && npm i playwright && npx playwright install chromium
node err.js       # Fehler beim Laden/Spielen (DE)
node err_en.js    # dasselbe auf Englisch
node mis.js       # Akt 1 komplett durchspielen
node a2full.js    # alle Akt-2-Missionen durchschalten
node a3full.js    # alle Akt-3-Missionen (inkl. Zeitlimit-Fehlschlag)
node ../build.cjs --check   # index.html passt zu src/
```
Alle müssen `[]` (keine Fehler) bzw. alle Missionen `true` melden.

## Deploy
Vorher `node build.cjs`. Dann Ordner per Drag & Drop auf Netlify (`src/` und `build.cjs` stören dort nicht), oder `netlify deploy --prod --dir .`

## iOS-App (TestFlight)
- Ordner `mobile/` (Capacitor 8, SPM, App-ID `com.joel.jjla`, nur iPhone, Querformat, Vollbild). Anleitung: `mobile/ANLEITUNG-TESTFLIGHT.md`.
- „App aktualisieren“: in `mobile/` `npm install && npm run sync` (kopiert das gebaute Spiel nach `ios/App/App/public/`, ohne Service-Worker), dann `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` +1, committen.

## Offene Punkte
- Radio-MP3s einbauen, sobald Joel welche schickt.
- Sprecher-Stimmen für Dialoge: noch keine Entscheidung (erste KI-Probe wurde verworfen).
