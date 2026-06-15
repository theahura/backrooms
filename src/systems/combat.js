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

export const MEDKIT_HEAL_AMOUNT = 25;

export const CORPSE_TINT = 0x666666;
export const CORPSE_ALPHA = 0.6;
export const CORPSE_ANGLE = 90;
export const CORPSE_DEPTH = 5;

export const HURT_BLINK_INTERVAL_MS = 150;
export const HURT_TINT = 0xff4444;

// Render hint for the hurt player: a red blink applied as a MULTIPLY tint
// (`setTint`), never a flat fill (`setTintFill`). A multiply tint keeps the
// sprite's dark outline and detail, so the silhouette stays visible against
// any background -- both dark floors and the bright flashlight cone. A flat
// fill instead paints the whole sprite one colour and vanishes whenever that
// colour matches the background (the recurring "player disappears" bug). The
// alpha never drops below 0.85 so the blink reads as a flash, not a fade-out.
export function getHurtFlash(cooldownRemaining) {
  if (cooldownRemaining <= 0) return { alpha: 1, tint: null };
  const flash = Math.floor(cooldownRemaining / HURT_BLINK_INTERVAL_MS) % 2 === 0;
  return flash ? { alpha: 0.85, tint: HURT_TINT } : { alpha: 1, tint: null };
}

// Screen-wide red tint shown the instant the player is shot. The peak alpha is
// capped well below 1 so the tint reads as "I got hit" without ever fully
// obscuring the view -- the player stays visible through it. (The old damage
// feedback used a full-opacity camera flash that erased the whole screen,
// player included: the "being shot makes the player fully disappear" bug.)
export const DAMAGE_FLASH_PEAK_ALPHA = 0.45;
export const DAMAGE_FLASH_DURATION_MS = 200;

// The damage-tint alpha for a given amount of flash time remaining: a linear
// fade from the capped peak down to 0 over DAMAGE_FLASH_DURATION_MS. Clamped so
// it is never negative and never exceeds the peak (even if more time than the
// duration is somehow remaining).
export function getDamageFlashAlpha(remainingMs, duration = DAMAGE_FLASH_DURATION_MS, peak = DAMAGE_FLASH_PEAK_ALPHA) {
  if (remainingMs <= 0) return 0;
  const frac = Math.min(remainingMs, duration) / duration;
  return peak * frac;
}

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

export function applyHeal(state, amount) {
  if (state.isDead) return state;
  const newHp = Math.min(state.maxHp, state.hp + amount);
  return { ...state, hp: newHp };
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

// Grants a temporary invulnerability window (e.g. spawn protection after a stair
// transition) by extending the damage cooldown. Never shortens an existing
// longer cooldown, and never revives a dead player.
export function grantInvulnerability(state, ms) {
  if (state.isDead) return state;
  return { ...state, damageCooldown: Math.max(state.damageCooldown, ms) };
}

export function applyEnemyDamage(health, damage) {
  return Math.max(0, health - damage);
}

export function isEnemyDead(health) {
  return health <= 0;
}
