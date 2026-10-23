# Tumble Royale

An original 3D multiplayer obstacle-course party game for the browser: up to **30 players** per match, six maps, races, survival rounds and a last-bean-standing final. Built for phones in landscape (iPhone first) and desktop browsers.

- **Real multiplayer**: an authoritative server runs the physics at 60 Hz. Clients predict their own movement, reconcile against the server, and interpolate everyone else.
- **Private parties**: create a room, share the 6-character code or invite link, and the host starts the match with as few as 2 players. Optional, clearly labelled bots can fill empty seats.
- **Quick play**: public matchmaking joins (or opens) a public lobby that auto-starts after 20 s.
- **Practice**: the same authoritative room runs inside the page against bots, fully offline. No rewards.

## Quick start

```bash
cd tumble-royale
npm install
npm run dev          # game server on :8080 + Vite client on :5173 (proxied)
```

Open http://localhost:5173. To play from a phone on the same Wi-Fi, open the `Network:` URL that Vite prints.

Production build (one Node process serves the client, the API and the WebSockets):

```bash
npm run build
npm start            # http://localhost:8080   (PORT, DATA_DIR, CLIENT_DIR env vars)
```

### Testing several players on one computer

The profile token is stored in `localStorage`. Two tabs of the same browser are therefore *the same player*: the second tab takes over the seat, which is the duplicate-entry protection. To play against yourself, use a normal window plus a private window, two different browsers, or add `?guest` to the URL (a throwaway identity per tab).

## Playing with friends online

Anyone who can reach the server can play. Choose one of these:

| Option | What to do |
| --- | --- |
| **Docker anywhere** | `docker build -t tumble-royale . && docker run -p 8080:8080 -v tumble-data:/data tumble-royale` |
| **Fly.io** | `fly launch --copy-config --no-deploy && fly volumes create tumble_data --size 1 && fly deploy` (uses `fly.toml`) |
| **Render** | New → Blueprint → this repo (`render.yaml`, root `tumble-royale`) |
| **Cloudflare Workers** | `npm run deploy:cf` (needs `npx wrangler login`). Uses `wrangler.jsonc` and `server/cf/worker.ts`: one Durable Object class acts as room, directory and profile store. |
| **Higgsfield game hosting** | Already deployed at `https://tumble-royale.higgsfield.app` (Cloudflare Worker + Durable Objects). It needs one publish step before people outside the account can open it; see "Known limitations". |

Then, in the game: **PARTY → Create a room → Invite**. The invite copies or shares a link like `https://your-host/?room=ABC123`, which opens the join dialog pre-filled. Friends can also type the code under **PARTY → Join**. The host picks *Tournament* or *Single map* and an optional bot fill, then presses **START**.

A static client on one host can talk to a game server on another: `https://client-host/?server=https://game-server` (or build with `VITE_SERVER_URL`).

## Controls

| | Desktop | Phone (landscape) |
| --- | --- | --- |
| Move | WASD / arrows | left thumb: floating joystick |
| Jump | Space | JUMP button |
| Dive | Shift (or E) | DIVE button |
| Camera | drag the mouse | drag anywhere on the right side |
| Pause / settings | Esc | ❚❚ button |

Gamepads work too: left stick moves, A jumps, B/X dives, right stick moves the camera. Tip: jump, then dive at the top of the jump to cross big gaps. After a belly slide, press jump to pop straight up.

## Game structure

| Lobby size | Rounds |
| --- | --- |
| 30 | 30 → 20 → 12 → 6 → final (4 rounds) |
| 20 | 20 → 12 → 6 → final |
| 10 | 10 → 5 → final |
| 2–6 | straight to the final |

Early rounds favour gentle races, later rounds get harder or switch to survival, and the final is *Final Arena* (sometimes *Lava Panic*) with one winner. Simultaneous finishes are ordered by the exact sub-tick crossing time, then by a seeded per-match key. In survival, players who drop on the same tick are ordered by who was higher. *Single map* mode plays any one map as a one-round match.

### Maps

1. **Rainbow Rush** (race, easy): boost runway, sliding platforms over water, a hammer bridge, twin stepping-stone routes, a rolling-ball slope with safe gaps between lanes, and a final sprint under a sweeper.
2. **Spinning Madness** (race, medium): a giant turntable under a counter-spinning sweeper, spinning logs, windmill bridges with a bounce-pad shortcut, twin rotating discs, and sliding walls.
3. **Sky Fall** (race, hard): cloud hops, bridges that blink out on a timer, elevators with a jump-pad shortcut, a gusty wind bridge, jump-pad tiers, and a crumbling tile road.
4. **Lava Panic** (survival): rising lava, platforms that collapse on a schedule, moving rafts, sweepers that switch on over time, and a crown peak.
5. **Ice Chaos** (race, medium): an ice rink with sliding blocks, a snowball slope, a downhill ice slide into a jump, cracking-ice bridges, snow cannons, and a final ice field.
6. **Final Arena** (final): three layers of hexagon tiles that drop after you step on them. Sweepers appear over time and the lava rises until one bean is left.

