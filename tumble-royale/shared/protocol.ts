// Wire protocol. Control messages are JSON; the two hot paths (client inputs and
// server snapshots) are compact little-endian binary.

import type { Cosmetics } from './cosmetics';
import { STATE_FIELDS, type Input, PState } from './player';

export type Phase = 'lobby' | 'intro' | 'countdown' | 'play' | 'roundEnd' | 'matchEnd';
export type MatchMode = 'tournament' | 'single';

export interface RoomSettings {
  /** Fill the match up to this many players with clearly-labelled bots (0 = humans only). */
  fillBots: number;
  mode: MatchMode;
  /** Map for single-round mode. */
  map: string;
  isPublic: boolean;
}

export interface LobbyPlayer {
  id: number;
  name: string;
  cos: Cosmetics;
  ready: boolean;
  bot: boolean;
  connected: boolean;
  level: number;
  /** Status in the current match. */
  status: 'lobby' | 'alive' | 'qualified' | 'eliminated' | 'spectator';
}

export interface RoundInfo {
  index: number;          // 0-based
  map: string;
  final: boolean;
  qualify: number;
  participants: number[];
  introTick: number;      // absolute server tick when the intro started
  goTick: number;         // absolute server tick of GO (round time 0)
  endTick: number;        // absolute server tick at which the timer expires
  triggered: [number, number][];
}

export interface RankEntry { id: number; place: number; result: 'qualified' | 'eliminated' | 'winner'; score?: number }

export interface Rewards { xp: number; coins: number; levelUp: boolean; level: number; challenges: string[] }

export type ClientMsg =
  | { t: 'hello'; v: number; name: string; token?: string; resume?: string; cos?: Cosmetics; guest?: boolean }
  | { t: 'ready'; on: boolean }
  | { t: 'settings'; s: Partial<RoomSettings> }
  | { t: 'start' }
  | { t: 'ping'; c: number }
  | { t: 'spectate'; id: number }
  | { t: 'emote'; e: number }
  | { t: 'kick'; id: number }
  | { t: 'leave' };

export type ServerMsg =
  | { t: 'welcome'; you: number; secret: string; code: string; tick: number; resumed: boolean }
  | { t: 'room'; code: string; host: number; phase: Phase; settings: RoomSettings; players: LobbyPlayer[]; startsIn?: number }
  | { t: 'round'; r: RoundInfo }
  | { t: 'tile'; id: number; tick: number | null }
  | { t: 'qual'; id: number; place: number }
  | { t: 'elim'; id: number; place: number; why: 'fell' | 'time' | 'left' | 'cut' }
  | { t: 'roundEnd'; qualified: number[]; eliminated: number[]; ranking: RankEntry[]; next: boolean }
  | { t: 'matchEnd'; winner: number | null; ranking: RankEntry[] }
  | { t: 'rewards'; r: Rewards }
  | { t: 'pong'; c: number; s: number }
  | { t: 'emote'; id: number; e: number }
  | { t: 'notice'; msg: string }
  | { t: 'error'; code: 'room_not_found' | 'room_full' | 'bad_version' | 'replaced' | 'kicked' | 'bad_request'; msg: string };

// ---------------------------------------------------------------- binary

export const BIN_INPUT = 1;
export const BIN_SNAPSHOT = 2;

export const POS_SCALE = 50; // 2 cm resolution, ±655 m range

/** Client → server: a batch of consecutive inputs starting at `firstTick`. */
export function encodeInputs(firstTick: number, inputs: Input[]): Uint8Array {
  const buf = new ArrayBuffer(6 + inputs.length * 3);
  const dv = new DataView(buf);
  dv.setUint8(0, BIN_INPUT);
  dv.setUint32(1, firstTick, true);
  dv.setUint8(5, inputs.length);
  let o = 6;
  for (const i of inputs) {
    dv.setInt8(o, Math.round(i.mx * 127));
    dv.setInt8(o + 1, Math.round(i.mz * 127));
    dv.setUint8(o + 2, i.btn & 3);
    o += 3;
  }
  return new Uint8Array(buf);
}

export function decodeInputs(data: Uint8Array): { firstTick: number; inputs: Input[] } | null {
  if (data.byteLength < 6) return null;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (dv.getUint8(0) !== BIN_INPUT) return null;
  const firstTick = dv.getUint32(1, true);
  const n = dv.getUint8(5);
  if (n > 32 || data.byteLength !== 6 + n * 3) return null;
  const inputs: Input[] = [];
  for (let k = 0, o = 6; k < n; k++, o += 3) {
    let mx = dv.getInt8(o) / 127, mz = dv.getInt8(o + 1) / 127;
    const l = Math.hypot(mx, mz);
    if (l > 1) { mx /= l; mz /= l; }
    inputs.push({ mx: Math.max(-1, Math.min(1, mx)), mz: Math.max(-1, Math.min(1, mz)), btn: dv.getUint8(o + 2) & 3 });
  }
  return { firstTick, inputs };
}

