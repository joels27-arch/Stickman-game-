# Brain Run: how the systems fit together

A short reference for the rules the code follows, and the decisions made where
earlier requests pulled in different directions.

## Rounds and difficulty (`src/logic.js`: `STAGES`, `buildCourse`, `checkCourse`)

Every mode runs on the same endless course; difficulty grows with distance.

| Stage | From | Seconds between rows | New patterns |
|---|---|---|---|
| Warm-up | 0 m | 1.7 | one hurdle, one gate, hurdle wall, gate wall, one crate (taught in that order) |
| Getting going | 250 m | 1.4 | crates with jumps/ducks (split), first barrels |
| In the zone | 700 m | 1.2 | mixed walls, tunnels (3 crates + a gate), 2-row slaloms |
| Pro | 1.4 km | 1.05 | 3-row slaloms, jump-then-slide combos, barrel pairs |
| Master | 2.4 km | 0.92 | zigzags, everything |

Rules the generator keeps:

* The first appearance of each obstacle type gets extra room and an `intro`
  flag; the client shows a one-line hint ("⬇ SLIDE under gates") for the
  first few races.
* Barrels only appear once crates have been taught (you learn to change lane
  first).
* The same pattern never comes twice in a row; a breather (box + boost pad, no
  obstacles) is forced after 9 patterns without one.
* **Fairness check:** from every lane a player could be in after a row, there
  must be a way through the next row reachable in time:
  `0.3 s reaction + 0.12 s per lane + finishing a jump (0.33 s) / slide
  (0.38 s) + starting the next jump (0.25 s) / slide (0.12 s)`. If a pattern
  would be too tight, its gap is widened. `checkCourse` re-checks whole
  courses; the tests run it over 1,200 generated courses.
* In a match of several rounds, each later round starts 350 m further along the curve.

Moving obstacles (log, bees, tractor, chicken, wave, crab) sweep across the
lanes on the shared race clock, one every ~150 m from 150 m on, always in a
wide gap between rows.

## Economy

| Source | Coins |
|---|---|
| Race (place 1–4) | 60 / 40 / 25 / 15, +10 per hit landed, ×2 in matches of several rounds |
| Solo endless run | 1 per 25 m (5–60) |
| Daily missions | 100 / 200 / 400 (claim) |
| Career missions | 50–600 each + a chapter chest |
| Daily login streak | 50 → 1000 coins on day 7 |

Medals (gold/silver/bronze) come from top-3 places **against at least one other
real player**. Silver and bronze also come from the Weekend League, the Season
Pass and chapter chests. **Gold medals are only won by winning races**: never
from packs, the shop, the login streak, the pass or chests, and never bought.
Bots never pay medals (they do pay coins).

