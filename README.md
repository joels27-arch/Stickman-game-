# Stickman games

Five browser games, built for phones first and playable on desktop. Each game
lives in its own folder with everything that belongs to it: code, art, tools,
tests, docs and app wrappers.

| Game | Folder | What it is |
|---|---|---|
| **INKFALL** | [`inkfall/`](inkfall/README.md) | side-scrolling stick-figure real-time strategy, landscape (Canvas 2D, no build step, PWA) |
| **Lane Rush** ("4 Friends") | [`lane-rush/`](lane-rush/README.md) | cartoon 4-player running race, portrait (three.js client, Cloudflare Worker server); `mobile/` is its iOS app, `claude-page/` the Claude-artifact version |
| **4 Friends Run** | `lane-rush-lite/` | a simpler copy of Lane Rush: Multiplayer or Endless Run, pick a runner, play |
| **Tumble Royale** | [`tumble-royale/`](tumble-royale/README.md) | 3D obstacle-course party game for up to 30 players, landscape (TypeScript, React, three.js, authoritative server) |
| **JJ in Los Angeles** | [`jj-la/`](jj-la/CLAUDE.md) | top-down open-world game in the GTA 2 style, landscape; `mobile/` is its iOS app |

Everything else at the root is about the repo as a whole: `CLAUDE.md` (the
rules for working here), `docs/RELEASE_NOTES.md`, `.github/workflows/`.

## Working in this repo

Read [`CLAUDE.md`](CLAUDE.md) first. In short:

- **Every piece of work gets its own branch**, cut from `develop`.
- **Finished work is merged into `develop`** (pull request or squash merge),
  never straight into `main`.
- **`main` is the stable branch.** It only moves by merging `develop` into it
  for a release.
- Nothing is ever committed directly to `develop` or `main`.

Each game's folder has its own README (or `CLAUDE.md` for JJ in Los Angeles)
with how to run and test it.
