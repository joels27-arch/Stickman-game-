# CLAUDE.md

Guidance for AI assistants (and humans) working in this repo. Read it in full
before every session; it governs every change.

## What is in this repo

Four browser games, built for phones first (the iPhone in particular) and
playable with mouse and keyboard on desktop. Each lives in its own folder with
its own tools, tests and README, and they share no code.

| Game | Folder | What it is | Built with | Live at |
|---|---|---|---|---|
| **INKFALL** | repo root (`index.html`, `src/`, `tools/`) | side-scrolling stick-figure RTS, landscape | Canvas 2D, vanilla JS modules, no build step, installable PWA | static files, no deploy recorded |
| **Lane Rush** ("4 Friends") | `lane-rush/` | cartoon 4-player running race, portrait | three.js client with no build step, Cloudflare Worker with one Durable Object per lobby | lane-rush-party.higgsfield.app |
| **4 Friends Run** | `lane-rush-lite/` | a simpler copy of Lane Rush: Multiplayer or Endless Run, pick a runner, play; no coins, packs, levels, pass, missions or tournaments | same as Lane Rush | four-friends-run.higgsfield.app |
| **Tumble Royale** | `tumble-royale/` | 3D obstacle-course party game for up to 30 players, landscape | TypeScript, React UI and three.js (Vite), authoritative server on Node or Cloudflare | tumble-royale.higgsfield.app |

Lane Rush was called **Brain Run** for a while, and `GAME-DESIGN.md`,
`src/logic.js` and `src/room.ts` still say so; players see "4 Friends". The
folder names stay as they are, and commits name a game by its folder (see
"Commits").

`lane-rush/claude-page/` is Lane Rush as a Claude artifact (live lobbies over
the artifact `room` capability, plus solo practice), with the scripts that
turn the Higgsfield models into glTF JSON for it; its README has the details.

All the art is generated on **Higgsfield**: concept images, image-to-3D
meshes with auto-rigged animations, music. INKFALL's processed art is tracked
in `assets/` and `icons/`. Lane Rush's is not in git at all: it is downloaded
from the live site (`lane-rush/fetch-assets.sh`).

## Architecture

**The rule: everything that decides an outcome lives in the game's pure,
DOM-free rules code and is tested there. Clients draw, take input and report;
they never decide who won.**

- INKFALL: `src/game/` (world, units, teams, AI, levels). It has no DOM
  dependency, so the balance and level tests run it headless in Node.
  Tunable numbers live in `src/config.js`, not in the simulation.
- Lane Rush and 4 Friends Run: `app/src/logic.js`.
- Tumble Royale: `shared/` (physics, protocol, match, maps), run by the
  server and by the client's prediction alike.

If you catch yourself writing a game rule, a score or a random draw in
rendering or UI code, move it into the rules code first.

Lane Rush's progression is the exception today: coins, packs, characters,
missions, the Season Pass and leagues are worked out in `public/client.js` and
saved in the browser's localStorage. `GAME-DESIGN.md` is their spec.

### INKFALL (repo root)

- `src/main.js` is the state machine (loading, menu, playing, paused,
  result) and wires the simulation to rendering, audio, input and UI.
  `src/core/loop.js` runs the simulation at a fixed 60 Hz and interpolates
  the render.
- `src/render/` draws the battlefield. Units are skeletal stick figures drawn
  in code, never sprites from the concept sheets; big battles cache their
  animation frames (`spritecache.js`).
- `src/ui/` is the DOM HUD, menus and tutorial; `src/input.js` the touch
  joystick, camera drag and keyboard; `src/audio.js` synthesized Web Audio.
- `src/save.js` is the save: one JSON object in localStorage under
  `inkfall.save.v1`, plus the Armory catalog and skins.
- `src/assets.js` loads the art with a fallback chain: `assets/game/*.webp`,
  else the raw PNGs in `assets/concept/` processed in a canvas, else
  code-drawn backgrounds and monuments. The game must always run with no art
  at all, so every step of that chain keeps working.
- `sw.js` precaches the app shell for offline play (see "Gotchas").
- `README.md` has the full layout, the controls, the units and the modes.

### Lane Rush (`lane-rush/app/`)