The **Gold Pass** (the Season Pass's second track) costs $4.99. Payments aren't
connected yet, so for now tapping the button unlocks it.

### Characters: one way to unlock each

| Group | Unlock | Count |
|---|---|---|
| Starters | free, playable in 3D | 7 |
| Kiko (3D) | Season Pass, free track level 2 (level 1 is a Brain Pack) | 1 |
| Coin characters | coins only (800–5,000 by rarity) | 10 |
| Medal exclusives | medals only (4–6 silver, 3–6 gold) | 7 |
| Pack exclusives | packs only | 10 |
| Season Pass | Gold track level 30 | 1 |

*Decision:* earlier the shop characters could be bought with either coins or
medals. The overhaul asked for medal-exclusive characters that coins can't
buy, so the ten were split into six coin and four medal characters.
Characters already bought under the old prices stay owned.

*Decision:* the sports and music characters (Siete, Diez, Big Slam, Disco
Dash, MC Gold) are invented archetypes with their own faces and names and no
team, national or brand marks; they don't depict real people.

*Decision:* the 2D characters (shop, packs, pass) are collectibles and can't
be raced yet; only the eight 3D starters are playable. The Collection page
says so on each card.

Pack duplicates turn into coins (rare 300, epic 600, legendary 1,500), so a
duplicate is never worthless and never worth more than a fresh pull.
Every purchase is confirmed first, checks the balance again at the moment of
buying, and can only run once per confirmation.

## Missions

* **Daily:** 3 per day (easy / medium / hard), claim to collect.
* **Career:** 6 chapters × 4 missions (Rookie → Legend). A chapter opens when
  the previous chapter's missions and chest are claimed; requirements grow
  with each chapter.

All progress lives in the browser (`localStorage`); nothing is lost on update
because new keys are added alongside the old ones.

## Home pages

The home screen is five pages with a tab bar (swipe or tap): **Tournaments**,
**Skins** (your runners first, then every one still to get, common to
legendary), **Play** (the default, in the middle), **Missions** (daily, career
and trophies) and **Shop** (Season Pass, packs, characters for sale, items).

* Characters you don't have are shown in full colour with a lock; you just
  can't race with them yet.
* The top bar shows only your medals and Settings; the Shop page adds coins,
  the daily reward and your league badge.
* Your name is asked once, the first time the game opens, and can be changed in
  Settings.

## Leagues

Leagues are climbed with medals only: every medal earned is worth league
points (gold 3, silver 2, bronze 1) and spending medals never takes points
away. Bronze 0 · Silver 10 · Gold 28 · Platinum 55 · Diamond 90 · Brain Master
140 (three divisions each, except Master). Rank points (RP) from race places
were removed; existing players start with the points of every medal they hold
or spent on characters.

## Tournaments

| Event | When | Format | Rewards |
|---|---|---|---|
| Weekend League | Fri 18:00 → Sun 24:00 (local time) | 10 matches, any mode (a random mode per match from the page); places score 10 / 6 / 3 / 1 | Tiers at 20 / 45 / 70 / 90 pts: 300, 700 + bronze, 1,200 + silver, 2,000 + gold coins |
| Grand Tour | Always | Survival, Brain Chase, Coin Rush and Hot Potato once each | Daily prize 500 / 250 / 120 |

* Any race against at least one other runner (bots count) during the weekend
  is a league match, until 10 are played. Rewards left unclaimed are paid out
  automatically when the next weekend starts.
* Tournament prizes are paid once per day for your best finish; finishing
  higher later the same day pays the difference. Rounds also pay normal race
  coins (×2, as in every cup).

## Packs

Packs hold characters and coins only (no medals). Brain Pack per item:
legendary 1 % · epic 6 % · rare 20 % · coins 73 %; the Mega Pack's last item is
always a character (5 / 25 / 70 %). You get characters you don't own first
(a duplicate only once you own every one of that rarity). New players: the
first pack always has a new character, and the first 3 packs have double
character odds.

## Modes

Survival (main), Brain Chase, Coin Rush, Hot Potato, Random (a mode drawn each
round) and the Grand Tour. Play solo = your own private room with bots.

### Room settings (host)

* **Rounds:** 1, 3 or 5 for any mode. More than one round is a match with a
  points table (10 / 5 / 3 / 1 per round); medals and prizes are paid for the
  final table. Random draws a different mode each round. The Grand Tour is
  always 4 rounds (one of each mode). *Decision:* the Party Cup was dropped,
  since Random × 3 rounds is the same thing.
* **Map:** fixed for the whole match, or Random (drawn every round).
* **Prize for the top 3:** none, coins (150 / 75 / 40), big coins
  (300 / 150 / 75) or a Brain Pack for 1st (then 150 / 75 coins). Paid with 2+
  real players, at most 5 room prizes per player per day.

* **Hot Potato:** the holder taps PASS 💣 to throw the bomb to the nearest
  runner within 12 m (any lane, ahead or behind; not straight back), or bumps
  into someone. Bots pass it on too.
* **Coin Rush:** a taken coin comes back 5 s later, so the runners at the back
  don't run dry.
* **Hearts** (Survival only): first come, first served, and gone for everyone.
* **Boxing glove:** hits the nearest runner within 25 m; with nobody in reach
  it's a whiff (used up), so you're never stuck holding it.
* Locking in your runner in the lobby marks you Ready (tap again to cancel).
* **Power-ups never cost a heart.** Lightning, thunder, bananas, bowling balls
  and fake boxes trip you and slow you down; only obstacles take hearts.
* **Throwing:** banana, glue, fake box and bowling ball all go ahead or behind,
  into any lane: the throw pad has a mini track (your lane is the default) above
  the Ahead / Behind buttons. Bots throw ahead at a runner in reach, else drop
  behind.

## Maps

Meadow, Farm and Beach use downloaded 3D props. City, Stadium and Space are
built in code (no download, light on phones), each with a painted track, its
own edges and two moving obstacles:

| Map | Scenery | Movers |
|---|---|---|
| City | skyscrapers, street lamps, concrete barriers | taxi (dodge), pigeons (slide) |
| Stadium | raked stands full of fans, ad boards, floodlights | football (jump), spidercam (slide) |
| Space | starry sky, ringed planet, craters, moon-base domes, neon rails | asteroid (jump), UFO beam (dodge) |

No cows or hay bales off the farm/meadow: those obstacle looks fall back to the
crates and hurdles. *Decision:* the cow stands 2.5 m tall and faces you, so it
reads as "dodge", never "jump".

## Race screen (phones)

Only what you act on: place, progress, time, hearts / mode counter, the
power-up button (saved item above it, throw pad beside it), Look back, and the
PASS button in Hot Potato. The mode tag shows for the first 7 s only. No kill
feed, combo badge, in-race emote button or "how to" banners; each power-up's
tip shows the first 3 times you pick it up. Nothing overlaps.
