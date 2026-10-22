#!/usr/bin/env bash
# Downloads the game's art (Higgsfield-generated 3D models + textures) from the
# live game, and three.js from jsDelivr, into app/public/. Run once after cloning.
set -euo pipefail
cd "$(dirname "$0")/app/public"
SITE="https://lane-rush-party.higgsfield.app"
THREE="https://cdn.jsdelivr.net/npm/three@0.160.0"
mkdir -p assets vendor/jsm/loaders vendor/jsm/utils
for f in c0.glb c1b.glb c2.glb c3.glb hurdle.glb gate.glb crate.glb ground.glb tree_oak.glb tree_pine.glb tree_blossom.glb bush.glb rocks.glb fence.glb cloud.glb c4.glb c5.glb c6.glb c7.glb \
         grass.jpg sky_pano.jpg cover.jpg icon.png pp0.webp pp1.webp pp2.webp pp3.webp pp4.webp pp5.webp pp6.webp pp7.webp medal_gold.png medal_silver.png medal_bronze.png; do
  echo "assets/$f"
  curl -fsSL -o "assets/$f" "$SITE/assets/$f"
done
curl -fsSL -o vendor/three.module.js "$THREE/build/three.module.min.js"
curl -fsSL -o vendor/jsm/loaders/GLTFLoader.js "$THREE/examples/jsm/loaders/GLTFLoader.js"
curl -fsSL -o vendor/jsm/utils/BufferGeometryUtils.js "$THREE/examples/jsm/utils/BufferGeometryUtils.js"
curl -fsSL -o vendor/jsm/utils/SkeletonUtils.js "$THREE/examples/jsm/utils/SkeletonUtils.js"
echo "done"
