# usage: sync.sh <commit-sha> — copy the game's app files from GitHub into the Higgsfield website checkout
set -e
R=https://raw.githubusercontent.com/joels27-arch/stickman-game-/$1/lane-rush/app
A=/home/user/website-b79f182e045711a0471705ae/app
for f in src/app-meta.json src/logic.js src/room.ts src/worker.ts src/logic.d.ts public/index.html public/style.css public/packfx.css public/packfx.js public/client.js public/themes.js public/themes.d.ts public/nr/lane.js public/nr/shared.js public/nr/maps.js public/nr/maps2.js public/nr/maps3.js public/nr/sky.js public/nr/scenery.js public/nr/meshopt_decoder.js public/nr/pipeline.js public/nr/srkit.js tests/room.test.ts tests/state.test.ts tests/logic.test.ts; do
  curl -sf -o $A/$f "$R/$f" || { echo "FAIL $f"; exit 1; }
done
echo synced $1
