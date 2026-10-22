/**
 * Types for `logic.js` — the six contract exports the room calls, plus the
 * Brain Run extras (shared tuning, the course builder, and `wakeAfter`, which
 * tells the room when to tick).
 *
 * Every function must be PURE: same inputs → same outputs, no `Date.now()`, no
 * `Math.random()`, no I/O. Time arrives as `action.t`, stamped by the room.
 */

export const meta: { game: string; minPlayers: number; maxPlayers: number };

export function setup(players: string[]): unknown;

export function validateAction(
  state: unknown,
  playerId: string,
  action: unknown,
): { ok: true } | { ok: false; error?: string };

export function applyAction(state: unknown, playerId: string, action: unknown): unknown;

export function isGameOver(
  state: unknown,
): { over: false } | { over: true; winner?: string | null; [key: string]: unknown };

export function viewFor(state: unknown, playerId: string): unknown;

/** Milliseconds until the room should tick on its own, or null for no timer. */
export function wakeAfter(state: unknown): number | null;

export function standings(state: unknown): string[];

export function buildCourse(seed: number, len?: number): {
  rows: { z: number; lanes: (string | null)[]; looks: number[] }[];
  boosts: { z: number; lane: number }[];
  boxes: { z: number; lane: number }[];
  len: number;
};

export const TRACK_LEN: number;
export const LANES: number;
export const MAX_RUNNERS: number;
export const BASE_SPEED: number;
export const BOOST_SPEED: number;
export const ROCKET_SPEED: number;
export const SURVIVAL_ROCKET: number;
export const COUNTDOWN_MS: number;
export const RACE_LIMIT_MS: number;
export const AFTER_FIRST_MS: number;
export const LOBBY_GRACE_MS: number;
export const CHARACTERS: number;
export const POWERS: string[];
export const BANANA_AHEAD_M: number;
export const ZAP_KINDS: string[];
export const BOWL_SPEED: number;
export const BOWL_RANGE_M: number;
export const BANANA_COOLDOWN_MS: number;
export const GAME_MODES: string[];
export const CUP_RACES: string[];
export const CUP_POINTS: number[];
export function cupStandings(state: unknown): string[];
export const LIVES: number;
export const SURVIVAL_LEN: number;
export const SURVIVAL_LIMIT_MS: number;
export const SURVIVAL_MAX_SPEED: number;
export const SURVIVAL_BOOST: number;
export function survivalSpeed(seconds: number): number;
export const ZAP_COOLDOWN_MS: number;
export const ROLLER_SPEED: number;
export const ROLLER_TRIGGER_M: number;
export const LOOKS: Record<string, number>;
export const COUNTRIES: [string, string][];
export const MEDALS: string[];
export const MEDAL_WORTH: Record<string, number>;
export const MIN_RACERS_FOR_MEDALS: number;
export function rewards(state: unknown): Record<string, { place: number; medal: string | null }>;
