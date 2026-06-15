import { mulberry32 } from './random.js';

// Automatic ceiling lamps / fluorescent lights: fixtures that light a local pool
// of a room on their own, independent of the player's flashlight battery. Unlike
// a light switch (which lights a whole room and stops enemy spawns), a lamp only
// provides light. Placement is a pure function of the world seed, so lamps are
// stable day-to-day for a save with no persisted state of their own.
export const LAMP_SEED_OFFSET = 110000;

// Fraction of (non-start) rooms that get an automatic lamp. "Some rooms" -- kept
// a minority so darkness stays the default and the flashlight still matters.
export const LAMP_CHANCE = 0.3;

// Radius of a lamp's light pool. Tuned to light the room centre without reaching
// the corners (the room reads as a pool of light in the dark, not a lit box).
export const LAMP_RADIUS = 200;

// Fraction of lamps that flicker (the "one bad tube" beat). Most stay steady.
export const LAMP_FLICKER_CHANCE = 0.3;

// A flickering lamp never drops below this fraction of full brightness, so the
// room is never plunged to black -- both an accessibility floor (no hard strobe
// to darkness) and the spec's "never anything pitch-black" guarantee.
export const LAMP_FLICKER_FLOOR = 0.4;

// Flicker is driven by the Quake/Valve canonical "fluorescent" light style:
// brightness letters stepped at 10fps. 'a' = dark, 'm' = full bright. The string
// is mostly 'm' with sparse brief 'a' dips, so lerped it reads as a subtle
// buzzing tube rather than a strobe.
export const LAMP_FLICKER_STEP_MS = 100;
export const LAMP_FLICKER_PATTERN = 'mmamammmmammamamaaamammma';

// Inset from the room walls within which a lamp centre may fall. Equal to the
// pool radius so the pool fills to the walls without spilling past them.
const LAMP_PLACEMENT_MARGIN = LAMP_RADIUS;

// Decide a single room's lamp from a PRNG already positioned at this room: roll
// the spawn chance, then draw the placement. Returns the lamp's geometry fields
// (no id/roomId), or null when the chance roll declines. Shared by the batch
// generator below AND GameScene's per-cell streaming path, so both place lamps
// from the identical formula -- only how each SEEDS its PRNG differs. Lamps are
// ceiling fixtures, so this deliberately does NOT reject against maze walls or
// furniture (light shines over them; unlike a wall-mounted light switch a lamp
// inside a wall footprint is harmless -- it just lights that patch).
export function rollRoomLamp(room, rand) {
  if (rand() >= LAMP_CHANCE) return null;

  const margin = LAMP_PLACEMENT_MARGIN;
  const x = room.x + margin + rand() * (room.width - 2 * margin);
  const y = room.y + margin + rand() * (room.height - 2 * margin);
  const flicker = rand() < LAMP_FLICKER_CHANCE;
  const phase = rand() * 10000;

  return { x, y, radius: LAMP_RADIUS, flicker, phase };
}

// At most one lamp per room, from one seeded PRNG stream walked over the room
// list (skip the start room). Used for batch generation and the unit tests; the
// live game streams rooms in and calls rollRoomLamp per cell instead.
export function generateRoomLamps(rooms, seed) {
  const rand = mulberry32(seed + LAMP_SEED_OFFSET);
  const lamps = [];
  let nextId = 0;

  for (const room of rooms) {
    if (room.id === 0) continue;
    const lamp = rollRoomLamp(room, rand);
    if (!lamp) continue;
    lamps.push({ id: nextId++, roomId: room.id, ...lamp });
  }

  return lamps;
}

// Map a light-style letter to a brightness fraction: 'a' (97) -> 0, 'm' (109) -> 1.
function charBrightness(c) {
  const v = (c.charCodeAt(0) - 97) / (109 - 97);
  return Math.max(0, Math.min(1, v));
}

// The brightness multiplier for a lamp at a given time. Steady lamps are always
// full; flickering lamps step through the pattern at 10fps (offset by the lamp's
// phase so lamps desync) and lerp between letters, scaled into [floor, 1].
export function lampBrightness(lamp, timeMs) {
  if (!lamp.flicker) return 1;

  const pattern = LAMP_FLICKER_PATTERN;
  const t = (timeMs + lamp.phase) / LAMP_FLICKER_STEP_MS;
  const i = Math.floor(t);
  const frac = t - i;
  const b0 = charBrightness(pattern[i % pattern.length]);
  const b1 = charBrightness(pattern[(i + 1) % pattern.length]);
  const raw = b0 + (b1 - b0) * frac;

  return LAMP_FLICKER_FLOOR + (1 - LAMP_FLICKER_FLOOR) * raw;
}