## Architecture

```
shared/      deterministic simulation used by BOTH server and client prediction
  physics    world.ts (kinematic bodies posed as pure functions of round time, broadphase,
             sphere/box/cylinder contacts), player.ts (character controller: run, jump,
             coyote time, dive, belly slide, knockdown, recovery, ice, bounce, boost,
             conveyors, wind, moving-platform carry, respawn)
  protocol   JSON control messages + compact binary inputs/snapshots
  match      tournament sizing, map planning, deterministic ranking/tie-breaks
  maps/      the six maps (MapBuilder DSL), bots (bot.ts), cosmetics, progression
server/      Room (transport-agnostic authoritative room), RoomManager, ProfileService
  node-main  HTTP + WebSocket server, SQLite profiles (node:sqlite)
  cf/        Cloudflare Worker + Durable Object adapter (same Room class)
client/      React UI (menus, lobby, HUD, locker, shop) + three.js engine
  net/       GameSession: clock sync, prediction/reconciliation, interpolation, reconnect
  game/      renderer, procedural character, map view, camera, input, effects, audio
```

**Networking.**
- **Tick rates**: the server simulates at 60 Hz and sends snapshots at 20 Hz. Clients send inputs at 30 Hz, two ticks per packet.
- **Input timing**: inputs carry the server tick they are meant for. The client runs a few ticks ahead and adjusts its clock rate from the server's measured input lead ("slack").
- **Reconciliation**: each snapshot carries the receiving player's full-precision state at the acknowledged tick. The client rewinds to it and replays its unacknowledged inputs, then smooths away any visual correction over about 90 ms.
- **Remote players**: they are interpolated about 115 ms in the past. Riders of moving platforms are interpolated in the platform's own frame so they stay glued to it.
- **Obstacles**: they are never streamed. Every obstacle's pose is a pure function of round time, so all clients agree exactly. Only step-triggered tiles produce events.
- **Anti-cheat**: the server simulates movement from inputs. Clients cannot send positions, speeds, finishes or rewards. Inputs are range-checked and rate-limited, and cosmetics are validated against the server-side inventory.
- **Connection handling**: heartbeats, a 12 s timeout, automatic reconnect with resume secrets, a 20 s grace period mid-round, host migration, and cleanup of abandoned rooms.

**Progression** is server-authoritative. The browser stores only a random secret token. XP, levels, coins, daily challenges, the inventory and shop purchases live in SQLite (Node) or Durable Object storage (Cloudflare).

**Graphics.**
- **Batching**: static level geometry is merged per material, dropping tiles and decor are instanced, and each character is one rigid-skinned mesh (one draw call).
- **Materials**: patterns (stripes, checkers, chevrons, outfits) are procedural shaders, so there are no textures to download.
- **Quality**: presets are Low / Medium / High / Auto. Auto steps resolution and shadows down or up based on measured FPS.

**Audio.**
- **Music**: three original instrumental loops generated with Higgsfield, in `public/music/` (lobby, race, final).
- **Effects**: synthesized with WebAudio, with separate music and SFX volume controls. The procedural music sequencer remains as an offline fallback.

## Tests (all run locally against real code)

```bash
npm test              # vitest: physics, maps, room/match flow, protocol, profiles, real-WebSocket multiplayer
npm run test:load     # 2/4/10/20/30 real WebSocket clients vs a separate server process
npm run build && npm run test:e2e   # Playwright: two browser contexts (desktop + emulated iPhone) play together
```

See `TESTING.md` for the latest numbers.

## Known limitations

- **Higgsfield hosting is gated.** The deployment at `tumble-royale.higgsfield.app` currently answers `401 unauthenticated` to visitors. On that platform only sites published to the community feed are public: Lane Rush, which is published, answers 200. Publishing is the account owner's decision (a `publish_website` call, or "show in feed" in Higgsfield). Alternatively, use any option in the table above.
- **Performance on real phones is unmeasured.** It hasn't been profiled on a physical iPhone 17. The test environment has no GPU, so frame-rate numbers here come from software rendering and are only relative. Rendering cost is bounded instead: about 230 draw calls and 400k triangles per frame on *High* with 31 characters, and fewer on the phone presets. Auto quality adapts on the device.
- **Bots are good but not great.** They finish races and survive for a while, but they don't time blinking bridges and they burn through Final Arena tiles faster than humans would.
- **Player shoves are server-only.** Shoves between players are not predicted, so bumping into someone causes small corrections (smoothed; worst case about 0.6 m in the 10-client load test).
- **Profiles are tied to a browser.** A profile lives in one browser's `localStorage`. There are no accounts or cross-device login yet.
