import { describe, it, expect } from 'vitest';
import {
  createCombatState,
  applyDamage,
  updateCombat,
  getHealthFraction,
  isInvulnerable,
  applyEnemyDamage,
  isEnemyDead,
} from '../combat.js';

describe('createCombatState', () => {
  it('starts with full health and alive', () => {
    const state = createCombatState();
    expect(getHealthFraction(state)).toBe(1);
    expect(state.isDead).toBe(false);
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
