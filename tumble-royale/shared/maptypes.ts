import type { V3 } from './math';
import type { Surf } from './constants';

export type ShapeDef =
  | { kind: 'box'; hx: number; hy: number; hz: number }
  | { kind: 'cyl'; r: number; hy: number }
  | { kind: 'sphere'; r: number };

/**
 * Every obstacle is a kinematic body whose pose is a pure function of round time,
 * so the server, every client and the client-side predictor agree on where it is
 * without streaming obstacle transforms. Only step-triggered state (falling tiles)
 * is event-driven, and the server broadcasts it.
 */
export interface MotionDef {
  /** Continuous rotation about a world axis through the pivot. */
  spin?: { axis: V3; speed: number; phase?: number };
  /** Pendulum swing about a world axis through the pivot: angle = amp * sin(2π(t/period + phase)). */
  swing?: { axis: V3; amp: number; period: number; phase?: number };
  /** Back-and-forth between pivot and pivot + delta. `hold` (0..0.45) pauses at each end for that fraction of the period. */
  move?: { delta: V3; period: number; phase?: number; hold?: number };
}

export interface VisualDef {
  /** Material style used by the client mesh factory. */
  style:
    | 'platform' | 'stripe' | 'checker' | 'hammer' | 'beam' | 'bumper' | 'bounce' | 'boost'
    | 'conveyor' | 'ice' | 'ball' | 'snowball' | 'tile' | 'wall' | 'glass' | 'cloud' | 'lava-rock'
    | 'log' | 'pillar' | 'invisible' | 'fan' | 'cannon' | 'start' | 'finish-pad';
  color?: number;
  color2?: number;
  /** Corner rounding for boxes (metres). */
  round?: number;
  /** Hide from shadow casting (big floors) for perf. */
  noShadow?: boolean;
}

export interface BodyDef {
  shape: ShapeDef;
  /** Pivot position. The body's centre is pivot + R_motion * offset + move. */
  pos: V3;
  /** Base orientation [yaw, pitch, roll] in radians (applied Y, then X, then Z). */
  rot?: [number, number, number];
  offset?: V3;
  motion?: MotionDef;
  surf?: Surf;
  /** Bounce power (vertical m/s), boost speed, or conveyor speed. */
  power?: number;
  /** Local direction for boost / conveyor surfaces (default +Z). */
  dir?: V3;
  /** Obstacle knocks players down on fast contact; value scales the launch. */
  knock?: number;
  /** Visible/solid `on` seconds then gone `off` seconds, offset by `phase` seconds. `warn` seconds of blinking before vanishing. */
  cycle?: { on: number; off: number; phase: number; warn?: number };
  /** Falls `delay` seconds after someone stands on it; comes back after `respawn` seconds if set. */
  trigger?: { delay: number; respawn?: number };
  /** Drops away this many seconds after GO (scheduled collapse). */
  fallAt?: number;
  /** Clones of this body travel along a polyline: `count` copies, one every `interval` seconds. */
  path?: { pts: V3[]; speed: number; interval: number; count: number; phase?: number };
  visual: VisualDef;
}

export type DecorKind =
  | 'tree' | 'pine' | 'cloud' | 'island' | 'arch' | 'flag' | 'balloon' | 'mushroom' | 'crystal'
  | 'snowman' | 'rock' | 'banner' | 'tower' | 'confetti-cannon' | 'volcano' | 'iceberg' | 'stands' | 'lamp';

export interface DecorDef { kind: DecorKind; pos: V3; scale?: number; yaw?: number; color?: number; }

export interface Zone { min: V3; max: V3 }
export interface Checkpoint extends Zone { spawn: V3; yaw: number }
export interface WindZone extends Zone { force: V3; cycle?: { on: number; off: number; phase: number } }

export interface Theme {
  skyTop: number; skyBottom: number; fog: number; fogNear: number; fogFar: number;
  sun: number; sunIntensity: number; ambient: number; hemiGround: number;
  /** Ground/void plane under the course. */
  floor: 'water' | 'lava' | 'clouds' | 'snow' | 'void';
  floorColor: number; floorY: number;
  sunDir: V3;
  particles?: 'snow' | 'embers' | 'petals' | 'sparkles';
}

export interface BotWaypoint { p: V3; jump?: boolean; dive?: boolean; wait?: boolean; r?: number }

export type GameMode = 'race' | 'survival';

export interface MapDef {
  id: string;
  name: string;
  subtitle: string;
  mode: GameMode;
  /** 1 (gentle) .. 3 (hard); used to order tournament rounds. */
  difficulty: number;
  theme: Theme;
  bodies: BodyDef[];
  decor: DecorDef[];
  spawn: { center: V3; yaw: number; cols: number; spacing: number };
  checkpoints: Checkpoint[];
  finish?: Zone;
  /** Kill height, optionally rising: y(t) = min(max, base + rise * max(0, t - delay)). */
  killY: { base: number; rise?: number; delay?: number; max?: number };
  /** Leaving this box counts as falling off. */
  bounds: Zone;
  wind: WindZone[];
  timeLimit: number;
  /** Survival: also end after this many seconds even if too many players remain. */
  camYaw: number;
  botPath: BotWaypoint[];
  music: 'race' | 'survival' | 'final';
}
