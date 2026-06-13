import { describe, it, expect } from 'vitest';
import {
  createCombatState,
  applyDamage,
  applyHeal,
  updateCombat,
  getHealthFraction,
  isInvulnerable,
  applyEnemyDamage,
  isEnemyDead,
  getHurtFlash,
  MEDKIT_HEAL_AMOUNT,
} from '../combat.js';

describe('createCombatState', () => {
  it('starts with full health and alive', () => {
    const state = createCombatState();
    expect(getHealthFraction(state)).toBe(1);
    expect(state.isDead).toBe(false);
  });

  it('accepts custom max health', () => {
    const state = createCombatState(150);
    expect(getHealthFraction(state)).toBe(1);
    expect(state.isDead).toBe(false);
    const hit = applyDamage(state, 100);
    expect(getHealthFraction(hit)).toBeGreaterThan(0);
    expect(hit.isDead).toBe(false);
  });
});

describe('applyDamage', () => {
  it('reduces health fraction after taking damage', () => {
    const state = createCombatState();
    const result = applyDamage(state, 20);
    expect(getHealthFraction(result)).toBeLessThan(1);
    expect(getHealthFraction(result)).toBeGreaterThan(0);
  });

  it('does not reduce health below zero and marks dead', () => {
    const state = createCombatState();
    const result = applyDamage(state, 9999);
    expect(getHealthFraction(result)).toBe(0);
    expect(result.isDead).toBe(true);
  });

  it('does not deal damage while invulnerable', () => {
    const state = createCombatState();
    const afterHit = applyDamage(state, 20);
    const healthAfterHit = getHealthFraction(afterHit);
    const secondHit = applyDamage(afterHit, 20);
    expect(getHealthFraction(secondHit)).toBe(healthAfterHit);
  });

  it('does not deal damage when already dead', () => {
    const state = createCombatState();
    const dead = applyDamage(state, 9999);
    const result = applyDamage(dead, 20);
    expect(getHealthFraction(result)).toBe(0);
  });

  it('makes the player invulnerable after taking damage', () => {
    const state = createCombatState();
    const result = applyDamage(state, 20);
    expect(isInvulnerable(result)).toBe(true);
  });

  it('allows damage again after invulnerability expires', () => {
    const state = createCombatState();
    const firstHit = applyDamage(state, 20);
    const recovered = updateCombat(firstHit, 99999);
    expect(isInvulnerable(recovered)).toBe(false);
    const secondHit = applyDamage(recovered, 20);
    expect(getHealthFraction(secondHit)).toBeLessThan(getHealthFraction(recovered));
  });
});

describe('updateCombat', () => {
  it('invulnerability wears off after enough time', () => {
    const state = createCombatState();
    const hit = applyDamage(state, 20);
    expect(isInvulnerable(hit)).toBe(true);
    const afterTime = updateCombat(hit, 99999);
    expect(isInvulnerable(afterTime)).toBe(false);
  });

  it('player is still invulnerable partway through cooldown', () => {
    const state = createCombatState();
    const hit = applyDamage(state, 20);
    const partway = updateCombat(hit, 1);
    expect(isInvulnerable(partway)).toBe(true);
  });

  it('does nothing when player is not invulnerable', () => {
    const state = createCombatState();
    const result = updateCombat(state, 100);
    expect(isInvulnerable(result)).toBe(false);
    expect(getHealthFraction(result)).toBe(1);
  });
});

describe('applyHeal', () => {
  it('increases health fraction for a damaged player', () => {
    const state = createCombatState();
    const damaged = applyDamage(state, 40);
    const cooldownExpired = updateCombat(damaged, 99999);
    const healed = applyHeal(cooldownExpired, MEDKIT_HEAL_AMOUNT);
    expect(getHealthFraction(healed)).toBeGreaterThan(getHealthFraction(cooldownExpired));
    expect(healed.isDead).toBe(false);
  });

  it('does not heal above full health', () => {
    const state = createCombatState();
    const damaged = applyDamage(state, 10);
    const cooldownExpired = updateCombat(damaged, 99999);
    const healed = applyHeal(cooldownExpired, 9999);
    expect(getHealthFraction(healed)).toBe(1);
  });

  it('does not heal a dead player', () => {
    const state = createCombatState();
    const dead = applyDamage(state, 9999);
    const result = applyHeal(dead, MEDKIT_HEAL_AMOUNT);
    expect(getHealthFraction(result)).toBe(0);
    expect(result.isDead).toBe(true);
  });
});

describe('applyEnemyDamage', () => {
  it('reduces health by damage amount', () => {
    expect(applyEnemyDamage(50, 25)).toBe(25);
  });

  it('does not reduce below 0', () => {
    expect(applyEnemyDamage(10, 25)).toBe(0);
  });
});

describe('isEnemyDead', () => {
  it('returns true when health is 0', () => {
    expect(isEnemyDead(0)).toBe(true);
  });

  it('returns false when health is positive', () => {
    expect(isEnemyDead(25)).toBe(false);
  });
});

describe('getHurtFlash', () => {
  it('renders the player fully visible with no tint when not recently hurt', () => {
    const render = getHurtFlash(0);
    expect(render.alpha).toBe(1);
    expect(render.tint).toBeNull();
  });

  it('blinks between tinted and untinted phases while invulnerable', () => {
    let transitions = 0;
    let prev = getHurtFlash(1000).tint === null;
    for (let remaining = 950; remaining > 0; remaining -= 50) {
      const current = getHurtFlash(remaining).tint === null;
      if (current !== prev) transitions++;
      prev = current;
    }
    expect(transitions).toBeGreaterThanOrEqual(2);
  });

  it('never renders the player near-invisible during the damage cooldown', () => {
    for (let remaining = 0; remaining <= 1000; remaining += 25) {
      expect(getHurtFlash(remaining).alpha).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('flashes a visible red tint rather than an invisible white-out while hurt', () => {
    const tints = [];
    for (let remaining = 0; remaining <= 1000; remaining += 25) {
      const { tint } = getHurtFlash(remaining);
      if (tint !== null) tints.push(tint);
    }
    expect(tints.length).toBeGreaterThan(0);
    for (const tint of tints) {
      const r = (tint >> 16) & 0xff;
      const g = (tint >> 8) & 0xff;
      const b = tint & 0xff;
      // Damage reads as a red flash (red-dominant). Visibility itself is
      // guaranteed by the alpha-floor test above plus the scene applying this
      // as a multiply tint (setTint), not a flat fill that erases the sprite.
      expect(r).toBeGreaterThan(g);
      expect(r).toBeGreaterThan(b);
    }
  });
});

