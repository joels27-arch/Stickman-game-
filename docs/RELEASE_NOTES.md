# Release Notes

## Unreleased

- Reorganized the repo into one folder per game: INKFALL moved from the root into `inkfall/`, Lane Rush's iOS app from `lane-rush-mobile/` into `lane-rush/mobile/`, and JJ in Los Angeles joined from its branch as `jj-la/` with its iOS app in `jj-la/mobile/`. The art-import and TestFlight workflows, the iOS build scripts and the guides follow the new paths.
- Branching: a `develop` integration branch; every piece of work on its own branch, merged into `develop`, and `main` moves only by merging `develop`. `CLAUDE.md` rewritten for the layout and the workflow, and a root `README.md` added that maps the games.
- lane-rush: the newer game work from the old default branch (buses, Artlist maps, Uranus, Medal Road, Starter Pack, retired maps and runners, the loading screen and the race camera) is now part of `main`'s history.
- Added `CLAUDE.md`: what each game is and how it is built, the commands, the testing and compatibility rules, the look and feel, and the workflow (plan first, one worktree per piece of work off `main`, squash-merged back into it, bracket-tag commits that name the game, release notes).
- Added this release-notes file, and git-ignored Claude Code's worktrees and the local `.claude_zip` helper.
- lane-rush-mobile: an iOS app of Lane Rush for a TestFlight test: the game bundled inside the app, playing on the live server, with share-sheet invites and haptics.
