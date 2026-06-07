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

  it('returns increasing values for all upgrade types', () => {
    for (const upgrade of UPGRADES) {
      const val0 = getUpgradeValue(upgrade.id, 0);
      const val1 = getUpgradeValue(upgrade.id, 1);
      expect(val1).toBeGreaterThan(val0);
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
