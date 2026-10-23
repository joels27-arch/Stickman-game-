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
real player**, the day-7 login reward, packs, the Season Pass and chapter
chests. Bots never pay medals or rank points (they do pay coins).

### Characters: one way to unlock each

| Group | Unlock | Count |
|---|---|---|
| Starters | free, playable in 3D | 8 |
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
* **Trophies:** lifetime goals with three ★ tiers.

All progress lives in the browser (`localStorage`); nothing is lost on update
because new keys are added alongside the old ones.

## Home pages

The home screen is three pages with a tab bar (swipe or tap): **Tournaments**
(left), **Play** (middle, the default) and **Shop** (right: Season Pass,
shop tabs, Collection, Missions).

## Tournaments

| Event | When | Format | Rewards |
|---|---|---|---|
| Weekend League | Fri 18:00 → Sun 24:00 (local time) | 10 matches, any mode (a random mode per match from the page); places score 10 / 6 / 3 / 1 | Tiers at 20 / 45 / 70 / 90 pts: 300, 700 + bronze, 1,200 + silver, 2,000 + gold coins |
| Coin Rush Cup | Always | 3 Coin Rush rounds on 3 maps, cup points | Daily prize 300 / 150 / 75 |
| Grand Tour | Always | Survival, Brain Chase, Coin Rush and Hot Potato once each | Daily prize 500 / 250 / 120 |

* Any race against at least one other runner (bots count) during the weekend
  is a league match, until 10 are played. Rewards left unclaimed are paid out
  automatically when the next weekend starts.
* Tournament prizes are paid once per day for your best finish; finishing
  higher later the same day pays the difference. Rounds also pay normal race
  coins (×2, as in every cup).

## Modes

Survival (main), Brain Chase, Coin Rush, Hot Potato, Party Cup (3 random rounds
of the others), and the two tournament formats above (`rushcup`, `grandtour`). Play solo = Endless Run alone, or any mode against 3 bots.
Sprint and Tournament were removed at the player's request.
