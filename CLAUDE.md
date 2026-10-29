# CLAUDE.md

Guidance for AI assistants (and humans) working in this repo. Read it in full
before every session; it governs every change.

## What is in this repo

Five games, built for phones first (the iPhone in particular) and playable
with mouse and keyboard on desktop. **Each game lives in its own top-level
folder, and everything that belongs to a game lives inside that folder**: its
code, art, tools, tests, docs, deploy configs and app wrappers. The games share
no code. The repo root holds only what is about the repo as a whole:
`CLAUDE.md`, `README.md`, `docs/`, `.gitignore` and `.github/`.

| Game | Folder | What it is | Built with | Live at |
|---|---|---|---|---|
| **INKFALL** | `inkfall/` | side-scrolling stick-figure RTS, landscape | Canvas 2D, vanilla JS modules, no build step, installable PWA | static files, no deploy recorded |
| **Lane Rush** ("4 Friends") | `lane-rush/` | cartoon 4-player running race, portrait | three.js client with no build step, Cloudflare Worker with one Durable Object per lobby | lane-rush-party.higgsfield.app |
| **4 Friends Run** | `lane-rush-lite/` | a simpler copy of Lane Rush: Multiplayer or Endless Run, pick a runner, play; no coins, packs, levels, pass, missions or tournaments | same as Lane Rush | four-friends-run.higgsfield.app |
| **Tumble Royale** | `tumble-royale/` | 3D obstacle-course party game for up to 30 players, landscape | TypeScript, React UI and three.js (Vite), authoritative server on Node or Cloudflare | tumble-royale.higgsfield.app |
| **JJ in Los Angeles** | `jj-la/` | top-down open-world game (GTA 2 style), landscape, German and English | one built `index.html` assembled from `src/` by `build.cjs`, no dependencies, PWA | Netlify (publish directory `jj-la`) |

Inside a game's folder:

- `inkfall/`: `index.html`, `css/`, `src/`, `sw.js`, `manifest.webmanifest`,
  the tracked art in `assets/` and `icons/`, and `tools/` (dev server, asset
  pipeline, headless tests). Its `README.md` has the full layout.
- `lane-rush/`: `app/` is the website and server, `claude-page/` is Lane Rush
  as a Claude artifact (live lobbies over the artifact `room` capability, plus
  solo practice, with the scripts that turn the Higgsfield models into glTF
  JSON), `mobile/` is the **iOS app** (Capacitor) for TestFlight, `art/` holds
  reference pictures, and `fetch-assets.sh` downloads the art that is not in
  git.
- `lane-rush-lite/`: `app/` only, laid out like `lane-rush/app/`.
- `tumble-royale/`: `shared/`, `server/`, `client/`, `tests/`, `scripts/`,
  `public/`, and the deploy files (Dockerfile, fly.toml, render.yaml,
  wrangler.jsonc).
- `jj-la/`: the game (`src/`, `build.cjs`, the built `index.html`, `sw.js`,
  its pictures and sounds, `tests/`), its own `CLAUDE.md` (in German, written
  for that game: read it before touching it), and `mobile/`, the **iOS app**
  (Capacitor) with the step-by-step TestFlight guides.

Lane Rush was called **Brain Run** for a while, and `GAME-DESIGN.md`,
`src/logic.js` and `src/room.ts` still say so; players see "4 Friends". The
folder names stay as they are, and commits name a game by its folder (see
"Commits").

All the art is generated on **Higgsfield** (concept images, image-to-3D meshes
with auto-rigged animations, music) or **Artlist** (some Lane Rush models).
INKFALL's processed art is tracked in `inkfall/assets/` and `inkfall/icons/`.
Lane Rush's is not in git at all: it is downloaded from the live site
(`lane-rush/fetch-assets.sh`). JJ in Los Angeles's sprite sheets and sounds
are tracked next to its `index.html`.

### Adding or moving a project

A new game gets a new top-level folder with its own README and, if it has
one, its own `CLAUDE.md`. A new piece of an existing game (an app wrapper, a
second client, a tool) goes inside that game's folder, never at the root or in
a folder of its own. Anything at the root that is about one game is in the
wrong place. When something moves, every path that pointed at it moves in the
same change: scripts, workflows, READMEs, this file.

## Architecture

**The rule: everything that decides an outcome lives in the game's pure,
DOM-free rules code and is tested there. Clients draw, take input and report;
they never decide who won.**

- INKFALL: `inkfall/src/game/` (world, units, teams, AI, levels). It has no DOM
  dependency, so the balance and level tests run it headless in Node.
  Tunable numbers live in `inkfall/src/config.js`, not in the simulation.
