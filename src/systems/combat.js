export const PLAYER_MAX_HP = 100;
export const ENEMY_CONTACT_DAMAGE = 20;
export const DAMAGE_COOLDOWN_MS = 1000;
export const ENEMY_MAX_HP = 50;
export const BULLET_DAMAGE = 25;

export const CRAWLER_MAX_HP = 30;
export const SPITTER_MAX_HP = 40;
export const CRAWLER_CONTACT_DAMAGE = 15;
export const SPITTER_CONTACT_DAMAGE = 10;
export const SPITTER_PROJECTILE_DAMAGE = 15;

export const CORPSE_TINT = 0x666666;
export const CORPSE_ALPHA = 0.6;
export const CORPSE_ANGLE = 90;
export const CORPSE_DEPTH = 5;

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
