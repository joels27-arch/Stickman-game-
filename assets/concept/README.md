# Concept art

Put the Higgsfield concept images here (or run `bash tools/fetch-assets.sh`):

| File | Used for |
|---|---|
| `monument_blue.png`, `monument_red.png` | Player / enemy bases (background removed automatically) |
| `bg_grassland.png` | Grassland battlefield |
| `bg_biomes.png` | 2×2 sheet: desert, snow, volcano, night |
| `icon.png` | PWA / home-screen icon |
| `digger.jpg`, `blade.jpg`, `bowman.jpg`, `shieldbearer.jpg`, `inkcaster.jpg`, `shadow.jpg`, `colossus.jpg` | Style reference only (units are drawn in code), stored as JPG to keep the repo small |

Then run `npm run assets` to generate the optimized files in `assets/game/` and `icons/`.
