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
    id: 'startingShotgun',
    name: 'Starting Shotgun',
    description: 'Start each run with a shotgun',
    maxLevel: 1,
    costs: [1500],
    base: 0,
    perLevel: 1,
  },
  {
    id: 'startingRifle',
    name: 'Starting Rifle',
    description: 'Start each run with a rifle',
    maxLevel: 1,
    costs: [2000],
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
  {
    id: 'rechargeBattery',
    name: 'Rechargeable Battery',
    description: 'Battery slowly recharges while the flashlight is off',
    maxLevel: 1,
    costs: [2500],
    base: 0,
    perLevel: 1,
  },
];

// Per-run consumables bought in the shop and applied at the start of the next
// run (then cleared): a single ammo refill for every carried gun, and a stack
// of spare batteries. Priced cheap relative to the permanent upgrades.
export const AMMO_COST = 50;
export const BATTERY_COST = 75;

const STARTING_GUN_UPGRADES = ['startingPistol', 'startingShotgun', 'startingRifle'];

function defaultConsumables() {
  return { ammo: false, batteries: 0 };
}

export function createShopState() {
  const upgrades = {};
  for (const upgrade of UPGRADES) {
    upgrades[upgrade.id] = 0;
  }
  return { gold: 0, upgrades, consumables: defaultConsumables() };
}

// Backfill any upgrade ids and the consumables block absent from an older save,
// so newly-added shop content is usable without a save migration.
export function normalizeShopState(state) {
  const defaults = createShopState();
  const consumables = state.consumables || {};
  return {
    ...state,
    gold: state.gold ?? 0,
    upgrades: { ...defaults.upgrades, ...(state.upgrades || {}) },
    consumables: {
      ammo: consumables.ammo ?? false,
      batteries: consumables.batteries ?? 0,
    },
  };
}

function ownsStartingGun(state) {
  return STARTING_GUN_UPGRADES.some((id) => (state.upgrades[id] || 0) > 0);
}

function batteryCap(state) {
  return getUpgradeValue('backpack', state.upgrades.backpack || 0);
}

export function canBuyAmmo(state) {
  if (state.consumables.ammo) return false;
  if (!ownsStartingGun(state)) return false;
  return state.gold >= AMMO_COST;
}

export function buyAmmo(state) {
  if (!canBuyAmmo(state)) return state;
  return {
    ...state,
    gold: state.gold - AMMO_COST,
    consumables: { ...state.consumables, ammo: true },
  };
}

export function canBuyBattery(state) {
  if (state.consumables.batteries >= batteryCap(state)) return false;
  return state.gold >= BATTERY_COST;
}

export function buyBattery(state) {
  if (!canBuyBattery(state)) return state;
  return {
    ...state,
    gold: state.gold - BATTERY_COST,
    consumables: { ...state.consumables, batteries: state.consumables.batteries + 1 },
  };
}

export function clearConsumables(state) {
  return { ...state, consumables: defaultConsumables() };
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
