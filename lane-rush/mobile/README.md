# Lane Rush on iPhone

**4 Friends** (Lane Rush) as an iOS app, made with [Capacitor](https://capacitorjs.com),
for a TestFlight test. It is the same game as the website, packed inside an
app, racing on the same server as the website. Payments are not connected: the
Gold Pass button still unlocks the pass for free, as on the website.

## How the app is put together

The game is not copied into this folder. It stays in `../app`, and
each build takes it from there:

```
../app/public/**      →  www/**          the client, styles, art, three.js
../app/src/logic.js   →  www/logic.js    the rules, shared with the server
native/native.js                →  www/native.js   the app's differences (below)
www/                            →  ios/App/App/public/   (npx cap sync)
```

`www/` and `ios/App/App/public/` are generated and git-ignored: a change to the
game is made in `../app`, never there.

`native/native.js` is loaded before the game. In the app, the game's files are
served by the app itself (`capacitor://localhost`), and the client builds
three things from the page it runs on, so this file points each one at the
right place:

| What | The client asks for | native.js turns it into |
|---|---|---|
| The lobby connection | `ws://localhost/ws/<CODE>` | `wss://lane-rush-party.higgsfield.app/ws/<CODE>` |
| Invite links | `capacitor://localhost/?join=<CODE>` | `https://lane-rush-party.higgsfield.app/?join=<CODE>`, through the iOS share sheet |
| Vibration | `navigator.vibrate`, which iOS doesn't have | taps of the Taptic Engine (Haptics plugin) |

The server address is two constants at the top of `native.js` (`SITE`,
`SERVER`).

## How the backend works

Lane Rush has two halves, both hosted by Higgsfield at
`lane-rush-party.higgsfield.app`:

1. **The game files** (`index.html`, `client.js`, `logic.js`, the 3D models,
   the music). On the website the browser downloads them; in the app they are
   inside the app. Menus, the shop, packs, missions and all saved progress run
   on the phone and are saved on the phone. The server never sees coins or
   characters.
2. **The server**: a Cloudflare Worker with Durable Objects. A Durable Object
   is a small server that exists exactly once per name, anywhere in the world;
   here the name is the 4-letter lobby code.

A race:

1. The phone opens a WebSocket to `/ws/ABCD`. Cloudflare sends everyone who
   uses the code `ABCD` to the same room (`../app/src/worker.ts`).
2. The room (`src/room.ts`) runs the rules (`src/logic.js`): who is in the
   lobby, the mode and map, the bots, the official clock and the countdown.
3. Every phone builds the same course from the same seed and runs its own
   runner, so the controls answer at once. It sends its progress; the room
   refuses anyone faster than possible, records finish times and ends the race.
4. When the last player leaves, the room deletes itself. There are no
   accounts and no player database.

**Every race uses the server**, Endless Run and solo races against bots
included (they open a private room; the bots run on the server). So the app
needs the internet to play.

### For this test

The app uses the **live Higgsfield server**. On 24 October 2026 its
`logic.js` was byte-for-byte this repo's, its `client.js` the same apart from
cache tags, and it accepted connections from the app. Nothing has to be
deployed, and app and website players share lobbies: a tester with the app
and a friend in Safari can race with the same code.

Two things to know:

- The app keeps the copy of the game it was built with. If the server's rules
  change on Higgsfield, rebuild the app from the same code.
- The app depends on Higgsfield's hosting staying up.

### Your own server (before a public release)

The same server can run on your own Cloudflare account. Roughly:

1. Install [Bun](https://bun.sh) and run `npx wrangler login` with your
   Cloudflare account.
2. In `../app`: `bun install`, `../fetch-assets.sh`,
   `bun run build`, then deploy with a production Wrangler config (the
   `wrangler.jsonc` there is for local dev only: give it your own `name` and
   route or domain, and keep the `ROOMS` Durable Object binding and its
   `new_sqlite_classes` migration).
3. Change `SITE` and `SERVER` in `native/native.js` to the new address,
   rebuild the app and upload a new build.

## Build and run

You need a Mac with Xcode (built with Xcode 27.1), Node 22 or later, and the
Apple developer team `GPR2C9QVS4` signed in to Xcode.

```bash
npm install
npm run assets     # once: downloads the art and three.js into ../app/public (not in git)
npm run sync       # builds www/ and copies it into the iOS project
npm run open       # opens the project in Xcode
```

In Xcode, pick an iPhone or a simulator and press ⌘R. Run `npm run sync`
again after every change to the game.

In the Simulator, use an **iOS 26.5** iPhone: in a new iOS 27.0 iPhone
Simulator the page never finished loading (Safari there hung too). The share
sheet opens blank in the Simulator; check invites on a real iPhone.

## Upload to TestFlight

1. In Xcode, pick **Any iOS Device (arm64)** as the destination, then
   **Product ▸ Archive**.
2. In the Organizer that opens: **Distribute App ▸ App Store Connect ▸
   Upload**. Let Xcode manage signing.
3. If App Store Connect has no app for `com.masprime77.lanerush` yet, create
   it (**Apps ▸ + ▸ New App**, iOS). The App Store name must be unique
   across the store; the name under the icon stays "4 Friends".
4. In App Store Connect, open the app's **TestFlight** tab. When the build has
   processed, add yourself to **Internal Testing**, then install it with the
   TestFlight app on your iPhone. Internal testers need no review; external
   testers go through Beta App Review first.

Every upload needs a higher build number than the last. The version and build
number are `MARKETING_VERSION` (1.0.0) and `CURRENT_PROJECT_VERSION` (1) in
`ios/App/App.xcodeproj/project.pbxproj`; raise the build number there, or let
Xcode raise it in step 2.

The export-compliance question is answered in `Info.plist`
(`ITSAppUsesNonExemptEncryption` is NO: the app only uses HTTPS and secure
WebSockets).

## What this test build does not do

- **Payments.** The Gold Pass shows $4.99 and unlocks for free. Fine for
  internal testers; Beta App Review may question it for external ones.
- **Offline play.** Every race needs the server.
- **Opening invite links in the app.** Links open the website (the domain is
  Higgsfield's, so it can't carry Universal Links); a friend with the app types
  the code instead.
- **Bundled fonts.** Barlow loads from Google Fonts; offline the text falls
  back to a system font.
- **iPad and Android.** iPhone only, in portrait.
- Progress is saved in the app, apart from the website's, and is gone if the
  app is deleted.
