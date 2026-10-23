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
* Party Cup rounds 2 and 3 start 350 m / 700 m further along the curve.

Moving obstacles (log, bees, tractor, chicken, wave, crab) sweep across the
lanes on the shared race clock, one every ~150 m from 150 m on, always in a
wide gap between rows.

## Economy

| Source | Coins |
|---|---|
| Race (place 1–4) | 60 / 40 / 25 / 15, +10 per hit landed, ×2 in Party Cup |
| Solo endless run | 1 per 25 m (5–60) |
| Daily missions | 100 / 200 / 400 (claim) |
| Career missions | 50–600 each + a chapter chest |
| Daily login streak | 50 → 750 + gold medal on day 7 |

Medals (gold/silver/bronze) come from top-3 places **against at least one other
real player**, the day-7 login reward, the Weekend League, the Season Pass and
chapter chests. Bots never pay medals (they do pay coins).

The **Gold Pass** (the Season Pass's second track) costs $4.99. Payments aren't
connected yet, so for now tapping the button unlocks it.

### Characters: one way to unlock each

| Group | Unlock | Count |
|---|---|---|
| Starters | free, playable in 3D | 7 |
| Kiko (3D) | Season Pass, free track level 2 (level 1 is a Brain Pack) | 1 |
| Coin characters | coins only (800–4,500 by rarity) | 6 |
| Medal exclusives | medals only (4–6 silver, 3–5 gold) | 4 |
| Pack exclusives | packs only | 5 |
| Season Pass | Gold track level 30 | 1 |

*Decision:* earlier the shop characters could be bought with either coins or
medals. The overhaul asked for medal-exclusive characters that coins can't
buy, so the ten were split into six coin and four medal characters.
Characters already bought under the old prices stay owned.

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

Survival (main), Brain Chase, Coin Rush, Hot Potato, Party Cup (3 random rounds
of the others), and the Grand Tour (`grandtour`). Play solo = Endless Run alone, or any mode against 3 bots.
Sprint and Tournament were removed at the player's request.

* **Hot Potato:** the holder taps PASS 💣 to throw the bomb to the nearest
  runner within 12 m (any lane, ahead or behind; not straight back), or bumps
  into someone. Bots pass it on too.
* **Coin Rush:** a taken coin comes back 5 s later, so the runners at the back
  don't run dry.
* **Hearts** (Survival only): first come, first served, and gone for everyone.
* **Boxing glove:** hits the nearest runner within 25 m; with nobody in reach
  it's a whiff (used up), so you're never stuck holding it.
* Locking in your runner in the lobby marks you Ready (tap again to cancel).