/** One remote player in a snapshot. */
export interface SnapPlayer {
  id: number; mode: number; flags: number; ev: number;
  x: number; y: number; z: number; yaw: number; ground: number;
}

export const SF_GROUNDED = 1;
export const SF_BOT = 2;

const PLAYER_BYTES = 14;
const STATE_BYTES = STATE_FIELDS.length * 8;

/** Encodes the part of a snapshot shared by every recipient. */
export function encodePlayersBlock(players: SnapPlayer[]): Uint8Array {
  const buf = new Uint8Array(1 + players.length * PLAYER_BYTES);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, players.length);
  let o = 1;
  for (const p of players) {
    dv.setUint8(o, p.id);
    dv.setUint8(o + 1, p.mode);
    dv.setUint8(o + 2, p.flags);
    dv.setUint16(o + 3, p.ev & 0xffff, true);
    dv.setInt16(o + 5, clampI16(p.x * POS_SCALE), true);
    dv.setInt16(o + 7, clampI16(p.y * POS_SCALE), true);
    dv.setInt16(o + 9, clampI16(p.z * POS_SCALE), true);
    dv.setUint8(o + 11, Math.round(((p.yaw % (Math.PI * 2)) + Math.PI * 2) / (Math.PI * 2) * 256) & 255);
    dv.setUint16(o + 12, p.ground < 0 ? 0xffff : p.ground, true);
    o += PLAYER_BYTES;
  }
  return buf;
}

const clampI16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v)));

/**
 * Full snapshot for one recipient: header + (optional) their own full-precision
 * state for reconciliation + the shared players block.
 */
export function encodeSnapshot(tick: number, ackTick: number, slack: number, own: PState | null, block: Uint8Array): Uint8Array {
  const headerLen = 1 + 4 + 4 + 1 + 1 + (own ? STATE_BYTES : 0);
  const out = new Uint8Array(headerLen + block.byteLength);
  const dv = new DataView(out.buffer);
  dv.setUint8(0, BIN_SNAPSHOT);
  dv.setUint32(1, tick, true);
  dv.setUint32(5, ackTick >>> 0, true);
  dv.setInt8(9, Math.max(-127, Math.min(127, Math.round(slack))));
  dv.setUint8(10, own ? 1 : 0);
  if (own) {
    let o = 11;
    for (const k of STATE_FIELDS) { dv.setFloat64(o, own[k], true); o += 8; }
  }
  out.set(block, headerLen);
  return out;
}

export interface Snapshot { tick: number; ack: number; slack: number; own: PState | null; players: SnapPlayer[] }

export function decodeSnapshot(data: Uint8Array): Snapshot | null {
  if (data.byteLength < 12) return null;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (dv.getUint8(0) !== BIN_SNAPSHOT) return null;
  const tick = dv.getUint32(1, true);
  const ack = dv.getUint32(5, true);
  const slack = dv.getInt8(9);
  let o = 11;
  let own: PState | null = null;
  if (dv.getUint8(10)) {
    own = new PState();
    for (const k of STATE_FIELDS) { (own as any)[k] = dv.getFloat64(o, true); o += 8; }
  }
  const n = dv.getUint8(o); o++;
  const players: SnapPlayer[] = [];
  for (let i = 0; i < n; i++) {
    const g = dv.getUint16(o + 12, true);
    players.push({
      id: dv.getUint8(o), mode: dv.getUint8(o + 1), flags: dv.getUint8(o + 2), ev: dv.getUint16(o + 3, true),
      x: dv.getInt16(o + 5, true) / POS_SCALE, y: dv.getInt16(o + 7, true) / POS_SCALE, z: dv.getInt16(o + 9, true) / POS_SCALE,
      yaw: (dv.getUint8(o + 11) / 256) * Math.PI * 2, ground: g === 0xffff ? -1 : g,
    });
    o += PLAYER_BYTES;
  }
  return { tick, ack, slack, own, players };
}

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export function normalizeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function sanitizeName(s: unknown): string {
  const str = typeof s === 'string' ? s : '';
  const clean = str.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return clean.length >= 2 ? clean : '';
}
