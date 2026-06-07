export const PLAYER_MAX_HP = 100;
export const ENEMY_CONTACT_DAMAGE = 20;
export const DAMAGE_COOLDOWN_MS = 1000;
export const ENEMY_MAX_HP = 50;
export const BULLET_DAMAGE = 25;

export function createCombatState(maxHp = PLAYER_MAX_HP) {
  return {
    hp: maxHp,
    maxHp,
    damageCooldown: 0,
    isDead: false,
  };
}

export function applyDamage(state, amount) {
  if (state.isDead || state.damageCooldown > 0) return state;
  const newHp = Math.max(0, state.hp - amount);
  return {
    ...state,
    hp: newHp,
    damageCooldown: DAMAGE_COOLDOWN_MS,
    isDead: newHp <= 0,
  };
}

export function updateCombat(state, delta) {
  if (state.damageCooldown <= 0) return state;
  return {
    ...state,
    damageCooldown: Math.max(0, state.damageCooldown - delta),
  };
}

export function getHealthFraction(state) {
  return state.hp / state.maxHp;
}

export function isInvulnerable(state) {
  return state.damageCooldown > 0;
}

export function applyEnemyDamage(health, damage) {
  return Math.max(0, health - damage);
}

export function isEnemyDead(health) {
  return health <= 0;
}
