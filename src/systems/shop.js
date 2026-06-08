export const UPGRADES = [
  {
    id: 'battery',
    name: 'Battery Capacity',
    description: 'Longer flashlight battery life',
    maxLevel: 3,
    costs: [200, 600, 1500],
    base: 100,
    perLevel: 30,
  },
  {
    id: 'flashlight',
    name: 'Flashlight Width',
    description: 'Wider flashlight beam',
    maxLevel: 3,
    costs: [200, 600, 1500],
    base: Math.PI / 6,
    perLevel: Math.PI / 12,
  },
  {
    id: 'health',
    name: 'Max Health',
    description: 'Increased maximum health',
    maxLevel: 3,
    costs: [200, 600, 1500],
    base: 100,
    perLevel: 25,
  },
  {
    id: 'speed',
    name: 'Movement Speed',
    description: 'Faster movement',
    maxLevel: 3,
    costs: [200, 600, 1500],
    base: 200,
    perLevel: 20,
  },
  {
    id: 'weaponDamage',
    name: 'Weapon Damage',
    description: 'Increased bullet damage',
    maxLevel: 3,
    costs: [200, 600, 1500],
    base: 25,
    perLevel: 10,
  },
  {
    id: 'fireRate',
    name: 'Fire Rate',
    description: 'Faster firing speed',
    maxLevel: 3,
    costs: [200, 600, 1500],
    base: 200,
    perLevel: -30,
  },
  {
    id: 'bulletRange',
    name: 'Bullet Range',
    description: 'Increased bullet range',
    maxLevel: 3,
    costs: [200, 600, 1500],
    base: 600,
    perLevel: 100,
  },
  {
    id: 'backpack',
    name: 'Backpack Size',
    description: 'Carry more items per run',
    maxLevel: 3,
    costs: [200, 600, 1500],
    base: 8,
    perLevel: 4,
  },
  {
    id: 'startingPistol',
    name: 'Starting Pistol',
    description: 'Start each run with a pistol',
    maxLevel: 1,
    costs: [1000],
    base: 0,
    perLevel: 1,
  },
  {
    id: 'minimap',
    name: 'Minimap',
    description: 'Reveals explored rooms on a map',
    maxLevel: 1,
    costs: [3000],
    base: 0,
    perLevel: 1,
  },
];

export function createShopState() {
  const upgrades = {};
  for (const upgrade of UPGRADES) {
    upgrades[upgrade.id] = 0;
  }
  return { gold: 0, upgrades };
}

export function addGold(state, amount) {
  return { ...state, gold: state.gold + amount };
}

export function getUpgradeCost(upgradeId, currentLevel) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (currentLevel >= upgrade.maxLevel) return null;
  return upgrade.costs[currentLevel];
}

export function getUpgradeValue(upgradeId, level) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  return upgrade.base + upgrade.perLevel * level;
}

export function canPurchase(state, upgradeId) {
  const level = state.upgrades[upgradeId];
  const cost = getUpgradeCost(upgradeId, level);
  if (cost === null) return false;
  return state.gold >= cost;
}

export function purchaseUpgrade(state, upgradeId) {
  if (!canPurchase(state, upgradeId)) return state;
  const level = state.upgrades[upgradeId];
  const cost = getUpgradeCost(upgradeId, level);
  return {
    ...state,
    gold: state.gold - cost,
    upgrades: { ...state.upgrades, [upgradeId]: level + 1 },
  };
}
