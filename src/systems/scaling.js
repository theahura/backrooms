// Enemy difficulty scales with a room's distance from the entrance
// (room.distance = door-hop Manhattan distance + FLOOR_DEPTH per floor),
// the same axis item/loot quality already uses. Rooms within SAFE_DISTANCE
// of the entrance stay at base difficulty permanently.
export const SAFE_DISTANCE = 2;

export function getEnemyHP(baseHP, distance) {
  const depth = Math.max(0, distance - SAFE_DISTANCE);
  return Math.min(Math.round(baseHP * (1 + 0.10 * depth)), Math.round(baseHP * 2.5));
}

export function getEnemyCount(distance) {
  return Math.min(Math.max(0, Math.floor((distance - 3) / 4)), 3);
}

export function getEnemyDamage(baseDamage, distance) {
  const depth = Math.max(0, distance - SAFE_DISTANCE);
  return Math.min(baseDamage + 5 * Math.floor(depth / 4), baseDamage + 20);
}
