# Lane Rush

A cartoon **4-player running race** for the browser (iPhone, iPad, Mac, PC).

**Play it:** https://lane-rush-party.higgsfield.app

## How to play

1. One player taps **Create lobby** and gets a 4-letter code (or taps *Copy invite link*).
2. Up to three friends open the game on their own device, type the code and tap **Join**.
3. Everyone picks a runner: **Rex** (barbarian), **Bolt** (goggles kid), **Ivy** (ponytail girl) or **Gizmo** (robot).
4. The host taps **Start race**. After a 3-2-1 countdown everyone runs the same course on a four-lane grass track, about one minute to the finish.
5. First across the line wins. Results show everyone's time; the host can start a rematch with the same group.

| Obstacle | What to do |
| --- | --- |
| Striped hurdle (low) | **Jump**: swipe up / tap / ↑ / W / Space |
| Striped gate (high beam) | **Slide/duck**: swipe down / ↓ / S |
| Crate stack | **Change lane**: swipe left/right / ← → / A D |
| Blue arrow pad | Run over it for a speed boost |

Hitting an obstacle makes you stumble and lose speed. Once the winner finishes, everyone else has 15 seconds left.

## How it's built

- **Art:** all characters, obstacles, trees, the grass texture, sky and cover were generated with **Higgsfield**: concept images → image-to-3D meshes → auto-rigged with run, jump, slide, idle and cheer animations.
- **Multiplayer:** hosted on Higgsfield's game platform (a Cloudflare Worker with one Durable Object per lobby code). The server is the referee. It owns the clock, caps how fast anyone can possibly be running, records finish times and ends the race. Each phone simulates its own runner so controls respond instantly.
- **Client:** three.js, no build step (`app/public/`).

```
app/src/logic.js     game rules: lobby, start, race, results (pure functions, also served to the browser)
app/src/room.ts      the lobby server: sockets, server clock, timers
app/public/client.js the game: 3D scene, controls, lobby/results screens
app/tests/           rules + real-WebSocket tests (20 tests)
```

## Run it on your Mac

You need [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`).

```bash
git clone https://github.com/joels27-arch/stickman-game-.git
cd stickman-game-/lane-rush
./fetch-assets.sh        # downloads the 3D models/textures + three.js
cd app
bun install
bun run build
bun run dev              # http://localhost:8787. Open two tabs to race yourself.
bun run test             # rules + multiplayer tests
```

The live version is deployed from Higgsfield's copy of this code. This folder mirrors it.
