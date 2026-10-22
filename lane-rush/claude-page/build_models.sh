#!/usr/bin/env bash
# Download the Higgsfield 3D generations and build the game's model files.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RAW="$HERE/raw"
OUT="$HERE/../lane-rush-play/assets"
mkdir -p "$RAW" "$OUT"
B=https://d8j0ntlcm91z4.cloudfront.net/user_3FJEfZAMS8m660R67XDr9qj7HsS
get() { [ -s "$RAW/$1.glb" ] || curl -fsSL -o "$RAW/$1.glb" "$B/$2.glb"; }

# runners: base (rigged + run) and four extra clips each
get c0_run hf_20261022_070643_5d267e9b-5dcc-4c02-9c3a-6ae620047b52
get c1_run hf_20261022_070645_c9c1970f-5c45-45b9-9b32-1bd6e6ac2efa
get c2_run hf_20261022_070647_998125fd-e614-47ae-8d92-5e5e33ae078c
get c3_run hf_20261022_070648_aebae902-1c3a-4695-bd6f-1a59fbd6906f
get c0_jump hf_20261022_071547_2cd3adb9-2460-4d12-afcc-9610ff411728
get c0_slide hf_20261022_071549_3ed2fc2b-d33d-467e-a772-ac280aa1fa69
get c0_idle hf_20261022_071550_d9143766-3e35-4e95-8fa2-d5c19a28b010
get c0_cheer hf_20261022_071552_6f586492-450e-480c-8119-eab361964138
get c1_jump hf_20261022_071553_970eb49e-0047-4b5f-9392-144a8be7832b
get c1_slide hf_20261022_071554_cfd4063a-204b-4492-8f84-8bf022a5a233
get c1_idle hf_20261022_071555_9c5541d1-981f-4510-95ed-f1d669917f91
get c1_cheer hf_20261022_071556_a649f17d-90c0-4b93-a30a-405c7ec750c7
get c2_jump hf_20261022_071557_30eb5ee9-ef8c-458a-9300-b97ceae71606
get c2_slide hf_20261022_071558_121d4254-a594-4cb6-a618-80663cf487d6
get c2_idle hf_20261022_071559_e4356f8f-b73a-476e-a1d3-f8f574ad2038
get c2_cheer hf_20261022_071601_8f4cdb00-a5ab-4e77-88f5-e30167e50380
get c3_jump hf_20261022_071602_7d733282-d29e-4664-83f2-ada8b145c32a
get c3_slide hf_20261022_071604_cedb68e1-a2de-49fd-9146-a50d1e4ae391
get c3_idle hf_20261022_071605_cf690038-a91b-4894-b65c-9caf6119d403
get c3_cheer hf_20261022_071605_afe5bdf5-1904-414c-88aa-aad21607d7da
# obstacles and scenery
get hurdle hf_20261022_070649_f1bcf13f-94bc-4a1d-b1f2-ab7bfbd8d7cd
get gate hf_20261022_070650_ca6abdc5-9a03-4c92-90a5-d2138bc23d26
get crate hf_20261022_070651_15068e55-ab92-4fbe-8c5e-e85387a642b1
get tree hf_20261022_070653_7d49beda-ffcc-4e72-b7ce-c87c5eb1c201

GT="npx -y @gltf-transform/cli@4"
for i in 0 1 2 3; do
  python3 "$HERE/merge_clips.py" "$RAW/c${i}_run.glb" "$RAW/c${i}_merged.glb" \
    Jump="$RAW/c${i}_jump.glb" Slide="$RAW/c${i}_slide.glb" Idle="$RAW/c${i}_idle.glb" Cheer="$RAW/c${i}_cheer.glb"
  $GT resize "$RAW/c${i}_merged.glb" "$OUT/c$i.glb" --width 1024 --height 1024
done
for p in hurdle gate crate tree; do
  $GT resize "$RAW/$p.glb" "$OUT/$p.glb" --width 1024 --height 1024
done
ls -la "$OUT"
