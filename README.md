# INKFALL

A side-scrolling stick-figure real-time strategy war game for the browser, built for **iPhone in landscape** (touch, safe-area aware, installable PWA) and playable with mouse + keyboard on desktop.

HTML5 Canvas + vanilla JavaScript ES modules. No engine, no build step, no runtime dependencies.

## Quick start

```bash
npm run dev            # or: node tools/serve.mjs 8080
```

Open http://localhost:8080. Any static server works (`python3 -m http.server 8080` too); ES modules need `http://`, not `file://`.

### Testing on iPhone

1. Connect the phone and computer to the same Wi-Fi.
2. Run `npm run dev`. It prints a **Network** URL such as `http://192.168.1.23:8080/`.
3. Open that URL in Safari on the iPhone and rotate to landscape.
4. To install as an app: **Share → Add to Home Screen**. It then launches full-screen with no browser bars.
   - Service workers (offline play) only register over **HTTPS** or `localhost`. For full PWA behavior on the phone, use an HTTPS tunnel (e.g. `npx localtunnel --port 8080` or `cloudflared tunnel --url http://localhost:8080`) or deploy the folder to any static host (GitHub Pages, Netlify, Vercel).
5. For debugging, connect the iPhone to a Mac and use Safari → Develop → *your iPhone*.

## Art assets

The concept art lives in `assets/concept/` (see the README there). It was generated on Higgsfield; `bash tools/fetch-assets.sh` downloads it from the URLs in `tools/asset-sources.txt` and optimizes it.

```bash
npm install            # installs sharp (only needed for the asset pipeline)
npm run assets         # assets/concept/*.png → assets/game/*.webp + icons/*.png
```

The pipeline:
- removes the light background from the two monuments (border flood-fill + edge feathering), trims them, and resizes them to 640 px tall WebP
- resizes `bg_grassland.png`, and crops `bg_biomes.png` into its four quadrants (desert, snow, volcano, night)
- generates the apple-touch icon, PWA icons (192/512 + maskable) and favicon from `icon.png`
- writes `assets/game/manifest.json` so the game only requests files that exist

At runtime, the loader prefers `assets/game/*.webp`. If those are missing it uses the raw PNGs in `assets/concept/` and does the same background removal and cropping in a canvas. If those are missing too, it falls back to code-drawn backgrounds and monuments, so the game always runs. Background images are split into 3 horizontal bands drawn at different parallax speeds (sky / far / near), with code-drawn foreground details per biome.

Units are **never** sprites from the concept sheets. They are skeletal stick figures drawn in code (forward kinematics, procedural animation) with per-unit accessories matching the concept art. Large battles cache animation frames into small canvases (`src/render/spritecache.js`). The game runs a short on-device benchmark to choose between cached frames and full vector drawing.

> Note: the repository ships with code-drawn placeholder icons. Run `npm run assets` after adding `icon.png` to replace them.

## How to play

- **Economy:** Diggers walk to the gold mines and the ink crystal node near your monument, mine, and carry the resources home. Gold buys everything; **Ink Crystals** (rarer) are needed for Inkcasters, Shadows, Colossi, some upgrades and the Ink Storm spell.
- **Train** units from the bottom bar. Each button shows its cost, queue count and a cooldown ring. Tap **⬆ UPGRADE** to switch the bar into upgrade mode: one upgrade tier per unit, plus **+POP** for a higher population cap.
- **Command** the army with the big buttons on the right:
  - **DEFEND:** gather in front of your monument
  - **ATTACK:** march on the enemy
  - **GARRISON:** retreat behind the monument (protected, healing); Bowmen shoot from the wall
  - Formation is automatic: melee in front, ranged behind.
- **Direct control:** tap any of your units to take control. It gets a glowing outline, +50% damage and takes 25% less damage. Drag on the left half for the virtual joystick; use ⚔ to attack and the purple button for the unit's special. Tap the unit again or ✕ to hand it back to the AI.
- **Ink Storm:** the ink-drop button (top right) calls down a bombardment wherever you tap. It costs 8 ink and has a 55 s cooldown.
- **Camera:** drag the battlefield, use the ◀ ▶ edge buttons, or tap/drag the minimap.

### Desktop controls

