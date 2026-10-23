#!/usr/bin/env bash
# Downloads the game's art (Higgsfield-generated 3D models + textures) from the
# live game, and three.js from jsDelivr, into app/public/. Run once after cloning.
set -euo pipefail
cd "$(dirname "$0")/app/public"
SITE="https://lane-rush-party.higgsfield.app"
THREE="https://cdn.jsdelivr.net/npm/three@0.160.0"
mkdir -p assets vendor/jsm/loaders vendor/jsm/utils
for f in c0.glb c1b.glb c2.glb c3.glb hurdle2.glb hay.glb barrel.glb banana.glb bowling_ball.glb barn.glb windmill.glb wheat.glb tractor.glb sunflowers.glb farm_tile.glb palm.glb hut.glb lighthouse.glb umbrella.glb board_tile.glb boost_pad.glb gate_start.glb gate_finish.glb gate2.glb arch.glb crates.glb cow.glb tires.glb box.glb ground.glb tree_oak.glb tree_pine.glb tree_blossom.glb bush.glb rocks.glb fence.glb cloud.glb c4.glb c5.glb c6.glb c7.glb \
         grass.jpg sky_pano.jpg cover.jpg icon.png pp0.webp pp1.webp pp2.webp pp3.webp pp4.webp pp5.webp pp6.webp pp7.webp medal_gold.png medal_silver.png medal_bronze.png pw_shield.png pw_rocket.png pw_ghost.png pw_lightning.png pw_banana.png pw_bowling.png pw_freeze.png sc_luna.webp sc_toto.webp sc_blaze.webp sc_zara.webp sc_jax.webp sc_leo.webp sc_kai.webp sc_momo.webp sc_zed.webp sc_aria.webp map_meadow.webp map_farm.webp map_beach.webp map_city.webp map_stadium.webp map_space.webp ct_road.glb ct_tower.glb ct_shop.glb ct_lamp.glb ct_taxi.glb ct_pigeon.glb st_pitch.glb st_stand.glb st_light.glb st_ball.glb st_cam.glb sp_walk.glb sp_dome.glb sp_rocket.glb sp_dish.glb sp_asteroid.glb sp_ufo.glb rd_ace.webp rd_titan.webp rd_aurum.webp full_c0.webp full_c1b.webp full_c2.webp full_c3.webp full_c4.webp full_c5.webp full_c6.webp full_c7.webp home_wide.jpg home_tall.jpg lobby_wide.jpg lobby_tall.jpg ui_c1.webp ui_c2.webp ui_c3.webp ui_chest.webp ui_box.webp ui_flame.webp ui_watch.webp ui_shoe.webp ui_star.webp lg_bronze.webp lg_silver.webp lg_gold.webp lg_platinum.webp lg_diamond.webp lg_master.webp pw_brainwave.png pw_swap.png pw_thunder.png pw_glue.png pw_boxing.png pw_fake.png brain.glb bomb.glb mlog.glb tractor.glb chicken.glb crab.glb pk_brainstorm.webp pk_brainz.webp pk_frosty.webp pk_ra.webp pk_fin.webp pk_mo.webp pack_brain.webp pack_mega.webp tab_trophy.webp tab_play.webp tab_skins.webp tab_missions.webp sc_porky.webp sc_foxy.webp sc_pandu.webp sc_sharky.webp sc_unitx.webp sc_hoops.webp sc_striker.webp pk_zorp.webp pk_glorb.webp pk_rapstar.webp pk_magic.webp pk_dancer.webp tab_shop.webp sfx_tap.mp3 sfx_coin.mp3 sfx_unlock.mp3 sfx_boom.mp3 sfx_whoosh.mp3 sfx_cheer.mp3 sfx_slip.mp3 sfx_thunder.mp3 sfx_pack.mp3 sfx_bonk.mp3 music_menu.mp3 music_race1.mp3 music_race2.mp3 music_race3.mp3; do
  echo "assets/$f"
  curl -fsSL -o "assets/$f" "$SITE/assets/$f"
done
curl -fsSL -o vendor/three.module.js "$THREE/build/three.module.min.js"
curl -fsSL -o vendor/jsm/loaders/GLTFLoader.js "$THREE/examples/jsm/loaders/GLTFLoader.js"
curl -fsSL -o vendor/jsm/utils/BufferGeometryUtils.js "$THREE/examples/jsm/utils/BufferGeometryUtils.js"
curl -fsSL -o vendor/jsm/utils/SkeletonUtils.js "$THREE/examples/jsm/utils/SkeletonUtils.js"
echo "done"
