import { describe, it, expect } from 'vitest';
import {
  createShopState,
  addGold,
  canPurchase,
  purchaseUpgrade,
  getUpgradeValue,
  getUpgradeCost,
  UPGRADES,
} from '../shop.js';

describe('createShopState', () => {
  it('starts with zero gold and all upgrades at level 0', () => {
    const state = createShopState();
    expect(state.gold).toBe(0);
    for (const upgrade of UPGRADES) {
      expect(state.upgrades[upgrade.id]).toBe(0);
    }
  });
});

describe('addGold', () => {
  it('increases gold balance by the given amount', () => {
    const state = createShopState();
    const result = addGold(state, 500);
    expect(result.gold).toBe(500);
  });

  it('accumulates gold across multiple additions', () => {
    const state = createShopState();
    const first = addGold(state, 200);
    const second = addGold(first, 300);
    expect(second.gold).toBe(500);
  });
});

describe('canPurchase', () => {
  it('returns true when player has enough gold and upgrade is not maxed', () => {
    const state = addGold(createShopState(), 500);
    expect(canPurchase(state, 'battery')).toBe(true);
  });

  it('returns true when gold exactly equals cost', () => {
    const cost = getUpgradeCost('battery', 0);
    const state = addGold(createShopState(), cost);
    expect(canPurchase(state, 'battery')).toBe(true);
    const result = purchaseUpgrade(state, 'battery');
    expect(result.gold).toBe(0);
    expect(result.upgrades.battery).toBe(1);
  });

  it('returns false when player cannot afford the upgrade', () => {
    const state = addGold(createShopState(), 10);
    expect(canPurchase(state, 'battery')).toBe(false);
  });

  it('returns false when upgrade is at max level', () => {
    let state = addGold(createShopState(), 99999);
    const upgrade = UPGRADES.find(u => u.id === 'battery');
    for (let i = 0; i < upgrade.maxLevel; i++) {
      state = purchaseUpgrade(state, 'battery');
    }
    expect(canPurchase(state, 'battery')).toBe(false);
  });
});

describe('purchaseUpgrade', () => {
  it('deducts gold and increments upgrade level', () => {
    const state = addGold(createShopState(), 500);
    const cost = getUpgradeCost('battery', 0);
    const result = purchaseUpgrade(state, 'battery');
    expect(result.gold).toBe(500 - cost);
    expect(result.upgrades.battery).toBe(1);
  });

  it('returns unchanged state when purchase is invalid', () => {
    const state = addGold(createShopState(), 1);
    const result = purchaseUpgrade(state, 'battery');
    expect(result.gold).toBe(state.gold);
    expect(result.upgrades.battery).toBe(0);
  });

  it('allows purchasing successive levels at increasing cost', () => {
    let state = addGold(createShopState(), 99999);
    const cost0 = getUpgradeCost('battery', 0);
    state = purchaseUpgrade(state, 'battery');
    const cost1 = getUpgradeCost('battery', 1);
    expect(cost1).toBeGreaterThan(cost0);
    const goldBefore = state.gold;
    state = purchaseUpgrade(state, 'battery');
    expect(state.gold).toBe(goldBefore - cost1);
    expect(state.upgrades.battery).toBe(2);
  });
});

describe('getUpgradeValue', () => {
  it('returns base value at level 0', () => {
    const upgrade = UPGRADES.find(u => u.id === 'battery');
    expect(getUpgradeValue('battery', 0)).toBe(upgrade.base);
  });

  it('returns increased value at higher levels', () => {
    const val0 = getUpgradeValue('battery', 0);
    const val1 = getUpgradeValue('battery', 1);
    const val2 = getUpgradeValue('battery', 2);
    expect(val1).toBeGreaterThan(val0);
    expect(val2).toBeGreaterThan(val1);
  });

  it('returns different values at higher levels for all upgrade types', () => {
    for (const upgrade of UPGRADES) {
      const val0 = getUpgradeValue(upgrade.id, 0);
      const val1 = getUpgradeValue(upgrade.id, 1);
      expect(val1).not.toBe(val0);
    }
  });
});

describe('getUpgradeCost', () => {
  it('returns cost for the next level', () => {
    const upgrade = UPGRADES.find(u => u.id === 'battery');
    expect(getUpgradeCost('battery', 0)).toBe(upgrade.costs[0]);
    expect(getUpgradeCost('battery', 1)).toBe(upgrade.costs[1]);
  });

  it('returns null when upgrade is at max level', () => {
    const upgrade = UPGRADES.find(u => u.id === 'battery');
    expect(getUpgradeCost('battery', upgrade.maxLevel)).toBeNull();
  });

  it('costs increase with each level', () => {
    for (const upgrade of UPGRADES) {
      for (let i = 1; i < upgrade.costs.length; i++) {
        expect(upgrade.costs[i]).toBeGreaterThan(upgrade.costs[i - 1]);
      }
    }
  });
});