- Lane Rush and 4 Friends Run: `app/src/logic.js`.
- Tumble Royale: `shared/` (physics, protocol, match, maps), run by the
  server and by the client's prediction alike.
- JJ in Los Angeles is single-player and has no server; its rules live in
  `jj-la/src/game/`, which is one global scope (see its `CLAUDE.md`).

If you catch yourself writing a game rule, a score or a random draw in
rendering or UI code, move it into the rules code first.

Lane Rush's progression is the exception today: coins, packs, characters,
missions, the Season Pass and leagues are worked out in `public/client.js` and
saved in the browser's localStorage. `GAME-DESIGN.md` is their spec.

### INKFALL (`inkfall/`)

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
- `tools/serve.mjs`, `tools/build-assets.mjs`, `tools/sim.mjs` and
  `tools/levels-test.mjs` resolve paths from their own location, so they work
  from any current directory.
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

### Lane Rush on iOS (`lane-rush/mobile/`)

- The game is not copied here. `scripts/build-web.mjs` makes `www/` from
  `../app` (`public/` and `src/logic.js`) at every build, and
  `npx cap sync` copies `www/` into `ios/App/App/public/`. Both are
  generated and git-ignored: a change to the game is made in `lane-rush/app`,
  and reaches the app only through `npm run sync` and a new upload.
- `native/native.js`, which the build loads before the game, holds the app's
  differences from the website: the lobby socket goes to the server instead
  of the app itself, invite links point to the website and open the iOS share
  sheet, and vibration becomes haptics. It calls the native plugins through
  the bridge Capacitor injects (`Capacitor.nativePromise`), so the game needs
  no bundler. The server address is its two constants, `SITE` and `SERVER`.
- `ios/` is the Xcode project from Capacitor 8 (Swift Package Manager, no
  CocoaPods): bundle id `com.masprime77.lanerush`, the name "4 Friends", team
  `GPR2C9QVS4`, iPhone only, portrait.

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

### JJ in Los Angeles (`jj-la/`)

- `jj-la/CLAUDE.md` is the game's own guide (in German) and wins inside that
  folder: how the single `index.html` is assembled from `src/` by
  `build.cjs`, the world layout, missions, the Playwright tests, and the
  owner's working preferences for that game.
- **Never edit `jj-la/index.html` by hand.** Change `src/`, run
  `node build.cjs`, and commit the rebuilt `index.html` with the change
  (`node build.cjs --check` tells whether it is current). Bump the cache
  version in `sw.js` (`jjla-vNN`) with every change players should see.
- `mobile/` is the Capacitor iOS app: `copy-web.cjs` copies the built game
  from the parent folder into `www/`, and `npx cap sync` puts it in
  `ios/App/App/public/`, which **is** tracked here (unlike Lane Rush's), so
  only Xcode is needed on a Mac. `.github/workflows/ios-testflight.yml` builds
  and uploads it from GitHub Actions when `jj-la/mobile/` changes on `main`
  and the Apple secrets are set (its guides: `ANLEITUNG-TESTFLIGHT.md`,
  `ANLEITUNG-OHNE-MAC.md`).

## Commands

```bash
# INKFALL
cd inkfall
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

# Lane Rush on iOS (lane-rush/mobile); needs Xcode
npm install
npm run assets                   # once: Lane Rush's art + three.js (../fetch-assets.sh)
npm run sync                     # build www/ from ../app and copy it into ios/
npm run open                     # Xcode: ⌘R to run, Product ▸ Archive for TestFlight

# JJ in Los Angeles (jj-la)
node build.cjs                   # rebuild index.html from src/
node build.cjs --check           # is index.html current? (exit 1 if not)
cd tests && npm i playwright && npx playwright install chromium && node err.js   # see jj-la/CLAUDE.md
cd mobile && npm install && npm run sync   # refresh the iOS app's bundled game
```

## Testing

- Each game tests with its own tools. INKFALL's are plain Node scripts in
  `inkfall/tools/`, with no framework. Lane Rush's and Tumble Royale's are
  Vitest; Lane Rush's run through `@cloudflare/vitest-pool-workers`, so the
  room is a real Durable Object behind real WebSockets. JJ in Los Angeles's
  are Playwright scripts in `jj-la/tests/` that play the game headless.
- A change to rules code comes with a test in that game's suite. A change
  that only draws or lays something out is checked by running the game in a
  browser at phone size (portrait for Lane Rush, landscape for INKFALL,
  Tumble Royale and JJ in Los Angeles) and on desktop.
- Lane Rush's fairness check (`checkCourse`: from every lane a runner can be
  in after a row, there is a way through the next row in time) runs over
  1,200 generated courses. Never loosen it or its timings to make a pattern
  pass; widen the pattern's gap instead, as the generator does.
