import { ITEM_TYPES } from './items.js';

export const DROP_CHANCES = {
  basic: 0.30,
  crawler: 0.45,
  spitter: 0.55,
};

export const ENEMY_DISTANCE_BONUS = {
  basic: 0,
  crawler: 1,
  spitter: 2,
};

const LOOT_TYPES = ITEM_TYPES.filter(t => t.type !== 'medkit');

function weightForDistance(itemType, distance) {
  return Math.max(0, itemType.weight.base + itemType.weight.perRoom * distance);
}

function pickLootType(rand, distance) {
  const totalWeight = LOOT_TYPES.reduce((sum, t) => sum + weightForDistance(t, distance), 0);
  if (totalWeight <= 0) return LOOT_TYPES[0];
  const roll = rand() * totalWeight;
  let cumulative = 0;
  for (const itemType of LOOT_TYPES) {
    cumulative += weightForDistance(itemType, distance);
    if (roll < cumulative) return itemType;
  }
  return LOOT_TYPES[LOOT_TYPES.length - 1];
}

export function getDropChance(enemyType) {
  return DROP_CHANCES[enemyType] ?? DROP_CHANCES.basic;
}

export function getDistanceBonus(enemyType) {
  return ENEMY_DISTANCE_BONUS[enemyType] ?? 0;
}

export function rollEnemyDrop(enemyType, distance, rand) {
  if (rand() >= getDropChance(enemyType)) return null;
  const effectiveDistance = distance + getDistanceBonus(enemyType);
  const itemType = pickLootType(rand, effectiveDistance);
  return { type: itemType.type, value: itemType.value };
}
