# Test results

These are real runs from the development container: Linux, Node 22.22, headless Chromium with SwiftShader (software WebGL, no GPU). Re-run them with the commands in the README.

## Unit + integration (`npm test`): 47 tests, all passing

| Suite | What it covers |
| --- | --- |
| `tests/physics.test.ts` (25) | standing still without jitter; run accel/stop; jump height (1.6–2.0 m); dive → slide → get up; no falling through floors from 40 m; walls stop dives; riding moving platforms; hammer knockdown; bounce pads; ice sliding; checkpoint respawn; **bit-exact determinism** over 1,200 ticks; player shoves; **every map:** all 30 spawn slots are on solid ground and every checkpoint respawn grid lands on ground |
| `tests/room.test.ts` (15) | 30→20→12→6→1 and small-lobby round counts; final/early map planning; deterministic tie-breaks for simultaneous finishes and same-tick survival falls; host-only settings, ready, kick, host migration; junk/garbage messages; 30-human cap; lobby disconnect grace + resume; race qualification order; **full 30-player bot tournament to one winner**; binary protocol round-trips; server-side rewards, level-ups, purchases (insufficient coins, duplicates, equipping unowned items rejected); concurrent reward grants without lost updates |
| `tests/net.test.ts` (7) | real Node server + real WebSockets + the browser's `GameSession`: unknown room codes rejected; **2, 4 and 10 clients** join, start, see each other (interpolated positions within 3.5 m of server truth); client prediction matches the server to under 5 cm in deterministic play; obstacle poses identical across clients; dropped connection → reconnect keeps the same seat mid-round; host leaves → migration; late joiner spectates a running match; the same profile can't appear twice |

## Load test (`npm run test:load`): separate server process, scripted clients

Each client runs the full prediction/interpolation stack, plays 25 s of Rainbow Rush, and runs, steers, jumps and dives.

| Clients | Server CPU | Server RSS | Avg / max tick | Server out | Per-client in | Corrections > 0.3 m | Max correction | Late inputs | Others visible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 4.0 % | 90 MB | 0.14 / 4.9 ms | 8.8 KB/s | 4.4 KB/s | 0 | 0.26 m | 0 | 1/1 |
| 4 | 2.8 % | 91 MB | 0.11 / 1.5 ms | 19.9 KB/s | 5.0 KB/s | 2 | 0.68 m | 0 | 3/3 |
| 10 | 2.9 % | 93 MB | 0.13 / 3.0 ms | 66 KB/s | 6.6 KB/s | 8 | 0.49 m | 0 | 9/9 |
| 20 | 3.2 % | 97 MB | 0.18 / 2.4 ms | 187 KB/s | 9.3 KB/s | 60 | 0.96 m | 0 | 19/19 |
| 30 | 3.7 % | 98 MB | 0.23 / 2.4 ms | 362 KB/s | 12.1 KB/s | 98 | 1.25 m | 0 | 29/29 |

A 60 Hz tick has a 16.7 ms budget; a 30-player room uses 0.23 ms of it on average.

Corrections come from player-vs-player shoves, which only the server resolves. These scripted clients all run in one tight pack, which is the worst case. The worst corrections are about 1 m in 20–30 player packs; the client smooths every correction over about 90 ms.

Two bugs found with this harness and fixed:
- Respawn-slot mismatch: corrections up to 3.7 m.
- Inputs lost between frames at high refresh rates.

The Cloudflare Worker build was also run under `wrangler dev` (workerd) with 10 clients. Everyone stayed visible, at 6.6 KB/s per client.

## Browser end-to-end (`npm run test:e2e`)

This uses two isolated browser contexts: a desktop window, and an emulated iPhone in landscape (844×390, touch, mobile UA). They play through the real UI.

It checks:
- **Menus**: the Locker, Shop, Stats and Settings screens open, and the server shows as online.
- **Party flow**: a room is created with a 6-character code, and a wrong code gives a friendly error. The phone joins by code, ready status syncs, and the host sees 2 players. The invite link pre-fills the code.
- **Play**: the round intro shows on both devices and the touch controls are visible. The phone's on-screen joystick moves its player, and the host sees that movement come through the server (about 20 m). The JUMP button jumps.
- **Leaving**: leaving mid-match from the pause menu returns to the menu, and the host is told.
- **Errors**: no page errors.

Bugs this caught, all fixed:
- the touch layer swallowed the pause button on phones;
- the HUD swallowed joystick touches;
- quick taps were lost between simulation ticks;
- PWA icon 404s;
- an unsorted results list.

Latest result: see the end of this file.

## Map validation (bot simulations, `scratch/` harnesses)

| Map | Result |
| --- | --- |
| Rainbow Rush | first bot finish about 54 s; 20/30 bots qualify inside the 150 s limit |
| Spinning Madness | 6–10 of 16 bots finish; first at 36–67 s |
| Sky Fall | 12 of 16 bots qualify by about 95 s; first finish about 40 s |
| Ice Chaos | 16/20 bots finish inside 150 s; first at 29–53 s |
| Lava Panic | the bot field thins over the round; a final ends around 83 s |
| Final Arena | 6-bot finals end in about 22 s. Bots use tiles up much faster than humans, so human finals should run longer (not measured). |

Full 30-player tournament with bots: Rainbow Rush → Ice Chaos → Sky Fall → Final Arena → one winner, with all 30 players ranked.

## Rendering cost (Rainbow Rush, 31 characters, High preset)

Per frame: about 230 draw calls and about 400k triangles, including the shadow pass. Each character is one skinned mesh of about 4.8k triangles. The Medium preset (the phone default) turns off character shadow casting. Frame rate has **not** been measured on a physical iPhone, because the container has no GPU.

### Latest e2e run

```
PASS  menu shows the server as online
PASS  menu button "Locker" opens its screen
PASS  menu button "Shop" opens its screen
PASS  menu button "Stats" opens its screen
PASS  settings opens
PASS  room created with a 6-character code
PASS  joining a wrong code shows a friendly error
PASS  host sees 2 players in the lobby
PASS  ready status reaches the host
PASS  invite link pre-fills the room code
PASS  round intro appears for the host
PASS  the phone enters the round (intro, countdown or HUD)
PASS  touch controls visible on the phone
PASS  JUMP button jumps  — peak 0.00 → 1.69
PASS  host sees the phone player move (joystick → server → host)  — 24.3 m
PASS  phone player moved and sees the host
PASS  leaving mid-match returns to the menu
PASS  host is told the phone player left
PASS  no page errors
19/19 checks passed
```

The emulated phone renders at about 2 fps under software WebGL in this container. The test therefore measures game state (prediction and server state), not frame timing.
