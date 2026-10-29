#!/usr/bin/env bash
# Download the INKFALL concept art (generated on Higgsfield) into assets/concept/,
# then run the optimizer. Usage: bash tools/fetch-assets.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/concept
while read -r name url; do
  [ -z "$name" ] && continue
  echo "↓ $name.png"
  curl -fsSL -o "assets/concept/$name.png" "$url"
done < tools/asset-sources.txt
node tools/build-assets.mjs
