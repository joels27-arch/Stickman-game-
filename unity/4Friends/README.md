# 4 Friends — Unity app

This Unity project is the app around the real game: it shows the live web version
(https://lane-rush-party.higgsfield.app) full screen. So it is **exactly the same game**, with
everything in it (menus, packs, Medal Road, races, multiplayer…), and every update of the web game
is in the app the next time it opens. No new app build needed for game changes.

## Open
1. Unity Hub → Installs → **Unity 6000.4.6f1**, with **iOS Build Support** and/or **Android Build Support**.
2. Unity Hub → Add → Add project from disk → pick this folder (`4Friends`).
3. Press **Play** to check it starts. (On a Mac the game shows in the editor; on Windows the
   web view may show only in a built app.)

## Build for a phone
- File → Build Profiles (Build Settings) → **iOS** or **Android** → Switch Platform.
- Player Settings: set the **Company Name**, **Product Name** (e.g. "4 Friends"), app icon and
  bundle id (e.g. `com.yourname.fourfriends`).
- Android: Build → install the .apk / upload the .aab to Google Play.
- iOS: Build → open the Xcode project on a Mac → pick your Apple team → run on your iPhone / upload.

## How it works
- `Assets/Scripts/WebGame.cs` starts itself in any scene: checks the connection, opens the game
  in a full-screen web view, shows "Loading…" or a "Try again" screen when offline.
- The web view is the open-source unity-webview plugin (`Packages/net.gree.unity-webview`, MIT).
- To change the game: change the web version (as always) and deploy it. The app picks it up.
- Change `GameUrl` in `WebGame.cs` only if the game moves to another address.
