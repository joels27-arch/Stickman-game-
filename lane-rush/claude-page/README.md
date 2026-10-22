# Lane Rush: play inside Claude

A single-player version of Lane Rush: you race the other three runners as computer opponents. It's published as a Claude artifact.

- `index.html`: the page. It uses the real Higgsfield 3D models, loaded as glTF `.json` files from `assets/`.
- `build_models.sh` + `merge_clips.py`: download the Higgsfield generations, merge each runner's run, jump, slide, idle and cheer clips into one model, and shrink textures. Claude artifacts don't serve `.glb`, so each model is then converted to glTF JSON with its buffer embedded (`npx @gltf-transform/cli copy`, then the buffer is inlined as a data URI).
