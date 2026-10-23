// Simulation, networking and movement tuning. Shared verbatim by client and server
// so client-side prediction runs exactly the same code as the authoritative server.

export const TICK_RATE = 60;            // simulation steps per second (server + client prediction)
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_EVERY = 3;        // server sends a snapshot every N ticks (20 Hz)
export const INPUT_SEND_EVERY = 2;      // client batches inputs every N ticks (30 Hz)
export const INTERP_DELAY_TICKS = 7;    // remote players are rendered ~115 ms in the past
export const MAX_PLAYERS = 30;
export const PROTOCOL_VERSION = 3;

// Character capsule, approximated by three stacked spheres.
export const P_RADIUS = 0.42;
export const P_HEIGHT = 1.7;
export const P_SPHERES = [0.42, 0.85, 1.28]; // sphere centre heights above the feet

// Movement.
export const RUN_SPEED = 7.2;
export const GROUND_ACCEL = 70;
export const GROUND_DECEL = 55;
export const OVERSPEED_DECEL = 9;       // how quickly speed above RUN_SPEED bleeds off on the ground
export const AIR_ACCEL = 24;
export const AIR_DECEL = 2.5;
export const ICE_ACCEL = 10;
export const ICE_DECEL = 1.6;
export const ICE_SPEED = 8.2;
export const GRAVITY = 28;
export const FALL_MULT = 1.3;
export const JUMP_VEL = 10;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.12;
export const TURN_RATE = 14;            // rad/s that the body turns toward its movement
export const MAX_FALL = 32;
export const MAX_HSPEED = 24;
export const MAX_UP = 30;

// Dive.
export const DIVE_SPEED = 10.5;
export const DIVE_HOP_GROUND = 5;
export const DIVE_HOP_AIR = 3.2;
export const DIVE_STEER = 1.2;          // rad/s of steering while diving
export const SLIDE_FRICTION = 13;
export const SLIDE_MIN_TIME = 0.14;     // after this, jump cancels the slide
export const SLIDE_MAX_TIME = 0.5;
export const GETUP_TIME = 0.22;
export const DIVE_COOLDOWN = 0.25;

// Knockdowns.
export const KNOCK_TIME = 0.85;
export const KNOCK_MAX_AIR = 3;
export const RECOVER_TIME = 0.32;
export const KNOCK_THRESHOLD = 2.2;     // obstacle surface speed (m/s, along the contact normal) that knocks you down
export const RESPAWN_TIME = 0.9;

// Player–player shoves (server only; clients just receive the corrected state).
export const SHOVE_RADIUS = 0.82;
export const DIVE_TACKLE_SPEED = 6;

export enum Mode {
  Normal = 0,
  Dive = 1,
  Slide = 2,
  Getup = 3,
  Knock = 4,
  Recover = 5,
  Respawn = 6,
  Out = 7,       // finished / eliminated / spectating: not simulated, not rendered on the course
}

export enum Btn { Jump = 1, Dive = 2 }

export enum Surf { Normal = 0, Ice = 1, Bounce = 2, Boost = 3, Conveyor = 4, Bumper = 5, Sticky = 6 }

// Step events (bitmask), used for sounds/effects and by the server.
export enum Ev {
  Jump = 1, Dive = 2, Land = 4, Bounce = 8, Knock = 16, FellOut = 32, Respawned = 64,
  Checkpoint = 128, Finish = 256, Boost = 512, BigLand = 1024,
}
