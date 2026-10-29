# Lane Rush — Unity port

The web game (`lane-rush/`), step by step in Unity. **Step 1: the Endless Run.**

## Open and play

1. Install **Unity 6000.4.6f1** (Unity Hub → Installs).
2. Unity Hub → **Add** → pick this folder (`unity/LaneRush`). The first open takes a few minutes
   (it downloads glTFast, the package that loads the 3D runners).
3. Optional, for the real 3D runners: run `./fetch-runners.sh` once (it downloads the 19 runner
   models from the live game into `Assets/StreamingAssets/Runners`). Without them a simple
   stand-in figure runs.
4. Press **Play**. The game builds itself in any scene, even an empty one.

Controls: swipe ← → (lanes), ↑ (jump), ↓ (slide / drop down), tap the item button.
Keyboard: arrows or WASD, Space = jump, E = use item. In the editor a mouse drag is a swipe.

To build for a phone: File → Save the open scene as `Assets/Scenes/Main.unity`, add it in
File → Build Settings, switch the platform to iOS or Android, Build.

## What's in step 1

| | |
|---|---|
| Course | `Core/Course.cs`: the web game's course generator, ported 1:1. Same seed → the same course as the browser (checked with `Tools/check-course-parity.sh`). |
| Run | 4 lanes, jump, slide, buses with ramps and roofs, hurdles, crates, rolling barrels, boost and slow pads, mystery boxes, hearts, coin trails. Speed ramps up like the web game. |
| Items | Endless rules: shield and rocket only. You start with one. |
| Maps | The 12 maps' colours and a themed wall behind the start (`World/MapTheme.cs`, `World/World.cs`). |
| Runners | All 19 runners, loaded from the web game's .glb files with their animations. |
| Camera | All four lanes always in view (phones in portrait too). |
| UI | Menu (map, runner), HUD, game over. Simple for now (IMGUI). |

## Next steps

2. Real UI (uGUI): home with the tab bar, Skins, Shop, a proper HUD and results screen.
3. Economy: coins, packs (with duplicates), the starter pack, the Season Pass.
4. Medal Road and leagues, missions.
5. 3D models for obstacles, buses, scenery (the web game's GLBs), music and sounds.
6. Races against bots: Classic Race, Survival, Brain Chase, Coin Rush, Party.
7. Online multiplayer (rooms with friends): needs a server for Unity (the web game's runs on Cloudflare).

## Layout

```
Assets/Scripts/Core     course generator + shared rules (plain C#, no Unity)
Assets/Scripts/World    maps, track, course objects, materials
Assets/Scripts/Game     game loop, runner, runner model, sounds
Tools/                  parity check against the web game (needs node + mono)
```