- INKFALL's balance comes from `npm run sim`. A change to units, costs or the
  AI reruns it and the levels test, and the plan says what moved.
- The iOS apps are checked in an iOS 26.5 iPhone Simulator: the game loads,
  a run starts, and (Lane Rush) a lobby made in the app can be joined from
  the website.
- Never weaken, skip or delete a failing test to get a change through. A test
  that is itself wrong is fixed in a commit of its own.

## Compatibility rules

Players already have progress saved and invite links shared, so these must
not drift:

- **Saved progress.** INKFALL's save is one JSON object under
  `inkfall.save.v1`; Lane Rush's, 4 Friends Run's and JJ in Los Angeles's
  live in localStorage too, and Tumble Royale's profiles in SQLite (Node) or
  Durable Object storage (Cloudflare). Never rename a stored key or change
  what its value means. Add new keys alongside the old ones and read a missing
  key as its default. A new shape for an existing value means a new key, or a
  new INKFALL save version, plus code that reads the old one.
- **What players own stays owned.** Something bought or unlocked under old
  prices or rules stays owned, and a character taken out of the game refunds
  its owners once. `GAME-DESIGN.md` records each case.
- **The wire protocol.** A page loaded before a deploy keeps talking to the
  new server until it reloads, and an iOS build keeps the client it was built
  with until the next upload is installed. Change messages additively: new
  fields are optional, and nothing is renamed or removed while an older client
  could still send or expect it.
- **Determinism.** Every Lane Rush client builds the course from the seed
  with `logic.js`, and Tumble Royale's obstacles are pure functions of round
  time. Anything that feeds them stays deterministic and the same on server
  and client.
- **Links.** Invite links (`/?join=CODE` in Lane Rush, `/?room=CODE` in
  Tumble Royale) are out in the world; keep them working.

## Look and feel

- **Phones first.** INKFALL, Tumble Royale and JJ in Los Angeles play in
  landscape and Lane Rush in portrait; each works with mouse and keyboard
  too. Respect the safe areas (`viewport-fit=cover`,
  `env(safe-area-inset-*)`), keep touch targets thumb-sized, and check a
  change at phone size before calling it done.
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
  with the branch's merge into `develop`, its title and description.
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

Three kinds of branch, and work only ever flows upward:

```text
feature branch  ──merge──▶  develop  ──merge──▶  main
(one per piece of work)     (integration)        (stable, what is released)
```

- **Every piece of work gets its own branch.** Every new feature, fix,
  request or investigation starts on a fresh branch cut from `develop`, named
  for the work (`claude/<name>` when Claude Code creates it, otherwise
  `<name>`; the user may name it). All of the work, and every commit, happens
  on that branch. Nothing is ever committed straight to `develop` or `main`.
- **When it is finished, it is merged into `develop`**, never into `main`.
  Open a pull request against `develop` on GitHub, or, when working locally
  and the user asks, squash-merge it from a `develop` checkout
  (`git merge --squash <branch>`, then `git commit`), so the piece of work
  lands as one commit whose message follows "Squash-merge commits" below.
  Then delete the branch (`git branch -D <branch>`: a squashed branch never
  reads as merged, so `-d` refuses it; check the squash commit is on
  `develop` first). An investigation that ends with nothing committed just
  deletes its branch. Never merge a branch with uncommitted changes.
- **`develop` is the integration branch.** It is where finished work meets
  and is tried together. It moves only through merges of finished branches.
- **`main` is the stable branch**: what is released and what players get.
  It moves only by merging `develop` into it, when the user asks for a
  release. Never commit to it directly and never force-push it.
- **If `develop` moves while the work is in progress**, merge `develop` into
  the work's branch (never the other way round until the work is done), fix
  any conflict there, and run the affected game's tests again.
- **Claude Code works in a worktree.** Each piece of work opens its own git
  worktree for its branch, in `.claude/worktrees/<name>` (git-ignored), so
  the main checkout stays on `develop` and is not edited directly. Remove the
  worktree when the branch is merged (`git worktree remove <path>`); never
  leave a finished one behind.
- **Pushing** to GitHub happens only when the user asks, and only the work's
  own branch is pushed (`git push -u origin <branch>`); `develop` and `main`
  move on GitHub through merged pull requests.
