import { describe, it, expect } from 'vitest';
import {
  WEAPON_TYPES,
  createWeaponState,
  switchWeapon,
  pickupWeapon,
  getActiveWeapon,
  hasAmmo,
  consumeAmmo,
  addAmmo,
  generateLevelWeapons,
  weaponPickupOutcome,
  refillAllAmmo,
} from '../weapons.js';

describe('createWeaponState (weaponless start)', () => {
  it('starts with both slots empty by default', () => {
    const state = createWeaponState();
    expect(state.slots[0]).toBe(null);
    expect(state.slots[1]).toBe(null);
    expect(state.activeSlot).toBe(0);
  });

  it('starts with ammo arrays at 0', () => {
    const state = createWeaponState();
    expect(state.ammo[0]).toBe(0);
    expect(state.ammo[1]).toBe(0);
  });

  it('starts with pistol when startingPistol option is true', () => {
    const state = createWeaponState({ startingPistol: true });
    expect(state.slots[0]).not.toBe(null);
    expect(state.slots[0].id).toBe('pistol');
    expect(state.ammo[0]).toBe(WEAPON_TYPES[0].startAmmo);
  });

  it('starts with shotgun ammo when startingShotgun option is true', () => {
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const state = createWeaponState({ startingShotgun: true });
    expect(state.slots[0].id).toBe('shotgun');
    expect(state.ammo[0]).toBe(shotgun.startAmmo);
  });

  it('starts with rifle ammo when startingRifle option is true', () => {
    const rifle = WEAPON_TYPES.find(w => w.id === 'rifle');
    const state = createWeaponState({ startingRifle: true });
    expect(state.slots[0].id).toBe('rifle');
    expect(state.ammo[0]).toBe(rifle.startAmmo);
  });

  it('both slots have correct starting ammo when two weapons are owned', () => {
    const rifle = WEAPON_TYPES.find(w => w.id === 'rifle');
    const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
    const state = createWeaponState({ startingPistol: true, startingRifle: true });
    expect(state.slots[0].id).toBe('rifle');
    expect(state.ammo[0]).toBe(rifle.startAmmo);
    expect(state.slots[1].id).toBe('pistol');
    expect(state.ammo[1]).toBe(pistol.startAmmo);
  });
});

describe('getActiveWeapon (unarmed)', () => {
  it('returns null when no weapon equipped', () => {
    const state = createWeaponState();
    expect(getActiveWeapon(state)).toBe(null);
  });

  it('returns weapon when equipped', () => {
    const state = createWeaponState({ startingPistol: true });
    expect(getActiveWeapon(state).id).toBe('pistol');
  });
});

describe('hasAmmo', () => {
  it('returns false when no weapon equipped', () => {
    const state = createWeaponState();
    expect(hasAmmo(state)).toBe(false);
  });

  it('returns true when active weapon has ammo > 0', () => {
    const state = createWeaponState({ startingPistol: true });
    expect(hasAmmo(state)).toBe(true);
  });

  it('returns false when active weapon has ammo === 0', () => {
    const state = createWeaponState({ startingPistol: true });
    const emptyState = { ...state, ammo: [0, 0] };
    expect(hasAmmo(emptyState)).toBe(false);
  });
});

describe('consumeAmmo', () => {
  it('decrements active weapon ammo by 1', () => {
    const state = createWeaponState({ startingPistol: true });
    const initial = state.ammo[0];
    const next = consumeAmmo(state);
    expect(next.ammo[0]).toBe(initial - 1);
  });

  it('does not go below 0', () => {
    const state = createWeaponState({ startingPistol: true });
    const emptyState = { ...state, ammo: [0, 0] };
    const next = consumeAmmo(emptyState);
    expect(next.ammo[0]).toBe(0);
  });

  it('consumes 1 ammo for shotgun regardless of pellet count', () => {
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const state = {
      slots: [shotgun, null],
      activeSlot: 0,
      ammo: [6, 0],
    };
    const next = consumeAmmo(state);
    expect(next.ammo[0]).toBe(5);
  });

  it('returns state unchanged when unarmed', () => {
    const state = createWeaponState();
    const next = consumeAmmo(state);
    expect(next).toEqual(state);
  });
});

describe('addAmmo', () => {
  it('increases active weapon ammo', () => {
    const state = createWeaponState({ startingPistol: true });
    const depleted = { ...state, ammo: [5, 0] };
    const next = addAmmo(depleted, 10);
    expect(next.ammo[0]).toBe(15);
  });

  it('caps at weapon maxAmmo', () => {
    const state = createWeaponState({ startingPistol: true });
    const pistolMax = WEAPON_TYPES[0].maxAmmo;
    const next = addAmmo(state, 999);
    expect(next.ammo[0]).toBe(pistolMax);
  });

  it('returns state unchanged when unarmed', () => {
    const state = createWeaponState();
    const next = addAmmo(state, 10);
    expect(next).toEqual(state);
  });
});