describe('UPGRADES', () => {
  it('all upgrade types can be fully purchased with enough gold', () => {
    let state = addGold(createShopState(), 999999);
    for (const upgrade of UPGRADES) {
      while (canPurchase(state, upgrade.id)) {
        state = purchaseUpgrade(state, upgrade.id);
      }
      expect(canPurchase(state, upgrade.id)).toBe(false);
    }
  });

});

describe('weapon damage upgrade', () => {
  it('returns 25 base damage at level 0', () => {
    expect(getUpgradeValue('weaponDamage', 0)).toBe(25);
  });

  it('returns 55 damage at max level 3', () => {
    expect(getUpgradeValue('weaponDamage', 3)).toBe(55);
  });

  it('can be purchased and used', () => {
    let state = addGold(createShopState(), 500);
    expect(canPurchase(state, 'weaponDamage')).toBe(true);
    state = purchaseUpgrade(state, 'weaponDamage');
    expect(state.upgrades.weaponDamage).toBe(1);
  });
});

describe('fire rate upgrade', () => {
  it('returns 200ms base cooldown at level 0', () => {
    expect(getUpgradeValue('fireRate', 0)).toBe(200);
  });

  it('returns 110ms cooldown at max level 3', () => {
    expect(getUpgradeValue('fireRate', 3)).toBe(110);
  });

  it('each level reduces cooldown', () => {
    const val0 = getUpgradeValue('fireRate', 0);
    const val1 = getUpgradeValue('fireRate', 1);
    const val2 = getUpgradeValue('fireRate', 2);
    const val3 = getUpgradeValue('fireRate', 3);
    expect(val1).toBeLessThan(val0);
    expect(val2).toBeLessThan(val1);
    expect(val3).toBeLessThan(val2);
  });
});

describe('bullet range upgrade', () => {
  it('returns 600 base range at level 0', () => {
    expect(getUpgradeValue('bulletRange', 0)).toBe(600);
  });

  it('returns 900 range at max level 3', () => {
    expect(getUpgradeValue('bulletRange', 3)).toBe(900);
  });
});

describe('backpack upgrade', () => {
  it('returns base capacity of 8 at level 0', () => {
    expect(getUpgradeValue('backpack', 0)).toBe(8);
  });

  it('returns capacity of 12 at level 1', () => {
    expect(getUpgradeValue('backpack', 1)).toBe(12);
  });

  it('returns capacity of 20 at max level 3', () => {
    expect(getUpgradeValue('backpack', 3)).toBe(20);
  });
});

describe('starting pistol upgrade', () => {
  it('can be purchased with 500 gold', () => {
    let state = addGold(createShopState(), 500);
    expect(canPurchase(state, 'startingPistol')).toBe(true);
    state = purchaseUpgrade(state, 'startingPistol');
    expect(state.upgrades.startingPistol).toBe(1);
    expect(state.gold).toBe(0);
  });

  it('cannot be purchased twice', () => {
    let state = addGold(createShopState(), 9999);
    state = purchaseUpgrade(state, 'startingPistol');
    expect(canPurchase(state, 'startingPistol')).toBe(false);
  });
});

describe('minimap upgrade', () => {
  it('is included in default shop state at level 0', () => {
    const state = createShopState();
    expect(state.upgrades.minimap).toBe(0);
  });

  it('cannot be purchased with insufficient gold', () => {
    const state = addGold(createShopState(), 1499);
    expect(canPurchase(state, 'minimap')).toBe(false);
  });

  it('can be purchased with exactly 1500 gold', () => {
    let state = addGold(createShopState(), 1500);
    expect(canPurchase(state, 'minimap')).toBe(true);
    state = purchaseUpgrade(state, 'minimap');
    expect(state.upgrades.minimap).toBe(1);
    expect(state.gold).toBe(0);
  });

  it('cannot be purchased twice (single tier)', () => {
    let state = addGold(createShopState(), 9999);
    state = purchaseUpgrade(state, 'minimap');
    expect(canPurchase(state, 'minimap')).toBe(false);
  });

  it('returns 0 at level 0 and 1 at level 1 via getUpgradeValue', () => {
    expect(getUpgradeValue('minimap', 0)).toBe(0);
    expect(getUpgradeValue('minimap', 1)).toBe(1);
  });
});

