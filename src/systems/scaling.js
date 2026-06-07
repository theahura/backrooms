export function getEnemyHP(baseHP, runCount) {
  return Math.min(Math.round(baseHP * (1 + 0.25 * runCount)), baseHP * 3);
}

export function getEnemyCount(runCount) {
  return Math.min(Math.floor(runCount / 2), 3);
}

export function getEnemyChaseSpeed(baseSpeed, runCount) {
  return baseSpeed * (1 + 0.05 * Math.min(runCount, 6));
}

export function getEnemyDamage(baseDamage, runCount) {
  return baseDamage + 5 * Math.min(runCount, 4);
}