- **`src/logic.js`** is the rules: pure functions over JSON state (`meta`,
  `setup`, `validateAction`, `applyAction`, `isGameOver`, `viewFor`), the
  course generator (`buildCourse`, `checkCourse`) and the shared tuning
  constants. It is deterministic: time arrives as `action.t`, and randomness
  is seeded. `scripts/check-logic.mjs` enforces that at build time (no
  imports, timers, `Date.now()`, `new Date()`, `Math.random()` or `fetch`).
  The build also serves the file to the browser as `/logic.js`, so the
  client builds the same course from the same seed and uses the same
  constants. Never put a secret in it.
- **`src/room.ts`** is the trusted half: one Durable Object per lobby code
  (the code is the room name), owning the sockets, the clock and storage. It
  stamps every action with server time, which is what makes the countdown,
  finish times and the speed cap work, and it runs the timers as alarm ticks
  scheduled by `logic.wakeAfter()`. When the last connection closes, the
  room wipes itself, so an old code never brings back a stale lobby.
- **`src/worker.ts`** routes `/ws/<CODE>` to that room. Static files are
  served before it runs.
- **`src/protocol.ts`** holds the wire messages' types.
- **`public/client.js`** is the whole client in one file: networking
  (reconnect, clock sync), the DOM screens, the three.js world and the local
  runner's physics. Each phone simulates its own runner, so controls answer
  at once, and streams its progress; remote runners are smoothed.
- **`GAME-DESIGN.md`** records how the systems fit (stages, the fairness
  check, the economy, unlocks, packs, leagues, tournaments, modes) and the
  decisions taken where requests pulled in different directions. Update it in
  the same change as any rule it describes.
- `wrangler.jsonc` is for local dev and tests only; the Higgsfield deploy
  makes its own.

### 4 Friends Run (`lane-rush-lite/app/`)

It started as a copy of Lane Rush and keeps the same layout and server
(`package.json` and `scripts/build.mjs` are identical). `public/client.js`,
`index.html`, `style.css`, `src/logic.js` and the tests have diverged since.
A change meant for both games is made in both folders in one piece of work,
and named for both (see "Commits"). It has no `GAME-DESIGN.md` of its own.

### Tumble Royale (`tumble-royale/`)

- `shared/` is the deterministic simulation, run by the server and by the
  client's prediction.
- `server/` has a transport-agnostic `Room`, the Node entry (HTTP, WebSockets,
  SQLite profiles) and the Cloudflare Worker and Durable Object adapter
  (`server/cf/`).
- `client/` is the React UI and the three.js engine; `client/net/` does
  prediction, reconciliation and interpolation.
- The server is authoritative for movement, finishes and progression.
  Clients send inputs, never positions, results or rewards.
- Its `README.md` has the networking and graphics details, and `TESTING.md`
  the measured results.

## Commands

```bash
# INKFALL (repo root)
npm run dev                      # http://localhost:8080; prints the LAN URL for a phone
npm test                         # quick balance smoke + matchup table
npm run sim                      # full balance report
node tools/levels-test.mjs hard  # plays every campaign level and Endless headless
npm install && npm run assets    # only for the art pipeline (sharp)

# Lane Rush (lane-rush/app) and 4 Friends Run (lane-rush-lite/app); needs Bun
../fetch-assets.sh               # Lane Rush only, once after cloning: art + three.js
bun install
bun run build                    # check-logic, tsc, then bundle into dist/
bun run dev                      # http://localhost:8787 (wrangler); two tabs race each other
bun run test                     # rules + real-WebSocket tests
bun run typecheck

# Tumble Royale (tumble-royale)
npm install
npm run dev                      # game server :8080 + Vite client :5173
npm test                         # physics, room and network tests
npm run typecheck
npm run test:load                # load test with scripted clients
npm run test:e2e
npm run build && npm start       # production build on :8080
```

## Testing

- Each game tests with its own tools. INKFALL's are plain Node scripts in
  `tools/`, with no framework. Lane Rush's and Tumble Royale's are Vitest;
  Lane Rush's run through `@cloudflare/vitest-pool-workers`, so the room is a
  real Durable Object behind real WebSockets.
- A change to rules code comes with a test in that game's suite. A change
  that only draws or lays something out is checked by running the game in a
  browser at phone size (portrait for Lane Rush, landscape for INKFALL and
  Tumble Royale) and on desktop.
