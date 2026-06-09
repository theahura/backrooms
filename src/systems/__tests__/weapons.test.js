import { describe, it, expect } from 'vitest';
import {
  WEAPON_TYPES,
  createWeaponState,
  switchWeapon,
  pickupWeapon,
  getActiveWeapon,
  getEffectiveStats,
  generateRoomWeapon,
} from '../weapons.js';
import { calculateShotgunSpread } from '../shooting.js';

describe('createWeaponState', () => {
  it('starts with both slots empty by default', () => {
    const state = createWeaponState();
    expect(state.slots[0]).toBe(null);
    expect(state.slots[1]).toBe(null);
    expect(state.activeSlot).toBe(0);
  });

  it('starts with pistol when startingPistol option is true', () => {
    const state = createWeaponState({ startingPistol: true });
    expect(state.slots[0].id).toBe('pistol');
    expect(state.slots[1]).toBe(null);
    expect(state.activeSlot).toBe(0);
  });

  it('starts with shotgun in slot 0 when startingShotgun option is true', () => {
    const state = createWeaponState({ startingShotgun: true });
    expect(state.slots[0].id).toBe('shotgun');
    expect(state.slots[1]).toBe(null);
  });

  it('starts with rifle in slot 0 when startingRifle option is true', () => {
    const state = createWeaponState({ startingRifle: true });
    expect(state.slots[0].id).toBe('rifle');
    expect(state.slots[1]).toBe(null);
  });

  it('fills both slots when two starting weapons are owned (pistol + shotgun)', () => {
    const state = createWeaponState({ startingPistol: true, startingShotgun: true });
    const ids = [state.slots[0].id, state.slots[1].id].sort();
    expect(ids).toEqual(['pistol', 'shotgun']);
  });

  it('fills both slots when two starting weapons are owned (pistol + rifle)', () => {
    const state = createWeaponState({ startingPistol: true, startingRifle: true });
    const ids = [state.slots[0].id, state.slots[1].id].sort();
    expect(ids).toEqual(['pistol', 'rifle']);
  });

  it('fills both slots when two starting weapons are owned (shotgun + rifle)', () => {
    const state = createWeaponState({ startingShotgun: true, startingRifle: true });
    const ids = [state.slots[0].id, state.slots[1].id].sort();
    expect(ids).toEqual(['rifle', 'shotgun']);
  });

  it('takes top 2 by priority when all three starting weapons are owned', () => {
    const state = createWeaponState({ startingPistol: true, startingShotgun: true, startingRifle: true });
    const ids = [state.slots[0].id, state.slots[1].id].sort();
    expect(ids).toEqual(['rifle', 'shotgun']);
  });

  it('puts higher-priority weapon in slot 0', () => {
    const state = createWeaponState({ startingPistol: true, startingRifle: true });
    expect(state.slots[0].id).toBe('rifle');
    expect(state.slots[1].id).toBe('pistol');
  });
});

describe('switchWeapon', () => {
  it('does not switch when only one weapon is held', () => {
    const state = createWeaponState();
    const next = switchWeapon(state);
    expect(next.activeSlot).toBe(0);
  });

  it('switches to the other slot when two weapons are held', () => {
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const state = { slots: [WEAPON_TYPES[0], shotgun], activeSlot: 0 };
    const next = switchWeapon(state);
    expect(next.activeSlot).toBe(1);
  });

  it('wraps back to slot 0 from slot 1', () => {
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const state = { slots: [WEAPON_TYPES[0], shotgun], activeSlot: 1 };
    const next = switchWeapon(state);
    expect(next.activeSlot).toBe(0);
  });
});

describe('pickupWeapon', () => {
  it('places weapon in first empty slot', () => {
    const state = createWeaponState();
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const result = pickupWeapon(state, shotgun);
    expect(result.state.slots[0].id).toBe('shotgun');
    expect(result.droppedWeapon).toBe(null);
  });

  it('places weapon in slot 1 when slot 0 is occupied', () => {
    const state = createWeaponState({ startingPistol: true });
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const result = pickupWeapon(state, shotgun);
    expect(result.state.slots[0].id).toBe('pistol');
    expect(result.state.slots[1].id).toBe('shotgun');
    expect(result.droppedWeapon).toBe(null);
  });

  it('swaps slot 1 weapon when full', () => {
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const rifle = WEAPON_TYPES.find(w => w.id === 'rifle');
    const state = { slots: [WEAPON_TYPES[0], shotgun], activeSlot: 0, ammo: [15, 6] };
    const result = pickupWeapon(state, rifle);
    expect(result.state.slots[1].id).toBe('rifle');
    expect(result.droppedWeapon.id).toBe('shotgun');
  });

  it('does not replace slot 0 when swapping', () => {
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const rifle = WEAPON_TYPES.find(w => w.id === 'rifle');
    const state = { slots: [WEAPON_TYPES[0], shotgun], activeSlot: 0, ammo: [15, 6] };
    const result = pickupWeapon(state, rifle);
    expect(result.state.slots[0].id).toBe('pistol');
  });
});