- GitHub's default branch should be `main` (it was
  `claude/inkfall-rts-game-c0g5po`, which `main` grew out of; nothing new
  goes to that branch or to any other old `claude/...` branch).

### Commits

Bracket-symbol tags, **not** Conventional Commits:

| Tag   | Meaning      |
|-------|--------------|
| `[+]` | added        |
| `[-]` | removed      |
| `[*]` | bug fix      |
| `[#]` | modification |

- **Title-only, single-line** messages — no body, no trailers
  (`Co-Authored-By` and the like). The squash-merge commit on `develop` is
  the one exception (below).
- **Name the game** right after the tag, by its folder, when the change sits
  in one game: `[+] lane-rush: add a pause button`,
  `[*] inkfall: fix the pause button under the notch`,
  `[#] jj-la: slower police at one star`. A piece of a game names the game,
  not the piece: `[*] lane-rush: haptics in the iOS app`. The same change
  made in both Lane Rush folders names both:
  `[#] lane-rush, lane-rush-lite: show a small place chip instead of the gold badge`.
  A change to the repo as a whole names none: `[+] add CLAUDE.md`.
- **One concern per commit.** A dependency or package bump gets its own commit.
- **Never squash unrelated changes** together. A squash merge folds one
  branch's work, which is one piece of work, never two.