- Lane Rush's fairness check (`checkCourse`: from every lane a runner can be
  in after a row, there is a way through the next row in time) runs over
  1,200 generated courses. Never loosen it or its timings to make a pattern
  pass; widen the pattern's gap instead, as the generator does.
- INKFALL's balance comes from `npm run sim`. A change to units, costs or the
  AI reruns it and the levels test, and the plan says what moved.
- Never weaken, skip or delete a failing test to get a change through. A test
  that is itself wrong is fixed in a commit of its own.

## Compatibility rules

Players already have progress saved and invite links shared, so these must
not drift:

- **Saved progress.** INKFALL's save is one JSON object under
  `inkfall.save.v1`; Lane Rush's and 4 Friends Run's live in localStorage
  too, and Tumble Royale's profiles in SQLite (Node) or Durable Object storage
  (Cloudflare). Never rename a stored key or change what its value means. Add
  new keys alongside the old ones and read a missing key as its default. A
  new shape for an existing value means a new key, or a new INKFALL save
  version, plus code that reads the old one.
- **What players own stays owned.** Something bought or unlocked under old
  prices or rules stays owned, and a character taken out of the game refunds
  its owners once. `GAME-DESIGN.md` records each case.
- **The wire protocol.** A page loaded before a deploy keeps talking to the
  new server until it reloads. Change messages additively: new fields are
  optional, and nothing is renamed or removed while an older client could
  still send or expect it.
- **Determinism.** Every Lane Rush client builds the course from the seed
  with `logic.js`, and Tumble Royale's obstacles are pure functions of round
  time. Anything that feeds them stays deterministic and the same on server
  and client.
- **Links.** Invite links (`/?join=CODE` in Lane Rush, `/?room=CODE` in
  Tumble Royale) are out in the world; keep them working.

## Look and feel

- **Phones first.** INKFALL and Tumble Royale play in landscape and Lane Rush
  in portrait; each works with mouse and keyboard too. Respect the safe areas
  (`viewport-fit=cover`, `env(safe-area-inset-*)`), keep touch targets
  thumb-sized, and check a change at phone size before calling it done.
- Lane Rush's look is lime green and black (dark pages and sheets, lime
  banners), set in Barlow and Barlow Condensed; 4 Friends Run uses the same
  fonts.
- **Loading never just hangs.** Lane Rush's boot screen shows progress by
  bytes downloaded, any error, and a retry button if it stalls; INKFALL falls
  back to code-drawn art. Keep it that way.
