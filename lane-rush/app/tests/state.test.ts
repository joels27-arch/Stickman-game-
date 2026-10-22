/**
 * Fresh room state must never be shared between rooms: Durable Object
 * instances of one class share an isolate, so a module-level object a room
 * mutates would leak into every other room.
 */

import { describe, expect, it } from "vitest";

import { freshGame } from "../src/room";

describe("fresh room state", () => {
  it("is a new object every call", () => {
    expect(freshGame()).not.toBe(freshGame());
  });

  it("starts empty and waiting", () => {
    expect(freshGame()).toEqual({ status: "waiting", state: null });
  });
});