describe('pickupWeapon (fills first empty slot)', () => {
  it('fills slot 0 first when both slots empty', () => {
    const state = createWeaponState();
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const result = pickupWeapon(state, shotgun);
    expect(result.state.slots[0].id).toBe('shotgun');
    expect(result.droppedWeapon).toBe(null);
  });

  it('fills slot 1 when slot 0 is occupied', () => {
    const state = createWeaponState({ startingPistol: true });
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const result = pickupWeapon(state, shotgun);
    expect(result.state.slots[0].id).toBe('pistol');
    expect(result.state.slots[1].id).toBe('shotgun');
    expect(result.droppedWeapon).toBe(null);
  });

  it('weapon comes with starting ammo', () => {
    const state = createWeaponState();
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const result = pickupWeapon(state, shotgun);
    expect(result.state.ammo[0]).toBe(shotgun.startAmmo);
  });

  it('swaps slot 1 when both slots full', () => {
    const pistol = WEAPON_TYPES[0];
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const rifle = WEAPON_TYPES.find(w => w.id === 'rifle');
    const state = {
      slots: [pistol, shotgun],
      activeSlot: 0,
      ammo: [15, 6],
    };
    const result = pickupWeapon(state, rifle);
    expect(result.state.slots[1].id).toBe('rifle');
    expect(result.droppedWeapon.id).toBe('shotgun');
    expect(result.droppedWeapon.ammo).toBe(6);
  });

  it('uses initialAmmo override instead of startAmmo when provided', () => {
    const state = createWeaponState();
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const result = pickupWeapon(state, shotgun, 18);
    expect(result.state.ammo[0]).toBe(18);
  });

  it('uses startAmmo when initialAmmo is undefined', () => {
    const state = createWeaponState();
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const result = pickupWeapon(state, shotgun);
    expect(result.state.ammo[0]).toBe(shotgun.startAmmo);
  });
});

describe('switchWeapon (unarmed guards)', () => {
  it('no-ops when both slots null', () => {
    const state = createWeaponState();
    const next = switchWeapon(state);
    expect(next.activeSlot).toBe(0);
  });

  it('no-ops when only one slot filled', () => {
    const state = createWeaponState();
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const oneWeapon = { ...state, slots: [shotgun, null], ammo: [6, 0] };
    const next = switchWeapon(oneWeapon);
    expect(next.activeSlot).toBe(0);
  });

  it('switches when both slots filled', () => {
    const pistol = WEAPON_TYPES[0];
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const state = { slots: [pistol, shotgun], activeSlot: 0, ammo: [15, 6] };
    const next = switchWeapon(state);
    expect(next.activeSlot).toBe(1);
  });
});

describe('generateLevelWeapons', () => {
  it('returns at least 1 weapon per floor', () => {
    const rooms = [
      { id: 0, x: 0, y: 0, width: 800, height: 600, floor: 0 },
      { id: 1, x: 900, y: 0, width: 800, height: 600, floor: 0 },
      { id: 2, x: 1800, y: 0, width: 800, height: 600, floor: 0 },
      { id: 3, x: 0, y: 10000, width: 800, height: 600, floor: 1 },
      { id: 4, x: 900, y: 10000, width: 800, height: 600, floor: 1 },
    ];
    const furnitureByRoom = new Map(rooms.map(r => [r.id, []]));
    const results = generateLevelWeapons(rooms, 42, furnitureByRoom);
    const floor0Weapons = results.filter(w => rooms.find(r => r.id === w.roomId).floor === 0);
    const floor1Weapons = results.filter(w => rooms.find(r => r.id === w.roomId).floor === 1);
    expect(floor0Weapons.length).toBeGreaterThanOrEqual(1);
    expect(floor1Weapons.length).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic with same seed', () => {
    const rooms = [
      { id: 0, x: 0, y: 0, width: 800, height: 600, floor: 0 },
      { id: 1, x: 900, y: 0, width: 800, height: 600, floor: 0 },
      { id: 3, x: 0, y: 10000, width: 800, height: 600, floor: 1 },
    ];
    const furnitureByRoom = new Map(rooms.map(r => [r.id, []]));
    const a = generateLevelWeapons(rooms, 99, furnitureByRoom);
    const b = generateLevelWeapons(rooms, 99, furnitureByRoom);
    expect(a).toEqual(b);
  });

  it('does not place weapons in room 0', () => {
    const rooms = [
      { id: 0, x: 0, y: 0, width: 800, height: 600, floor: 0 },
      { id: 1, x: 900, y: 0, width: 800, height: 600, floor: 0 },
      { id: 2, x: 0, y: 10000, width: 800, height: 600, floor: 1 },
    ];
    const furnitureByRoom = new Map(rooms.map(r => [r.id, []]));
    const results = generateLevelWeapons(rooms, 42, furnitureByRoom);
    expect(results.every(w => w.roomId !== 0)).toBe(true);
  });

  it('includes all weapon types as possible drops', () => {
    const rooms = [
      { id: 0, x: 0, y: 0, width: 800, height: 600, floor: 0 },
      { id: 1, x: 900, y: 0, width: 800, height: 600, floor: 0 },
      { id: 2, x: 0, y: 10000, width: 800, height: 600, floor: 1 },
    ];
    const furnitureByRoom = new Map(rooms.map(r => [r.id, []]));
    const allWeaponIds = new Set();
    for (let seed = 0; seed < 100; seed++) {
      const results = generateLevelWeapons(rooms, seed, furnitureByRoom);
      results.forEach(w => allWeaponIds.add(w.weaponId));
    }
    expect(allWeaponIds.has('pistol')).toBe(true);
    expect(allWeaponIds.has('shotgun')).toBe(true);
    expect(allWeaponIds.has('rifle')).toBe(true);
  });
});

