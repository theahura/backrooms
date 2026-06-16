import { hashU32 } from './worldgen.js';

// Per-cell record of player-caused changes that must survive day-to-day, keyed by
// the stable cellKey ("floor:gx,gy"). Items/treasure/ammo/health a player takes
// stay gone; killed enemies leave a (capped) pile of bodies; light switches keep
// the state the player left them in; ceiling lamps remember whether they are lit.
// Enemy SPAWNS are deliberately NOT stored here -- they re-roll each day off a
// day-mixed seed so a cleared room is never permanently safe.

// Most bodies a single room remembers (and re-draws) before the oldest are
// dropped, so corpses cannot pile up without bound across many days of fighting.
export const CORPSE_CAP = 15;

// Between two days, every known light independently re-rolls: a lit light has this
// chance to go dark, a dark light this chance to come back on (symmetric drift).
export const LIGHT_OFF_CHANCE = 0.2;
export const LIGHT_ON_CHANCE = 0.2;

// Salt that mixes the day number into a room's enemy spawn seed, kept distinct
// from the salts worldgen.js uses for doors/stairs/content (0-5).
const SPAWN_DAY_SALT = 7;

export function createRoomState() {
  return { lastDayProcessed: -1, cells: {} };
}

function ensureCell(state, cellKey) {
  let cell = state.cells[cellKey];
  if (!cell) {
    cell = {};
    state.cells[cellKey] = cell;
  }
  return cell;
}

// --- Items: consumed-forever ------------------------------------------------

export function isItemConsumed(state, cellKey, index) {
  const cell = state.cells[cellKey];
  return !!cell && Array.isArray(cell.items) && cell.items.includes(index);
}

export function markItemConsumed(state, cellKey, index) {
  const cell = ensureCell(state, cellKey);
  if (!cell.items) cell.items = [];
  if (!cell.items.includes(index)) cell.items.push(index);
  return state;
}

// --- Corpses: persistent decoration, FIFO-capped ----------------------------

export function addCorpse(state, cellKey, corpse, cap = CORPSE_CAP) {
  const cell = ensureCell(state, cellKey);
  if (!cell.corpses) cell.corpses = [];
  cell.corpses.push(corpse);
  if (cell.corpses.length > cap) {
    cell.corpses = cell.corpses.slice(cell.corpses.length - cap);
  }
  return state;
}

export function getCorpses(state, cellKey) {
  const cell = state.cells[cellKey];
  return cell && cell.corpses ? cell.corpses : [];
}

// --- Lights: persistent on/off, flipped between days ------------------------

// Switches start dark; the player turns them on. Only start tracking once a cell
// is known to actually have a switch, so flipLights leaves unknown cells alone.
export function trackSwitch(state, cellKey) {
  const cell = ensureCell(state, cellKey);
  if (cell.switchOn === undefined) cell.switchOn = false;
  return state;
}

export function setSwitchOn(state, cellKey, isOn) {
  ensureCell(state, cellKey).switchOn = !!isOn;
  return state;
}

export function isSwitchOn(state, cellKey) {
  const cell = state.cells[cellKey];
  return !!cell && cell.switchOn === true;
}

// Ceiling lamps start lit.
export function trackLamp(state, cellKey) {
  const cell = ensureCell(state, cellKey);
  if (cell.lampOn === undefined) cell.lampOn = true;
  return state;
}

export function isLampOn(state, cellKey) {
  const cell = state.cells[cellKey];
  return !cell || cell.lampOn !== false;
}

// One re-roll per day across every known light. A lit light may go dark; a dark
// light may return. rng is a seeded PRNG; the mutated state is then persisted, so
// the flip happens exactly once per advancing day rather than being re-derived.
export function flipLights(state, rng, offChance = LIGHT_OFF_CHANCE, onChance = LIGHT_ON_CHANCE) {
  const flip = (on) => (on ? !(rng() < offChance) : rng() < onChance);
  for (const cellKey of Object.keys(state.cells)) {
    const cell = state.cells[cellKey];
    if (cell.lampOn !== undefined) cell.lampOn = flip(cell.lampOn);
    if (cell.switchOn !== undefined) cell.switchOn = flip(cell.switchOn);
  }
  return state;
}

// --- Enemy spawns: day-varying seed -----------------------------------------

// Mix the day number into a room's content seed so enemy placement/count/type
// vary day-to-day while everything else keyed on the room seed stays stable.
export function daySpawnSeed(roomSeed, day) {
  return hashU32(roomSeed, day, 0, SPAWN_DAY_SALT);
}