| Key | Action |
|---|---|
| 1–7 | Train Digger … Colossus (Shift+number = upgrade) |
| U | Toggle upgrade mode |
| Z / X / C | Defend / Attack / Garrison |
| Q | Arm Ink Storm, then click to target |
| Click a unit / Tab | Take control (Tab cycles units near the camera) |
| WASD / arrows | Move controlled unit (or pan the camera) |
| J or Space / K | Attack / special |
| Esc | Release unit, or pause |
| Mouse drag / wheel | Pan the camera |

## Units

| Unit | Role | Cost | Special (direct control) |
|---|---|---|---|
| Digger | Worker, mines gold & ink | 50 | Sprint |
| Blade | Fast melee swordsman | 85 | Dash Slash |
| Bowman | Archer; arrows arc with physics | 120 | Volley |
| Shieldbearer | Slow tank; braces to block arrows and cut melee damage; spear pierces 2 | 175 | Hold to brace |
| Inkcaster | Channels an area ink blast | 190 + 3 ink | Quick Blast |
| Shadow | Invisible until it strikes; huge backstab | 170 + 2 ink | Vanish |
| Colossus | Giant brute; smashes and knocks back groups | 480 + 8 ink | Ground Slam |

Rough counters: Blade beats Bowman/Inkcaster/Shadow · Shieldbearer beats Blade/Bowman · Inkcaster beats clumps and Shieldbearers · Shadow assassinates the back line · Colossus crushes melee · Bowmen (bonus damage vs giants) beat the Colossus.

## Modes

- **Campaign:** 12 levels on a world map across 4 chapters (Grassland, Desert, Snow, Volcano) including night battles. Each level has a twist: tutorial, only bowmen, night ambush, limited gold, protect the statue, hold out, deep snow, assassins, dark war, meteor rain, boss Colossus, and the final battle. 1–3 stars per level (win · monument HP · time). New units unlock along the way.
- **Endless Defense:** survive escalating waves (a Colossus every 5th wave, a boss every 10th). Your best wave is saved.
- **Skirmish:** pick difficulty (Easy / Normal / Hard / Insane) and battlefield.

## Progression

Battles award **Gems**. Spend them in the **Armory** on permanent upgrades (per-unit training, starting gold, monument HP, mining yield, population, spell power), on early unit unlocks, and on cosmetic skins (army colors and hats). Everything is saved in `localStorage`.

## Enemy AI

The rule-based commander (`src/game/ai.js`):
- grows its economy
- scores each unit type against your current army using a counter matrix, and saves up for a clearly better pick
- buys upgrades and population
- switches between defend, attack and garrison based on army strength and threats near its monument
- casts Ink Storm on clustered troops; on Normal and above, units also use their abilities

Difficulty changes reaction time, income, worker count, aggression, counter-picking skill and accuracy.

## Project layout

```
index.html, css/style.css, manifest.webmanifest, sw.js
src/
  main.js            game state machine, modes, rewards, events → audio/fx/UI
  config.js          all tunable data: units, economy, difficulty, biomes, quality
  core/loop.js       fixed-timestep loop (60 Hz sim, interpolated render, hit-stop)
  core/util.js       math, seeded RNG, object pool
  game/world.js      simulation: units, structures, resources, projectiles, damage
  game/unit.js       unit behaviour, formations, abilities, direct control
  game/team.js       resources, training queues, upgrades
  game/ai.js         enemy commander + endless wave director
  game/levels.js     campaign levels and their rule twists
  render/renderer.js camera, parallax, ground, structures, night lighting, weather
  render/stick.js    skeletal stick figures: poses, accessories, ragdoll drawing
  render/spritecache.js  cached animation frames for big battles
  render/fx.js       pooled particles, decals, stuck arrows, verlet ragdolls
  ui/hud.js, ui/menus.js, ui/tutorial.js
  input.js           touch joystick, camera drag, taps, keyboard
  audio.js           Web Audio synthesized SFX + adaptive battle drums
  assets.js          loader, background removal, biome cropping, fallbacks
  save.js            localStorage save, Armory catalog, skins
tools/
  serve.mjs          zero-dependency dev server (prints the LAN URL)
  build-assets.mjs   image optimization pipeline (sharp)
  fetch-assets.sh    download concept art + run the pipeline
  sim.mjs            headless balance tests (unit matchups, AI vs AI, mono-unit vs mixed armies)
  levels-test.mjs    plays every campaign level and Endless headless
```

## Headless tests

The simulation has no DOM dependency, so the balance and level tests run in Node:

```bash
npm test                  # quick smoke + matchup table
npm run sim               # full balance report (mono-unit armies vs a mixed AI)
node tools/levels-test.mjs hard
```
