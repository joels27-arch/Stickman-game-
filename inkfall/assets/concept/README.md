# Concept art

Put the Higgsfield concept images here (or run `bash tools/fetch-assets.sh`):

| File | Used for |
|---|---|
| `monument_blue.png`, `monument_red.png` | Player / enemy bases (background removed automatically) |
| `bg_grassland.png` | Grassland battlefield |
| `bg_biomes.png` | 2×2 sheet: desert, snow, volcano, night |
| `icon.png` | PWA / home-screen icon |
| `digger.png`, `blade.png`, `bowman.png`, `shieldbearer.png`, `inkcaster.png`, `shadow.png`, `colossus.png` | Style reference only — units are drawn in code |

Then run `npm run assets` to generate the optimized files in `assets/game/` and `icons/`.