- Commits from before this file use plain sentences ("4 Friends Run: three
  home buttons ..."); history is never rewritten to match. The art-import
  workflow's commit (see "CI") is automated and keeps its own message.

#### Squash-merge commits

The commit a branch's squash merge makes on `develop` is the **only** commit
that may carry a description:

- **Title:** one line in the same bracket-tag style, summarizing everything
  the branch did, not repeating one of its commits. Pick the tag for the
  work as a whole (`[+]` for a new feature, `[*]` for a fix, ...) and name
  the game as above. Example: `[+] lane-rush: add a weekly tournament`.
- **Description:** after a blank line, the commits made on the branch, one
  `- ` line each, oldest first, with their titles exactly as written (merges
  of `develop` into the branch left out).
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
commit — never a separate release-notes commit. When `develop` is merged into
`main` for a release, the `## Unreleased` bullets move under a heading for
that release.

### Versioning

INKFALL and Tumble Royale carry `1.0.0` in their `package.json`; the Lane
Rush website and 4 Friends Run have no version, and no game has had a numbered
release. A game that ships as an app starts at **1.0.0 (build 1)**, semver
from there, with its version and build number kept in one file. Lane Rush's
iOS app is 1.0.0 (build 1): `MARKETING_VERSION` and
`CURRENT_PROJECT_VERSION` of the App target in
`lane-rush/mobile/ios/App/App.xcodeproj/project.pbxproj`. JJ in Los
Angeles's iOS app takes its build number from the GitHub Actions run when the
workflow builds it, and from `CURRENT_PROJECT_VERSION` in
`jj-la/mobile/ios/App/App.xcodeproj/project.pbxproj` when built in Xcode.
Every TestFlight upload needs a higher build number. INKFALL's service worker
`VERSION` and JJ in Los Angeles's `jjla-vNN` are cache names, not release
versions (see "Gotchas").

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
- JJ in Los Angeles is static files too, published from `main` by Netlify
  with `jj-la` as the publish directory (`jj-la/mobile/ANLEITUNG-OHNE-MAC.md`,
  part A).
- The iOS apps go to TestFlight for testing (`lane-rush/mobile/README.md`,
  `jj-la/mobile/ANLEITUNG-*.md`); no game is in the App Store or Google Play
  yet. Uploading Lane Rush is the user's step, from Xcode with their Apple
  account; JJ in Los Angeles can be uploaded by the GitHub Actions workflow
  once its secrets are set.

### Dependencies

- No new third-party package, runtime or dev, without an explicit plan.
- INKFALL has no runtime dependencies and no build step; `sharp` is dev-only,
  for the asset pipeline. Keep it so. JJ in Los Angeles has none at all
  (`build.cjs` is plain Node; Playwright is installed only inside `tests/`).
- Lane Rush's client has no build step and no npm packages: three.js
  (0.160.0) and its loaders are downloaded into `public/vendor/` by
  `fetch-assets.sh` and reached through the import map in `index.html`. Its
  dev tools are pinned exactly in `package.json`, and `bunfig.toml` refuses
  any package version published less than a day ago, a supply-chain guard
  that stays.
- The iOS apps' Capacitor packages are pinned in their `package.json` files
  (exactly in Lane Rush's), and Capacitor's Swift package in
  `Package.resolved`; they move together, in a commit of their own.

### Formatting & lint

No formatter or linter is configured. Match the file you are in: 2-space
indent everywhere, single quotes in INKFALL and Tumble Royale, double quotes
in Lane Rush, 4 Friends Run and JJ in Los Angeles. Their TypeScript is strict
and `tsc --noEmit` must pass (Lane Rush's `bun run build` runs it). Comments
say why, in the plain style of the code around them (German in `jj-la/`).
Don't reformat code you are not changing.

### CI

Two workflows, both in `.github/workflows/` (GitHub only reads them there, so
they are the one game-specific thing outside a game's folder):

- `import-art.yml` (INKFALL): a push that changes
  `inkfall/tools/art-bundle.url` (`<url> <sha256>`) downloads that zip,
  checks its checksum, extracts only `assets/` and `icons/` into `inkfall/`,
  and commits them back to the same branch as github-actions[bot].
- `ios-testflight.yml` (JJ in Los Angeles): a push to `main` that changes
  `jj-la/mobile/` archives the iOS app on a macOS runner and uploads it to
  TestFlight, if the Apple secrets are set; without them it ends with a
  notice and no error. It can also be started by hand (workflow_dispatch).

Nothing runs the tests on a push or pull request, so run the affected game's
tests locally before every commit.

## Repo snapshot zip (`.claude_zip`)

`./.claude_zip` packs the repo into `../stickman_claude.zip`, a lightweight
copy with the source, docs, tracked art and `.git` history but none of the
heavy or generated data. The script is git-ignored, so it exists only in the
local checkout.

- It zips exactly what git sees: tracked files, untracked files that are not
  git-ignored, and `.git`. So everything in a `.gitignore` stays out:
  `node_modules/`, `dist/`, `.wrangler/`, Lane Rush's downloaded
  `public/assets/` and `public/vendor/`, the iOS apps' `www/` and Lane Rush's
  `ios/App/App/public/`, Tumble Royale's `data/` and `test-results/`,
  `.DS_Store` and the script itself. INKFALL's tracked art
  (`inkfall/assets/`, `inkfall/icons/`) and JJ in Los Angeles's bundled app
  files go in.
- **Keep it current.** When a change adds heavy, generated or secret data (a
  new build or dependency directory, downloaded art, caches, a secrets file),
  git-ignore it. That keeps it out of the zip too. If something must stay
  tracked in git but out of the zip, add an explicit exclusion to
  `.claude_zip` and note it here.
- If the zip's location, name or contents rule changes, update this section in
  the same change.

## Gotchas

- **ES modules need `http://`.** Opening INKFALL's `index.html` from
  `file://` fails; use `npm run dev` or any static server.
- **Service workers need HTTPS or `localhost`.** On a phone over Wi-Fi,
  INKFALL's offline play only works through an HTTPS tunnel or a deploy.
- **INKFALL's precache list.** `SHELL` in `inkfall/sw.js` names every code
  file, and `cache.addAll` fails the whole install if one is missing. A
  renamed or removed file leaves `SHELL` in the same change, and a new module
  joins it, or the offline game breaks. Change `VERSION` whenever `SHELL` or
  `OPTIONAL` changes, so old caches are dropped. The paths in it are relative
  to `inkfall/`, so moving the folder does not touch them.
- **JJ in Los Angeles's `index.html` is generated.** Edit `src/`, rebuild,
  commit both. Bump `jjla-vNN` in `sw.js` or phones keep the old version.
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
  them, the iOS app (`capacitor://localhost`) included.
- **The iOS Simulator.** In a new iOS 27.0 iPhone Simulator the Lane Rush
  app's page never finished loading, and Safari there hung too; an iOS 26.5
  iPhone runs it. The share sheet opens blank in the Simulator, so check
  invites on a phone.
- **Two tabs are one player** in Tumble Royale: the profile token is in
  localStorage, and the second tab takes over the seat. Use a private window,
  another browser, or `?guest`.
- **Bun's day-old rule.** `bun install` refuses a version published less than
  24 hours ago (`bunfig.toml`). Pick an older version rather than removing
  the guard.
- **Old names.** Lane Rush's `package.json` is named `higgsfield-game`, the
  iOS apps' are `lane-rush-mobile` and `jj-la-ios` (their old folder names),
  and "Brain Run" still stands in Lane Rush's docs and comments. Don't rename
  them in passing; a rename is a planned change of its own.