- **Characters are invented.** No real people, and no team, national or brand
  marks (`GAME-DESIGN.md`'s decision on the sports and music characters).

## Workflow & conventions

### Plan first, then execute

Every task that will change the repo starts with a plan, and nothing changes
until the user approves it.

- **Propose before touching anything.** Read the code and the docs as much
  as the plan needs, but edit, create, move or delete no file, run no command
  that writes, and make no commit or merge first.
- **The plan names** what changes and where (files, rules functions and their
  tests, `GAME-DESIGN.md`, CLAUDE.md sections), how it will be checked (which
  test commands, which game to run in the browser and at what size), and
  **every commit, by its exact title** in the bracket-tag format below, in
  order, with the release-notes bullet that folds into the last one. It ends
  with the squash merge into `main`, its title and description, and the
  worktree's removal.
- **Execute only on a clear yes**, exactly as approved. Approval covers that
  plan and nothing else: a later task, or a follow-up the work turns up, gets
  a plan of its own.
- **Stop and re-plan** when the plan stops fitting: another file or commit, a
  different commit title, a test that fails for a reason the plan did not
  foresee, or a decision the plan left open. Say what changed and wait for
  approval again before going on.
- A question, an explanation or an investigation that ends with no change
  needs no plan.

### Branching

- **`main`** is the integration branch: every piece of work lands on it as
  one squash-merge commit. Never commit to it directly (the squash merges
  are the only commits made on it) and never force-push it. `main` started
  from `claude/inkfall-rts-game-c0g5po`, which is still GitHub's default
  branch; nothing new goes there.
- **One worktree per piece of work.** Every new feature, fix, request or
  investigation opens its own git worktree, on its own branch cut from
  `main`, in `.claude/worktrees/<name>` (the branch is `claude/<name>` unless
  the user names it). All of the work, and every commit, happens in that
  worktree; the main checkout stays on `main` and is not edited directly.
- If `main` moves while the work is in progress, merge `main` into the
  worktree's branch, never the other way round until the work is done.
- **When it is finished,** squash-merge the worktree's committed branch into
  `main` from the main checkout (`git merge --squash <branch>`, then
  `git commit`), so the whole piece of work lands on `main` as one commit
  whose message follows "Squash-merge commits" below. Then remove the
  worktree and delete its branch (`git worktree remove <path>`,
  `git branch -D <branch>`: a squashed branch never reads as merged, so `-d`
  refuses it; check the squash commit is on `main` first). An investigation
  that ends with nothing committed just removes its worktree. Never leave a
  finished worktree behind, and never merge one with uncommitted changes.
- **Pushing** to GitHub happens only when the user asks.

### Commits

Bracket-symbol tags, **not** Conventional Commits:

| Tag   | Meaning      |
|-------|--------------|
| `[+]` | added        |
| `[-]` | removed      |
| `[*]` | bug fix      |
| `[#]` | modification |

- **Title-only, single-line** messages — no body, no trailers
  (`Co-Authored-By` and the like). The squash-merge commit on `main` is the one
  exception (below).
- **Name the game** right after the tag, by its folder, when the change sits
  in one game: `[+] lane-rush: add a pause button`,
  `[*] inkfall: fix the pause button under the notch`. The same change made
  in both Lane Rush folders names both:
  `[#] lane-rush, lane-rush-lite: show a small place chip instead of the gold badge`.
  A change to the repo as a whole names none: `[+] add CLAUDE.md`.
- **One concern per commit.** A dependency or package bump gets its own commit.
- **Never squash unrelated changes** together. A squash merge folds one
  worktree's work, which is one piece of work, never two.
- Commits from before this file use plain sentences ("4 Friends Run: three
  home buttons ..."); history is never rewritten to match. The art-import
  workflow's commit (see "CI") is automated and keeps its own message.

#### Squash-merge commits

The commit a worktree's squash merge makes on `main` is the **only** commit
that may carry a description:

- **Title:** one line in the same bracket-tag style, summarizing everything
  the worktree did, not repeating one of its commits. Pick the tag for the
  work as a whole (`[+]` for a new feature, `[*]` for a fix, ...) and name
  the game as above. Example: `[+] lane-rush: add a weekly tournament`.
- **Description:** after a blank line, the commits made in the worktree, one
  `- ` line each, oldest first, with their titles exactly as written (merges
  of `main` into the branch left out).
- Still no trailers (`Co-Authored-By` and the like) in it.

```text
[+] lane-rush: add a weekly tournament

- [+] lane-rush: add the weekly tournament's rules and prizes
- [+] lane-rush: add the weekly tournament card to the Tournaments page
- [*] lane-rush: pay a weekly prize only once per week
```

### Release notes

In the **last commit of every task**, append to `docs/RELEASE_NOTES.md` under
`## Unreleased` (create the heading if missing), one bullet per logical change,
each starting with the game as its commit names it. Fold it into that last
commit — never a separate release-notes commit.

### Versioning

INKFALL and Tumble Royale carry `1.0.0` in their `package.json`; Lane Rush
and 4 Friends Run have no version yet, and no game has had a numbered
release. When a game first ships to an app store, it starts at **1.0.0
(build 1)**, semver from there, with its version and build number kept in one
file, which this section then names. INKFALL's service worker `VERSION` is a
cache name, not a release version (see "Gotchas").

### Distribution

- Lane Rush, 4 Friends Run and Tumble Royale run on **Higgsfield's game
  hosting** (a Cloudflare Worker with Durable Objects per game). Lane Rush's
  live copy is deployed from Higgsfield's copy of the code, which
  `lane-rush/` mirrors: a commit here is not live until it is deployed
  there, and the two are kept in step.
- **Never deploy without the user asking.** A deploy publishes to every
  player at once.
- Tumble Royale can also run on Docker, Fly.io, Render or a Cloudflare account
  of the user's own (its README).
- INKFALL is static files for any static host; offline play through `sw.js`
  needs HTTPS.
- No game is in the App Store or Google Play yet.

### Dependencies

- No new third-party package, runtime or dev, without an explicit plan.
- INKFALL has no runtime dependencies and no build step; `sharp` is dev-only,
  for the asset pipeline. Keep it so.
- Lane Rush's client has no build step and no npm packages: three.js
  (0.160.0) and its loaders are downloaded into `public/vendor/` by
  `fetch-assets.sh` and reached through the import map in `index.html`. Its
  dev tools are pinned exactly in `package.json`, and `bunfig.toml` refuses
  any package version published less than a day ago, a supply-chain guard
  that stays.

### Formatting & lint

No formatter or linter is configured. Match the file you are in: 2-space
indent everywhere, single quotes in INKFALL and Tumble Royale, double quotes
in Lane Rush and 4 Friends Run. Their TypeScript is strict and `tsc --noEmit`
must pass (Lane Rush's `bun run build` runs it). Comments say why, in the
plain style of the code around them. Don't reformat code you are not
changing.

### CI

`.github/workflows/import-art.yml` is the only workflow. A push that changes
`tools/art-bundle.url` (`<url> <sha256>`) downloads that zip, checks its
checksum, extracts only `assets/` and `icons/`, and commits them back to the
same branch as github-actions[bot]. Nothing runs the tests on a push or pull
request, so run the affected game's tests locally before every commit.

## Repo snapshot zip (`.claude_zip`)

`./.claude_zip` packs the repo into `../stickman_claude.zip`, a lightweight
copy with the source, docs, tracked art and `.git` history but none of the
heavy or generated data. The script is git-ignored, so it exists only in the
local checkout.

- It zips exactly what git sees: tracked files, untracked files that are not
  git-ignored, and `.git`. So everything in a `.gitignore` stays out:
  `node_modules/`, `dist/`, `.wrangler/`, Lane Rush's downloaded
  `public/assets/` and `public/vendor/`, Tumble Royale's `data/` and
  `test-results/`, `.DS_Store` and the script itself. INKFALL's tracked art
  (`assets/`, `icons/`) goes in.
- **Keep it current.** When a change adds heavy, generated or secret data (a
  new build or dependency directory, downloaded art, caches, a secrets file),
  git-ignore it. That keeps it out of the zip too. If something must stay
  tracked in git but out of the zip, add an explicit exclusion to
  `.claude_zip` and note it here.
- If the zip's location, name or contents rule changes, update this section in
  the same change.

## Gotchas

- **ES modules need `http://`.** Opening `index.html` from `file://` fails;
  use `npm run dev` or any static server.
- **Service workers need HTTPS or `localhost`.** On a phone over Wi-Fi,
  INKFALL's offline play only works through an HTTPS tunnel or a deploy.
- **INKFALL's precache list.** `SHELL` in `sw.js` names every code file, and
  `cache.addAll` fails the whole install if one is missing. A renamed or
  removed file leaves `SHELL` in the same change, and a new module joins it,
  or the offline game breaks. Change `VERSION` whenever `SHELL` or `OPTIONAL`
  changes, so old caches are dropped.
- **Lane Rush's art is not in git.** `fetch-assets.sh` downloads a fixed list
  of files from the live site, so a fresh clone gets what is deployed, not
  what this checkout uses. A new asset the client loads joins that list in
  the same change. 4 Friends Run has no fetch script of its own, and its
  `.gitignore` does not exclude `public/assets/` or `public/vendor/`, so
  never commit downloaded art there.
- **Durable Object hibernation.** `room.ts` accepts sockets with
  `ctx.acceptWebSocket`, so the room can be evicted while connections stay
  open. Instance fields do not survive that: everything lives in
  `ctx.storage`, and a connection's id rides on the socket
  (`serializeAttachment`).
- **The `Room` export.** A Durable Object class must be exported from the
  Worker's entry module (`worker.ts`), or it does not ship and the deploy
  fails.
- **Test hooks on localhost.** `public/client.js` exposes `window.__laneRush`
  (scene, runner, race state) to the automated play-tests whenever the
  hostname is `localhost` or `127.0.0.1`, so any page served from there gets
  them.
- **Two tabs are one player** in Tumble Royale: the profile token is in
  localStorage, and the second tab takes over the seat. Use a private window,
  another browser, or `?guest`.
- **Bun's day-old rule.** `bun install` refuses a version published less than
  24 hours ago (`bunfig.toml`). Pick an older version rather than removing
  the guard.
- **Old names.** Lane Rush's `package.json` is named `higgsfield-game`, and
  "Brain Run" still stands in its docs and comments. Don't rename them in
  passing; a rename is a planned change of its own.