describe('getActiveWeapon', () => {
  it('returns the weapon in the active slot', () => {
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const state = { slots: [WEAPON_TYPES[0], shotgun], activeSlot: 1 };
    expect(getActiveWeapon(state).id).toBe('shotgun');
  });
});

describe('getEffectiveStats', () => {
  it('applies additive damage bonus', () => {
    const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
    const stats = getEffectiveStats(pistol, { damage: 10, fireRate: 0, range: 0 });
    expect(stats.damage).toBe(pistol.damage + 10);
  });

  it('applies fire rate reduction', () => {
    const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
    const stats = getEffectiveStats(pistol, { damage: 0, fireRate: -30, range: 0 });
    expect(stats.fireRate).toBe(pistol.fireRate - 30);
  });

  it('applies range bonus', () => {
    const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
    const stats = getEffectiveStats(pistol, { damage: 0, fireRate: 0, range: 100 });
    expect(stats.range).toBe(pistol.range + 100);
  });

  it('upgrades do not change how many bullets a shotgun fires', () => {
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const baseStats = getEffectiveStats(shotgun, { damage: 0, fireRate: 0, range: 0 });
    const upgradedStats = getEffectiveStats(shotgun, { damage: 10, fireRate: -60, range: 200 });
    expect(upgradedStats.bulletCount).toBe(baseStats.bulletCount);
    expect(upgradedStats.spreadAngle).toBe(baseStats.spreadAngle);
  });

  it('does not allow fire rate below 50ms', () => {
    const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
    const stats = getEffectiveStats(pistol, { damage: 0, fireRate: -500, range: 0 });
    expect(stats.fireRate).toBeGreaterThanOrEqual(50);
  });
});

describe('calculateShotgunSpread', () => {
  it('returns correct number of pellets', () => {
    const pellets = calculateShotgunSpread(0, 0, 100, 0, 400, 4, Math.PI / 5);
    expect(pellets).toHaveLength(4);
  });

  it('all pellets have the same speed magnitude', () => {
    const pellets = calculateShotgunSpread(0, 0, 100, 0, 400, 4, Math.PI / 5);
    for (const p of pellets) {
      const magnitude = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      expect(magnitude).toBeCloseTo(400, 1);
    }
  });

  it('pellets are symmetric around the aim direction', () => {
    const pellets = calculateShotgunSpread(0, 0, 100, 0, 400, 4, Math.PI / 5);
    const angles = pellets.map(p => Math.atan2(p.vy, p.vx));
    const avgAngle = angles.reduce((s, a) => s + a, 0) / angles.length;
    expect(avgAngle).toBeCloseTo(0, 1);
  });

  it('spread matches the specified angle', () => {
    const spreadAngle = Math.PI / 5;
    const pellets = calculateShotgunSpread(0, 0, 100, 0, 400, 4, spreadAngle);
    const angles = pellets.map(p => Math.atan2(p.vy, p.vx));
    const totalSpread = Math.max(...angles) - Math.min(...angles);
    expect(totalSpread).toBeCloseTo(spreadAngle, 2);
  });

  it('handles single pellet (no spread)', () => {
    const pellets = calculateShotgunSpread(0, 0, 100, 0, 400, 1, Math.PI / 5);
    expect(pellets).toHaveLength(1);
    expect(pellets[0].vx).toBeCloseTo(400, 1);
    expect(pellets[0].vy).toBeCloseTo(0, 1);
  });
});

describe('generateRoomWeapon', () => {
  it('returns null for room 0', () => {
    const result = generateRoomWeapon(0, 0, 800, 600, 16, 42, [], 0);
    expect(result).toBe(null);
  });

  it('returns a weapon with position inside the room for non-room-0', () => {
    const result = generateRoomWeapon(0, 0, 800, 600, 16, 42, [], 1);
    expect(result).not.toBe(null);
    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(800);
    expect(result.y).toBeGreaterThan(0);
    expect(result.y).toBeLessThan(600);
    expect(['pistol', 'shotgun', 'rifle']).toContain(result.weaponId);
  });

  it('is deterministic with same seed', () => {
    const a = generateRoomWeapon(0, 0, 800, 600, 16, 99, [], 3);
    const b = generateRoomWeapon(0, 0, 800, 600, 16, 99, [], 3);
    expect(a).toEqual(b);
  });

  it('avoids furniture positions', () => {
    const furniture = [{ x: 100, y: 100, width: 600, height: 400 }];
    const result = generateRoomWeapon(0, 0, 800, 600, 16, 42, furniture, 2);
    expect(result).not.toBe(null);
    const insideFurniture = result.x >= 100 && result.x <= 700 &&
                            result.y >= 100 && result.y <= 500;
    expect(insideFurniture).toBe(false);
  });
});

