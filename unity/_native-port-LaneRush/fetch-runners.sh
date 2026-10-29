#!/usr/bin/env bash
# Downloads the game's rigged 3D runners (the same .glb files the web game uses) into
# Assets/StreamingAssets/Runners. Run once after cloning; Unity picks them up on the next Play.
set -euo pipefail
cd "$(dirname "$0")/Assets/StreamingAssets/Runners"
SITE="https://lane-rush-party.higgsfield.app/assets"
for f in c0 c1b c2 c3 c4 c5 c6 c7 c8 c9 c10 c11 c12 c14 c15 c16 c17 c18 c19; do
  echo "↓ $f.glb"
  curl -fsSL -o "$f.glb" "$SITE/$f.glb"
done
echo "Done: $(ls *.glb | wc -l) runners."