describe('weaponPickupOutcome', () => {
  const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
  const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
  const rifle = WEAPON_TYPES.find(w => w.id === 'rifle');

  it('returns "equip" when an empty slot is open and the weapon is not owned', () => {
    const state = createWeaponState({ startingPistol: true });
    expect(weaponPickupOutcome(state, shotgun)).toBe('equip');
  });

  it('returns "ammo" when the weapon is already owned and below max ammo', () => {
    const state = createWeaponState({ startingPistol: true });
    expect(weaponPickupOutcome(state, pistol)).toBe('ammo');
  });

  it('returns "full" when the weapon is owned and already at max ammo', () => {
    const state = createWeaponState({ startingPistol: true });
    const maxed = { ...state, ammo: [pistol.maxAmmo, 0] };
    expect(weaponPickupOutcome(maxed, pistol)).toBe('full');
  });

  it('returns "swap" when both slots are full of different weapons', () => {
    const state = { slots: [pistol, shotgun], activeSlot: 0, ammo: [15, 6] };
    expect(weaponPickupOutcome(state, rifle)).toBe('swap');
  });

  it('returns "ammo" for an owned duplicate even when both slots are full', () => {
    const state = { slots: [pistol, shotgun], activeSlot: 0, ammo: [5, 6] };
    expect(weaponPickupOutcome(state, pistol)).toBe('ammo');
  });

  it('returns "full" for an owned maxed duplicate even when both slots are full', () => {
    const state = { slots: [pistol, shotgun], activeSlot: 0, ammo: [pistol.maxAmmo, 6] };
    expect(weaponPickupOutcome(state, pistol)).toBe('full');
  });
});

describe('pickupWeapon (duplicate weapon becomes ammo)', () => {
  const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
  const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');

  it('adds a magazine to the owned slot instead of taking a second slot', () => {
    const state = { slots: [pistol, null], activeSlot: 0, ammo: [5, 0] };
    const result = pickupWeapon(state, pistol);
    expect(result.state.slots[1]).toBe(null);
    expect(result.state.ammo[0]).toBe(5 + pistol.startAmmo);
    expect(result.droppedWeapon).toBe(null);
    expect(result.addedAmmo).toBe(true);
  });

  it('caps the duplicate ammo at maxAmmo', () => {
    const state = { slots: [pistol, null], activeSlot: 0, ammo: [pistol.maxAmmo - 2, 0] };
    const result = pickupWeapon(state, pistol);
    expect(result.state.ammo[0]).toBe(pistol.maxAmmo);
  });

  it('tops up the slot holding the duplicate, not the active slot', () => {
    const state = { slots: [shotgun, pistol], activeSlot: 0, ammo: [6, 5] };
    const result = pickupWeapon(state, pistol);
    expect(result.state.ammo[1]).toBe(5 + pistol.startAmmo);
    expect(result.state.ammo[0]).toBe(6);
  });

  it('uses the carried ammo override when a duplicate drop is grabbed', () => {
    const state = { slots: [pistol, null], activeSlot: 0, ammo: [5, 0] };
    const result = pickupWeapon(state, pistol, 10);
    expect(result.state.ammo[0]).toBe(15);
  });
});

describe('refillAllAmmo', () => {
  const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
  const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');

  it('refills every equipped weapon to its max ammo', () => {
    const state = { slots: [pistol, shotgun], activeSlot: 0, ammo: [1, 1] };
    const next = refillAllAmmo(state);
    expect(next.ammo[0]).toBe(pistol.maxAmmo);
    expect(next.ammo[1]).toBe(shotgun.maxAmmo);
  });

  it('leaves an empty slot at zero', () => {
    const state = { slots: [pistol, null], activeSlot: 0, ammo: [1, 0] };
    const next = refillAllAmmo(state);
    expect(next.ammo[0]).toBe(pistol.maxAmmo);
    expect(next.ammo[1]).toBe(0);
  });

  it('returns an unchanged loadout when unarmed', () => {
    const state = createWeaponState();
    const next = refillAllAmmo(state);
    expect(next.ammo).toEqual([0, 0]);
  });
});
