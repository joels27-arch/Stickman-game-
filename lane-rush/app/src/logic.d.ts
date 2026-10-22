/**
 * Types for `logic.js` — the six contract exports the room calls, plus the
 * Lane Rush extras (shared tuning, the course builder, and `wakeAfter`, which
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

export function buildCourse(seed: number): {
  rows: { z: number; lanes: (string | null)[] }[];
  boosts: { z: number; lane: number }[];
  len: number;
};

export const TRACK_LEN: number;
export const LANES: number;
export const MAX_RUNNERS: number;
export const BASE_SPEED: number;
export const BOOST_SPEED: number;
export const COUNTDOWN_MS: number;
export const RACE_LIMIT_MS: number;
export const AFTER_FIRST_MS: number;
export const LOBBY_GRACE_MS: number;
export const CHARACTERS: number;
